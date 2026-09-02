# Dealer Agent Protocol Specification 0.1

**Version:** 0.1.0-draft.1  
**Status:** Editor's draft  
**Protocol baseline:** MCP `2026-07-28`

## 1. Purpose

Dealer Agent Protocol standardizes the smallest useful automotive-retail
surface an MCP client can depend on across Dealer Agent Gateways. It defines a
normalized view of dealer-published vehicles, availability, prices, charges,
discounts, rebates, incentives, and their conditions. MCP remains the wire
protocol and capability model.

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**,
and **MAY** are interpreted as described by BCP 14 when capitalized.

## 2. Scope

Version 0.1 covers retail discovery and offer understanding:

- dealership organization and rooftop discovery;
- inventory search, vehicle detail, and authoritative availability checks;
- advertised-price and required-charge disclosure; and
- discounts, rebates, incentives, eligibility conditions, validity periods,
  and stacking rules.

A conformant gateway lets an agent answer five questions without guessing:

1. Who is selling the vehicle, and at which rooftop?
2. Which specific vehicles are published for sale, and what are their facts?
3. Is a specific vehicle currently available, according to which source and as
   of when?
4. What price and dealer-imposed charges are generally available?
5. Which discounts or incentives might apply, under what conditions, during
   what period, and in combination with which other offers?

It is not a DMS API, CRM API, or general dealership-system integration
standard. It excludes leads, customer records, appointments, holds, desking,
inventory mutation, credit applications, credit reports, lender decisions,
payments, binding orders or contracts, deal jackets, service, parts, marketing
audiences, payroll, and signed documents. A gateway may obtain retail facts
from internal or third-party sources, but those sources are implementation
details and are not exposed as generic system access.

## 3. Architecture

```text
buyer or operator agent
        |
        | MCP (normative)
        v
Dealer Agent Gateway
  capability discovery | retail policy | normalization
  provenance/freshness | offer semantics | tenant isolation
        |
        v
published inventory | pricing/incentive source | availability source | catalog
```

An optional A2A binding is appropriate when an independent buyer agent and
dealer agent need delegated, asynchronous, or multi-turn collaboration. A2A is
not required for deterministic inventory reads or bounded MCP tool calls.

## 4. MCP requirements

### 4.1 Versioning

A conformant gateway MUST support MCP revision `2026-07-28`. It MAY support
legacy MCP revisions but MUST list each revision in its conformance claim and
MUST follow MCP's explicit modern/legacy negotiation behavior. It MUST NOT
silently interpret a modern request with legacy semantics.

### 4.2 Discovery

The gateway MUST implement MCP `server/discover`. Domain capability discovery
then occurs through both:

- the `dealeragent.discovery.get_manifest` tool; and
- the `dealeragent://manifest` resource.

The two representations MUST be generated from the same authoritative object.
The manifest MUST validate against `schemas/manifest.schema.json` and identify
the specification version, exact profile versions, tools/resources, auth modes,
scope model, organization/rooftop coverage, MCP revisions, schema base URI,
extensions, and conformance evidence.

The manifest response MUST include MCP cache metadata. Public manifests SHOULD
use `cacheScope: "public"`; caller-specific manifests MUST use `"private"`.

### 4.3 Tools and resources

Parameterized searches, availability checks, and pricing disclosures are MCP
tools. Stable read-only dealer, vehicle, and policy documents MAY also be
exposed as MCP resources or resource templates.

Required tool output MUST use `structuredContent` and declare an
`outputSchema`. A text serialization MAY accompany it for legacy clients, but
clients MUST treat the structured content as authoritative.

MCP tool annotations are untrusted hints. A gateway MUST also publish and
enforce the normative safety metadata in `capabilities.yaml`; a client MUST NOT
infer permission from `readOnlyHint`, `destructiveHint`, or `idempotentHint`.

## 5. Profiles and minimum interoperability

Profiles are explicit, independently versioned conformance units. A server MAY
claim an individual profile, but it MUST NOT call itself “Dealer Agent Protocol Core”
unless it implements the full `dealeragent.core-retail-read/0.1` bundle:

| Required profile | Required behavior |
|---|---|
| `dealeragent.discovery/0.1` | Manifest and dealer/group identity |
| `dealeragent.inventory.read/0.1` | Search plus vehicle detail |
| `dealeragent.inventory.availability/0.1` | Fresh authoritative verification |
| `dealeragent.pricing.disclosure/0.1` | Itemized dealer charges and conditional adjustments |

The exact tools, schemas, scopes, idempotency behavior, and safety requirements
for every profile are normative in `capabilities.yaml`.

Version 0.1 defines no customer-data, write, lead-routing, appointment, hold,
quote-generation, or transaction profiles. Future work in those areas requires
a separately versioned extension and does not alter core conformance.

## 6. Common data rules

### 6.1 Identifiers

Every entity MUST have a stable gateway-scoped identifier. Industry identifiers
such as VIN and dealer/OEM codes are separate named fields and MUST NOT be
silently substituted for the gateway identifier. A VIN asserted as a VIN MUST
match `^[A-HJ-NPR-Z0-9]{17}$`.

### 6.2 Money

Money MUST be an integer `amount_minor` plus an ISO 4217 currency code. Binary
floating point and whole-dollar-only representations are forbidden. Conversion
between decimal strings and minor units MUST use the currency's exponent and
reject unrepresentable values; it MUST NOT round a transactional figure without
an explicit, disclosed rounding rule.

### 6.3 Time and locale

Timestamps MUST be RFC 3339 with an explicit offset. Calendar dates use ISO
8601 full-date. Jurisdictions SHOULD use ISO 3166-2 identifiers. Addresses and
legal requirements MUST NOT assume the United States.

### 6.4 Provenance, freshness, authority, and uncertainty

Every dealer, vehicle, availability result, and pricing disclosure MUST carry:

- `provenance`: named source, source-record identifier when available,
  authority class, observation time, and transformations;
- `freshness`: observation time, optional validity limit, and explicit state;
  and
- uncertainty or assumptions wherever the value is estimated, derived,
  conditional, or unknown.

`updated_at` alone is insufficient. A stale or unknown record MUST remain
explicitly stale or unknown; a client MUST NOT upgrade it to current. Only a
source authorized by dealer policy may label availability or transactional
pricing as `authoritative`.

### 6.5 Pagination

List tools use opaque cursor pagination. Cursors MUST be scoped to the query,
authorization context, and rooftop set; they MUST NOT contain PII. Servers MUST
reject a cursor reused under a different scope without revealing foreign data.

## 7. Tenant and dealer-group isolation

Every request is evaluated against an `organization_id` and one or more
`rooftop_id` values. Authorization grants MUST contain:

- subject and audience;
- organization identifier;
- allowed rooftop identifiers or an explicit group-level grant;
- allowed profiles/scopes;
- purpose and expiry; and
- delegation issuer and chain when applicable.

A caller-supplied rooftop identifier is a requested target, not proof of
authority. The gateway MUST intersect it with the grant before querying an
upstream system. Authorization failure MUST occur before any lookup that could
reveal whether a foreign resource exists.

Group search MAY span rooftops only when the caller is public and the records
are published for group search, or when an authenticated grant explicitly
authorizes the entire requested set. Results MUST retain `rooftop_id` and
provenance per record; a group response MUST NOT blend ownership or authority.

## 8. Inventory and availability

Search results are discovery snapshots, not promises of availability. Each
vehicle MUST carry its observation time, validity state, source, and rooftop.

`dealeragent.inventory.verify_availability` is the authoritative check before a
client presents a specific unit as currently available. Its result MUST state:

- current status;
- authority class;
- `observed_at` and `valid_until`;
- whether human verification is still required; and
- any uncertainty or required human verification.

If authority or freshness is insufficient, the gateway MUST return an explicit
unknown/stale result or a structured error, never infer availability.

## 9. Pricing

Pricing requirements are normative in `pricing.md` and
`schemas/pricing.schema.json`. A generic `price` field is forbidden.

An inventory disclosure separates:

- `advertised_price`;
- `required_dealer_charges`;
- `conditional_adjustments` with eligibility and stacking rules; and
- `government_charges` marked unknown, estimated, calculated, or not
  applicable.

An inventory pricing disclosure is not a personalized quote or an
out-the-door total. A client MUST NOT present it as one when buyer-specific or
jurisdiction-specific amounts remain unknown.

## 10. No system or customer-data access

Version 0.1 is read-focused. It MUST NOT be used to infer generic access to a
dealer's DMS, CRM, desking, lender, or other operational systems. It defines no
customer PII input, lead submission, record creation, inventory mutation, hold,
appointment, payment, contract, or other transactional action.

Future extensions MAY define bounded retail actions, but they require separate
capability identifiers, authorization, consent, confirmation, retention, and
conformance requirements. Supporting such an extension never expands a core
grant or changes the meaning of core retail data.

## 11. Errors and audit

Errors follow `errors.md`. Validation and business failures returned from a tool
call use MCP `isError: true` with structured content. JSON-RPC errors are
reserved for protocol-level failures.

Reads of nonpublic data MUST emit audit events containing a trace
identifier, actor, tenant/rooftop, tool/profile, policy decision, resource
identifiers, outcome, and timestamp. Audit events MUST not contain access
tokens, secret state, or unnecessary data.

## 12. Internationalization and legal posture

The schemas provide jurisdiction, currency, language, tax/fee status, and
policy-extension points. US-specific pricing or credit rules are not
universalized into the core contract.

The research and legal design notes are not legal advice. Deployers remain
responsible for current law, dealer policy, records retention, consumer
disclosures, accessibility, and contractual authority in every jurisdiction.

## 13. Extensions

Extensions use reverse-domain identifiers and version independently. They MUST
not weaken core safety requirements or redefine a core field. Unknown optional
extensions are ignored; a required unknown extension causes negotiation
failure. Extension data belongs under the `extensions` object.

## 14. Conformance

A conformance claim MUST validate against `conformance/claim.schema.json` and
pin:

- Dealer Agent Protocol specification version and immutable digest/reference;
- supported MCP revisions;
- exact profile IDs and versions;
- exact tool/resource inventory;
- auth modes, scopes, organization and rooftop scope;
- extension identifiers/versions;
- test-suite version, result digest, execution time, and issuer; and
- claim status and expiry.

Schema validity alone is not conformance. Behavioral tests MUST cover tenant
isolation, stale data, pricing uncertainty, cursor scope, error redaction, and
authorization failure ordering.

## 15. Compatibility

The compatibility documents classify every mapping as lossless, lossy,
conditional, or unsupported. A gateway MUST NOT advertise native compatibility
when an adapter drops provenance, pricing conditions, freshness, or tenant
scope.

## 16. Open issues before 0.1 candidate

- Decide whether per-record signed attestations are useful enough to standardize.
- Define a neutral registry and collision policy for profile identifiers.
- Test minor-unit conversion across zero- and three-decimal currencies.
- Prove two server and two client implementations against the same suite.
- Agree on minimum availability freshness targets by inventory source type.
- Define a common vocabulary for incentive eligibility without embedding a
  single market's programs.
