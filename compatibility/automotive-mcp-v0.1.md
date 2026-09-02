# Automotive MCP v0.1 mapping

Status: informative. “Automotive MCP” and its `amcp:` namespace belong to their respective project; Dealer Agent Protocol does not claim certification or endorsement.

Automotive MCP v0.1 is MCP-native but defines a much broader domain surface.
Dealer Agent Protocol v0.1 deliberately maps only discovery, dealer identity,
published inventory, availability, and retail pricing disclosure.

| Automotive MCP semantic surface | Dealer Agent Protocol mapping | Decision |
|---|---|---|
| Tenant/dealer/location | organization and rooftop objects | Map with explicit group delegation; never blend tenants implicitly. |
| Inventory list/search/get | `dealeragent.inventory.search`, `get_vehicle` | Map; attach per-result provenance, freshness, and authority. |
| Vehicle availability | `dealeragent.inventory.verify_availability` | Map only when backed by an authoritative source and validity window. |
| Odometer, title, prior use, history, warranty, CPO, condition grade | `dealeragent.used-vehicle.read/0.1` | Conditional; split the shared history block into provider-specific reports, attach provenance/freshness, qualify the grading system, and preserve conflicts. Direct provider URLs do not prove summary redistribution rights. |
| Money | `amount_minor` integer plus ISO currency | Structurally map only from the normative minor-unit form. Published major-unit `number` variants require explicit decimal conversion and conflict reporting. |
| Deals/quotes | none | Out of scope in version 0.1. |
| Consent/lead/contact | none | Out of scope in version 0.1; customer data is rejected. |
| Events/subscriptions | MCP `subscriptions/listen` | No generic “Level 3” equivalence; negotiate the pinned MCP revision and event-specific profile. |
| CRM, service, parts, F&I, marketing signals | none in v0.1 | Out of scope, not silently proxied. |
| Credit application, lender decision, adverse action, documents | none | Explicitly refused by core v0.1 because the authorization, retention, regulatory, and commitment model is insufficient. |

## Conformance translation

Automotive MCP Levels 1–3 do not translate into a Dealer Agent Protocol claim.
A Dealer Agent Protocol claim is profile-specific and requires evidence for
exact tools, schema behavior, tenant isolation, freshness, pricing semantics,
and negative security cases. A bridge is conformant only for the profiles it
actually passes; upstream conformance labels are input evidence, not inherited
certification.

## Namespace and authorization

Do not rewrite an `amcp:` scope string into a `dealeragent:` scope. The authorization server must issue a token for the Dealer Agent Protocol resource and its precise organization/rooftop grants. Capability annotations are model hints, not authorization policy.

Sources: [Automotive MCP scope](https://automotivemcp.ai/spec/scope), [conformance](https://automotivemcp.ai/spec/conformance), [core concepts](https://automotivemcp.ai/spec/core-concepts), [security](https://automotivemcp.ai/spec/auth-security), and [schemas](https://automotivemcp.ai/spec/schemas).
