"""Dealer Agent Protocol client safety helpers."""

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal, Mapping, Optional


AvailabilityBand = Literal["verified_current", "recent_authoritative", "asserted", "stale", "unknown"]


@dataclass(frozen=True)
class AvailabilityPresentation:
    band: AvailabilityBand
    may_say_available_now: bool
    label: str


def availability_presentation(record: Mapping, now: Optional[datetime] = None) -> AvailabilityPresentation:
    """Classify without ever upgrading an asserted, stale, or unknown fact."""
    now = now or datetime.now(timezone.utc)
    availability = record.get("availability", {})
    freshness = record.get("freshness", {})
    authority = availability.get("authority_status") or record.get("provenance", {}).get("authority_status")
    observed_raw = freshness.get("observed_at") or availability.get("observed_at")
    if not observed_raw:
        return AvailabilityPresentation("unknown", False, "Availability unknown")
    observed = datetime.fromisoformat(str(observed_raw).replace("Z", "+00:00"))
    age = max(0, (now - observed).total_seconds())
    if freshness.get("state") in {"stale", "unknown"}:
        return AvailabilityPresentation(freshness.get("state", "unknown"), False, "Availability needs verification")
    if authority == "authoritative" and age <= 120 and availability.get("status") == "available":
        return AvailabilityPresentation("verified_current", True, "Available — verified now")
    if authority == "authoritative" and age <= 900:
        return AvailabilityPresentation("recent_authoritative", False, "Recently observed — confirm before acting")
    if authority in {"asserted", "dealer_asserted"} and age <= 86400:
        return AvailabilityPresentation("asserted", False, "Dealer-published listing — availability not verified")
    return AvailabilityPresentation("stale", False, "Availability needs verification")


def inventory_age_label(tenure: Mapping) -> str:
    """Produce a dated inventory-age statement without hiding the age basis."""
    basis = {
        "stocked_at": "dealer stocked date",
        "first_public_listing_at": "first public listing",
        "source_reported": "source-reported age",
    }.get(tenure.get("age_basis"), "unknown basis")
    return f"{tenure['age_days']} complete days in inventory as of {tenure['age_as_of']}, based on {basis}"


@dataclass(frozen=True)
class HistoryPresentation:
    may_say_accident_free: bool
    label: str


def history_presentation(details: Mapping) -> HistoryPresentation:
    """Preserve report conflicts and never turn absence of events into a guarantee."""
    discrepancies = details.get("discrepancies", [])
    if any(item.get("status") == "unresolved" and "accident" in item.get("field", "") for item in discrepancies):
        return HistoryPresentation(False, "Vehicle-history reports conflict — review the original reports")
    statuses = [
        report.get("summary", {}).get("accident_status")
        for report in details.get("history_reports", [])
        if report.get("summary", {}).get("accident_status")
    ]
    if "events_reported" in statuses:
        return HistoryPresentation(False, "At least one vehicle-history report contains an accident event")
    if statuses and all(status == "no_events_reported" for status in statuses):
        return HistoryPresentation(False, "No accident events reported by the named reports as observed")
    return HistoryPresentation(False, "Accident history unknown")


__all__ = [
    "AvailabilityBand",
    "AvailabilityPresentation",
    "HistoryPresentation",
    "availability_presentation",
    "history_presentation",
    "inventory_age_label",
]
