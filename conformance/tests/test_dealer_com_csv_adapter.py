from __future__ import annotations

import unittest

from dealer_agent_protocol_reference.adapters import DealerComCsvAdapter


SOURCE = """VIN,StockNumber,Year,Make,Model,Trim,NewUsed,VDPUrl,LastUpdated,Price,Status
1HGBH41JXMN109186,N26001,2026,Example,Northstar,Touring AWD,N,https://dealer.example/N26001,2026-09-02T14:00:00Z,"$42,875.00",In Stock
"""

USED_SOURCE = """VIN,StockNumber,Year,Make,Model,Trim,NewUsed,VDPUrl,LastUpdated,Price,Status,Mileage,OdometerUnit,StockedDate,FirstListedDate,CarfaxUrl,AutoCheckUrl,CertificationType
2HGFC2F59JH000001,U24002,2024,Example,Northstar,Touring AWD,U,https://dealer.example/U24002,2026-09-02T14:00:00Z,"$31,995.00",In Stock,18420,mi,2026-07-17T10:00:00Z,2026-07-19T12:00:00Z,https://example.invalid/carfax/U24002,https://example.invalid/autocheck/U24002,dealer
"""


class DealerComCsvAdapterTests(unittest.TestCase):
    def test_common_export_maps_to_normative_csv(self) -> None:
        adapter = DealerComCsvAdapter(
            "org.example-motors",
            "roof.downtown",
            required_dealer_charges=[{"label": "Documentation fee", "amount_minor": 99500}],
        )
        rows = adapter.convert(SOURCE)
        self.assertEqual("4287500", rows[0]["advertised_price_minor"])
        self.assertEqual("available", rows[0]["availability_status"])
        self.assertEqual("new", rows[0]["condition"])
        self.assertIn("Documentation fee", rows[0]["required_dealer_charges_json"])
        rendered = adapter.write(rows)
        self.assertIn("dealer-agent", "dealer-agent-inventory-csv/0.1")
        self.assertIn("advertised_price_minor", rendered)

    def test_duplicate_vin_in_same_rooftop_is_rejected(self) -> None:
        adapter = DealerComCsvAdapter("org.example-motors", "roof.downtown")
        with self.assertRaisesRegex(ValueError, "duplicate"):
            adapter.convert(SOURCE + SOURCE.splitlines()[1] + "\n")

    def test_fractional_minor_units_are_rejected(self) -> None:
        adapter = DealerComCsvAdapter("org.example-motors", "roof.downtown")
        with self.assertRaisesRegex(ValueError, "unrepresentable"):
            adapter.convert(SOURCE.replace("$42,875.00", "$42,875.001"))

    def test_used_vehicle_fields_and_provider_links_are_mapped(self) -> None:
        adapter = DealerComCsvAdapter("org.example-motors", "roof.downtown")
        row = adapter.convert(USED_SOURCE)[0]
        self.assertEqual("18420", row["odometer_value"])
        self.assertEqual("mi", row["odometer_unit"])
        self.assertEqual("2026-07-17T10:00:00Z", row["stocked_at"])
        self.assertEqual("dealer_certified", row["certification_type"])
        self.assertIn("com.carfax", row["history_reports_json"])
        self.assertIn('"summary_sharing_authorized":false', row["history_reports_json"])

    def test_odometer_without_unit_or_configured_default_is_rejected(self) -> None:
        adapter = DealerComCsvAdapter("org.example-motors", "roof.downtown")
        with self.assertRaisesRegex(ValueError, "unit"):
            adapter.convert(USED_SOURCE.replace(",mi,", ",,"))

    def test_configured_odometer_unit_is_explicitly_applied(self) -> None:
        adapter = DealerComCsvAdapter("org.example-motors", "roof.downtown", default_odometer_unit="mi")
        row = adapter.convert(USED_SOURCE.replace(",mi,", ",,"))[0]
        self.assertEqual("mi", row["odometer_unit"])


if __name__ == "__main__":
    unittest.main()
