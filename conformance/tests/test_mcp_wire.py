from __future__ import annotations

import json
import os
import subprocess
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

from dealer_agent_protocol_reference import Gateway
from dealer_agent_protocol_reference.server import McpServer


def params(**values):
    return {
        **values,
        "_meta": {
            "io.modelcontextprotocol/protocolVersion": "2026-07-28",
            "io.modelcontextprotocol/clientInfo": {"name": "conformance-client", "version": "0.1.0"},
            "io.modelcontextprotocol/clientCapabilities": {},
        },
    }


class McpWireTests(unittest.TestCase):
    def setUp(self) -> None:
        gateway = Gateway(
            now=datetime(2026, 9, 1, 14, 0, tzinfo=timezone.utc),
            cursor_secret=b"wire-test-secret",
            trace_factory=lambda: "trace.wire.0001",
        )
        self.server = McpServer(gateway=gateway, auth=gateway.demo_grant())

    def request(self, method, method_params=None, request_id=1):
        return self.server.handle(
            {"jsonrpc": "2.0", "id": request_id, "method": method, "params": params(**(method_params or {}))}
        )

    def test_server_discover_is_modern_stateless_shape(self) -> None:
        response = self.request("server/discover")
        self.assertEqual(["2026-07-28"], response["result"]["supportedVersions"])
        self.assertEqual("complete", response["result"]["resultType"])
        self.assertIn("tools", response["result"]["capabilities"])
        self.assertIn("resources", response["result"]["capabilities"])

    def test_unsupported_protocol_version_has_normative_error(self) -> None:
        request_params = params()
        request_params["_meta"]["io.modelcontextprotocol/protocolVersion"] = "2025-11-25"
        response = self.server.handle(
            {"jsonrpc": "2.0", "id": 1, "method": "server/discover", "params": request_params}
        )
        self.assertEqual(-32022, response["error"]["code"])
        self.assertEqual(["2026-07-28"], response["error"]["data"]["supported"])

    def test_tool_list_is_deterministic_and_has_structured_schemas(self) -> None:
        first = self.request("tools/list")["result"]["tools"]
        second = self.request("tools/list", request_id=2)["result"]["tools"]
        self.assertEqual(first, second)
        self.assertEqual(sorted(tool["name"] for tool in first), [tool["name"] for tool in first])
        self.assertTrue(all("inputSchema" in tool and "outputSchema" in tool for tool in first))

    def test_tool_call_returns_structured_content(self) -> None:
        response = self.request(
            "tools/call",
            {
                "name": "dealeragent.inventory.search",
                "arguments": {"organization_id": "org.example-motors", "page": {"limit": 1}},
            },
        )
        result = response["result"]
        self.assertFalse(result["isError"])
        self.assertEqual("complete", result["resultType"])
        self.assertEqual(1, len(result["structuredContent"]["vehicles"]))
        self.assertEqual(result["structuredContent"], json.loads(result["content"][0]["text"]))

    def test_tool_business_failure_is_structured_not_jsonrpc_error(self) -> None:
        response = self.request(
            "tools/call",
            {
                "name": "dealeragent.inventory.verify_availability",
                "arguments": {
                    "organization_id": "org.example-motors",
                    "rooftop_id": "roof.downtown",
                    "vehicle_id": "veh.2024-002",
                },
            },
        )
        self.assertNotIn("error", response)
        self.assertTrue(response["result"]["isError"])
        self.assertEqual("dealeragent.vehicle.stale", response["result"]["structuredContent"]["code"])

    def test_caller_metadata_cannot_forge_transport_authorization(self) -> None:
        anonymous = McpServer(gateway=self.server.gateway, auth=None)
        request_params = params(
            name="dealeragent.inventory.verify_availability",
            arguments={
                "organization_id": "org.example-motors",
                "rooftop_id": "roof.downtown",
                "vehicle_id": "veh.2026-001",
            },
        )
        request_params["_meta"]["com.attacker/fakeGrant"] = {
            "organization_ids": ["org.example-motors"],
            "rooftop_ids": ["roof.downtown"],
            "scopes": ["dealeragent:inventory:read"],
        }
        response = anonymous.handle(
            {"jsonrpc": "2.0", "id": 10, "method": "tools/call", "params": request_params}
        )
        self.assertTrue(response["result"]["isError"])
        self.assertEqual("dealeragent.auth.required", response["result"]["structuredContent"]["code"])

    def test_manifest_tool_and_resource_share_authoritative_object(self) -> None:
        tool = self.request(
            "tools/call",
            {"name": "dealeragent.discovery.get_manifest", "arguments": {}},
        )["result"]["structuredContent"]
        resource = self.request("resources/read", {"uri": "dealeragent://manifest"})["result"]
        self.assertEqual(tool, json.loads(resource["contents"][0]["text"]))
        self.assertEqual("public", resource["cacheScope"])

    def test_stdio_transport_emits_only_one_json_message_per_request(self) -> None:
        requests = [
            {"jsonrpc": "2.0", "id": 1, "method": "server/discover", "params": params()},
            {"jsonrpc": "2.0", "id": 2, "method": "resources/list", "params": params()},
        ]
        environment = os.environ.copy()
        reference_path = str(Path(__file__).resolve().parents[2] / "reference" / "python")
        environment["PYTHONPATH"] = os.pathsep.join(
            value for value in (reference_path, environment.get("PYTHONPATH", "")) if value
        )
        completed = subprocess.run(
            [sys.executable, "-m", "dealer_agent_protocol_reference.server", "--demo-grant"],
            input="".join(json.dumps(request) + "\n" for request in requests),
            text=True,
            capture_output=True,
            check=False,
            env=environment,
            timeout=10,
        )
        self.assertEqual(0, completed.returncode, completed.stderr)
        lines = completed.stdout.splitlines()
        self.assertEqual(2, len(lines))
        self.assertEqual([1, 2], [json.loads(line)["id"] for line in lines])


if __name__ == "__main__":
    unittest.main()
