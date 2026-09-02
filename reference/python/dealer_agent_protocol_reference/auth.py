"""Transport-independent authorization context for the reference gateway."""

from __future__ import annotations

from dataclasses import dataclass
from typing import FrozenSet, Iterable, Optional


@dataclass(frozen=True)
class AuthContext:
    """A grant already authenticated by the transport boundary.

    Production gateways must derive this context from validated, audience-bound
    credentials. Tool arguments and request metadata are never authorization.
    """

    subject: str
    organization_ids: FrozenSet[str]
    rooftop_ids: FrozenSet[str]
    scopes: FrozenSet[str]

    @classmethod
    def grant(
        cls,
        subject: str,
        organization_ids: Iterable[str],
        rooftop_ids: Iterable[str],
        scopes: Iterable[str],
    ) -> "AuthContext":
        return cls(
            subject=subject,
            organization_ids=frozenset(organization_ids),
            rooftop_ids=frozenset(rooftop_ids),
            scopes=frozenset(scopes),
        )

    def permits(self, organization_id: str, rooftop_id: Optional[str], scope: str) -> bool:
        return (
            organization_id in self.organization_ids
            and (rooftop_id is None or rooftop_id in self.rooftop_ids)
            and scope in self.scopes
        )
