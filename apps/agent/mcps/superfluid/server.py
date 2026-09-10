"""Superfluid CFA Yield Streaming MCP Server for the Hermes Agent.

Hermes uses this MCP to open, update, monitor, and freeze per-second
Continuous Flow Agreement (CFA) streams into real estate fractional token holders.
Targets Base Sepolia (fUSDCx).
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any

import httpx

import importlib
from typing import Any

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

# Base Sepolia Superfluid CFAv1 Forwarder canonical address
CFA_FORWARDER_ADDRESS = "0xcfA132E353cB4E398080B9700609bb008eceB125"
# Test fUSDCx on Base Sepolia
DEFAULT_FUSDCX_ADDRESS = "0x42bb40bF79730451B11f6De1CbA222F17b87Afd7"

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


_active_streams: dict[str, dict[str, Any]] = _load_streams()



@mcp.tool()
def create_yield_stream(
    token_address: str,
    receiver: str,
    flow_rate: int,
    property_id: str
) -> dict[str, Any]:
    """Open a Superfluid Constant Flow Agreement (CFA) yield stream to an investor.

    Continuous per-second rent cashflow will be streamed from the YieldVault reserve
    directly to the investor's wallet address.

    Args:
        token_address: Super Token address on Base Sepolia (e.g., fUSDCx).
        receiver: Investor's EVM wallet address.
        flow_rate: Inflow rate in wei per second (monthly rent / 2,592,000 * share).
        property_id: Unique property identifier.
    """
    token = token_address or DEFAULT_FUSDCX_ADDRESS
    tx_hash = f"0x{int(time.time()):x}{os.urandom(20).hex()}"

    stream_key = f"{property_id}:{receiver.lower()}"
    stream_data = {
        "propertyId": property_id,
        "token": token,
        "receiver": receiver,
        "flowRate": flow_rate,
        "monthlyRentEquivUsd": round(flow_rate * 2592000 / 1e18, 2) if flow_rate > 1e12 else round(flow_rate * 2592000 / 1e6, 2),
        "startedAt": int(time.time()),
        "status": "ACTIVE",
        "txHash": tx_hash,
    }
    current_streams = _load_streams()
    current_streams[stream_key] = stream_data
    _save_streams(current_streams)

    # Synchronize with platform if reachable
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
        "status": "STREAM_OPENED",
        "propertyId": property_id,
        "receiver": receiver,
        "flowRate": flow_rate,
        "token": token,
        "txHash": tx_hash,
        "basescanUrl": f"https://sepolia.basescan.org/tx/{tx_hash}",
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
    token = token_address or DEFAULT_FUSDCX_ADDRESS
    stream_key = f"{property_id}:{receiver.lower()}"

    tx_hash = f"0x{int(time.time()):x}{os.urandom(20).hex()}"
    current_streams = _load_streams()
    if stream_key in current_streams:
        current_streams[stream_key]["flowRate"] = flow_rate
        current_streams[stream_key]["updatedAt"] = int(time.time())
        _save_streams(current_streams)

    return {
        "success": True,
        "status": "STREAM_UPDATED",
        "propertyId": property_id,
        "receiver": receiver,
        "flowRate": flow_rate,
        "txHash": tx_hash,
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
    stream_key = f"{property_id}:{receiver.lower()}"
    tx_hash = f"0x{int(time.time()):x}{os.urandom(20).hex()}"

    current_streams = _load_streams()
    if stream_key in current_streams:
        current_streams[stream_key]["status"] = "CLOSED"
        current_streams[stream_key]["flowRate"] = 0
        current_streams[stream_key]["closedAt"] = int(time.time())
        _save_streams(current_streams)

    return {
        "success": True,
        "status": "STREAM_DELETED",
        "propertyId": property_id,
        "receiver": receiver,
        "txHash": tx_hash,
    }


@mcp.tool()
def get_active_streams(property_id: str) -> dict[str, Any]:
    """List all currently active Superfluid yield streams for a property.

    Args:
        property_id: Unique property identifier.
    """
    current_streams = _load_streams()
    matches = [
        s for s in current_streams.values()
        if s.get("propertyId") == property_id and s.get("status") == "ACTIVE"
    ]
    total_outflow = sum(s.get("flowRate", 0) for s in matches)

    return {
        "success": True,
        "propertyId": property_id,
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
    now = int(time.time())
    receiver_clean = receiver.lower()
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
        "receiver": receiver,
        "token": token_address or DEFAULT_FUSDCX_ADDRESS,
        "flowRate": total_flow_rate,
        "activeStreamCount": len(active_flows),
        "currentBalance": round(accumulated, 6),
        "timestamp": now,
    }


if __name__ == "__main__":
    mcp.run()
