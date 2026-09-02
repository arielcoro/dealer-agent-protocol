from __future__ import annotations

import unittest

from dealer_agent_protocol_reference.adapters import DealerComCsvAdapter


SOURCE = """VIN,StockNumber,Year,Make,Model,Trim,NewUsed,VDPUrl,LastUpdated,Price,Status
1HGBH41JXMN109186,N26001,2026,Example,Northstar,Touring AWD,N,https://dealer.example/N26001,2026-09-02T14:00:00Z,"$42,875.00",In Stock
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


if __name__ == "__main__":
    unittest.main()
