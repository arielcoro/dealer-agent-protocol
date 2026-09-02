"""Stateless MCP 2026-07-28 stdio transport for the reference gateway."""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any, Dict, Optional
from urllib.parse import unquote

from . import __version__
from .auth import AuthContext
from .errors import GatewayError
from .fixtures import ORGANIZATION_ID
from .gateway import Gateway, PROTOCOL_VERSION


JSONRPC_INVALID_REQUEST = -32600
JSONRPC_METHOD_NOT_FOUND = -32601
JSONRPC_INVALID_PARAMS = -32602
JSONRPC_INTERNAL_ERROR = -32603
UNSUPPORTED_PROTOCOL_VERSION = -32022


class McpServer:
    def __init__(self, gateway: Optional[Gateway] = None, auth: Optional[AuthContext] = None) -> None:
        self.gateway = gateway or Gateway()
        self.auth = auth

    def handle(self, request: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        request_id = request.get("id")
        if request.get("jsonrpc") != "2.0" or not isinstance(request.get("method"), str):
            return self._error(request_id, JSONRPC_INVALID_REQUEST, "Invalid JSON-RPC request.")
        method = request["method"]
        if method.startswith("notifications/"):
            return None
        if "id" not in request:
            return None
        params = request.get("params", {})
        if not isinstance(params, dict):
            return self._error(request_id, JSONRPC_INVALID_PARAMS, "Request params must be an object.")

        metadata_error = self._validate_metadata(request_id, params)
        if metadata_error:
            return metadata_error
        try:
            if method == "server/discover":
                result = self._discover()
            elif method == "tools/list":
                result = self._list_tools()
            elif method == "tools/call":
                result = self._call_tool(params)
            elif method == "resources/list":
                result = self._list_resources()
            elif method == "resources/read":
                result = self._read_resource(params)
            else:
                return self._error(request_id, JSONRPC_METHOD_NOT_FOUND, "Method not found.")
            return {"jsonrpc": "2.0", "id": request_id, "result": result}
        except GatewayError as error:
            if method == "tools/call":
                return {"jsonrpc": "2.0", "id": request_id, "result": self._tool_error(error)}
            return self._error(request_id, JSONRPC_INVALID_PARAMS, error.message)
        except (KeyError, TypeError, ValueError):
            return self._error(request_id, JSONRPC_INVALID_PARAMS, "Invalid method parameters.")
        except Exception:
            return self._error(request_id, JSONRPC_INTERNAL_ERROR, "Internal server error.")

    def _validate_metadata(self, request_id: Any, params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        meta = params.get("_meta")
        if not isinstance(meta, dict):
            return self._error(request_id, JSONRPC_INVALID_PARAMS, "MCP request metadata is required.")
        requested = meta.get("io.modelcontextprotocol/protocolVersion")
        if requested != PROTOCOL_VERSION:
            return self._error(
                request_id,
                UNSUPPORTED_PROTOCOL_VERSION,
                "Unsupported MCP protocol version.",
                {"supported": [PROTOCOL_VERSION], "requested": requested or ""},
            )
        if not isinstance(meta.get("io.modelcontextprotocol/clientInfo"), dict):
            return self._error(request_id, JSONRPC_INVALID_PARAMS, "MCP clientInfo metadata is required.")
        if not isinstance(meta.get("io.modelcontextprotocol/clientCapabilities"), dict):
            return self._error(request_id, JSONRPC_INVALID_PARAMS, "MCP clientCapabilities metadata is required.")
        return None

    def _discover(self) -> Dict[str, Any]:
        return {
            "resultType": "complete",
            "supportedVersions": [PROTOCOL_VERSION],
            "capabilities": {"tools": {}, "resources": {}},
            "_meta": {
                "io.modelcontextprotocol/serverInfo": {
                    "name": "dealer-agent-protocol-reference",
                    "version": __version__,
                }
            },
            "instructions": "Use inventory search for discovery, verify availability before acting, and never describe an unknown government-charge amount as zero.",
            "ttlMs": 3600000,
            "cacheScope": "public",
        }

    def _list_tools(self) -> Dict[str, Any]:
        return {
            "resultType": "complete",
            "tools": self.gateway.tool_definitions(),
            "ttlMs": 3600000,
            "cacheScope": "public",
        }

    def _call_tool(self, params: Dict[str, Any]) -> Dict[str, Any]:
        name = params["name"]
        arguments = params.get("arguments", {})
        if not isinstance(name, str) or not isinstance(arguments, dict):
            raise ValueError("invalid tool call")
        result = self.gateway.call_tool(name, arguments, self.auth)
        return {
            "resultType": "complete",
            "content": [{"type": "text", "text": json.dumps(result, sort_keys=True, separators=(",", ":"))}],
            "structuredContent": result,
            "isError": False,
        }

    def _tool_error(self, error: GatewayError) -> Dict[str, Any]:
        result = error.as_dict()
        self.gateway.schemas.validate_document("error.schema.json", result)
        return {
            "resultType": "complete",
            "content": [{"type": "text", "text": f"{result['code']}: {result['message']}"}],
            "structuredContent": result,
            "isError": True,
        }

    @staticmethod
    def _list_resources() -> Dict[str, Any]:
        return {
            "resultType": "complete",
            "resources": [
                {
                    "uri": "dealeragent://manifest",
                    "name": "Dealer Agent Protocol manifest",
                    "description": "Caller-visible profiles, tools, resources, tenancy, policy, and conformance evidence.",
                    "mimeType": "application/json",
                },
                {
                    "uri": f"dealeragent://organization/{ORGANIZATION_ID}",
                    "name": "Example Motors organization",
                    "description": "Synthetic public dealer organization and rooftop directory.",
                    "mimeType": "application/json",
                },
            ],
            "ttlMs": 3600000,
            "cacheScope": "public",
        }

    def _read_resource(self, params: Dict[str, Any]) -> Dict[str, Any]:
        uri = params["uri"]
        if uri == "dealeragent://manifest":
            value = self.gateway.manifest()
            ttl_ms = 3600000
        elif uri == f"dealeragent://organization/{ORGANIZATION_ID}":
            value = self.gateway.call_tool("dealeragent.dealer.get", {"organization_id": ORGANIZATION_ID}, self.auth)
            ttl_ms = 300000
        else:
            raise GatewayError("dealeragent.resource.not_found", "The requested resource was not found.")
        return {
            "resultType": "complete",
            "contents": [
                {
                    "uri": unquote(uri),
                    "mimeType": "application/json",
                    "text": json.dumps(value, sort_keys=True, separators=(",", ":")),
                }
            ],
            "ttlMs": ttl_ms,
            "cacheScope": "public",
        }

    @staticmethod
    def _error(
        request_id: Any, code: int, message: str, data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        error: Dict[str, Any] = {"code": code, "message": message}
        if data is not None:
            error["data"] = data
        return {"jsonrpc": "2.0", "id": request_id, "error": error}


def serve(server: McpServer) -> int:
    for raw_line in sys.stdin:
        try:
            request = json.loads(raw_line)
            if not isinstance(request, dict):
                response = McpServer._error(None, JSONRPC_INVALID_REQUEST, "Invalid JSON-RPC request.")
            else:
                response = server.handle(request)
        except json.JSONDecodeError:
            response = McpServer._error(None, -32700, "Parse error.")
        if response is not None:
            sys.stdout.write(json.dumps(response, sort_keys=True, separators=(",", ":")) + "\n")
            sys.stdout.flush()
    return 0


def main(argv: Optional[list] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--demo-grant",
        action="store_true",
        help="Enable the operator-controlled synthetic downtown-rooftop grant. Never use this as production authentication.",
    )
    args = parser.parse_args(argv)
    auth = Gateway.demo_grant() if args.demo_grant else None
    return serve(McpServer(auth=auth))


if __name__ == "__main__":
    raise SystemExit(main())
