# Security and Authorization Profile

This document is normative. It supplements, and does not replace, MCP
`2026-07-28` authorization and security requirements.

## 1. Trust zones

Dealer Agent Protocol separates two retail-data access classes:

| Class | Typical capabilities | Identity requirement |
|---|---|---|
| Published retail | manifest, dealer info, published inventory, pricing disclosure | none; dealer policy may still require a token |
| Protected retail | authoritative availability or dealer-restricted offer data | revocable authenticated client/user |

A grant for one class never implies a higher class.

## 2. OAuth and MCP

Remote gateways MUST follow MCP authorization, including protected-resource
metadata, authorization-server discovery, PKCE, the OAuth `resource` parameter,
issuer validation, and exact audience validation.

- Access tokens MUST be short-lived and audience-bound to the gateway.
- Public clients MUST use PKCE and refresh-token rotation where applicable.
- The gateway MUST NOT pass the inbound MCP token to an upstream retail-data
  source. It obtains a separate upstream credential when one is required.
- The gateway MUST validate expiry, issuer, audience, subject, scopes,
  organization, rooftop set, and policy constraints on every protected call.
- A revoked or invalid credential fails closed; it is not downgraded to public.

Mutual TLS, DPoP, private-key JWT, workload identity, or token exchange MAY be
required by deployment policy. The base profile does not falsely require all of
them for every public inventory endpoint.

## 3. Scopes

Scopes are capability-specific:

```text
dealeragent:inventory:read
dealeragent:pricing:read
```

Scopes are necessary but not sufficient. A server also enforces the dealer
policy grant, tenant/rooftop grant, purpose, and data preconditions. Version 0.1
defines read scopes only.

## 4. Tenant and rooftop grants

The authorization decision input includes:

```json
{
  "subject": "agent:buyer-assistant",
  "organization_id": "org_demo_auto",
  "rooftop_ids": ["rt_demo_sf"],
  "profiles": ["dealeragent.inventory.availability/0.1"],
  "purposes": ["vehicle_shopping"],
  "expires_at": "2026-09-01T18:00:00Z"
}
```

The actual token format is implementation-defined. Wildcard rooftop grants are
forbidden unless a separately recorded group-level delegation authorizes them.
A group gateway may receive such a delegation; audit events still record the
affected rooftop for every call.

Authorization checks occur before resource lookup. Servers SHOULD use
indistinguishable not-found/forbidden behavior where different responses would
create a cross-tenant enumeration oracle.

## 5. Cursor and request integrity

Pagination cursors and other server-issued request state MUST be
integrity-protected and bound to the query, authorization context,
organization, rooftop set, issue time, and expiry. The server treats returned
state as hostile and MUST reject modified, expired, or cross-scope reuse.

## 6. PII and sensitive data

Data is classified as:

- `public_business`: dealer address, hours, public contact points;
- `public_inventory`: published vehicle and price data;
- `protected_retail`: authoritative availability and dealer-restricted offer
  data; and
- `prohibited_customer_data`: customer identity, contact, communications,
  credit, financial, and deal data.

Version 0.1 tools MUST NOT accept or return customer PII. Customer data MUST NOT
appear in cursors, URLs, tool names, resource URIs, error messages, traces,
metrics labels, model prompts, or cache entries.

Deployers MUST publish retention ceilings per category and implement deletion or
legal-hold policy. “Retain according to policy” without a named policy/version is
not a conformance claim.

## 7. Logging and audit

Audit records include `trace_id`, actor, tenant, rooftop, tool, profile, policy
decision/version, identifiers, timestamp, and outcome. Logs MUST omit tokens,
secrets, private upstream credentials, and prohibited customer data.

Audit storage is append-resistant, access-controlled, time-synchronized, and
covered by retention/deletion policy. A returned `trace_id` permits support
correlation without exposing the audit record.

## 8. Tool-output and prompt-injection safety

Dealer and third-party descriptions, vehicle notes, and media captions are
untrusted data. Gateways MUST return them as structured content and
MUST NOT interpret embedded instructions as gateway policy. Clients SHOULD keep
content and instructions separated and render provenance.

Schema references, media URLs, callback URLs, and client metadata fetches create
SSRF risk. Implementations MUST apply allowlists or validated egress policy,
block private/link-local targets where inappropriate, bound response sizes and
timeouts, and avoid automatically dereferencing external JSON Schema references.

## 9. Availability and abuse

Gateways implement per-subject and per-rooftop rate limits, payload/depth limits,
bounded pagination, schema-validation timeouts, and circuit breakers for
upstream systems. `rate_limited` errors include a safe retry interval.

Public inventory endpoints MUST not become a path to private dealer cost,
customer records, unpublished VINs, or write capabilities.

## 10. Legal security boundaries

Auto dealers that finance or lease may be financial institutions under the FTC
Safeguards Rule. That can require a written information-security program,
encryption, access controls, MFA, service-provider oversight, and incident
reporting. This profile intentionally defers credit data; adding it is not a
schema-only change.

This section is design guidance, not legal advice. Jurisdictional profiles may
strengthen these controls but MUST NOT weaken the base security invariants.
