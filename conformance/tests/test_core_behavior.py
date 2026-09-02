from __future__ import annotations

import json
import unittest
from datetime import datetime, timezone

from dealer_agent_protocol_reference import AuthContext, Gateway
from dealer_agent_protocol_reference.errors import GatewayError


class CoreBehaviorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.gateway = Gateway(
            now=datetime(2026, 9, 1, 14, 0, tzinfo=timezone.utc),
            cursor_secret=b"deterministic-conformance-secret",
            trace_factory=lambda: "trace.test.0001",
        )
        self.demo_grant = self.gateway.demo_grant()

    def test_core_manifest_has_exact_required_profiles(self) -> None:
        manifest = self.gateway.call_tool("dealeragent.discovery.get_manifest", {})
        profiles = {capability["profile"] for capability in manifest["capabilities"]}
        self.assertTrue(
            {
                "dealeragent.discovery/0.1",
                "dealeragent.inventory.read/0.1",
                "dealeragent.inventory.availability/0.1",
                "dealeragent.pricing.disclosure/0.1",
            }.issubset(profiles)
        )
        self.assertEqual("2026-07-28", manifest["mcp_revision"])

    def test_public_search_preserves_per_vehicle_rooftop_and_freshness(self) -> None:
        result = self.gateway.call_tool(
            "dealeragent.inventory.search",
            {"organization_id": "org.example-motors"},
        )
        self.assertEqual(3, len(result["vehicles"]))
        self.assertEqual({"roof.downtown", "roof.north"}, {vehicle["rooftop_id"] for vehicle in result["vehicles"]})
        self.assertIn("stale", {vehicle["freshness"]["state"] for vehicle in result["vehicles"]})
        self.assertEqual("stale", result["freshness"]["state"])

    def test_opaque_cursor_is_bound_to_query_and_integrity_protected(self) -> None:
        first = self.gateway.call_tool(
            "dealeragent.inventory.search",
            {"organization_id": "org.example-motors", "page": {"limit": 1}},
        )
        cursor = first["page"]["next_cursor"]
        second = self.gateway.call_tool(
            "dealeragent.inventory.search",
            {"organization_id": "org.example-motors", "page": {"limit": 1, "cursor": cursor}},
        )
        self.assertNotEqual(first["vehicles"][0]["vehicle_id"], second["vehicles"][0]["vehicle_id"])

        with self.assertRaisesRegex(GatewayError, "cursor"):
            self.gateway.call_tool(
                "dealeragent.inventory.search",
                {
                    "organization_id": "org.example-motors",
                    "filters": {"condition": ["new"]},
                    "page": {"limit": 1, "cursor": cursor},
                },
            )
        with self.assertRaisesRegex(GatewayError, "cursor"):
            self.gateway.call_tool(
                "dealeragent.inventory.search",
                {"organization_id": "org.example-motors", "page": {"limit": 1, "cursor": cursor[:-1] + "A"}},
            )

    def test_authoritative_availability_requires_transport_grant(self) -> None:
        arguments = {
            "organization_id": "org.example-motors",
            "rooftop_id": "roof.downtown",
            "vehicle_id": "veh.2026-001",
        }
        with self.assertRaises(GatewayError) as caught:
            self.gateway.call_tool("dealeragent.inventory.verify_availability", arguments)
        self.assertEqual("dealeragent.auth.required", caught.exception.code)

        result = self.gateway.call_tool("dealeragent.inventory.verify_availability", arguments, self.demo_grant)
        self.assertEqual("authoritative", result["availability"]["authority_status"])
        self.assertEqual("current", result["freshness"]["state"])

    def test_rooftop_argument_never_expands_transport_grant(self) -> None:
        arguments = {
            "organization_id": "org.example-motors",
            "rooftop_id": "roof.north",
            "vehicle_id": "veh.2026-003",
        }
        with self.assertRaises(GatewayError) as caught:
            self.gateway.call_tool("dealeragent.inventory.verify_availability", arguments, self.demo_grant)
        self.assertEqual("dealeragent.tenant.forbidden", caught.exception.code)

    def test_tenant_membership_does_not_imply_capability_scope(self) -> None:
        no_scope = AuthContext.grant(
            "operator:no-scope",
            ["org.example-motors"],
            ["roof.downtown"],
            [],
        )
        arguments = {
            "organization_id": "org.example-motors",
            "rooftop_id": "roof.downtown",
            "vehicle_id": "veh.2026-001",
        }
        with self.assertRaises(GatewayError) as caught:
            self.gateway.call_tool("dealeragent.inventory.verify_availability", arguments, no_scope)
        self.assertEqual("dealeragent.scope.insufficient", caught.exception.code)

    def test_stale_record_cannot_be_upgraded_to_authoritative(self) -> None:
        arguments = {
            "organization_id": "org.example-motors",
            "rooftop_id": "roof.downtown",
            "vehicle_id": "veh.2024-002",
        }
        with self.assertRaises(GatewayError) as caught:
            self.gateway.call_tool("dealeragent.inventory.verify_availability", arguments, self.demo_grant)
        self.assertEqual("dealeragent.vehicle.stale", caught.exception.code)
        self.assertEqual("stale", caught.exception.details["current_freshness"]["state"])

    def test_pricing_keeps_mandatory_conditional_and_government_amounts_separate(self) -> None:
        result = self.gateway.call_tool(
            "dealeragent.pricing.get_disclosure",
            {
                "organization_id": "org.example-motors",
                "rooftop_id": "roof.downtown",
                "vehicle_id": "veh.2026-001",
            },
        )
        self.assertNotIn("price", result)
        self.assertTrue(result["required_dealer_charges"][0]["required"])
        self.assertTrue(result["required_dealer_charges"][0]["included_in_advertised_price"])
        self.assertEqual("unknown", result["government_charges"]["status"])
        self.assertEqual("required", result["conditional_adjustments"][0]["criteria"][0]["evidence_status"])
        self.assertIsInstance(result["advertised_price"]["amount"]["amount_minor"], int)

    def test_foreign_organization_is_enumeration_resistant(self) -> None:
        with self.assertRaises(GatewayError) as caught:
            self.gateway.call_tool("dealeragent.dealer.get", {"organization_id": "org.foreign"})
        self.assertEqual("dealeragent.resource.not_found", caught.exception.code)
        self.assertNotIn("foreign", caught.exception.message)

    def test_validation_error_does_not_echo_sensitive_input_value(self) -> None:
        secret = "buyer-secret@example.net"
        with self.assertRaises(GatewayError) as caught:
            self.gateway.call_tool(
                "dealeragent.inventory.search",
                {"organization_id": "org.example-motors", "query": secret, "unexpected": secret},
            )
        serialized = json.dumps(caught.exception.as_dict())
        self.assertNotIn(secret, serialized)


if __name__ == "__main__":
    unittest.main()
