from __future__ import annotations

import json
import unittest
from datetime import datetime, timedelta, timezone

from dealer_agent_protocol_reference import AuthContext, Gateway
from dealer_agent_protocol_reference.errors import GatewayError


SUBJECT = "sha256:" + "a" * 64


class HandoffBehaviorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.gateway = Gateway(
            now=datetime(2026, 9, 2, 14, 0, tzinfo=timezone.utc),
            trace_factory=lambda: "trace.test.handoff",
        )
        self.grant = self.gateway.demo_grant()

    def prepare(self):
        return self.gateway.call_tool(
            "dealeragent.handoff.prepare",
            {
                "organization_id": "org.example-motors",
                "rooftop_id": "roof.downtown",
                "vehicle_id": "veh.2026-001",
                "purpose": "vehicle_inquiry",
                "requested_channels": ["email"],
                "requested_data_categories": ["contact", "vehicle_interest"],
                "subject_binding": SUBJECT,
                "idempotency_key": "prepare-test-0001",
            },
            self.grant,
        )

    def submit_args(self, binding):
        return {
            "organization_id": "org.example-motors",
            "rooftop_id": "roof.downtown",
            "vehicle_id": "veh.2026-001",
            "binding_id": binding["binding_id"],
            "binding_token": binding["binding_token"],
            "subject_binding": SUBJECT,
            "contact": {"name": "Jamie Buyer", "email": "jamie@example.net", "preferred_channels": ["email"]},
            "message": "Please contact me about the vehicle.",
            "idempotency_key": "submit-test-0001",
        }

    def test_prepare_contains_no_pii_and_returns_es256_binding(self) -> None:
        binding = self.prepare()
        self.assertEqual("ES256", binding["signature_algorithm"])
        self.assertEqual(3, len(binding["binding_token"].split(".")))
        serialized = json.dumps(binding)
        self.assertNotIn("jamie@example.net", serialized.lower())
        self.assertNotIn("Jamie Buyer", serialized)

    def test_prepare_schema_rejects_pii_before_handler(self) -> None:
        arguments = {
            "organization_id": "org.example-motors",
            "rooftop_id": "roof.downtown",
            "purpose": "vehicle_inquiry",
            "requested_channels": ["email"],
            "requested_data_categories": ["contact"],
            "subject_binding": SUBJECT,
            "idempotency_key": "prepare-test-0002",
            "email": "must-not-enter-prepare@example.net",
        }
        with self.assertRaises(GatewayError) as caught:
            self.gateway.call_tool("dealeragent.handoff.prepare", arguments, self.grant)
        self.assertNotIn(arguments["email"], json.dumps(caught.exception.as_dict()))

    def test_submit_consumes_binding_and_emits_adf(self) -> None:
        binding = self.prepare()
        result = self.gateway.call_tool("dealeragent.handoff.submit", self.submit_args(binding), self.grant)
        self.assertEqual("consumed", result["binding_status"])
        self.assertIn("<adf>", result["adf_xml"])
        self.assertIn("Jamie Buyer", result["adf_xml"])
        self.assertNotIn(binding["binding_token"], result["adf_xml"])

    def test_replayed_binding_with_new_idempotency_key_is_rejected(self) -> None:
        binding = self.prepare()
        arguments = self.submit_args(binding)
        self.gateway.call_tool("dealeragent.handoff.submit", arguments, self.grant)
        arguments["idempotency_key"] = "submit-test-replay2"
        with self.assertRaises(GatewayError) as caught:
            self.gateway.call_tool("dealeragent.handoff.submit", arguments, self.grant)
        self.assertEqual("dealeragent.binding.invalid", caught.exception.code)

    def test_expired_binding_is_rejected(self) -> None:
        binding = self.prepare()
        self.gateway.now += timedelta(minutes=11)
        with self.assertRaises(GatewayError) as caught:
            self.gateway.call_tool("dealeragent.handoff.submit", self.submit_args(binding), self.grant)
        self.assertEqual("dealeragent.binding.invalid", caught.exception.code)

    def test_cross_rooftop_binding_is_rejected_before_delivery(self) -> None:
        binding = self.prepare()
        broad_grant = AuthContext.grant(
            "operator:cross-rooftop-test",
            ["org.example-motors"],
            ["roof.downtown", "roof.north"],
            ["dealeragent:handoff:submit"],
        )
        arguments = self.submit_args(binding)
        arguments["rooftop_id"] = "roof.north"
        with self.assertRaises(GatewayError) as caught:
            self.gateway.call_tool("dealeragent.handoff.submit", arguments, broad_grant)
        self.assertEqual("dealeragent.binding.invalid", caught.exception.code)
        self.assertNotIn("downtown", caught.exception.message.lower())

    def test_subject_mismatch_is_rejected(self) -> None:
        binding = self.prepare()
        arguments = self.submit_args(binding)
        arguments["subject_binding"] = "sha256:" + "b" * 64
        with self.assertRaises(GatewayError) as caught:
            self.gateway.call_tool("dealeragent.handoff.submit", arguments, self.grant)
        self.assertEqual("dealeragent.binding.invalid", caught.exception.code)


if __name__ == "__main__":
    unittest.main()
