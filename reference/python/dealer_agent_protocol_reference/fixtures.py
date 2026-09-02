"""Realistic, synthetic dealership records for the reference implementation."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

from .used_vehicle import inventory_age_days


ORGANIZATION_ID = "org.example-motors"
DOWNTOWN = "roof.downtown"
NORTH = "roof.north"


def _ts(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _source(name: str, authority: str, observed: datetime, record_id: str) -> Dict[str, Any]:
    return {
        "source_name": name,
        "source_record_id": record_id,
        "authority": authority,
        "observed_at": _ts(observed),
    }


def _provenance(name: str, authority: str, observed: datetime, record_id: str) -> Dict[str, Any]:
    authority_status = {
        "authoritative_dealer_system": "authoritative",
        "dealer_asserted": "asserted",
        "derived": "derived",
    }.get(authority, "unknown")
    return {
        "sources": [_source(name, authority, observed, record_id)],
        "authority_status": authority_status,
        "transformed_at": _ts(observed + timedelta(seconds=1)),
    }


def _freshness(observed: datetime, valid_until: datetime, state: str) -> Dict[str, Any]:
    return {
        "observed_at": _ts(observed),
        "valid_until": _ts(valid_until),
        "state": state,
        "max_age_seconds": max(0, int((valid_until - observed).total_seconds())),
    }


def _vehicle(
    now: datetime,
    *,
    vehicle_id: str,
    rooftop_id: str,
    vin: str,
    stock: str,
    year: int,
    model: str,
    condition: str,
    price_minor: int,
    stale: bool = False,
) -> Dict[str, Any]:
    observed = now - (timedelta(hours=2) if stale else timedelta(minutes=2))
    valid_until = now - timedelta(hours=1) if stale else now + timedelta(minutes=13)
    state = "stale" if stale else "current"
    authority_status = "asserted" if stale else "authoritative"
    availability_status = "unknown" if stale else "available"
    return {
        "vehicle_id": vehicle_id,
        "organization_id": ORGANIZATION_ID,
        "rooftop_id": rooftop_id,
        "vin": vin,
        "stock_number": stock,
        "vehicle_type": "suv",
        "year": year,
        "make": "Example",
        "model": model,
        "trim": "Touring AWD",
        "condition": condition,
        "body_style": "SUV",
        "exterior_color": "Deep Blue" if not stale else "Silver",
        "odometer": {
            "value": 7 if condition == "new" else 18420,
            "unit": "mi",
            "status": "actual",
        },
        "features": ["adaptive cruise control", "heated front seats"],
        "listing_url": f"https://dealer.example/inventory/{stock}",
        "advertised_price": {
            "amount": {"amount_minor": price_minor, "currency": "USD"},
            "availability": "generally_available",
            "includes_required_dealer_charges": True,
            "valid_until": _ts(now + timedelta(days=2)),
        },
        "availability": {
            "status": availability_status,
            "authority_status": authority_status,
            "observed_at": _ts(observed),
            "valid_until": _ts(valid_until),
            "human_verification_required": stale,
            **({"reason": "Authoritative inventory observation expired."} if stale else {}),
        },
        "provenance": _provenance(
            "dealer-inventory-system",
            "dealer_asserted" if stale else "authoritative_dealer_system",
            observed,
            stock,
        ),
        "freshness": _freshness(observed, valid_until, state),
    }


def _pricing(vehicle: Dict[str, Any], now: datetime, stale: bool = False) -> Dict[str, Any]:
    observed = now - (timedelta(hours=2) if stale else timedelta(minutes=3))
    valid_until = now - timedelta(hours=1) if stale else now + timedelta(minutes=57)
    state = "stale" if stale else "current"
    price = deepcopy(vehicle["advertised_price"])
    price["valid_until"] = _ts(valid_until)
    return {
        "disclosure_id": f"pricing.{vehicle['vehicle_id']}",
        "vehicle_id": vehicle["vehicle_id"],
        "organization_id": vehicle["organization_id"],
        "rooftop_id": vehicle["rooftop_id"],
        "advertised_price": price,
        "required_dealer_charges": [
            {
                "charge_id": "charge.documentation",
                "name": "Documentation charge",
                "amount": {"amount_minor": 99500, "currency": "USD"},
                "payee": "dealer",
                "included_in_advertised_price": True,
                "taxable_status": "jurisdiction_dependent",
                "required": True,
                "provenance": _provenance(
                    "dealer-pricing-system",
                    "authoritative_dealer_system",
                    observed,
                    "documentation-charge",
                ),
            }
        ],
        "conditional_adjustments": [
            {
                "adjustment_id": "incentive.military",
                "name": "Military appreciation incentive",
                "direction": "discount",
                "amount_status": "known",
                "amount": {"amount_minor": 50000, "currency": "USD"},
                "criteria": [
                    {
                        "criterion": "military",
                        "operator": "verified",
                        "value": True,
                        "evidence_status": "required",
                        "description": "Dealer verification of current or qualifying prior service is required.",
                    }
                ],
                "criteria_mode": "all",
                "jurisdictions": [{"country": "US"}],
                "valid_until": _ts(now + timedelta(days=30)),
                "stacking": {"group": "affinity", "combinability": "rule_defined"},
                "provenance": _provenance(
                    "dealer-pricing-system",
                    "authoritative_dealer_system",
                    observed,
                    "military-2026-09",
                ),
            }
        ],
        "government_charges": {
            "status": "unknown",
            "assumptions": ["Buyer registration jurisdiction has not been supplied."],
            "provenance": _provenance(
                "dealer-pricing-policy",
                "dealer_asserted",
                observed,
                "government-charge-policy",
            ),
        },
        "disclosure_completeness": {
            "score": 85 if not stale else 60,
            "components": {
                "advertised_price_present_and_authoritative": not stale,
                "required_dealer_charges_itemized": True,
                "conditional_adjustments_have_eligibility_and_stacking": True,
                "government_charges_classified": True,
                "availability_band": "recent_authoritative" if not stale else "stale",
            },
        },
        "disclosure_text": "Government charges depend on buyer and registration facts. Conditional incentives require verification.",
        "uncertainty": {
            "status": "unknown",
            "reason": "Government charges and incentive eligibility are not yet known.",
            "assumptions": ["No conditional incentive is included in the advertised price."],
        },
        "provenance": _provenance(
            "dealer-pricing-system",
            "dealer_asserted" if stale else "authoritative_dealer_system",
            observed,
            vehicle["vehicle_id"],
        ),
        "freshness": _freshness(observed, valid_until, state),
    }


def _used_vehicle_details(now: datetime, vehicle: Dict[str, Any]) -> Dict[str, Any]:
    observed = now - timedelta(minutes=30)
    valid_until = now + timedelta(hours=23, minutes=30)
    stocked_at = now - timedelta(days=47, hours=4)
    first_listed_at = now - timedelta(days=45, hours=2)
    provider_freshness = _freshness(observed, now + timedelta(days=29), "current")
    dealer_freshness = _freshness(observed, valid_until, "current")
    inventory_tenure = {
        "stocked_at": _ts(stocked_at),
        "first_public_listing_at": _ts(first_listed_at),
        "age_days": inventory_age_days(stocked_at, now),
        "age_as_of": _ts(now),
        "age_basis": "stocked_at",
        "provenance": _provenance("dealer-inventory-system", "authoritative_dealer_system", observed, vehicle["stock_number"]),
        "freshness": dealer_freshness,
    }
    carfax_summary = {
        "accident_status": "no_events_reported",
        "accident_event_count": 0,
        "damage_status": "no_damage_reported",
        "structural_damage_status": "not_reported",
        "airbag_deployment_status": "not_reported",
        "title_brand_status": "no_brands_reported",
        "odometer_consistency": "consistent",
        "owner_count_status": "known",
        "owner_count": 1,
        "prior_use": ["personal"],
        "service_record_count": 6,
        "last_reported_odometer": {"value": 18110, "unit": "mi"},
    }
    autocheck_summary = {
        "accident_status": "events_reported",
        "accident_event_count": 1,
        "damage_status": "damage_reported",
        "structural_damage_status": "not_reported",
        "airbag_deployment_status": "unknown",
        "title_brand_status": "no_brands_reported",
        "odometer_consistency": "consistent",
        "owner_count_status": "known",
        "owner_count": 1,
        "prior_use": ["personal"],
        "last_reported_odometer": {"value": 18201, "unit": "mi"},
    }
    return {
        "vehicle_id": vehicle["vehicle_id"],
        "organization_id": vehicle["organization_id"],
        "rooftop_id": vehicle["rooftop_id"],
        "vin": vehicle["vin"],
        "condition": vehicle["condition"],
        "odometer": {
            "reading": {"value": 18420, "unit": "mi"},
            "status": "actual",
            "observed_at": _ts(observed),
            "provenance": _provenance("dealer-inventory-system", "authoritative_dealer_system", observed, vehicle["stock_number"]),
            "freshness": dealer_freshness,
        },
        "inventory_tenure": inventory_tenure,
        "history_reports": [
            {
                "provider_id": "com.carfax",
                "provider_name": "CARFAX",
                "report_id": "synthetic-carfax-002",
                "status": "available",
                "access": "public_link",
                "report_url": "https://example.invalid/history/carfax/U24002",
                "report_generated_at": _ts(now - timedelta(days=7)),
                "observed_at": _ts(observed),
                "summary_sharing_authorized": True,
                "summary": carfax_summary,
                "provenance": _provenance("CARFAX synthetic fixture", "third_party", observed, "synthetic-carfax-002"),
                "freshness": provider_freshness,
            },
            {
                "provider_id": "com.experian.autocheck",
                "provider_name": "AutoCheck",
                "report_id": "synthetic-autocheck-002",
                "status": "available",
                "access": "dealer_presented",
                "report_generated_at": _ts(now - timedelta(days=6)),
                "observed_at": _ts(observed),
                "summary_sharing_authorized": True,
                "summary": autocheck_summary,
                "provenance": _provenance("AutoCheck synthetic fixture", "third_party", observed, "synthetic-autocheck-002"),
                "freshness": provider_freshness,
            },
        ],
        "title": {
            "status": "clear",
            "brands": [],
            "jurisdiction": "US-FL",
            "provenance": _provenance("dealer-title-file", "dealer_asserted", observed, vehicle["vin"]),
            "freshness": dealer_freshness,
        },
        "condition_report": {
            "status": "completed",
            "inspection_authority": "dealer",
            "inspector_name": "Example Motors Used Vehicle Center",
            "inspected_at": _ts(now - timedelta(days=2)),
            "inspection_point_count": 125,
            "grade": {"system": "Example Motors retail inspection v1", "value": "retail-ready with disclosed cosmetic wear"},
            "components": [
                {"component": "mechanical", "status": "pass"},
                {"component": "brakes", "status": "pass"},
                {"component": "tires", "status": "pass"},
                {"component": "exterior", "status": "attention", "note": "Small repaired scratch on the right rear door."},
            ],
            "disclosed_damage": ["Small repaired scratch on the right rear door."],
            "provenance": _provenance("dealer-used-inspection", "dealer_asserted", observed, "inspection-U24002"),
            "freshness": dealer_freshness,
        },
        "certification": {
            "type": "not_certified",
            "provenance": _provenance("dealer-inventory-system", "authoritative_dealer_system", observed, vehicle["stock_number"]),
            "freshness": dealer_freshness,
        },
        "reconditioning": {
            "status": "completed",
            "completed_at": _ts(now - timedelta(days=1)),
            "items": [
                {"category": "brakes", "description": "Front brake pads replaced.", "status": "completed"},
                {"category": "tires", "description": "Four tires measured and passed retail inspection.", "status": "completed"},
                {"category": "cosmetic", "description": "Right rear door scratch repaired and disclosed.", "status": "completed"},
            ],
            "provenance": _provenance("dealer-reconditioning-status", "dealer_asserted", observed, "recon-U24002"),
            "freshness": dealer_freshness,
        },
        "discrepancies": [
            {
                "field": "history.accident_status",
                "source_names": ["CARFAX synthetic fixture", "AutoCheck synthetic fixture"],
                "description": "One synthetic report has no accident event while the other has one reported event; the gateway does not reconcile them.",
                "status": "unresolved",
            }
        ],
        "provenance": {
            "sources": [
                _source("dealer-inventory-system", "authoritative_dealer_system", observed, vehicle["stock_number"]),
                _source("CARFAX synthetic fixture", "third_party", observed, "synthetic-carfax-002"),
                _source("AutoCheck synthetic fixture", "third_party", observed, "synthetic-autocheck-002"),
            ],
            "authority_status": "asserted",
            "transformed_at": _ts(now),
            "transformations": ["normalized provider-specific fields without resolving the provider conflict"],
        },
        "freshness": dealer_freshness,
        "trace_id": "trace.fixture.used.002",
    }


def build_fixture(now: datetime) -> Dict[str, Any]:
    """Build deterministic shapes with freshness relative to the injected clock."""

    now = now.astimezone(timezone.utc)
    observed = now - timedelta(minutes=5)
    vehicles: List[Dict[str, Any]] = [
        _vehicle(
            now,
            vehicle_id="veh.2026-001",
            rooftop_id=DOWNTOWN,
            vin="1HGBH41JXMN109186",
            stock="N26001",
            year=2026,
            model="Northstar",
            condition="new",
            price_minor=4287500,
        ),
        _vehicle(
            now,
            vehicle_id="veh.2024-002",
            rooftop_id=DOWNTOWN,
            vin="2HGFC2F59JH000001",
            stock="U24002",
            year=2024,
            model="Northstar",
            condition="used",
            price_minor=3199500,
            stale=True,
        ),
        _vehicle(
            now,
            vehicle_id="veh.2026-003",
            rooftop_id=NORTH,
            vin="3GNAXUEV1NL000001",
            stock="N26003",
            year=2026,
            model="Trailwind",
            condition="new",
            price_minor=3975000,
        ),
    ]
    used_vehicle_details = _used_vehicle_details(now, vehicles[1])
    vehicles[1]["used_vehicle"] = {
        "inventory_tenure": deepcopy(used_vehicle_details["inventory_tenure"]),
        "history_report_status": "conflicting",
        "certification_type": used_vehicle_details["certification"]["type"],
    }
    dealer = {
        "organization_id": ORGANIZATION_ID,
        "name": "Example Motors Group",
        "legal_name": "Example Motors Group LLC",
        "rooftops": [
            {
                "rooftop_id": DOWNTOWN,
                "name": "Example Motors Downtown",
                "website": "https://dealer.example/downtown",
                "address": {
                    "lines": ["100 Example Avenue"],
                    "locality": "Miami",
                    "region": "FL",
                    "postal_code": "33101",
                    "country": "US",
                },
                "timezone": "America/New_York",
                "departments": ["sales", "internet_sales", "service", "parts"],
                "contacts": [
                    {"department": "internet_sales", "channel": "phone", "value": "+13055550100", "public": True}
                ],
                "supported_languages": ["en-US", "es-US"],
                "supported_currencies": ["USD"],
            },
            {
                "rooftop_id": NORTH,
                "name": "Example Motors North",
                "website": "https://dealer.example/north",
                "address": {
                    "lines": ["200 Example Avenue"],
                    "locality": "Fort Lauderdale",
                    "region": "FL",
                    "postal_code": "33301",
                    "country": "US",
                },
                "timezone": "America/New_York",
                "departments": ["sales", "internet_sales", "service"],
                "supported_languages": ["en-US"],
                "supported_currencies": ["USD"],
            },
        ],
        "provenance": _provenance("dealer-directory", "authoritative_dealer_system", observed, ORGANIZATION_ID),
        "freshness": _freshness(observed, now + timedelta(hours=1), "current"),
    }
    return {
        "dealer": dealer,
        "vehicles": vehicles,
        "pricing": {vehicle["vehicle_id"]: _pricing(vehicle, now, vehicle["freshness"]["state"] == "stale") for vehicle in vehicles},
        "used_vehicle_details": {vehicles[1]["vehicle_id"]: used_vehicle_details},
    }
