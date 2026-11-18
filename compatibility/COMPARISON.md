# Compare dealer agent standards

**Checked October 25, 2026 · Maintained by the Dealer Agent Protocol project**

There are now four public attempts to standardize how an AI agent reads a dealership’s inventory, availability, and price. We wrote one of them. This page compares all four as fairly as we can, with links to each specification and test vectors you can run. Where another standard is better, we say so first.

This is a technical comparison, not a claim of endorsement, affiliation, or legal compliance. Open a [comparison correction](https://github.com/arielcoro/dealer-agent-protocol/issues/new?template=comparison-correction.yml) with a primary source when something changes.

## What each one does better than we do

### DMC-12

- Defines quotes with expiry, soft holds, negotiation envelopes, and deal handoff in a stable 1.0 profile. DAP defines reads and a consented handoff and has deliberately deferred holds.
- Introduced a per-merchant `freshness_sla_seconds` commitment and named agent trust levels. DAP adopted both and credits DMC-12.
- Publishes an explicit UCP binding alongside MCP and A2A bindings.
- Already carries `stocked_date` and `days_on_lot` in its inventory record. DAP added inventory tenure later and credits that prior art.

### Auto Agent Protocol (AAP)

- Has the easiest on-ramp in the category: a small A2A agent card, with commercial providers offering hosting. DAP’s static on-ramp is newer.
- Uses A2A for delegated, multi-turn work by default and has a smaller five-skill surface.
- Has public implementers focused on automotive agent interoperability.
- Already carries `mileage` and `inventory_date` in the vehicle record. DAP's inventory-age model is more qualified, but the concept is not new.

### AutomotiveMCP

- Ships the most complete public demo in the category: one unauthenticated Streamable HTTP endpoint that works in ChatGPT, Claude, Claude Code, Cursor, and MCP Inspector, renders MCP Apps cards, and gives every session a public trace page showing which vendor answered each call and what pseudonymous identifier it received. DAP's demo gateway followed in October 2026 and credits that bar.
- Models a multi-vendor gateway. Eight simulated vendor "members" sit behind one endpoint, a dealer can connect a new member by URL after a signed probe, and each member call gets its own ES256 token minted by RFC 8693 token exchange with a different pairwise shopper identifier per vendor. DAP's gateway role is single-operator by design.
- Specifies portable consent as a normative, domain-neutral section: a JWS receipt over a disclosure hash, bound to one relying party, with a status endpoint, JWKS discovery, and upstream revocation. DAP's consent binding is comparable in rigor but scoped to one handoff into one gateway.
- Covers eight dealership domains, including service, parts, and F&I. DAP covers retail reads and consented handoff only, on purpose.
- Runs a public readiness directory of 77 dealer-tool vendors and a dealer playbook for writing agent access into contracts and RFPs. DAP has no equivalent distribution mechanism.
- Already publishes a substantial used-vehicle shape with odometer status, title, prior use, history, CARFAX/AutoCheck links, recalls, warranty, CPO, and condition grade. DAP should not claim it invented structured used-vehicle data.

## At a glance

| Dimension | Dealer Agent Protocol | DMC-12 | Auto Agent Protocol | AutomotiveMCP |
|---|---|---|---|---|
| Primary job | Dealer retail truth and disclosure | Agentic shopping through negotiation and handoff | Vehicle discovery and lead connection over A2A | Multi-vendor dealership gateway, consent portability, and a broad domain catalog |
| Scope | Discovery, inventory, availability, pricing disclosure, used-vehicle evidence, consented handoff | Inventory, quotes, holds, negotiation, disclosure, deal handoff | Dealer info, search/facets, vehicle, lead submit | Nine domains and 63 catalog tools, inventory through F&I; normative consent receipts; draft federation and delegated identity |
| Transport | MCP; optional A2A extension | MCP, A2A, and UCP bindings | A2A with an MCP bridge | MCP; WebMCP browser demo |
| Price representation | Integer minor units; four classified components with eligibility and stacking | Exact decimals with disclosure lines | Whole-dollar scalar `price` in v1.2 schema | Minor-unit `amount` objects in a flat `prices[]` list typed msrp/selling/internet; `dealer_fees[]` with a taxable flag; `rebates[]` with a `conditional` boolean; no government-charge object |
| Availability | Separate authoritative call, `observed_at`, `valid_until`, authority class; stale evidence refused | Search inclusion plus manifest freshness SLA | Status enum plus `updated_at` | `availability.status` plus `updated_at`; demo check is "as of the daily inventory snapshot"; freshness contracts listed as a known gap |
| Provenance | Named source, record ID, authority, observation and transformation on every record | Source and freshness fields | Limited source timestamp | `source_ids[]` on the vehicle; per-item `provenance` only in the draft federation section |
| Dealer groups | Organization plus rooftop isolation and explicit group grants | Merchant/store model | Dealer-oriented card | `location_id` per call, mirrored in a header; groups are labels expanded to explicit locations (draft) |
| Customer data | Two-phase ES256 consent binding, single use, verifiable at published JWKS; ADF delivery | Two-phase consented deal handoff | Lead submission skill | Normative JWS consent receipts with disclosure hash, audience binding, status endpoint, STOP propagation; demo issues one receipt per vendor |
| Used-vehicle facts | Optional evidence profile: mileage, qualified inventory tenure, provider-neutral report array, title, inspection, certification, warranty, public recon, and conflicts | Mileage, stocked date, days on lot | Mileage and inventory date; other attributes may carry more | Broad used shape including history-provider links, title, condition, warranty, and CPO; `days_in_stock` as a bare integer |
| Static on-ramp | `/.well-known/dealer-agent.json` plus CSV | Manifest/binding | A2A agent card | `/.well-known/automotivemcp-gateway.json` and member manifests on the gateway; §10 discovery not yet written |
| Public demo | Synthetic Example Motors gateway, all profiles, MCP Apps cards, no sign-in | Reference material in repository | Hosted agent cards from providers | Castle Kia of McHenry sandbox, 35 live tools, cards, trace viewer, dealer view, consent demo |
| Conformance | Schemas, negative behavior tests, signed claims; no badge program | Requirement IDs and profiles | Profile conformance declaration | Three levels per domain; Tier 1 self-attested and Tier 2 council-tested marks planned; zero assessments published |
| Code | Public Apache-2.0 repository with spec, tests, and gateway | Public repository | Public repository | Apache-2.0 stated; repository "opens with the specification repository", access by request |

## Pricing and disclosure

One scalar price is easy to search and hard to explain. It cannot say whether a required documentation charge is included, whether a rebate applies only to a qualifying buyer, whether two incentives stack, or whether taxes and registration were calculated for the buyer’s jurisdiction.

- **AAP:** compact whole-dollar price field. A bridge must mark it asserted because classification information is absent.
- **DMC-12:** exact decimal money and pricing-disclosure lines; more transaction-oriented.
- **AutomotiveMCP:** the vehicle schema lists several typed prices, dealer fees with a taxable flag, and rebates with a `conditional` boolean. Live search results add human strings such as `price_display`, `price_label`, and `below_msrp_display`. There is no object for government charges and no eligibility criteria or stacking rule on a rebate. The project's own `llms.txt` lists "machine-readable substantiation of quoted prices" as a known gap.
- **DAP:** advertised price, required dealer charges, conditional adjustments, and government charges are separate schema objects. Each adjustment carries criteria, evidence status, and a stacking group. Unknown never means zero.

Run the three [One Price Problem vectors](../spec/v0.1/examples/one-price-problem/README.md): conditional rebate, omitted required charge, and unknown government charges.

## Used vehicles and inventory age

Inventory age is not a unique DAP feature. AAP v1.2 has `inventory_date`, and
DMC-12 has both `stocked_date` and `days_on_lot`. AutomotiveMCP has the broadest
single vehicle object reviewed, including history, title, prior use, warranty,
CPO, and direct CARFAX and AutoCheck links.

DAP's different contribution is an evidence contract rather than a larger flat
record:

- inventory tenure separates `stocked_at` from `first_public_listing_at`, names
  the clock in `age_basis`, and dates the calculated `age_days` with `age_as_of`;
- history is an array of provider-neutral reports, so CARFAX, AutoCheck, a title
  source, or another provider keep independent provenance and freshness;
- every report declares its access method and whether mapped summary sharing is
  authorized;
- `no_events_reported` cannot be upgraded to “accident-free”;
- material disagreements become required `discrepancies` instead of one merged,
  favorable summary; and
- manufacturer CPO, dealer certification, and third-party certification cannot
  be collapsed into one badge.

As of this review, those combined licensing, per-report provenance, dated-tenure,
and conflict-preservation requirements are DAP's defensible distinction. The raw
existence of mileage, vehicle history, CARFAX/AutoCheck links, or days in stock is
not.

Primary schema evidence: [AAP v1.2 vehicle](https://github.com/auto-agent-protocol/auto-agent-protocol/blob/main/spec/v1.2/schemas/vehicle.schema.json), [DMC-12 inventory](https://github.com/mm-open/dmc-12/blob/main/schemas/v1/inventory.json), and [AutomotiveMCP vehicle](https://automotivemcp.ai/spec/schemas/vehicle).

## Availability

- **DMC-12:** a manifest-level freshness SLA lets a client judge the merchant commitment. DAP adopts this field.
- **AAP:** a vehicle status and update time provide a useful discovery snapshot.
- **AutomotiveMCP:** the vehicle schema carries `availability.status` and `updated_at`. The live demo's availability tool answers "whether one VIN is still listed, as of the daily inventory snapshot" and is marked nonstandard in its own tool metadata. "Inventory freshness contracts" is a stated known gap, and the reference flow marks "confirm the item is still available" as not yet specified.
- **DAP:** search returns a snapshot; a separate check returns the authorized source’s answer with authority class, `observed_at`, and `valid_until`. An asserted record cannot become “available now” in a client, and stale evidence returns `dealeragent.vehicle.stale` rather than a guess.

DAP’s five bands are `verified_current` (up to 120 seconds), `recent_authoritative` (up to 15 minutes), `asserted` (up to 24 hours), `stale`, and `unknown`. A stricter dealer policy may shorten them.

## Live comparison: two demo gateways, same question

Both projects run a public demo gateway anyone can connect to. On October 25, 2026 we asked each one the same two things and recorded the shape of the answer. Reproduce it with MCP Inspector or any client; the endpoints are below.

**"Find a new SUV under $40,000" (one result shown)**

| | AutomotiveMCP demo (`gateway.automotivemcp.ai/mcp`, `inventory.search_vehicles`) | DAP demo (`demo.dealeragentprotocol.com/mcp`, `dealeragent.inventory.search`) |
|---|---|---|
| Data | 474 vehicles from a real dealer's public website listings, photos hot-linked from the website provider's CDN, "dated snapshot" | 13 synthetic vehicles for a fictional dealer, labeled synthetic in every response |
| Price | `price: {amount: 2604100, currency: "USD"}` plus `price_display`, `price_label: "Sale price (includes $413 dealer doc fee; excludes tax, title, license)"`, `dealer_fees_display`, `msrp_display`, `below_msrp_display` strings | `advertised_price: {amount: {amount_minor, currency}, availability: "generally_available", includes_required_dealer_charges: true, valid_until}`; charges and incentives itemized by the pricing tool |
| Freshness | `as_of: "2026-10-24"` for the whole result; `days_in_stock: 169` on the vehicle with no basis or as-of | `freshness: {observed_at, valid_until, state, max_age_seconds}` on every vehicle and on the result; aggregate state turns `stale` if any record is stale |
| Source | none on the record | `provenance: {sources: [{source_name, source_record_id, authority, observed_at}], authority_status, transformed_at}` on every record |
| Tool status | standard catalog name | standard profile tool |

**"Is it still available?"**

| | AutomotiveMCP demo (`testkit.check_availability`) | DAP demo (`dealeragent.inventory.verify_availability`) |
|---|---|---|
| Answer basis | "as of the daily inventory snapshot"; tool flagged `io.automotivemcp/nonstandard: true` | authority class, `observed_at`, `valid_until`, `human_verification_required`, source record |
| Stale case | not modeled | `dealeragent.vehicle.stale`, retryable, with `current_freshness` attached |

**What the AutomotiveMCP demo does that ours does not**

Trade appraisal with payoff and equity, cash/finance/lease quotes, desking to a target payment, manufacturer and dealer offers merged from two providers, live chat with a store desk, a dealer-side portal to connect a vendor by URL, per-vendor pairwise tokens, and a public per-session trace page. Of its 35 live tools, 15 use the standard catalog's names; the other 20 are `testkit.*` tools marked nonstandard, including vehicle details, compare, match-to-budget, availability, window sticker, and all chat.

## Provenance and dealer control

DAP attaches a named source, source record ID when available, authority class, observation time, transformations, freshness, and uncertainty to dealer, vehicle, availability, and pricing objects. A Dealer Agent Gateway exposes approved retail answers; it does not expose generic DMS or CRM access.

AutomotiveMCP is intentionally broader and its federation draft adds per-item provenance when a gateway fans out to members. AAP is intentionally simpler. DMC-12 carries more of the transaction. Those are design choices, not implementation mistakes.

## Consent and handoff

DAP uses three tools. `get_policy` tells the agent whether handoff is possible before collecting personal data. `prepare` sends purpose and requested channels but no PII, then returns the exact disclosure and an ES256-signed, expiring, single-use binding whose public key is published at the gateway's JWKS. `submit` accepts contact data only after consent and verifies signature, expiry, single use, subject, organization, rooftop, vehicle, purpose, and channels before storage or ADF forwarding.

AutomotiveMCP's §9 solves an adjacent problem: carrying one captured consent across several vendors. A capturing party issues a JWS receipt bound to one relying party, with a SHA-256 of the verbatim disclosure, a status endpoint the relying party must check before marketing contact, and a rule that a STOP heard by any party propagates upstream. That is a stronger multi-party design than DAP needs for a single handoff, and the browser demo that lets you tamper with a receipt is a model for how to explain consent cryptography.

DMC-12 already demonstrates why two-phase consent is necessary and remains ahead on negotiation and hold behavior. AAP has a simpler lead-submit skill. DAP’s contribution is a narrowly bounded consent artifact designed to survive replay, cross-rooftop use, and audit review, with a public demo where the replay is refused.

## Transport and bindings

DAP does not compete with transport standards. MCP is normative for deterministic tools. The optional `dealeragent.binding.a2a/0.1` extension advertises `https://dealeragentprotocol.com/extensions/core-retail-read/0.1`; each DAP tool maps to an A2A skill and schema objects travel unchanged in `DataPart`. Identity, tenant scope, authorization, and trace context survive the bridge.

AutomotiveMCP profiles MCP 2026-07-28, publishes a WebMCP browser demo registering the same tools in-page, and serves `/.well-known/mcp.json` and an A2A agent card from its gateway.

## Migration: already on one? Keep it.

- **From AAP:** map dealer information and inventory skills to DAP discovery and read tools. A scalar price stays asserted until classified. Lead submission maps only after a consent binding is prepared. See [`aap-v1.2.md`](aap-v1.2.md).
- **From DMC-12:** exact decimals convert to minor units only when exactly representable. `freshness_sla_seconds` maps directly; `store_code` maps to `rooftop_id`. See [`dmc-12-v1.0.md`](dmc-12-v1.0.md).
- **From AutomotiveMCP:** inventory, availability, and pricing concepts map; a DAP gateway can sit behind an AutomotiveMCP gateway as a member serving the inventory domain; consent receipts and DAP bindings can coexist because they answer different questions. Other dealership domains remain outside DAP. See [`automotive-mcp-v0.1.md`](automotive-mcp-v0.1.md).

## Where DAP is behind

| Gap | Current plan | Target |
|---|---|---|
| No multi-vendor federation story | A DAP gateway is single-operator. Evaluate serving DAP tools as a member behind a federating gateway rather than inventing a second federation model | Q1 2027 |
| No per-session public trace | The demo returns `trace_id` on every result but has no viewer. Add a privacy-preserving session page to the demo gateway | December 2026 |
| No production dealer roster | One dealer-authorized pilot runs on a private endpoint. First 50 Verified rooftops are free during the founding pilot | Rolling from September 2026 |
| No independent conforming server yet | Recruit a website or inventory provider as a second implementer | December 1, 2026 |
| No holds, quotes, payments, or trade appraisal | Deferred by design; consider an optional hold profile only after 90 days of production handoff | Q1 2027 |
| No complete UCP binding | DMC-12 compatibility carriage is documented; full binding follows production handoff | Q4 2026 |

## FAQ

### Is Dealer Agent Protocol the same as Auto Agent Protocol?

No. AAP is an A2A automotive profile. DAP is an MCP-native retail data and disclosure standard. They can run together through an adapter or the DAP A2A extension.

### Is Dealer Agent Protocol competing with AutomotiveMCP?

They overlap on inventory and pricing and differ in shape. AutomotiveMCP is a broad catalog plus a multi-vendor gateway and consent-portability spec, with freshness and price substantiation named as open gaps. DAP is a narrow inventory-truth profile that specifies exactly those two things. A DAP gateway can serve the inventory domain behind an AutomotiveMCP gateway, and both projects publish Apache-2.0 schemas.

### Why not use DMC-12 alone?

DMC-12 is stronger today for quotes, holds, negotiation, and transaction flow. DAP is narrower and stronger on classified retail disclosure, per-record provenance, authoritative availability, and dealer-group isolation. A bridge is preferable to forced replacement.

### Why not cover every dealership system?

DAP is deliberately limited to inventory for sale, price, fees, incentives, availability, used-vehicle evidence, and a consented handoff. Scope discipline reduces the data and authorization a dealer must expose. AutomotiveMCP is the more natural project when broad service, parts, F&I, and operational domains are required.

### Can another vendor implement DAP?

Yes. The specification, schemas, tests, examples, and open gateway are Apache-2.0 licensed. DealershipMCP is one commercial implementation and receives no exclusive right or private conformance path.

## Sources and change log

Claims were last checked October 25, 2026 against primary project material:

- [Dealer Agent Protocol repository](https://github.com/arielcoro/dealer-agent-protocol) and [demo gateway](https://demo.dealeragentprotocol.com/manifest.json)
- [DMC-12 specification](https://github.com/mm-open/dmc-12/blob/main/SPEC.md) and [project site](https://dmc-12.ai/)
- [Auto Agent Protocol repository and specification](https://github.com/auto-agent-protocol/auto-agent-protocol)
- AutomotiveMCP: [specification](https://automotivemcp.ai/spec), [tool catalog](https://automotivemcp.ai/tools.json), [llms.txt with known gaps](https://automotivemcp.ai/llms.txt), [consent portability §9](https://automotivemcp.ai/spec/consent-portability), [federation §11](https://automotivemcp.ai/spec/federation), [delegated identity §12](https://automotivemcp.ai/spec/delegated-identity), [test kit](https://automotivemcp.ai/test-kit), [gateway docs](https://automotivemcp.ai/test-kit/gateway), [governance](https://automotivemcp.ai/governance), [directory](https://automotivemcp.ai/directory), and live `initialize`, `tools/list`, and `inventory.search_vehicles` responses from `https://gateway.automotivemcp.ai/mcp`
- [Model Context Protocol specification](https://modelcontextprotocol.io/specification/2026-07-28)
- [A2A protocol specification](https://a2a-protocol.org/latest/specification/)

Change log:

- October 25, 2026 — re-checked AutomotiveMCP after its October 16 council launch, October 12 "movement" repositioning, and public test kit; added live two-gateway comparison, consent-portability and federation notes, demo-gateway row, and new dated gaps.
- September 2, 2026 — initial four-project comparison; added DAP static publication, availability bands, two-phase handoff, DMC-12 credits, and dated gaps.
