"""Safe domain errors returned by Dealer Agent Protocol tools."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from uuid import uuid4


RETRYABLE = {
    "dealeragent.vehicle.stale",
    "dealeragent.state.conflict",
    "dealeragent.rate_limited",
    "dealeragent.upstream.unavailable",
    "dealeragent.internal",
}


@dataclass
class GatewayError(Exception):
    code: str
    message: str
    details: Dict[str, Any] = field(default_factory=dict)
    retry_after_ms: Optional[int] = None

    def __post_init__(self) -> None:
        super().__init__(self.message)

    @property
    def retryable(self) -> bool:
        return self.code in RETRYABLE

    def as_dict(self, trace_id: Optional[str] = None) -> Dict[str, Any]:
        result: Dict[str, Any] = {
            "error_id": f"err.{uuid4().hex}",
            "code": self.code,
            "message": self.message[:500],
            "retryable": self.retryable,
            "trace_id": trace_id or f"trace.{uuid4().hex}",
            "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        }
        if self.retry_after_ms is not None:
            result["retry_after_ms"] = self.retry_after_ms
        if self.details:
            result["details"] = self.details
        return result


def not_found() -> GatewayError:
    """One enumeration-resistant response for absent and foreign records."""

    return GatewayError("dealeragent.resource.not_found", "The requested resource was not found.")
