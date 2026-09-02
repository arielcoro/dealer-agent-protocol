# Product marketing context — Dealer Agent Protocol

Status: internal working draft, derived from the version 0.1 protocol artifacts on 2026-09-01.

## Positioning

Dealer Agent Protocol is an open, dealer-controlled contract for sharing retail inventory and offer facts with AI agents. It standardizes what agents need to understand about dealer identity, published vehicles, authoritative availability, advertised prices, required dealer charges, and conditional incentives. It is not a generic DMS or CRM API.

## Primary audiences

1. Dealer executives and digital-retail leaders who want AI shopping experiences to repeat approved, current retail facts without exposing internal systems.
2. Automotive retail technology providers that already connect inventory, pricing, website, or availability sources and can operate the gateway layer.
3. AI agent, marketplace, and OEM experience builders that need one typed contract instead of reverse-engineering every dealer website and feed.
4. Technical, security, and standards evaluators who need explicit boundaries, schemas, provenance, tenancy, and evidence-based conformance.

## Value pillars

- Dealer control: the dealer or provider chooses sources, policy, access, and freshness limits.
- Agent accuracy: results carry source, freshness, authority, and uncertainty instead of a naked value.
- Retail clarity: pricing separates advertised price, required dealer charges, conditional offers, and unresolved government charges.
- Small adoption surface: version 0.1 contains six read-only tools across four required profiles.
- Open implementation: specification, schemas, examples, conformance checks, and reference code use Apache License 2.0.

## Defensible proof

- 6 read-only tools
- 4 required profiles in the core retail read bundle
- 7 JSON schemas including the conformance claim schema
- 24 repository conformance checks
- MCP revision 2026-07-28 and JSON Schema 2020-12
- Public reference gateway using synthetic data only

These are artifact counts, not adoption or customer claims.

## Adoption message

Start with one rooftop, one approved source map, the six core reads, and a set of real shopping questions. Validate the answers before publishing a public endpoint.

## Voice

Precise, grounded, editorial, and direct. Lead with human outcomes, then show the architecture and exact contract. Say “editor's draft,” “open contract,” and “conformance evidence.” Do not say “ratified industry standard,” “certified,” or imply customer adoption that has not occurred.

## Preferred language

Use: retail truth, dealer-published, dealer-controlled, authoritative availability, source-aware, normalized retail catalog, read-only, open draft, implement, evaluate, pilot.

Avoid: dealership systems protocol, AI DMS, universal dealership access, replaces the dealer website, guaranteed out-the-door price, certified standard.

## Calls to action

- Understand: see how it works.
- Evaluate: read the human guide and use the synthetic reference gateway.
- Implement: follow the core retail read quickstart and normative artifacts.

