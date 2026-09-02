# Landscape and gap analysis

Status date: 2026-09-01  
Research mode: exhaustive, primary sources for technical and legal claims  
Legal note: this is protocol design analysis, not legal advice.

## Executive conclusion

The research supports the contrarian hypothesis: the defensible product is not
a new wire protocol, a full dealership data model, or an API for dealership
systems. It is a small MCP-native retail inventory and offer profile, a rigorous
schema package, an executable conformance suite, and loss-aware adapters to
existing work. “Dealer Agent Protocol” earns a reason to exist only if it
reduces ambiguity more effectively than it expands the standards landscape.

AAP v1.2 is compact and implementable, but it makes A2A mandatory for deterministic reads, permits conformance with any one of five optional skills, stops at one-step lead submission, and overloads a whole-dollar `price` with an out-the-door meaning that anonymous discovery usually cannot substantiate ([AAP introduction](https://autoagentprotocol.org/docs/v1.2/intro), [profile](https://autoagentprotocol.org/docs/v1.2/a2a-profile), [pricing](https://autoagentprotocol.org/docs/v1.2/pricing-and-ftc)). Automotive MCP is MCP-native and broader, but its v0.1 surface spans inventory through credit and lender decisions, its conformance levels do not state exact interoperable capability sets, and its published money/security statements are internally uneven ([scope](https://automotivemcp.ai/spec/scope), [conformance](https://automotivemcp.ai/spec/conformance), [schemas](https://automotivemcp.ai/spec/schemas)). DMC-12 is the closest conceptual predecessor and should be treated as such, but requires MCP/A2A/UCP layering and has one binding plus self-declared conformance; its network profiles remain less mature than its stable core ([DMC-12 specification](https://github.com/mm-open/dmc-12/blob/main/SPEC.md)).

Dealer Agent Protocol v0.1 therefore standardizes only dealer discovery,
published inventory reads, authoritative availability, and classified retail
pricing disclosure. It pins MCP `2026-07-28`; makes money, source lineage,
freshness, uncertainty, eligibility conditions, and tenant grants
machine-verifiable; and explicitly excludes DMS/CRM access, customer data,
leads, appointments, holds, desking, credit, payments, and contracts.

## Comparative findings

| Dimension | AAP v1.2 | Automotive MCP v0.1 | DMC-12 v1.0 | Dealer Agent Protocol v0.1 response |
|---|---|---|---|---|
| Transport | Mandatory A2A JSON-RPC; MCP adapter | MCP | MCP plus A2A/UCP bindings | MCP normative; optional A2A only across independent agents |
| Interoperability floor | Any one of five skills | Broad Levels 1–3 | Profiles/claims | Required four-profile read bundle |
| Scope | Dealer/inventory/lead | Eight domains, including F&I | Merchant discovery through handoff/holds | Retail inventory and offer understanding only |
| Price | Whole USD integer labeled final OTD | Normative minor units, but published schema variants conflict | Exact decimal | Minor-unit integer plus classified components and uncertainty |
| Freshness/provenance | `updated_at`-oriented | Inconsistent by domain | Strong freshness/source patterns | Required on records; authoritative availability separately checked |
| Consent/mutations | One-step lead; optional idempotency | Broad scopes and consent domain | Two-phase draft lead transfer | None in version 0.1 |
| Tenancy | A2A context, little dealer-group policy | Rooftops treated separately | Merchant/profile dependent | Organization + rooftop grant, explicit group delegation, fail closed |
| Governance evidence | Public repo; maintained release | Public governance/certification plans | Public repo; maintainer-led | Open artifacts, public decisions, test evidence; no premature certification |

## 1. The exact problem

Generic MCP supplies transport, discovery, tools, resources, authorization
mechanics, cache metadata, and extensions. It intentionally does not say what a
dealer price means, which source can assert availability, or how a group
delegates rooftop access. The current `2026-07-28` revision also changed
important assumptions: the core is stateless, initialization/session dependence
is gone, and discovery and cache policy are explicit ([normative repository](https://github.com/modelcontextprotocol/modelcontextprotocol/tree/main/docs/specification/2026-07-28), [release](https://blog.modelcontextprotocol.io/posts/2026-07-28/)). A domain profile must pin these behaviors rather than recreate them.

STAR provides a substantial automotive retail semantic model and bounded-context map. It is a vocabulary and integration source, not an AI-facing authorization, freshness, consent, or transaction-safety profile ([STAR announcement](https://www.starstandard.org/index.php/2026/01/27/star-unveils-industry-defining-retail-automotive-domain-model-to-advance-data-interoperability-and-ai-transformation-across-the-entire-ecosystem/), [domain map](https://www.starstandard.org/wp-content/uploads/2026/01/STAR_Standard_DOMAIN_MAP_WEB.pdf)). ADF remains useful as a legacy lead adapter but was designed for lead XML, not purpose-bound consent or authenticated agent actions ([ADF 1.0](https://adfxml.info/adf_spec.pdf)). Schema.org helps public web discovery, not dealer-system authority ([automotive vocabulary](https://schema.org/docs/automotive.html)).

The residual problem is precise: give an agent a predictable, evidence-bearing
way to read dealer-controlled retail facts without confusing conditional offers
with generally available prices or stale indexes with current availability.
None of the compared projects combines that narrow floor, current MCP semantics,
explicit multi-rooftop grants, and enforceable retail-data semantics.

## 2. Why MCP is normative; where A2A adds value

Inventory search, vehicle lookup, price disclosure, and an availability check
are deterministic retail-data requests. MCP already gives an agent host tool
discovery, structured input/output schemas, resource access, authorization, and
server discovery. Wrapping every call in A2A adds an Agent Card,
message/data-part envelope, agent task semantics, and another identity/routing
boundary without creating collaboration. AAP's own MCP design is an adapter
that forwards MCP calls to A2A, demonstrating the extra layer rather than
eliminating it ([AAP MCP compatibility](https://autoagentprotocol.org/docs/v1.2/compatibility/mcp)).

A2A is justified when the dealer side is genuinely an independent, stateful
agent that negotiates alternatives, performs asynchronous work, or coordinates
with staff. That is a separate boundary and not a version 0.1 requirement. A2A
v1.0 supplies Agent Cards, task lifecycle, security schemes, and tenant-aware
routing for such future work ([A2A specification](https://github.com/a2aproject/A2A/blob/main/docs/specification.md)).

## 3. Minimum useful conformance floor

Two conformant implementations need more than a shared badge. The required `dealeragent.core-retail-read/0.1` bundle contains:

1. Discovery: a cacheable manifest and dealer/group/rooftop identity.
2. Inventory Read: search/facets and exact vehicle detail.
3. Availability: a separate authoritative check with observation and validity time.
4. Pricing Disclosure: advertised/offering price, required dealer charges, conditional adjustments, and government charges classified as unknown, estimated, calculated, or not applicable.

All outputs use JSON Schema 2020-12 and the same money, provenance, freshness,
uncertainty, pagination, error, and tenant identifiers. Version 0.1 defines no
action profiles. A profile claim names exact tools and scopes and depends on a
passing, immutable test report. This avoids AAP's “any skill” floor and
Automotive MCP's coarse domain levels.

## 4. Published versus protected retail reads

Public access is a dealer policy, not a protocol default. A manifest can be public. Dealer identity, inventory, and pricing reads may be anonymous when the operator chooses, but must be rate-limited, provenance-bearing, and free of private/customer data. Authoritative availability can require authentication because it may touch a system of record and reveal operational state.

Protected reads require an authorization token audience-bound to the gateway
resource, exact profile scope, organization/rooftop grant, and caller identity.
Tokens must not be passed through to upstream sources; the gateway exchanges or
maps credentials at each trust boundary. MCP tool annotations are untrusted
hints to models, not policy. Customer data is outside the protocol and must be
rejected rather than silently stored or routed.

## 5. Preventing invented certainty

Five concepts are deliberately separate:

- Freshness records when data was observed, until when it is valid, maximum age, and whether it is current, stale, unknown, or withdrawn.
- Provenance records one or more named sources, source record identifiers, authority class, observation time, digest, and transformations.
- Authority says whether the result is authoritative, asserted, derived, or unknown. A third-party feed can be fresh and still not be authoritative for current availability.
- Eligibility expresses the criterion, operator, claimed value, evidence state, geography/validity where applicable, and stacking group for conditional adjustments.
- Uncertainty labels an amount or answer exact, estimated, unknown, or not applicable and preserves assumptions.

The server never collapses these into one `updated_at` or confidence score.
Search may return asserted availability; the availability tool must recheck an
authoritative source before a client presents a vehicle as currently available.
NHTSA vPIC can support decoded vehicle identity but cannot establish installed
equipment, dealer ownership, price, or availability ([vPIC API](https://vpic.nhtsa.dot.gov/api/Home/Index)). A Monroney label can support new-vehicle
MSRP/options/delivery claims but is not a transaction price ([15 USC §1232](https://www.law.cornell.edu/uscode/text/15/1232)).

Pricing follows the same rule. The FTC's March 2026 warning says advertised
prices should include mandatory fees and not depend on unavailable rebates,
unshown extra down payments, mandatory financing, mandatory add-ons, or
nonexistent vehicles ([FTC warning](https://www.ftc.gov/news-events/news/press-releases/2026/03/ftc-warns-97-auto-dealership-groups-about-deceptive-pricing)). Dealer Agent Protocol therefore separates generally available advertised
price, mandatory dealer charges, conditional adjustments, and government
charges. Version 0.1 does not emit a personalized out-the-door quote.

## 6. Dealer-group delegation without tenant leakage

Every request identifies an organization; every unit-specific read also
identifies a rooftop. Authorization grants carry an allowed organization set
and either an explicit rooftop set or a separately issued group delegation. The
gateway calculates the intersection of token grant, requested tenant,
capability, and dealer policy. Empty or ambiguous intersection fails closed.

Group delegation is a first-class administrative act with issuer, grantee,
exact rooftops, scopes, expiry, and revocation. It is not inferred because
rooftops share a brand, vendor, DMS instance, email domain, or parent company.
Search across rooftops is an explicit fan-out whose results preserve their
source rooftop. Audit records include actor, effective tenant, requested tenant,
policy decision, tool, purpose, and result—never secrets or customer data.

## 7. Why retail actions are deferred

Quotes, holds, appointments, lead handoff, customer records, and transaction
workflows introduce PII, consent, retention, authorization, confirmation, and
system-write concerns that are independent of understanding inventory and
offers. Including them would also make the protocol look like a DMS or CRM
access layer.

Version 0.1 therefore has no action surface. Earlier design experiments are
preserved outside the normative specification in the incubator. Any promotion
requires a separately versioned extension and independent conformance tests.

## 8. International usefulness without US law in the schema

Core money uses integer ISO 4217 minor units and an ISO currency code;
geography is an ISO country/subdivision plus optional locality/postal code.
Pricing components are semantic roles—dealer charge, conditional adjustment,
government charge—not US tax names.

This creates a conservative cross-border floor without claiming universal
compliance. US enforcement influenced the separation of mandatory and
conditional amounts, but the schema does not encode the vacated CARS Rule. The
Fifth Circuit vacated that rule on January 27, 2025; FTC reporting confirms the
status, and the agency recorded its withdrawal on February 12, 2026 ([opinion](https://www.ca5.uscourts.gov/opinions/pub/24/24-60013-CV0.pdf), [FTC report](https://www.ftc.gov/system/files/ftc_gov/pdf/2025-06-Final-Public.pdf), [withdrawal notice](https://www.ftc.gov/legal-library/browse/federal-register-notices/revision-negative-option-rule-withdrawal-cars-rule-removal-non-compete-rule-conform-these-rules)).

Future jurisdiction profiles should be independently versioned and maintained with local counsel. Servers disclose supported jurisdictions and refuse calculations they cannot substantiate.

## 9. Migration path

AAP operators can map dealer and inventory skills to discovery and read tools.
`lead.submit` has no version 0.1 mapping. The lossy point is price: a
whole-dollar field labeled final out-the-door cannot automatically become a
generally available advertised price. The adapter must preserve the source,
declare USD before multiplying by 100, and mark unknown components and
authority. The detailed rule set is in [the AAP mapping](../compatibility/aap-v1.2.md).

Automotive MCP implementations can map tenant/location, inventory,
availability, and retail pricing concepts, but only for exact tested profiles.
The documented minor-unit form maps directly; any published major-unit numeric
schema requires exact conversion and a conflict notice. CRM, F&I, service,
parts, lead, and transaction domains stay outside Dealer Agent Protocol v0.1.
Existing `amcp:` scopes are not textually rewritten; the authorization server
issues audience-bound `dealeragent:` grants. See [the Automotive MCP mapping](../compatibility/automotive-mcp-v0.1.md).

DMC-12 implementations have the shortest semantic path. Exact decimals map only when exactly representable in currency minor units; profiles and claims still require independent Dealer Agent Protocol tests. See [the DMC-12 mapping](../compatibility/dmc-12-v1.0.md). STAR and ADF are source/adapter mappings, not conformance inheritance.

UCP's discovery and capability intersection are useful for a future commerce adapter, but checkout/payment capabilities are not a v0.1 dependency ([UCP](https://ucp.dev/latest/)).

## 10. Credible governance and conformance

Credibility comes from boring evidence, not a council graphic or self-awarded seal. The repository should keep the normative spec, schemas, examples, tests, compatibility mappings, decisions, release tags, security policy, and change log public. Released schemas are immutable. Breaking changes require a new major profile version; additions must be optional until a new bundle version is ratified. The governance file defines open proposals, recorded rationale, conflict disclosure, two independent approvals for normative change, and a path toward a neutral working group.

v0.1 claims are explicitly self-asserted. A signed claim names the
implementation, endpoint, exact profiles, MCP revision, source revision,
test-suite version, completion time, and immutable report digest. Required
tests cannot be skipped. Negative cases cover tenant leakage, stale data,
cross-scope cursor reuse, customer-data rejection, and redaction. A claim is not
certification or endorsement. Third-party certification should be considered
only after the suite, multiple independent implementations, an appeals process,
and trademark rules exist.

Licensing is Apache-2.0 for the specification package to include an express patent grant. Compatibility documents preserve attribution and do not copy external schemas. Governance should actively pursue convergence: propose reusable schemas or findings upstream and accept replacement of Dealer Agent Protocol components when a mature neutral standard becomes equivalent.

## Operational evidence and failure modes

Paper standards understate gateway risk. The reviewed unofficial, third-party Cox Automotive MCP wrapper accepts an API key from environment configuration, exposes caller-supplied account IDs, includes create/update/delete inventory operations, lacks visible idempotency and confirmation controls, returns JSON encoded as text, and logs most arguments except specially named secrets ([repository](https://github.com/sanjibani/cox-automotive-mcp)). This is evidence that an apparently ordinary MCP wrapper can cross tenant, mutation, logging, and structured-output boundaries incorrectly. It must not be generalized to Cox Automotive or every automotive server.

The corresponding Dealer Agent Protocol controls are server-derived tenant
authorization, no inventory CRUD, schema-level structured output, per-tool
effect metadata, scoped cursors, redacted audit, and negative conformance tests.
Model-facing annotations help planning but never substitute for those
enforcement points.

## Contrarian findings

1. A narrower standard is more valuable than a comprehensive one. Most dealership domains should stay out until independent demand, threat models, and tests exist.
2. “Out-the-door price in search” is often false precision. A classified partial disclosure with explicit unknowns is more interoperable than a universal-looking scalar.
3. A2A is not automatically more agentic. For deterministic reads, it is often an unnecessary trust and operations layer.
4. Public inventory does not imply public authoritative state. Availability checks can deserve stronger authentication and throttling than cached listings.
5. Self-declared conformance can still be useful when backed by signed, reproducible evidence—but it must never be marketed as certification.
6. Success may mean upstreaming or retiring parts of Dealer Agent Protocol. A permanent brand is not the objective; convergence is.

## Open questions before a stable 0.1

- Which two independent dealer gateways will implement the core bundle and expose failures in the schemas?
- Should facets become a separate tool for high-cardinality inventories, or is search-returned facet data enough?
- What is the minimum cryptographic format for conformance signatures: JWS,
  COSE, or a protocol-agnostic profile?
- How should server/discover cache invalidation interact with emergency capability withdrawal?
- Which STAR identifiers and controlled vocabularies can be adopted without licensing or membership ambiguity?
- What maximum freshness thresholds are operationally realistic for website feeds, DMS inventory, pricing systems, and in-transit vehicles?
- Should group delegation be represented in OAuth authorization details, token claims, or an external policy decision response?
- What evidence is sufficient to label inventory “authoritative” when systems of record disagree?
- Which incentive and discount eligibility terms are common enough to
  standardize across manufacturers and markets?
- What neutral organization could steward trademarks, patent commitments, appeals, and certification if adoption warrants it?

## Method and limitations

The analysis reviewed protocol-owned documentation and repositories, regulator/court/statute sources, automotive standards materials, and one real open-source gateway. Repository revisions and limitations are recorded in the [source register](source-register.md). No Firecrawl credential was used. The study did not interview dealers, regulators, vendors, or protocol maintainers; did not inspect private conformance programs; and did not establish market adoption. Assertions about gaps describe published materials as of the cutoff, not undisclosed roadmaps or implementation quality.
