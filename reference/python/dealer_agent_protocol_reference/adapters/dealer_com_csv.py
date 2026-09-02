"""Dealer.com-style CSV export to dealer-agent-inventory-csv/0.1.

Dealer.com export headers vary by account. This adapter accepts the common
aliases below and a caller-supplied override map. It has no vendor API access
and does not imply a partnership or endorsement.
"""

from __future__ import annotations

import csv
import json
from datetime import datetime
from decimal import Decimal, InvalidOperation
from io import StringIO
from typing import Dict, Iterable, List, Mapping, Optional


DEFAULT_ALIASES = {
    "vin": ("VIN", "Vin", "vin"),
    "stock_number": ("StockNumber", "Stock #", "Stock", "stock_number"),
    "year": ("Year", "year"),
    "make": ("Make", "make"),
    "model": ("Model", "model"),
    "trim": ("Trim", "trim"),
    "condition": ("NewUsed", "Condition", "condition"),
    "listing_url": ("VDPUrl", "VehicleUrl", "URL", "listing_url"),
    "observed_at": ("LastUpdated", "FeedDate", "observed_at"),
    "advertised_price": ("Price", "InternetPrice", "SalePrice", "advertised_price"),
    "availability_status": ("Status", "Availability", "availability_status"),
    "odometer_value": ("Mileage", "Odometer", "Miles", "odometer_value"),
    "odometer_unit": ("MileageUnit", "OdometerUnit", "odometer_unit"),
    "stocked_at": ("StockedDate", "InStockDate", "DateInStock", "stocked_at"),
    "first_public_listing_at": ("FirstListedDate", "InventoryDate", "first_public_listing_at"),
    "carfax_url": ("CarfaxUrl", "CARFAX URL", "carfax_url"),
    "autocheck_url": ("AutoCheckUrl", "AutoCheck URL", "autocheck_url"),
    "certification_type": ("CertificationType", "CPOType", "certification_type"),
}


class DealerComCsvAdapter:
    def __init__(
        self,
        organization_id: str,
        rooftop_id: str,
        *,
        currency: str = "USD",
        header_overrides: Optional[Mapping[str, str]] = None,
        required_dealer_charges: Optional[List[dict]] = None,
        default_odometer_unit: Optional[str] = None,
    ) -> None:
        self.organization_id = organization_id
        self.rooftop_id = rooftop_id
        self.currency = currency
        self.header_overrides = dict(header_overrides or {})
        self.required_dealer_charges = required_dealer_charges or []
        if default_odometer_unit not in {None, "mi", "km"}:
            raise ValueError("default_odometer_unit must be mi, km, or None")
        self.default_odometer_unit = default_odometer_unit

    def convert(self, source: str) -> List[Dict[str, str]]:
        reader = csv.DictReader(StringIO(source))
        if not reader.fieldnames:
            raise ValueError("CSV header row is required")
        rows = [self._convert_row(row, index + 2) for index, row in enumerate(reader)]
        seen = set()
        for row in rows:
            key = (row["rooftop_id"], row["vin"])
            if key in seen:
                raise ValueError(f"duplicate rooftop/VIN at {key[0]}/{key[1]}")
            seen.add(key)
        return rows

    def _value(self, row: Mapping[str, str], field: str) -> str:
        override = self.header_overrides.get(field)
        if override:
            return (row.get(override) or "").strip()
        for alias in DEFAULT_ALIASES[field]:
            if alias in row and row[alias] is not None:
                return row[alias].strip()
        return ""

    def _convert_row(self, row: Mapping[str, str], line: int) -> Dict[str, str]:
        vin = self._value(row, "vin").upper()
        if len(vin) != 17 or any(character in "IOQ" for character in vin):
            raise ValueError(f"invalid VIN on line {line}")
        try:
            year = int(self._value(row, "year"))
        except ValueError as error:
            raise ValueError(f"invalid year on line {line}") from error
        price_raw = self._value(row, "advertised_price").replace("$", "").replace(",", "")
        try:
            price = Decimal(price_raw)
        except InvalidOperation as error:
            raise ValueError(f"invalid advertised price on line {line}") from error
        minor = price * 100
        if price < 0 or minor != minor.to_integral_value():
            raise ValueError(f"unrepresentable advertised price on line {line}")
        observed = self._value(row, "observed_at")
        try:
            parsed = datetime.fromisoformat(observed.replace("Z", "+00:00"))
        except ValueError as error:
            raise ValueError(f"invalid observed_at on line {line}") from error
        if parsed.tzinfo is None:
            raise ValueError(f"observed_at requires an explicit offset on line {line}")

        condition = self._value(row, "condition").lower()
        condition = {"n": "new", "u": "used", "cpo": "certified", "certified pre-owned": "certified"}.get(condition, condition)
        if condition not in {"new", "used", "certified"}:
            raise ValueError(f"invalid condition on line {line}")
        status = self._value(row, "availability_status").lower().replace(" ", "_") or "unknown"
        status = {"in_stock": "available", "active": "available", "sold": "unavailable"}.get(status, status)
        if status not in {"available", "unavailable", "in_transit", "reserved", "unknown"}:
            status = "unknown"

        odometer_value = self._value(row, "odometer_value").replace(",", "")
        odometer_unit = self._value(row, "odometer_unit").lower() or self.default_odometer_unit or ""
        if odometer_value:
            try:
                if int(odometer_value) < 0 or str(int(odometer_value)) != odometer_value:
                    raise ValueError
            except ValueError as error:
                raise ValueError(f"invalid odometer on line {line}") from error
            if odometer_unit not in {"mi", "km"}:
                raise ValueError(f"odometer unit is required on line {line}")

        stocked_at = self._optional_timestamp(row, "stocked_at", line)
        first_listed_at = self._optional_timestamp(row, "first_public_listing_at", line)
        history_reports = []
        for field, provider_id, provider_name in (
            ("carfax_url", "com.carfax", "CARFAX"),
            ("autocheck_url", "com.experian.autocheck", "AutoCheck"),
        ):
            report_url = self._value(row, field)
            if report_url:
                history_reports.append(
                    {
                        "provider_id": provider_id,
                        "provider_name": provider_name,
                        "status": "available",
                        "access": "public_link",
                        "report_url": report_url,
                        "summary_sharing_authorized": False,
                    }
                )

        certification = self._value(row, "certification_type").lower().replace(" ", "_")
        certification = {"cpo": "manufacturer_cpo", "manufacturer": "manufacturer_cpo", "dealer": "dealer_certified"}.get(certification, certification)
        if certification and certification not in {"manufacturer_cpo", "dealer_certified", "third_party_certified", "not_certified", "unknown"}:
            raise ValueError(f"invalid certification type on line {line}")

        return {
            "organization_id": self.organization_id,
            "rooftop_id": self.rooftop_id,
            "vin": vin,
            "stock_number": self._value(row, "stock_number"),
            "year": str(year),
            "make": self._value(row, "make"),
            "model": self._value(row, "model"),
            "trim": self._value(row, "trim"),
            "condition": condition,
            "listing_url": self._value(row, "listing_url"),
            "observed_at": parsed.isoformat().replace("+00:00", "Z"),
            "advertised_price_minor": str(int(minor)),
            "currency": self.currency,
            "required_dealer_charges_json": json.dumps(self.required_dealer_charges, separators=(",", ":")),
            "conditional_adjustments_json": "[]",
            "government_charges_status": "unknown",
            "availability_status": status,
            "odometer_value": odometer_value,
            "odometer_unit": odometer_unit,
            "stocked_at": stocked_at,
            "first_public_listing_at": first_listed_at,
            "history_reports_json": json.dumps(history_reports, separators=(",", ":")),
            "certification_type": certification,
        }

    def _optional_timestamp(self, row: Mapping[str, str], field: str, line: int) -> str:
        value = self._value(row, field)
        if not value:
            return ""
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as error:
            raise ValueError(f"invalid {field} on line {line}") from error
        if parsed.tzinfo is None:
            raise ValueError(f"{field} requires an explicit offset on line {line}")
        return parsed.isoformat().replace("+00:00", "Z")

    @staticmethod
    def write(rows: Iterable[Mapping[str, str]]) -> str:
        rows = list(rows)
        if not rows:
            return ""
        output = StringIO()
        writer = csv.DictWriter(output, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
        return output.getvalue()
