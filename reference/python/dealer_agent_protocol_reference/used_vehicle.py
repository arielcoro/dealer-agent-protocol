"""Used-vehicle normalization helpers for the synthetic reference gateway."""

from __future__ import annotations

from datetime import datetime


def inventory_age_days(basis: datetime, as_of: datetime) -> int:
    """Return complete elapsed 24-hour periods without accepting ambiguous time."""

    if basis.tzinfo is None or as_of.tzinfo is None:
        raise ValueError("inventory age timestamps require explicit offsets")
    elapsed = as_of - basis
    if elapsed.total_seconds() < 0:
        raise ValueError("inventory age basis cannot be in the future")
    return int(elapsed.total_seconds() // 86_400)
