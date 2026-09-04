# Changelog

All notable changes to Dealer Agent Protocol are recorded here.

## Unreleased — 2026-09-02

- Deployed the first dealer-backed Gateway pilot at
  `https://mcp.dealeragentgateway.com/mcp` using Howard Bentley Buick GMC's
  authorized daily retail feed, public-safe field filtering, rate limiting,
  honest pricing and availability uncertainty, and private query receipts.
- Added the zero-server `/.well-known/dealer-agent.json` publication path,
  schema, example, and Dealer Agent Inventory CSV 0.1 format.
- Added the first Dealer.com-style CSV adapter and executable edge-case tests.
- Added the optional Used Vehicle Retail profile with unit-explicit odometer
  readings, dated inventory tenure, provider-neutral history evidence,
  title/condition/certification/reconditioning records, and conflict-preserving
  presentation rules.
- Promoted the two-phase consented handoff as a separately claimed profile with
  ES256 consent bindings, ADF output, and replay/expiry/subject/rooftop tests.
- Added disclosure completeness, per-rooftop freshness SLAs, five availability
  bands, DMC-12 trust-level credits, and requirement IDs for every normative
  MUST.
- Published the One Price Problem paper and three golden vectors.
- Added TypeScript and Python client safety helpers plus the `dealer-agent` CLI
  scaffold.
- Rebuilt the Dealer Agent Protocol and DealershipMCP sites around human
  explanations, accessible diagrams, a sourced comparison, the free AI Answer
  Audit, and a public conformance/rooftop evidence path.
- Deployed the synthetic reference endpoint at
  `https://mcp.dealershipmcp.com/mcp` and retained the legacy MCP hostname as an
  alias while redirecting the gateway marketing domain to DealershipMCP.

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
