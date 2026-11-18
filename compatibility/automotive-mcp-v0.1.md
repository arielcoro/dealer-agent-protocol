# AutomotiveMCP v0.1 mapping

Status: informative. Last checked October 25, 2026. “AutomotiveMCP” and its `amcp:` and `io.automotivemcp/*` namespaces belong to their respective project; Dealer Agent Protocol does not claim certification or endorsement.

AutomotiveMCP v0.1 is an MCP profile with a nine-domain catalog of 63 tools, a normative consent-portability section, and draft sections for federation and delegated identity. Since October 2026 it also runs a public multi-vendor demo gateway. Dealer Agent Protocol v0.1 deliberately maps only discovery, dealer identity, published inventory, availability, retail pricing disclosure, used-vehicle evidence, and a single consented handoff.

## Semantic mapping

| AutomotiveMCP semantic surface | Dealer Agent Protocol mapping | Decision |
|---|---|---|
| `location_id` (absolute https URI, one per call, mirrored in `Mcp-Param-Location`) and group labels | `organization_id` plus `rooftop_id`; explicit group delegation | Map a location to a rooftop. Expand a group to explicit rooftops with a grant for each; never blend tenants implicitly. Authorization is decided on body values, which both projects agree on. |
| `core.get_dealer`, `core.list_dealers` | `dealeragent.dealer.get`, manifest `rooftop_ids` | Map. |
| `inventory.search_vehicles`, `inventory.get_vehicle`, `inventory.get_snapshot` | `dealeragent.inventory.search`, `get_vehicle` | Map; attach per-result provenance, freshness, and authority. Snapshot facets map to DAP `facets`. |
| `availability.status` plus `updated_at`; demo `testkit.check_availability` "as of the daily inventory snapshot" | `dealeragent.inventory.verify_availability` | Map only when backed by an authoritative source and validity window. A snapshot status is `asserted` at best and never `verified_current`. |
| `pricing.prices[]` typed msrp/selling/internet, `dealer_fees[]` with `taxable`, `rebates[]` with `conditional`, `price_disclaimer` | `dealeragent.pricing.get_disclosure` components | Map `selling` or `internet` to `advertised_price` only when the fee inclusion is known; map `dealer_fees[]` to `required_dealer_charges` with `included_in_advertised_price` resolved explicitly; map `rebates[]` to `conditional_adjustments` with criteria `evidence_status: required` because the source carries no eligibility detail; emit `government_charges.status: unknown`. |
| Odometer, title, prior use, history, warranty, CPO, condition grade | `dealeragent.used-vehicle.read/0.1` | Conditional; split the shared history block into provider-specific reports, attach provenance/freshness, qualify the grading system, and preserve conflicts. Direct provider URLs do not prove summary redistribution rights. `days_in_stock` maps to `age_days` only with an explicit `age_basis` and `age_as_of`. |
| Money | `amount_minor` integer plus ISO currency | Both projects use integer minor units plus ISO 4217. Map directly; reject floats and display strings. |
| `leads.create_lead`, `leads.create_appointment`, `leads.send_message` | `dealeragent.handoff/0.1` (policy, prepare, submit) for `create_lead` only | Map `create_lead` behind a DAP consent binding. Appointments and messaging are out of DAP scope. |
| §9 consent receipts (`consent.get_receipt`, `verify_receipt`, `report_revocation`) | DAP consent binding | Different objects. A DAP binding authorizes one handoff into one gateway; an AutomotiveMCP receipt lets a relying party prove a captured consent. A gateway that forwards a DAP handoff to downstream vendors may issue §9 receipts to them; do not present a binding as a receipt or a receipt as a binding. |
| §11 federation (member servers, fan-out, per-member RFC 8693 tokens, `federation` status object) | none | A DAP gateway can be a member serving the inventory domain. Do not pass caller tokens through; the DAP security profile already requires credential exchange at trust boundaries. |
| §12 delegated identity (`anonymous`, `contact_verified`, `account_linked`, `identity_proofed`; `act` claim; step-up via `insufficient_scope`) | none in v0.1 | Draft upstream. DAP handoff requires no principal level because it collects contact data only inside a consented binding. Revisit if DAP adds actions. |
| Deals, desking, quotes, trade appraisal | none | Out of scope in version 0.1. |
| Events/subscriptions (Level 3) | MCP `subscriptions/listen` | No mechanism is specified upstream yet; negotiate the pinned MCP revision and event-specific profile. |
| CRM, service, parts, F&I, marketing signals | none in v0.1 | Out of scope, not silently proxied. |
| Credit application, lender decision, adverse action, documents | none | Explicitly refused by core v0.1 because the authorization, retention, regulatory, and commitment model is insufficient. |

## Conformance translation

AutomotiveMCP Levels 1–3 do not translate into a Dealer Agent Protocol claim.
A Dealer Agent Protocol claim is profile-specific and requires evidence for
exact tools, schema behavior, tenant isolation, freshness, pricing semantics,
and negative security cases. A bridge is conformant only for the profiles it
actually passes; upstream conformance labels are input evidence, not inherited
certification. As of this check AutomotiveMCP has published no conformance
assessments and its self-attested and council-tested marks are not yet open.

## Namespace and authorization

Do not rewrite an `amcp:` scope string into a `dealeragent:` scope. The authorization server must issue a token for the Dealer Agent Protocol resource and its precise organization/rooftop grants. Capability annotations are model hints, not authorization policy. AutomotiveMCP tool metadata uses `_meta["io.automotivemcp/*"]` keys such as `canonical_name`, `members`, `nonstandard`, `level`, and `sandbox`; a bridge may read them as hints and must not treat them as authorization.

## What the public demo shows

The AutomotiveMCP test kit at `https://gateway.automotivemcp.ai/mcp` serves one real dealership's scraped public listings behind eight simulated vendors. Of its 35 live tools, 15 carry standard catalog names and 20 are `testkit.*` tools flagged nonstandard, including the availability check, vehicle details, compare, budget matching, window sticker, and chat. Its `llms.txt` names discovery (§10), inventory freshness contracts, machine-readable substantiation of quoted prices, and eventing as known gaps. Those four are the surface Dealer Agent Protocol specifies, which is why a DAP gateway behind an AutomotiveMCP gateway is a sensible composition rather than a conflict.

Sources: [scope](https://automotivemcp.ai/spec/scope), [conformance](https://automotivemcp.ai/spec/conformance), [core concepts](https://automotivemcp.ai/spec/core-concepts), [security](https://automotivemcp.ai/spec/auth-security), [consent portability](https://automotivemcp.ai/spec/consent-portability), [federation](https://automotivemcp.ai/spec/federation), [delegated identity](https://automotivemcp.ai/spec/delegated-identity), [schemas](https://automotivemcp.ai/spec/schemas), [tool catalog](https://automotivemcp.ai/tools.json), [llms.txt](https://automotivemcp.ai/llms.txt), [test kit](https://automotivemcp.ai/test-kit), and [gateway docs](https://automotivemcp.ai/test-kit/gateway).
