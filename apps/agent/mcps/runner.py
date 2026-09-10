#!/usr/bin/env python3
"""Unified runner for Prism 8 Python MCP servers.

Enables calling tools on any Python MCP server (usps_chainlink, hedera_write,
hedera_read, evm_write, evm_read, superfluid, worldid) via direct CLI invocation
or standard MCP stdio JSON-RPC 2.0 protocol.
"""

from __future__ import annotations

import inspect
import json
import os
import sys
from pathlib import Path
from typing import Any, Callable

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent

SERVER_MAP: dict[str, tuple[str, str]] = {
    "usps_chainlink": ("usps_chainlink", "server"),
    "hedera_write": ("hedera", "write_server"),
    "hedera_read": ("hedera", "read_server"),
    "evm_write": ("evm", "write_server"),
    "evm_read": ("evm", "read_server"),
    "superfluid": ("superfluid", "server"),
    "worldid": ("worldid", "server"),
}


def load_server_module(server_name: str) -> Any:
    """Import the requested MCP server module by setting up sys.path correctly."""
    if server_name not in SERVER_MAP:
        raise ValueError(f"Unknown MCP server '{server_name}'. Available: {list(SERVER_MAP.keys())}")

    subdir, module_name = SERVER_MAP[server_name]
    server_dir = SCRIPT_DIR / subdir

    if str(server_dir) not in sys.path:
        sys.path.insert(0, str(server_dir))
    if str(SCRIPT_DIR) not in sys.path:
        sys.path.insert(1, str(SCRIPT_DIR))

    import importlib
    return importlib.import_module(module_name)


def get_server_tools(server_module: Any) -> dict[str, Callable[..., Any]]:
    """Extract tool callables from the server module."""
    tools: dict[str, Callable[..., Any]] = {}

    mcp_obj = getattr(server_module, "mcp", None)
    if mcp_obj and hasattr(mcp_obj, "tools") and isinstance(mcp_obj.tools, dict):
        tools.update(mcp_obj.tools)

    for attr_name in dir(server_module):
        attr = getattr(server_module, attr_name)
        if callable(attr) and not attr_name.startswith("_") and not isinstance(attr, type):
            doc = inspect.getdoc(attr) or ""
            if hasattr(attr, "__wrapped__") or "Args:" in doc or attr_name in {
                "validate_property_address", "get_verification_status", "store_verified_hash",
                "create_yield_stream", "update_flow_rate", "delete_stream", "get_active_streams", "get_stream_balance",
                "deploy_token", "whitelist_holder", "revoke_holder", "distribute", "reclaim_now", "pause_token",
                "fulfill_token_request", "reject_token_request", "process_liveness_expirations",
                "list_tokens", "get_token", "list_token_requests", "get_token_request",
                "list_pending_verifications", "get_holder_verifications", "get_verification", "verify_pending_proof"
            }:
                tools[attr_name] = attr

    return tools


def call_tool(server_name: str, tool_name: str, args: dict[str, Any]) -> Any:
    """Execute a single tool on the given MCP server and return the raw output."""
    module = load_server_module(server_name)
    tools = get_server_tools(module)

    if tool_name not in tools:
        raise KeyError(f"Tool '{tool_name}' not found in MCP server '{server_name}'. Available: {list(tools.keys())}")

    fn = tools[tool_name]
    return fn(**args)


def run_stdio_jsonrpc(server_name: str) -> None:
    """Run standard line-delimited MCP JSON-RPC 2.0 loop over stdin/stdout."""
    module = load_server_module(server_name)
    tools = get_server_tools(module)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except Exception:
            continue

        method = msg.get("method")
        msg_id = msg.get("id")

        if method == "initialize":
            res = {
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {"tools": {}},
                    "serverInfo": {"name": server_name, "version": "1.0.0"}
                }
            }
            sys.stdout.write(json.dumps(res) + "\n")
            sys.stdout.flush()
        elif method == "notifications/initialized":
            pass
        elif method == "tools/list":
            tool_list = []
            for t_name, t_fn in tools.items():
                doc = inspect.getdoc(t_fn) or ""
                tool_list.append({
                    "name": t_name,
                    "description": doc.split("\n\n")[0] if doc else t_name,
                    "inputSchema": {"type": "object", "properties": {}}
                })
            res = {
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": {"tools": tool_list}
            }
            sys.stdout.write(json.dumps(res) + "\n")
            sys.stdout.flush()
        elif method == "tools/call":
            params = msg.get("params", {})
            t_name = params.get("name")
            t_args = params.get("arguments", {})
            try:
                if t_name not in tools:
                    raise KeyError(f"Tool '{t_name}' not found")
                output = tools[t_name](**t_args)
                res = {
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "result": {
                        "content": [{"type": "text", "text": json.dumps(output) if isinstance(output, (dict, list)) else str(output)}],
                        "isError": False
                    }
                }
            except Exception as exc:
                res = {
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "result": {
                        "content": [{"type": "text", "text": str(exc)}],
                        "isError": True
                    }
                }
            sys.stdout.write(json.dumps(res) + "\n")
            sys.stdout.flush()
        elif msg_id is not None:
            res = {
                "jsonrpc": "2.0",
                "id": msg_id,
                "error": {"code": -32601, "message": f"Method {method} not found"}
            }
            sys.stdout.write(json.dumps(res) + "\n")
            sys.stdout.flush()


def main() -> None:
    args = sys.argv[1:]
    if not args:
        print(f"Usage: {sys.argv[0]} <server_name> <tool_name> '<json_args>'", file=sys.stderr)
        print(f"       {sys.argv[0]} --list-tools <server_name>", file=sys.stderr)
        print(f"       {sys.argv[0]} --stdio <server_name>", file=sys.stderr)
        sys.exit(1)

    if args[0] == "--stdio":
        server_name = args[1]
        run_stdio_jsonrpc(server_name)
        return

    if args[0] == "--list-tools":
        server_name = args[1]
        mod = load_server_module(server_name)
        tools = get_server_tools(mod)
        print(json.dumps({"server": server_name, "tools": list(tools.keys())}))
        return

    # Direct invocation: <server_name> <tool_name> [json_args]
    server_name = args[0]
    tool_name = args[1]
    args_json = args[2] if len(args) > 2 else "{}"

    try:
        parsed_args = json.loads(args_json)
    except Exception as exc:
        print(json.dumps({"error": f"Invalid JSON arguments: {exc}"}), file=sys.stderr)
        sys.exit(1)

    try:
        result = call_tool(server_name, tool_name, parsed_args)
        print(json.dumps(result, indent=2 if os.environ.get("PRETTY_PRINT") else None))
        sys.exit(0)
    except Exception as exc:
        err_payload = {"error": str(exc), "server": server_name, "tool": tool_name}
        print(json.dumps(err_payload), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
