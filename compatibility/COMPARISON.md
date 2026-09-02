# Compare dealer agent standards

**Checked September 2, 2026 · Maintained by the Dealer Agent Protocol project**

There are now four public attempts to standardize how an AI agent reads a dealership’s inventory, availability, and price. We wrote one of them. This page compares all four as fairly as we can, with links to each specification and test vectors you can run. Where another standard is better, we say so first.

This is a technical comparison, not a claim of endorsement, affiliation, or legal compliance. Open a [comparison correction](https://github.com/arielcoro/dealer-agent-protocol/issues/new?template=comparison-correction.yml) with a primary source when something changes.

## What each one does better than we do

### DMC-12

- Defines quotes with expiry, soft holds, negotiation envelopes, and deal handoff in a stable 1.0 profile. DAP defines reads and a consented handoff and has deliberately deferred holds.
- Introduced a per-merchant `freshness_sla_seconds` commitment and named agent trust levels. DAP adopted both and credits DMC-12.
- Publishes an explicit UCP binding alongside MCP and A2A bindings.

### Auto Agent Protocol (AAP)

- Has the easiest on-ramp in the category: a small A2A agent card, with commercial providers offering hosting. DAP’s static on-ramp is newer.
- Uses A2A for delegated, multi-turn work by default and has a smaller five-skill surface.
- Has public implementers focused on automotive agent interoperability.

### AutomotiveMCP

- Covers eight dealership domains, including service, parts, and F&I. DAP covers retail reads and consented handoff only, on purpose.
- Brings a broader dealership technology scope and working-group model.

## At a glance

| Dimension | Dealer Agent Protocol | DMC-12 | Auto Agent Protocol | AutomotiveMCP |
|---|---|---|---|---|
| Primary job | Dealer retail truth and disclosure | Agentic shopping through negotiation and handoff | Vehicle discovery and lead connection over A2A | Broad dealership-domain MCP standardization |
| Scope | Discovery, inventory, availability, pricing disclosure, consented handoff | Inventory, quotes, holds, negotiation, disclosure, deal handoff | Dealer info, search/facets, vehicle, lead submit | Eight dealership domains, inventory through F&I |
| Transport | MCP; optional A2A extension | MCP, A2A, and UCP bindings | A2A with an MCP bridge | MCP |
| Price representation | Integer minor units; four classified components | Exact decimals with disclosure lines | Whole-dollar scalar `price` in v1.2 schema | Domain-dependent |
| Availability | Separate authoritative call, `observed_at`, `valid_until`, authority class | Search inclusion plus manifest freshness SLA | Status enum plus `updated_at` | Implementation-specific |
| Provenance | Named source, record ID, authority, observation and transformation | Source and freshness fields | Limited source timestamp | Domain-dependent |
| Dealer groups | Organization plus rooftop isolation and explicit group grants | Merchant/store model | Dealer-oriented card | Organization/domain model |
| Customer data | Separate two-phase signed consent binding; ADF delivery | Two-phase consented deal handoff | Lead submission skill | Broader domain scope |
| Static on-ramp | `/.well-known/dealer-agent.json` plus CSV | Manifest/binding | A2A agent card | MCP server deployment |
| Conformance | Schemas, negative behavior tests, signed claims | Requirement IDs and profiles | Profile conformance declaration | Working-group artifacts |
| License | Apache-2.0 | Check project repository | Check project repository | Check project repository |

## Pricing and disclosure

One scalar price is easy to search and hard to explain. It cannot say whether a required documentation charge is included, whether a rebate applies only to a qualifying buyer, whether two incentives stack, or whether taxes and registration were calculated for the buyer’s jurisdiction.

- **AAP:** compact whole-dollar price field. A bridge must mark it asserted because classification information is absent.
- **DMC-12:** exact decimal money and pricing-disclosure lines; more transaction-oriented.
- **AutomotiveMCP:** pricing semantics vary by the relevant domain and current proposal.
- **DAP:** advertised price, required dealer charges, conditional adjustments, and government charges are separate schema objects. Unknown never means zero.

Run the three [One Price Problem vectors](../spec/v0.1/examples/one-price-problem/README.md): conditional rebate, omitted required charge, and unknown government charges.

## Availability

- **DMC-12:** a manifest-level freshness SLA lets a client judge the merchant commitment. DAP adopts this field.
- **AAP:** a vehicle status and update time provide a useful discovery snapshot.
- **DAP:** search returns a snapshot; a separate authenticated check returns the authorized source’s answer with authority class, `observed_at`, and `valid_until`. An asserted record cannot become “available now” in a client.
- **AutomotiveMCP:** broad scope leaves exact availability behavior to its domain work.

DAP’s five bands are `verified_current` (up to 120 seconds), `recent_authoritative` (up to 15 minutes), `asserted` (up to 24 hours), `stale`, and `unknown`. A stricter dealer policy may shorten them.

## Provenance and dealer control

DAP attaches a named source, source record ID when available, authority class, observation time, transformations, freshness, and uncertainty to dealer, vehicle, availability, and pricing objects. A Dealer Agent Gateway exposes approved retail answers; it does not expose generic DMS or CRM access.

AutomotiveMCP is intentionally broader. AAP is intentionally simpler. DMC-12 carries more of the transaction. Those are design choices, not implementation mistakes.

## Consent and handoff

DAP uses three tools. `get_policy` tells the agent whether handoff is possible before collecting personal data. `prepare` sends purpose and requested channels but no PII, then returns the exact disclosure and an ES256-signed, expiring, single-use binding. `submit` accepts contact data only after consent and verifies signature, expiry, single use, subject, organization, rooftop, vehicle, purpose, and channels before storage or ADF forwarding.

DMC-12 already demonstrates why two-phase consent is necessary and remains ahead on negotiation and hold behavior. AAP has a simpler lead-submit skill. AutomotiveMCP covers lead and CRM-adjacent domains more broadly. DAP’s contribution is a narrowly bounded consent artifact designed to survive replay, cross-rooftop use, and audit review.

## Transport and bindings

DAP does not compete with transport standards. MCP is normative for deterministic tools. The optional `dealeragent.binding.a2a/0.1` extension advertises `https://dealeragentprotocol.com/extensions/core-retail-read/0.1`; each DAP tool maps to an A2A skill and schema objects travel unchanged in `DataPart`. Identity, tenant scope, authorization, and trace context survive the bridge.

## Migration: already on one? Keep it.

- **From AAP:** map dealer information and inventory skills to DAP discovery and read tools. A scalar price stays asserted until classified. Lead submission maps only after a consent binding is prepared. See [`aap-v1.2.md`](aap-v1.2.md).
- **From DMC-12:** exact decimals convert to minor units only when exactly representable. `freshness_sla_seconds` maps directly; `store_code` maps to `rooftop_id`. See [`dmc-12-v1.0.md`](dmc-12-v1.0.md).
- **From AutomotiveMCP:** inventory, availability, and pricing concepts map; other dealership domains remain outside DAP. See [`automotive-mcp-v0.1.md`](automotive-mcp-v0.1.md).

## Where DAP is behind

| Gap | Current plan | Target |
|---|---|---|
| No completed public agent transaction | Handoff profile is implemented in the synthetic gateway; first consented dealer handoff is the pilot goal | October 2, 2026 |
| No independent conforming server yet | Recruit DealerOn or another website/inventory provider as a second implementer | December 1, 2026 |
| No production dealer roster | First 50 Verified rooftops are free during the founding pilot | Rolling from September 2026 |
| No holds or quotes | Deferred by design; consider an optional hold profile only after 90 days of production handoff | Q1 2027 |
| No complete UCP binding | DMC-12 compatibility carriage is documented; full binding follows production handoff | Q4 2026 |

## FAQ

### Is Dealer Agent Protocol the same as Auto Agent Protocol?

No. AAP is an A2A automotive profile. DAP is an MCP-native retail data and disclosure standard. They can run together through an adapter or the DAP A2A extension.

### Why not use DMC-12 alone?

DMC-12 is stronger today for quotes, holds, negotiation, and transaction flow. DAP is narrower and stronger on classified retail disclosure, per-record provenance, authoritative availability, and dealer-group isolation. A bridge is preferable to forced replacement.

### Why not cover every dealership system?

DAP is deliberately limited to inventory for sale, price, fees, incentives, availability, and a consented handoff. Scope discipline reduces the data and authorization a dealer must expose. AutomotiveMCP is the more natural project when broad service, parts, F&I, and operational domains are required.

### Can another vendor implement DAP?

Yes. The specification, schemas, tests, examples, and open gateway are Apache-2.0 licensed. DealershipMCP is one commercial implementation and receives no exclusive right or private conformance path.

## Sources and change log

Claims were last checked September 2, 2026 against primary project material:

- [Dealer Agent Protocol repository](https://github.com/arielcoro/dealer-agent-protocol)
- [DMC-12 specification](https://github.com/mm-open/dmc-12/blob/main/SPEC.md) and [project site](https://dmc-12.ai/)
- [Auto Agent Protocol repository and specification](https://github.com/auto-agent-protocol/auto-agent-protocol)
- [AutomotiveMCP specification site](https://automotivemcp.ai/spec/)
- [Model Context Protocol specification](https://modelcontextprotocol.io/specification/2026-07-28)
- [A2A protocol specification](https://a2a-protocol.org/latest/specification/)

Change log: September 2, 2026 — initial four-project comparison; added DAP static publication, availability bands, two-phase handoff, DMC-12 credits, and dated gaps.
