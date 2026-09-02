"""Small stateless ASGI transport for the synthetic public reference gateway."""

from __future__ import annotations

import json
import os
from typing import Any, Awaitable, Callable, Dict, Iterable, Optional

from . import __version__
from .gateway import Gateway, PROTOCOL_VERSION, STANDARD_VERSION
from .server import JSONRPC_INVALID_REQUEST, McpServer


Receive = Callable[[], Awaitable[Dict[str, Any]]]
Send = Callable[[Dict[str, Any]], Awaitable[None]]
MAX_BODY_BYTES = 1_048_576


def _truthy(value: Optional[str]) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "on"}


class PublicReferenceApp:
    """Expose the read-only synthetic fixture over stateless HTTP.

    A fresh Gateway is built for every MCP request so its synthetic observation
    and validity windows remain coherent for a long-running public demo.
    """

    def __init__(
        self,
        *,
        demo_mode: Optional[bool] = None,
        allowed_origins: Optional[Iterable[str]] = None,
        cursor_secret: Optional[str] = None,
    ) -> None:
        self.demo_mode = _truthy(os.environ.get("DEALER_AGENT_DEMO_MODE", "1")) if demo_mode is None else demo_mode
        configured_origins = os.environ.get(
            "DEALER_AGENT_ALLOWED_ORIGINS",
            "https://dealeragentprotocol.com,https://dealeragentgateway.com",
        )
        self.allowed_origins = {
            origin.strip().rstrip("/")
            for origin in (allowed_origins if allowed_origins is not None else configured_origins.split(","))
            if origin.strip()
        }
        configured_secret = cursor_secret or os.environ.get("DEALER_AGENT_CURSOR_SECRET")
        if not configured_secret:
            if not self.demo_mode:
                raise RuntimeError("DEALER_AGENT_CURSOR_SECRET is required outside synthetic demo mode.")
            configured_secret = "synthetic-reference-only-change-before-production"
        self.cursor_secret = configured_secret.encode("utf-8")

    async def __call__(self, scope: Dict[str, Any], receive: Receive, send: Send) -> None:
        if scope.get("type") != "http":
            return
        method = scope.get("method", "GET").upper()
        path = scope.get("path", "/")
        headers = {
            key.decode("latin-1").lower(): value.decode("latin-1")
            for key, value in scope.get("headers", [])
        }
        origin = headers.get("origin", "").rstrip("/")
        if origin and origin not in self.allowed_origins:
            await self._json(send, 403, {"error": "origin_not_allowed"})
            return

        if method == "OPTIONS":
            await self._empty(send, 204, origin)
            return
        if path == "/health" and method in {"GET", "HEAD"}:
            payload = {
                "status": "ok",
                "service": "dealer-agent-gateway-reference",
                "version": __version__,
                "standard": "Dealer Agent Protocol",
                "standard_version": STANDARD_VERSION,
                "mcp_revision": PROTOCOL_VERSION,
                "data_status": "synthetic-reference-only",
            }
            await self._json(send, 200, payload if method == "GET" else None, origin)
            return
        if path == "/" and method == "GET":
            await self._json(
                send,
                200,
                {
                    "name": "Dealer Agent Gateway Reference",
                    "mcp_endpoint": "https://mcp.dealershipmcp.com/mcp",
                    "documentation": "https://dealeragentprotocol.com/",
                    "data_status": "synthetic-reference-only",
                },
                origin,
            )
            return
        if path != "/mcp":
            await self._json(send, 404, {"error": "not_found"}, origin)
            return
        if method != "POST":
            await self._json(send, 405, {"error": "method_not_allowed"}, origin, extra=[(b"allow", b"POST, OPTIONS")])
            return
        if headers.get("content-type", "").split(";", 1)[0].strip().lower() != "application/json":
            await self._json(send, 415, {"error": "content_type_must_be_application_json"}, origin)
            return

        body = await self._read_body(receive)
        if body is None:
            await self._json(send, 413, {"error": "request_too_large"}, origin)
            return
        try:
            request = json.loads(body)
        except (UnicodeDecodeError, json.JSONDecodeError):
            await self._json(send, 400, McpServer._error(None, -32700, "Parse error."), origin)
            return
        if not isinstance(request, dict):
            await self._json(send, 400, McpServer._error(None, JSONRPC_INVALID_REQUEST, "Invalid JSON-RPC request."), origin)
            return

        gateway = Gateway(cursor_secret=self.cursor_secret)
        auth = Gateway.demo_grant() if self.demo_mode else None
        response = McpServer(gateway=gateway, auth=auth).handle(request)
        if response is None:
            await self._empty(send, 202, origin)
            return
        await self._json(send, 200, response, origin)

    @staticmethod
    async def _read_body(receive: Receive) -> Optional[bytes]:
        chunks = bytearray()
        more = True
        while more:
            event = await receive()
            if event.get("type") == "http.disconnect":
                return b""
            chunk = event.get("body", b"")
            chunks.extend(chunk)
            if len(chunks) > MAX_BODY_BYTES:
                return None
            more = bool(event.get("more_body", False))
        return bytes(chunks)

    def _headers(self, origin: str, extra: Optional[list] = None) -> list:
        headers = [
            (b"cache-control", b"no-store"),
            (b"x-content-type-options", b"nosniff"),
            (b"x-frame-options", b"DENY"),
            (b"referrer-policy", b"no-referrer"),
            (b"vary", b"Origin"),
        ]
        if origin:
            headers.extend(
                [
                    (b"access-control-allow-origin", origin.encode("latin-1")),
                    (b"access-control-allow-methods", b"POST, OPTIONS"),
                    (b"access-control-allow-headers", b"Content-Type, MCP-Protocol-Version"),
                    (b"access-control-max-age", b"600"),
                ]
            )
        if extra:
            headers.extend(extra)
        return headers

    async def _json(
        self,
        send: Send,
        status: int,
        payload: Optional[Dict[str, Any]],
        origin: str = "",
        extra: Optional[list] = None,
    ) -> None:
        body = b"" if payload is None else json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
        headers = [(b"content-type", b"application/json; charset=utf-8"), *self._headers(origin, extra)]
        await send({"type": "http.response.start", "status": status, "headers": headers})
        await send({"type": "http.response.body", "body": body})

    async def _empty(self, send: Send, status: int, origin: str = "") -> None:
        await send({"type": "http.response.start", "status": status, "headers": self._headers(origin)})
        await send({"type": "http.response.body", "body": b""})


app = PublicReferenceApp()


def main() -> None:
    import uvicorn

    port = int(os.environ.get("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port, proxy_headers=True, server_header=False)
