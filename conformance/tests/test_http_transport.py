from __future__ import annotations

import asyncio
import json
import unittest

from dealer_agent_protocol_reference.http import PublicReferenceApp


class HttpTransportTests(unittest.TestCase):
    def setUp(self) -> None:
        self.app = PublicReferenceApp(
            demo_mode=True,
            allowed_origins=["https://dealeragentprotocol.com", "https://dealeragentgateway.com"],
            cursor_secret="http-test-secret",
        )

    def request(self, method: str, path: str, body=None, headers=None):
        sent = []
        events = [{"type": "http.request", "body": body or b"", "more_body": False}]

        async def receive():
            return events.pop(0)

        async def send(event):
            sent.append(event)

        scope = {
            "type": "http",
            "method": method,
            "path": path,
            "headers": [(key.lower().encode(), value.encode()) for key, value in (headers or {}).items()],
        }
        asyncio.run(self.app(scope, receive, send))
        status = sent[0]["status"]
        response_headers = {key.decode(): value.decode() for key, value in sent[0]["headers"]}
        response_body = sent[1].get("body", b"")
        return status, response_headers, response_body

    def test_health_is_public_and_declares_synthetic_data(self):
        status, _, body = self.request("GET", "/health")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["data_status"], "synthetic-reference-only")

    def test_discovery_over_http(self):
        request = {
            "jsonrpc": "2.0",
            "id": "discover-http",
            "method": "server/discover",
            "params": {
                "_meta": {
                    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
                    "io.modelcontextprotocol/clientInfo": {"name": "http-test", "version": "1"},
                    "io.modelcontextprotocol/clientCapabilities": {},
                }
            },
        }
        status, headers, body = self.request(
            "POST",
            "/mcp",
            json.dumps(request).encode(),
            {"content-type": "application/json", "origin": "https://dealeragentprotocol.com"},
        )
        result = json.loads(body)["result"]
        self.assertEqual(status, 200)
        self.assertEqual(result["supportedVersions"], ["2026-07-28"])
        self.assertEqual(headers["access-control-allow-origin"], "https://dealeragentprotocol.com")

    def test_notification_is_accepted_without_response_body(self):
        request = {
            "jsonrpc": "2.0",
            "method": "notifications/cancelled",
            "params": {
                "_meta": {
                    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
                    "io.modelcontextprotocol/clientInfo": {"name": "http-test", "version": "1"},
                    "io.modelcontextprotocol/clientCapabilities": {},
                }
            },
        }
        status, _, body = self.request(
            "POST", "/mcp", json.dumps(request).encode(), {"content-type": "application/json"}
        )
        self.assertEqual(status, 202)
        self.assertEqual(body, b"")

    def test_gateway_website_origin_can_read_health(self):
        status, headers, body = self.request(
            "GET", "/health", headers={"origin": "https://dealeragentgateway.com"}
        )
        self.assertEqual(status, 200)
        self.assertEqual(headers["access-control-allow-origin"], "https://dealeragentgateway.com")
        self.assertEqual(json.loads(body)["data_status"], "synthetic-reference-only")

    def test_rejects_wrong_content_type(self):
        status, _, _ = self.request("POST", "/mcp", b"{}", {"content-type": "text/plain"})
        self.assertEqual(status, 415)

    def test_rejects_unapproved_browser_origin(self):
        status, _, _ = self.request("POST", "/mcp", b"{}", {"origin": "https://attacker.example"})
        self.assertEqual(status, 403)


if __name__ == "__main__":
    unittest.main()
