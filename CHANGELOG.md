# Changelog

All notable changes to Dealer Agent Protocol are recorded here.

## 0.1.0-draft.1 — 2026-09-01

- Established MCP `2026-07-28` as the normative transport baseline.
- Defined the mandatory Core Retail Read bundle as the complete version 0.1
  surface.
- Added dealer, vehicle, retail pricing, and manifest schemas.
- Moved early quote, hold, appointment, consent, and handoff experiments to a
  non-normative incubator; they are not part of version 0.1 conformance.
- Added provenance, freshness, uncertainty, and exact minor-unit money types.
- Separated published retail reads from protected authoritative checks.
- Added group/rooftop authorization, scoped cursor, privacy, and audit
  requirements.
- Added mappings for AAP v1.2, Automotive MCP v0.1, and DMC-12 v1.0.
- Added initial examples, conformance claim, and validation script.
- Added a synthetic reference gateway implementing all six Core Retail Read
  tools over stateless MCP `2026-07-28` stdio.
- Added behavioral and wire-protocol tests for tenancy, stale data, pricing,
  opaque cursors, structured errors, discovery, resources, and stdio framing.
