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


__all__ = ["AvailabilityBand", "AvailabilityPresentation", "availability_presentation"]
