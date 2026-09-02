from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta, timezone
import json
import unittest

from dealer_agent_protocol_reference import Gateway
from dealer_agent_protocol_reference.errors import GatewayError
from dealer_agent_protocol_reference.used_vehicle import inventory_age_days
from dealer_agent_client import history_presentation, inventory_age_label


class UsedVehicleBehaviorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.now = datetime(2026, 9, 1, 14, 0, tzinfo=timezone.utc)
        self.gateway = Gateway(now=self.now, trace_factory=lambda: "trace.test.used.0001")
        self.selector = {
            "organization_id": "org.example-motors",
            "rooftop_id": "roof.downtown",
            "vehicle_id": "veh.2024-002",
        }

    def test_manifest_advertises_used_vehicle_profile_separately(self) -> None:
        manifest = self.gateway.call_tool("dealeragent.discovery.get_manifest", {})
        profile = next(item for item in manifest["capabilities"] if item["profile"] == "dealeragent.used-vehicle.read/0.1")
        self.assertEqual(["dealeragent.inventory.get_used_vehicle_details"], profile["tools"])

    def test_used_vehicle_disclosure_has_dated_inventory_age(self) -> None:
        result = self.gateway.call_tool("dealeragent.inventory.get_used_vehicle_details", self.selector)
        tenure = result["inventory_tenure"]
        self.assertEqual(47, tenure["age_days"])
        self.assertEqual("stocked_at", tenure["age_basis"])
        self.assertIn("age_as_of", tenure)
        self.assertIn("provenance", tenure)

    def test_future_stocked_timestamp_is_rejected_by_age_calculator(self) -> None:
        with self.assertRaisesRegex(ValueError, "future"):
            inventory_age_days(self.now + timedelta(seconds=1), self.now)

    def test_ambiguous_stocked_timestamp_is_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "offset"):
            inventory_age_days(datetime(2026, 8, 1), self.now)

    def test_provider_reports_keep_separate_provenance_and_conflict(self) -> None:
        result = self.gateway.call_tool("dealeragent.inventory.get_used_vehicle_details", self.selector)
        reports = result["history_reports"]
        self.assertEqual({"com.carfax", "com.experian.autocheck"}, {report["provider_id"] for report in reports})
        self.assertNotEqual(
            reports[0]["summary"]["accident_status"],
            reports[1]["summary"]["accident_status"],
        )
        self.assertEqual("unresolved", result["discrepancies"][0]["status"])

    def test_history_language_never_claims_accident_free(self) -> None:
        result = self.gateway.call_tool("dealeragent.inventory.get_used_vehicle_details", self.selector)
        self.assertNotIn("accident-free", json.dumps(result).casefold())
        self.assertIn("no_events_reported", json.dumps(result))

    def test_summary_is_invalid_when_sharing_is_not_authorized(self) -> None:
        result = self.gateway.call_tool("dealeragent.inventory.get_used_vehicle_details", self.selector)
        prohibited = deepcopy(result["history_reports"][0])
        prohibited["summary_sharing_authorized"] = False
        with self.assertRaises(GatewayError):
            self.gateway.schemas.validate("used-vehicle.schema.json#/$defs/historyReport", prohibited)

    def test_new_vehicle_has_no_used_vehicle_disclosure(self) -> None:
        selector = {**self.selector, "vehicle_id": "veh.2026-001"}
        with self.assertRaises(GatewayError) as caught:
            self.gateway.call_tool("dealeragent.inventory.get_used_vehicle_details", selector)
        self.assertEqual("dealeragent.resource.not_found", caught.exception.code)

    def test_search_filters_mileage_with_explicit_unit_conversion(self) -> None:
        result = self.gateway.call_tool(
            "dealeragent.inventory.search",
            {
                "organization_id": "org.example-motors",
                "filters": {"odometer_min": {"value": 29_000, "unit": "km"}},
            },
        )
        self.assertEqual(["veh.2024-002"], [vehicle["vehicle_id"] for vehicle in result["vehicles"]])

    def test_search_filters_and_sorts_inventory_age(self) -> None:
        result = self.gateway.call_tool(
            "dealeragent.inventory.search",
            {
                "organization_id": "org.example-motors",
                "filters": {"inventory_age_min_days": 30, "history_report_status": ["conflicting"]},
                "sort": {"field": "inventory_age_days", "order": "desc"},
            },
        )
        self.assertEqual(1, len(result["vehicles"]))
        self.assertEqual(47, result["vehicles"][0]["used_vehicle"]["inventory_tenure"]["age_days"])

    def test_client_preserves_history_conflict(self) -> None:
        result = self.gateway.call_tool("dealeragent.inventory.get_used_vehicle_details", self.selector)
        presentation = history_presentation(result)
        self.assertFalse(presentation.may_say_accident_free)
        self.assertIn("conflict", presentation.label.lower())

    def test_client_inventory_age_label_includes_as_of_and_basis(self) -> None:
        result = self.gateway.call_tool("dealeragent.inventory.get_used_vehicle_details", self.selector)
        label = inventory_age_label(result["inventory_tenure"])
        self.assertIn("47 complete days", label)
        self.assertIn("2026-09-01T14:00:00Z", label)
        self.assertIn("stocked", label)


if __name__ == "__main__":
    unittest.main()
