"""Realistic, synthetic dealership records for the reference implementation."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List


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
    }
