#!/usr/bin/env python3
"""Export the synthetic demo fleet consumed by the public demo gateway worker.

The worker at deployment/cloudflare/demo-gateway-core.mjs (entry: reference-gateway-worker.mjs) serves
clearly labeled synthetic data for Example Motors Group. This script builds
that data from the same fixture helpers the conformance suite exercises, adds
a larger fleet so searches and filters are meaningful, validates every record
against the normative schemas, and writes deployment/cloudflare/demo-fixture.json.

Timestamps in the file are placeholders: the worker re-stamps observation,
validity, and tenure relative to the request clock.
"""

from __future__ import annotations

import hashlib
import json
import sys
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "reference" / "python"))

from dealer_agent_protocol_reference import fixtures  # noqa: E402
from dealer_agent_protocol_reference.schema_store import SchemaStore  # noqa: E402

OUTPUT = ROOT / "deployment" / "cloudflare" / "demo-fixture.json"
CLOCK = datetime(2026, 10, 25, 12, 0, 0, tzinfo=timezone.utc)

# Additional synthetic vehicles. VINs use the fictitious WMI "EXM" so they can
# never collide with a real manufacturer, and every make is "Example".
FLEET = [
    # vehicle_id, rooftop, vin, stock, year, model, trim, type, body, color, condition, price_minor, odometer, features, stale
    ("veh.2026-004", fixtures.DOWNTOWN, "EXM4A1B2C3D400004", "N26004", 2026, "Northstar", "Base FWD", "suv", "SUV", "Glacier White", "new", 3649500, 9, ["lane keeping assist", "wireless charging"], False),
    ("veh.2026-005", fixtures.DOWNTOWN, "EXM5A1B2C3D400005", "N26005", 2026, "Harbor", "Limited", "car", "Sedan", "Midnight Black", "new", 3395000, 12, ["heated steering wheel", "premium audio"], False),
    ("veh.2026-006", fixtures.DOWNTOWN, "EXM6A1B2C3D400006", "N26006", 2026, "Harbor", "SE", "car", "Sedan", "Cardinal Red", "new", 2899000, 5, ["adaptive cruise control"], False),
    ("veh.2026-007", fixtures.NORTH, "EXM7A1B2C3D400007", "N26007", 2026, "Ridgeline", "Crew Cab 4x4", "truck", "Pickup", "Granite Gray", "new", 5249500, 14, ["tow package", "bed liner", "360 camera"], False),
    ("veh.2026-008", fixtures.NORTH, "EXM8A1B2C3D400008", "N26008", 2026, "Trailwind", "Hybrid Touring", "suv", "SUV", "Forest Green", "new", 4495000, 11, ["hybrid powertrain", "panoramic roof"], False),
    ("veh.2025-009", fixtures.NORTH, "EXM9A1B2C3D400009", "D25009", 2025, "Trailwind", "Hybrid Touring", "suv", "SUV", "Silver", "demo", 4049500, 3120, ["hybrid powertrain", "panoramic roof"], False),
    ("veh.2023-010", fixtures.DOWNTOWN, "EXMAA1B2C3D400010", "U23010", 2023, "Harbor", "Limited", "car", "Sedan", "Pearl White", "used", 2349500, 27450, ["heated steering wheel", "premium audio"], False),
    ("veh.2022-011", fixtures.NORTH, "EXMBA1B2C3D400011", "C22011", 2022, "Ridgeline", "Crew Cab 4x4", "truck", "Pickup", "Deep Blue", "certified", 4199500, 38912, ["tow package", "360 camera"], False),
    ("veh.2024-012", fixtures.DOWNTOWN, "EXMCA1B2C3D400012", "U24012", 2024, "Northstar", "Touring AWD", "suv", "SUV", "Copper", "used", 3349500, 15230, ["adaptive cruise control", "heated front seats"], False),
    ("veh.2021-013", fixtures.NORTH, "EXMDA1B2C3D400013", "U21013", 2021, "Harbor", "SE", "car", "Sedan", "Silver", "used", 1699500, 61044, ["adaptive cruise control"], False),
]


def extend_vehicle(base: dict, spec: tuple) -> dict:
    (vehicle_id, rooftop, vin, stock, year, model, trim, vtype, body, color, condition, price, odo, features, stale) = spec
    vehicle = deepcopy(base)
    vehicle.update(
        {
            "vehicle_id": vehicle_id,
            "rooftop_id": rooftop,
            "vin": vin,
            "stock_number": stock,
            "year": year,
            "model": model,
            "trim": trim,
            "vehicle_type": vtype,
            "body_style": body,
            "exterior_color": color,
            "condition": condition,
            "features": features,
            "listing_url": f"https://dealer.example/inventory/{stock}",
        }
    )
    vehicle["odometer"]["value"] = odo
    vehicle["advertised_price"]["amount"]["amount_minor"] = price
    vehicle["provenance"]["sources"][0]["source_record_id"] = stock
    return vehicle


def main() -> int:
    data = fixtures.build_fixture(CLOCK)
    store = SchemaStore(ROOT)

    new_template = data["vehicles"][0]
    for spec in FLEET:
        vehicle = extend_vehicle(new_template, spec)
        data["vehicles"].append(vehicle)
        data["pricing"][vehicle["vehicle_id"]] = fixtures._pricing(vehicle, CLOCK)
        if vehicle["condition"] in {"used", "certified", "demo"}:
            details = fixtures._used_vehicle_details(CLOCK, vehicle)
            details["odometer"]["reading"]["value"] = vehicle["odometer"]["value"]
            details["history_reports"] = [details["history_reports"][0]]
            details["history_reports"][0]["summary"]["last_reported_odometer"]["value"] = max(0, vehicle["odometer"]["value"] - 310)
            details["discrepancies"] = []
            if vehicle["condition"] == "certified":
                details["certification"] = {
                    "type": "manufacturer_cpo",
                    "program_name": "Example Certified Pre-Owned",
                    "certified_at": fixtures._ts(CLOCK - timedelta(days=12)),
                    "provenance": details["certification"]["provenance"],
                    "freshness": details["certification"]["freshness"],
                }
            data["used_vehicle_details"][vehicle["vehicle_id"]] = details
            vehicle["used_vehicle"] = {
                "inventory_tenure": deepcopy(details["inventory_tenure"]),
                "history_report_status": "available",
                "certification_type": details["certification"]["type"],
            }

    # Give the extended fleet varied inventory tenure so age filters do something.
    for index, vehicle in enumerate(data["vehicles"]):
        details = data["used_vehicle_details"].get(vehicle["vehicle_id"])
        if details is None:
            continue
        days = 47 if vehicle["vehicle_id"] == "veh.2024-002" else 9 + (index * 11) % 70
        stocked = CLOCK - timedelta(days=days, hours=4)
        for tenure in (details["inventory_tenure"], vehicle["used_vehicle"]["inventory_tenure"]):
            tenure["stocked_at"] = fixtures._ts(stocked)
            tenure["first_public_listing_at"] = fixtures._ts(stocked + timedelta(days=2))
            tenure["age_days"] = days

    failures = 0
    for vehicle in data["vehicles"]:
        try:
            store.validate("vehicle.schema.json#/$defs/vehicle", vehicle)
        except Exception as error:  # noqa: BLE001
            failures += 1
            print(f"vehicle {vehicle['vehicle_id']} invalid: {error}", file=sys.stderr)
    for vehicle_id, pricing in data["pricing"].items():
        try:
            store.validate("pricing.schema.json#/$defs/pricingDisclosure", pricing)
        except Exception as error:  # noqa: BLE001
            failures += 1
            print(f"pricing {vehicle_id} invalid: {error}", file=sys.stderr)
    for vehicle_id, details in data["used_vehicle_details"].items():
        try:
            store.validate("used-vehicle.schema.json#/$defs/usedVehicleDetails", details)
        except Exception as error:  # noqa: BLE001
            failures += 1
            print(f"used details {vehicle_id} invalid: {error}", file=sys.stderr)
    store.validate("dealer.schema.json#/$defs/dealerOrganization", data["dealer"])
    if failures:
        return 1

    claim_path = ROOT / "conformance" / "claims" / "example-claim.json"
    claim_digest = "sha256:" + hashlib.sha256(claim_path.read_bytes()).hexdigest()
    payload = {
        "generated_with_clock": fixtures._ts(CLOCK),
        "note": "Synthetic Example Motors Group records. No real dealer, vehicle, VIN, price, or person.",
        "example_claim_digest": claim_digest,
        **data,
    }
    OUTPUT.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT.relative_to(ROOT)} with {len(data['vehicles'])} vehicles")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
