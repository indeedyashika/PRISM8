"""Superfluid CFA Yield Streaming MCP Server for the Hermes Agent.

Hermes uses this MCP to open, update, monitor, and freeze per-second
Continuous Flow Agreement (CFA) streams into real estate fractional token holders.
Targets Base Sepolia (fUSDCx / fDAIx).
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path
from typing import Any

import httpx

import importlib

FastMCP: Any = None
try:
    _mod = importlib.import_module("mcp.server.fastmcp")
    FastMCP = getattr(_mod, "FastMCP")
except Exception:
    try:
        _mod = importlib.import_module("mcp.server.mcpserver")
        FastMCP = getattr(_mod, "MCPServer", getattr(_mod, "Server", None))
    except Exception:
        pass

if FastMCP is None:
    class FastMCP:  # type: ignore
        def __init__(self, name: str):
            self.name = name
            self.tools: dict[str, Any] = {}
        def tool(self, name: str | None = None, description: str | None = None):
            def decorator(fn: Any):
                tname = name or getattr(fn, "__name__", "tool")
                self.tools[tname] = fn
                return fn
            return decorator
        def prompt(self):
            def decorator(fn: Any):
                return fn
            return decorator
        def run(self, *args: Any, **kwargs: Any):
            pass

BASE_URL = os.environ.get("TOKENIZATION_BASE_URL", "http://127.0.0.1:3000").rstrip("/")
AGENT_SECRET = os.environ.get("TOKENIZATION_AGENT_SECRET", "")
BASE_SEPOLIA_RPC = os.environ.get("BASE_SEPOLIA_RPC_URL", "https://sepolia.base.org")
BASE_SEPOLIA_CHAIN_ID = 84532

# Base Sepolia Superfluid CFAv1 Forwarder canonical address
CFA_FORWARDER_ADDRESS = "0xcfA132E353cB4E398080B9700609bb008eceB125"
# Test fUSDCx on Base Sepolia
DEFAULT_FUSDCX_ADDRESS = "0x42bb40bF79730451B11f6De1CbA222F17b87Afd7"
# Test fDAIx on Base Sepolia
DEFAULT_FDAIX_ADDRESS = "0x9ce2062b085a2268e8d769ffc040f6692315fd2c"

mcp = FastMCP("superfluid")


class SuperfluidError(RuntimeError):
    """Expose safe error messages to Hermes without breaking agent context."""


# Persistent stream registry
STREAMS_FILE = Path(os.environ.get("SUPERFLUID_STREAMS_FILE", Path(__file__).parent / ".active_streams.json"))


def _load_streams() -> dict[str, dict[str, Any]]:
    if STREAMS_FILE.exists():
        try:
            return json.loads(STREAMS_FILE.read_text("utf-8"))
        except Exception:
            pass
    return {}


def _save_streams(streams: dict[str, dict[str, Any]]) -> None:
    try:
        STREAMS_FILE.write_text(json.dumps(streams, indent=2), "utf-8")
    except Exception:
        pass


def validate_receiver(receiver: str) -> str:
    """Validate EVM receiver address format and non-zero."""
    if not receiver or not isinstance(receiver, str):
        raise SuperfluidError("Invalid receiver: address string required.")
    cleaned = receiver.strip()
    if not (cleaned.startswith("0x") and len(cleaned) == 42):
        raise SuperfluidError(f"Invalid receiver: '{receiver}' is not a valid 42-character hex address.")
    if cleaned.lower() == "0x0000000000000000000000000000000000000000":
        raise SuperfluidError("Invalid receiver: cannot stream to the zero address.")
    try:
        int(cleaned, 16)
    except ValueError:
        raise SuperfluidError(f"Invalid receiver: '{receiver}' contains non-hex characters.")
    return cleaned


def validate_flow_rate(flow_rate: Any, allow_zero: bool = False) -> int:
    """Validate flow rate as a positive integer."""
    try:
        fr = int(flow_rate)
    except (ValueError, TypeError):
        raise SuperfluidError(f"Invalid flow rate: '{flow_rate}' is not an integer.")
    if not allow_zero and fr <= 0:
        raise SuperfluidError(f"Invalid flow rate: '{flow_rate}' must be strictly positive.")
    if allow_zero and fr < 0:
        raise SuperfluidError(f"Invalid flow rate: '{flow_rate}' cannot be negative.")
    return fr


def calculate_deterministic_flow_rate(monthly_rent_usd: float, share_percentage: float = 10.0) -> int:
    """Deterministically calculate flow rate in wei per second (monthlyRent * share% / 2,592,000 * 1e18)."""
    if monthly_rent_usd <= 0:
        raise SuperfluidError("Monthly rent must be positive.")
    if share_percentage <= 0 or share_percentage > 100:
        raise SuperfluidError("Share percentage must be between 0 and 100.")
    monthly_investor_rent = (monthly_rent_usd * share_percentage) / 100.0
    # 1 month = 30 days = 2,592,000 seconds
    per_second_wei = (monthly_investor_rent * 1e18) / 2592000.0
    return int(per_second_wei)


def _submit_onchain_cfa_transaction(action_type: str, token_address: str, receiver: str, flow_rate: int = 0) -> dict[str, Any] | None:
    """Attempt genuine on-chain CFA stream transaction via Base Sepolia Web3 provider with confirmation receipt waiting."""
    pk = os.environ.get("SUPERFLUID_PRIVATE_KEY") or os.environ.get("EVM_OPERATOR_PRIVATE_KEY")
    if not pk:
        return None
    try:
        from web3 import Web3
        w3 = Web3(Web3.HTTPProvider(BASE_SEPOLIA_RPC))
        if not w3.is_connected():
            return None

        # Verify network
        chain_id = w3.eth.chain_id
        if chain_id != BASE_SEPOLIA_CHAIN_ID:
            raise SuperfluidError(f"Wrong network: connected to chain {chain_id}, expected Base Sepolia ({BASE_SEPOLIA_CHAIN_ID}).")

        account = w3.eth.account.from_key(pk)

        # Verify gas balance
        balance = w3.eth.get_balance(account.address)
        if balance == 0:
            raise SuperfluidError(f"Insufficient balance: operator {account.address} has 0 Base Sepolia ETH for gas.")

        cfa_address = Web3.to_checksum_address(CFA_FORWARDER_ADDRESS)
        token = Web3.to_checksum_address(token_address or DEFAULT_FUSDCX_ADDRESS)
        recip = Web3.to_checksum_address(receiver)

        cfa_abi = [
            {
                "inputs": [
                    {"name": "token", "type": "address"},
                    {"name": "sender", "type": "address"},
                    {"name": "receiver", "type": "address"},
                    {"name": "flowRate", "type": "int96"},
                    {"name": "userData", "type": "bytes"}
                ],
                "name": "createFlow",
                "outputs": [{"name": "", "type": "bool"}],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [
                    {"name": "token", "type": "address"},
                    {"name": "sender", "type": "address"},
                    {"name": "receiver", "type": "address"},
                    {"name": "flowRate", "type": "int96"},
                    {"name": "userData", "type": "bytes"}
                ],
                "name": "updateFlow",
                "outputs": [{"name": "", "type": "bool"}],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [
                    {"name": "token", "type": "address"},
                    {"name": "sender", "type": "address"},
                    {"name": "receiver", "type": "address"},
                    {"name": "userData", "type": "bytes"}
                ],
                "name": "deleteFlow",
                "outputs": [{"name": "", "type": "bool"}],
                "stateMutability": "nonpayable",
                "type": "function"
            }
        ]
        contract = w3.eth.contract(address=cfa_address, abi=cfa_abi)
        nonce = w3.eth.get_transaction_count(account.address)

        if action_type == "create":
            tx = contract.functions.createFlow(token, account.address, recip, int(flow_rate), b"").build_transaction({
                "from": account.address,
                "nonce": nonce,
                "gas": 350000,
                "maxFeePerGas": w3.to_wei(2, "gwei"),
                "maxPriorityFeePerGas": w3.to_wei(1, "gwei"),
                "chainId": BASE_SEPOLIA_CHAIN_ID,
            })
        elif action_type == "update":
            tx = contract.functions.updateFlow(token, account.address, recip, int(flow_rate), b"").build_transaction({
                "from": account.address,
                "nonce": nonce,
                "gas": 350000,
                "maxFeePerGas": w3.to_wei(2, "gwei"),
                "maxPriorityFeePerGas": w3.to_wei(1, "gwei"),
                "chainId": BASE_SEPOLIA_CHAIN_ID,
            })
        elif action_type == "delete":
            tx = contract.functions.deleteFlow(token, account.address, recip, b"").build_transaction({
                "from": account.address,
                "nonce": nonce,
                "gas": 350000,
                "maxFeePerGas": w3.to_wei(2, "gwei"),
                "maxPriorityFeePerGas": w3.to_wei(1, "gwei"),
                "chainId": BASE_SEPOLIA_CHAIN_ID,
            })
        else:
            return None

        signed_tx = w3.eth.account.sign_transaction(tx, private_key=pk)
        tx_hash_bytes = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        tx_hash = tx_hash_bytes.hex()

        # Wait for on-chain block confirmation
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=45)
        if receipt.get("status") != 1:
            raise SuperfluidError(f"Transaction reverted on Base Sepolia: {tx_hash}")

        block_number = receipt.get("blockNumber")
        basescan_url = f"https://sepolia.basescan.org/tx/{tx_hash}"

        return {
            "mode": "live",
            "txHash": tx_hash,
            "blockNumber": block_number,
            "basescanUrl": basescan_url,
            "explorerUrl": basescan_url,
        }
    except SuperfluidError:
        raise
    except Exception as exc:
        print(f"[Superfluid] On-chain transaction error: {exc}", file=sys.stderr)
        return None


@mcp.tool()
def create_yield_stream(
    token_address: str,
    receiver: str,
    flow_rate: int,
    property_id: str,
    allow_update: bool = True
) -> dict[str, Any]:
    """Open a Superfluid Constant Flow Agreement (CFA) yield stream to an investor.

    Args:
        token_address: Super Token address on Base Sepolia (e.g., fUSDCx).
        receiver: Investor's EVM wallet address.
        flow_rate: Inflow rate in wei per second (monthly rent / 2,592,000 * share).
        property_id: Unique property identifier.
        allow_update: If False, rejects duplicate active streams for the same property/receiver.
    """
    valid_receiver = validate_receiver(receiver)
    valid_flow_rate = validate_flow_rate(flow_rate, allow_zero=False)
    prop_id = str(property_id).strip()
    if not prop_id:
        raise SuperfluidError("Property ID is required.")

    token = token_address or DEFAULT_FUSDCX_ADDRESS
    stream_key = f"{prop_id}:{valid_receiver.lower()}"
    current_streams = _load_streams()

    # Check duplicate stream
    if not allow_update and stream_key in current_streams and current_streams[stream_key].get("status") == "ACTIVE":
        raise SuperfluidError(
            f"Duplicate stream: an active stream already exists for property '{prop_id}' and receiver '{valid_receiver}'."
        )

    onchain = _submit_onchain_cfa_transaction("create", token, valid_receiver, valid_flow_rate)
    is_live = onchain is not None
    tx_hash = onchain["txHash"] if is_live else f"sim_cfa_create_{prop_id}"
    basescan_url = onchain["basescanUrl"] if is_live else None
    block_number = onchain.get("blockNumber") if is_live else None

    stream_data = {
        "propertyId": prop_id,
        "token": token,
        "tokenAddress": token,
        "receiver": valid_receiver,
        "flowRate": valid_flow_rate,
        "monthlyRentEquivUsd": round(valid_flow_rate * 2592000 / 1e18, 2) if valid_flow_rate > 1e12 else round(valid_flow_rate * 2592000 / 1e6, 2),
        "startedAt": int(time.time()),
        "status": "ACTIVE",
        "txHash": tx_hash,
        "blockNumber": block_number,
        "mode": "live" if is_live else "simulated",
    }
    current_streams[stream_key] = stream_data
    _save_streams(current_streams)

    # Synchronize with platform SQLite database
    try:
        url = f"{BASE_URL}/api/yield/streams"
        headers = {"Content-Type": "application/json"}
        if AGENT_SECRET:
            headers["X-Tokenization-Agent-Secret"] = AGENT_SECRET
        httpx.post(url, json=stream_data, headers=headers, timeout=5.0)
    except Exception:
        pass

    return {
        "success": True,
        "mode": "live" if is_live else "simulated",
        "status": "STREAM_OPENED",
        "propertyId": prop_id,
        "receiver": valid_receiver,
        "flowRate": valid_flow_rate,
        "token": token,
        "txHash": tx_hash,
        "blockNumber": block_number,
        "basescanUrl": basescan_url,
        "explorerUrl": basescan_url,
    }


@mcp.tool()
def update_flow_rate(
    token_address: str,
    receiver: str,
    flow_rate: int,
    property_id: str
) -> dict[str, Any]:
    """Update the per-second flow rate of an active Superfluid CFA yield stream.

    Args:
        token_address: Super Token address on Base Sepolia.
        receiver: Investor's EVM wallet address.
        flow_rate: New flow rate in wei per second.
        property_id: Unique property identifier.
    """
    valid_receiver = validate_receiver(receiver)
    valid_flow_rate = validate_flow_rate(flow_rate, allow_zero=True)
    prop_id = str(property_id).strip()
    if not prop_id:
        raise SuperfluidError("Property ID is required.")

    stream_key = f"{prop_id}:{valid_receiver.lower()}"
    current_streams = _load_streams()
    if stream_key not in current_streams or current_streams[stream_key].get("status") == "CLOSED":
        raise SuperfluidError(f"Stream not found: no active stream exists for property '{prop_id}' and receiver '{valid_receiver}'.")

    token = token_address or DEFAULT_FUSDCX_ADDRESS
    onchain = _submit_onchain_cfa_transaction("update", token, valid_receiver, valid_flow_rate)
    is_live = onchain is not None
    tx_hash = onchain["txHash"] if is_live else f"sim_cfa_update_{prop_id}"
    basescan_url = onchain["basescanUrl"] if is_live else None
    block_number = onchain.get("blockNumber") if is_live else None

    current_streams[stream_key]["flowRate"] = valid_flow_rate
    current_streams[stream_key]["updatedAt"] = int(time.time())
    current_streams[stream_key]["mode"] = "live" if is_live else "simulated"
    current_streams[stream_key]["txHash"] = tx_hash
    current_streams[stream_key]["blockNumber"] = block_number
    _save_streams(current_streams)

    # Sync with platform
    try:
        url = f"{BASE_URL}/api/yield/streams"
        headers = {"Content-Type": "application/json"}
        if AGENT_SECRET:
            headers["X-Tokenization-Agent-Secret"] = AGENT_SECRET
        httpx.patch(url, json={"propertyId": prop_id, "receiver": valid_receiver, "flowRate": valid_flow_rate}, headers=headers, timeout=5.0)
    except Exception:
        pass

    return {
        "success": True,
        "mode": "live" if is_live else "simulated",
        "status": "STREAM_UPDATED",
        "propertyId": prop_id,
        "receiver": valid_receiver,
        "flowRate": valid_flow_rate,
        "txHash": tx_hash,
        "blockNumber": block_number,
        "basescanUrl": basescan_url,
        "explorerUrl": basescan_url,
    }


@mcp.tool()
def delete_stream(
    token_address: str,
    receiver: str,
    property_id: str
) -> dict[str, Any]:
    """Halt and delete an ongoing Superfluid CFA yield stream for an investor.

    Args:
        token_address: Super Token address.
        receiver: Investor's EVM wallet address.
        property_id: Unique property identifier.
    """
    valid_receiver = validate_receiver(receiver)
    prop_id = str(property_id).strip()
    if not prop_id:
        raise SuperfluidError("Property ID is required.")

    stream_key = f"{prop_id}:{valid_receiver.lower()}"
    current_streams = _load_streams()
    if stream_key not in current_streams or current_streams[stream_key].get("status") == "CLOSED":
        raise SuperfluidError(f"Stream not found: no active stream exists for property '{prop_id}' and receiver '{valid_receiver}'.")

    token = token_address or DEFAULT_FUSDCX_ADDRESS
    onchain = _submit_onchain_cfa_transaction("delete", token, valid_receiver, 0)
    is_live = onchain is not None
    tx_hash = onchain["txHash"] if is_live else f"sim_cfa_delete_{prop_id}"
    basescan_url = onchain["basescanUrl"] if is_live else None
    block_number = onchain.get("blockNumber") if is_live else None

    current_streams[stream_key]["status"] = "CLOSED"
    current_streams[stream_key]["flowRate"] = 0
    current_streams[stream_key]["closedAt"] = int(time.time())
    current_streams[stream_key]["mode"] = "live" if is_live else "simulated"
    current_streams[stream_key]["txHash"] = tx_hash
    current_streams[stream_key]["blockNumber"] = block_number
    _save_streams(current_streams)

    # Sync with platform
    try:
        url = f"{BASE_URL}/api/yield/streams?propertyId={prop_id}&receiver={valid_receiver}"
        headers = {}
        if AGENT_SECRET:
            headers["X-Tokenization-Agent-Secret"] = AGENT_SECRET
        httpx.delete(url, headers=headers, timeout=5.0)
    except Exception:
        pass

    return {
        "success": True,
        "mode": "live" if is_live else "simulated",
        "status": "STREAM_DELETED",
        "propertyId": prop_id,
        "receiver": valid_receiver,
        "txHash": tx_hash,
        "blockNumber": block_number,
        "basescanUrl": basescan_url,
        "explorerUrl": basescan_url,
    }


@mcp.tool()
def get_active_streams(property_id: str) -> dict[str, Any]:
    """List all currently active Superfluid yield streams for a property.

    Args:
        property_id: Unique property identifier.
    """
    prop_id = str(property_id).strip()
    current_streams = _load_streams()
    matches = [
        s for s in current_streams.values()
        if s.get("propertyId") == prop_id and s.get("status") == "ACTIVE"
    ]
    total_outflow = sum(s.get("flowRate", 0) for s in matches)

    return {
        "success": True,
        "propertyId": prop_id,
        "activeCount": len(matches),
        "totalFlowRate": total_outflow,
        "streams": matches,
    }


@mcp.tool()
def get_stream_balance(
    token_address: str,
    receiver: str,
    property_id: str = ""
) -> dict[str, Any]:
    """Query the real-time continuous streaming balance and active flow rate for an investor.

    Args:
        token_address: Super Token address on Base Sepolia.
        receiver: Investor's wallet address.
        property_id: Optional property identifier to filter by.
    """
    valid_receiver = validate_receiver(receiver)
    now = int(time.time())
    receiver_clean = valid_receiver.lower()
    current_streams = _load_streams()

    # Find matching streams for this receiver
    active_flows = [
        s for s in current_streams.values()
        if s.get("receiver", "").lower() == receiver_clean
        and s.get("status") == "ACTIVE"
        and (not property_id or s.get("propertyId") == property_id)
    ]

    total_flow_rate = sum(f.get("flowRate", 0) for f in active_flows)

    accumulated = 0.0
    for f in active_flows:
        elapsed = now - f.get("startedAt", now)
        accumulated += (f.get("flowRate", 0) * elapsed) / 1e18

    return {
        "success": True,
        "receiver": valid_receiver,
        "token": token_address or DEFAULT_FUSDCX_ADDRESS,
        "flowRate": total_flow_rate,
        "activeStreamCount": len(active_flows),
        "currentBalance": round(accumulated, 6),
        "timestamp": now,
    }


if __name__ == "__main__":
    mcp.run()
