# Dealer Agent Protocol — the open MCP standard for car dealership data

[![License](https://img.shields.io/badge/license-Apache--2.0-174d3c.svg)](LICENSE)
[![Status](https://img.shields.io/badge/status-v0.1%20open%20for%20review-e94f2b.svg)](spec/v0.1/SPEC.md)
[![CI](https://github.com/arielcoro/dealer-agent-protocol/actions/workflows/ci.yml/badge.svg)](https://github.com/arielcoro/dealer-agent-protocol/actions/workflows/ci.yml)

**Dealer Agent Protocol (DAP) is an open specification and MCP server profile that lets AI agents read a car dealership's inventory, verify a vehicle is still available, and explain the price, required fees, and conditional incentives — with the source, freshness, and uncertainty of every fact attached.** It is the window sticker AI agents can read.

Any dealership, dealer group, website provider, or inventory vendor can implement it. [DealershipMCP](https://dealershipmcp.com) is one hosted implementation. The project is Apache-2.0 licensed with an explicit patent grant.

> **Dealer Agent Protocol is not Auto Agent Protocol.** Auto Agent Protocol (AAP) is an A2A-based automotive profile. DAP is an MCP-native retail data and disclosure standard. The projects can interoperate through the documented [AAP bridge](compatibility/aap-v1.2.md).

| I am a… | Start here |
|---|---|
| **Dealer or dealer group** | [Get a free AI Answer Audit](https://dealershipmcp.com/audit/) — see what major AI assistants say about your store today |
| **Website, inventory, or CRM vendor** | [Publish a `.well-known/dealer-agent.json`](spec/v0.1/discovery.md#4-static-publication) in a day, or run the [reference gateway](reference/README.md) |
| **AI agent or assistant builder** | [Quickstart](https://dealeragentprotocol.com/docs/) — typed MCP tools and synthetic test data |
| **Standards or compliance person** | [Why one price field is not enough](spec/v0.1/pricing.md) · [Governance](governance/GOVERNANCE.md) · [Compare the public approaches](compatibility/COMPARISON.md) |

## What problem this solves

When a shopper asks an AI assistant “is this car still available and what does it really cost,” the assistant often scrapes the dealer's website and guesses. It can apply rebates the buyer cannot get, omit a required dealer charge, or describe a vehicle that sold days ago. DAP gives the dealer one controlled way to publish the real answer and gives every AI agent one way to read it.

## Protocol and gateway are different things

| Layer | What it is | Responsibility |
|---|---|---|
| **Dealer Agent Protocol** | Open standard | Shared tools, schemas, retail meanings, disclosure rules, and conformance requirements. |
| **Dealer Agent Gateway** | A role defined by DAP | Software that maps dealer-approved sources into DAP and serves the tools to agents. Anyone can build one. |
| **DealershipMCP** | Commercial product from Dealer Growth Hackers | A hosted Dealer Agent Gateway, Answer Audit, adapters, monitoring, and optional consented handoff. |
| **MCP** | Transport | Tool discovery and calls between an AI agent and a gateway. |

DAP does not invent a new wire protocol. MCP carries the calls; DAP defines what automotive retail requests and answers mean.

## MCP server for car dealerships: six core tools plus used-vehicle truth

The `dealeragent.core-retail-read/0.1` bundle contains six read-only tools:

1. `dealeragent.discovery.get_manifest`
2. `dealeragent.dealer.get`
3. `dealeragent.inventory.search`
4. `dealeragent.inventory.get_vehicle`
5. `dealeragent.inventory.verify_availability`
6. `dealeragent.pricing.get_disclosure`

The separate `dealeragent.handoff/0.1` profile adds three consent-gated tools. A Core claim never implies handoff access.

The optional `dealeragent.used-vehicle.read/0.1` profile adds
`dealeragent.inventory.get_used_vehicle_details`. It standardizes mileage,
dated inventory age, provider-neutral vehicle-history references, title,
inspection, manufacturer-versus-dealer certification, warranty, public
reconditioning facts, and unresolved source conflicts. See the
[used-vehicle profile](spec/v0.1/used-vehicles.md) and
[complete example](spec/v0.1/examples/used-vehicle-detail.json).

Inventory age is never an unexplained `days_on_lot` number. The response says
which event starts the clock, the date being measured, how many complete days
elapsed, and which source asserted it. CARFAX and AutoCheck can be integrated
behind a gateway when the dealer is authorized; the public contract stays
provider-neutral and never turns “no events reported” into “accident-free.”

## Pricing disclosure: advertised price, dealer fees, incentives, and government charges

DAP never compresses an offer into an ambiguous scalar. A disclosure separates the advertised price, required dealer charges, conditional adjustments, and government charges. Eligibility, stacking, assumptions, authority, freshness, and unknown amounts remain explicit. See [The One Price Problem](spec/v0.1/examples/one-price-problem/README.md) and its runnable JSON vectors.

## Availability verification: why “available” needs a source and a timestamp

Search results are discovery snapshots, not promises. The authenticated availability tool returns the authority class, observation time, validity window, and whether human verification is required. Clients must never upgrade an asserted or stale fact to “available now.”

## Consented handoff: leads into the CRM as ADF, and nowhere else

Handoff is separate from the read-only core. An agent first requests policy, then prepares a purpose-bound handoff without sending personal information. The gateway returns the exact disclosure and a signed, expiring, single-use consent binding. Only after the buyer agrees can the agent submit contact details; the gateway verifies the binding before persisting or forwarding an ADF lead. See [the handoff profile](spec/v0.1/handoff.md).

## Compared with Auto Agent Protocol (AAP), DMC-12, and AutomotiveMCP

DAP is intentionally narrower than broad dealership integration standards and more disclosure-focused than transaction profiles. [The dated comparison](compatibility/COMPARISON.md) states what each public project does better, where DAP is behind, migration paths, and source links. Corrections are invited through the issue template.

## Dealer-group tenancy and security

Organizations and rooftops are separate identifiers. Authorization comes from trusted transport context, not caller-supplied tool arguments. Group access is explicit, rooftop scope is checked before record lookup, and handoff submission uses its own scope. See [security](spec/v0.1/security.md).

## Conformance and the badge

Conformance is an evidence claim, not a self-awarded marketing label. A claim identifies profiles, schema and behavior results, implementation version, and signature. The reference suite uses only synthetic records and includes negative tests. See [conformance](conformance/README.md) and the [public claims index](conformance/claims/README.md).

## Build, validate, and run

```bash
python3 -m pip install -r requirements-dev.txt
python3 scripts/validate_artifacts.py
PYTHONPATH=reference/python python3 scripts/run_conformance.py
python3 scripts/build_public_site.py
python3 scripts/validate_deployment.py
```

The canonical publication is [dealeragentprotocol.com](https://dealeragentprotocol.com). The repository contains the standard, schemas, examples, conformance suite, open gateway code, and all three public website sources.

## Project status and roadmap

Version `0.1.0-draft.1` is open for public review. The target is a version 0.1 candidate and first conformance badges by **December 1, 2026**. The first release stays focused on public retail reads and a separately consented handoff. Credit, lender decisions, payments, binding orders, deal jackets, service, parts, desking, and trade appraisal are not part of 0.x. An optional hold profile will be considered only after handoff has run in production for 90 days.

## Contributing and governance

Start with [CONTRIBUTING.md](CONTRIBUTING.md), open a proposal with a concrete interoperability case, and include a test vector for normative behavior. Decisions, working groups, open questions, and the editor/implementer relationship are documented under [governance](governance/).

Specification text, schemas, examples, tests, websites, and reference code are licensed under [Apache License 2.0](LICENSE).

## Creator

Dealer Agent Protocol was created by **Ariel Coro**. DealershipMCP is a Dealer Growth Hackers product and one implementation of the open standard.

## FAQ

**What is an MCP server for a car dealership?**

A Model Context Protocol server that exposes a dealership's inventory, pricing, and availability as typed tools an AI assistant can call, instead of scraping the website. Dealer Agent Protocol defines what those tools and their answers mean so every gateway returns the same thing.

**Is Dealer Agent Protocol the same as Auto Agent Protocol (AAP)?**

No. AAP is an A2A profile with automotive skills. Dealer Agent Protocol is MCP-native, requires four profiles for a Core claim, itemizes price into classified components, verifies availability against an authoritative source, and supports dealer groups. A bridge is documented in [`compatibility/aap-v1.2.md`](compatibility/aap-v1.2.md).

**Does it give AI agents access to my DMS or CRM?**

No. Agents receive dealer-approved retail facts through a gateway. Customer data enters only through the separate, consented handoff profile and is delivered to an approved destination as ADF.

**Who created it and who owns it?**

Dealer Agent Protocol was created by Ariel Coro and is published under Apache-2.0. DealershipMCP, a Dealer Growth Hackers product, is one implementation. The specification is independently implementable and governance is documented in [`governance/GOVERNANCE.md`](governance/GOVERNANCE.md).
