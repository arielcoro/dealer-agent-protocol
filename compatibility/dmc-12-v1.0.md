# DMC-12 v1.0 mapping

Status: informative. DMC-12 is the closest public semantic predecessor found during research; this mapping gives credit without asserting affiliation.

DMC-12's separation of merchant profiles, bindings, and claims; exact money;
freshness; and price disclosure directly informed Dealer Agent Protocol. Dealer
Agent Protocol narrows version 0.1 to read-only dealer retail data over MCP.

| DMC-12 concept | Dealer Agent Protocol mapping | Difference |
|---|---|---|
| Merchant Core | Discovery Core | Dealer-specific organization/rooftop identity and explicit group delegation. |
| Inventory Core | Inventory Read | Per-object provenance and authoritative availability semantics are required. |
| Price Disclosure | Pricing Disclosure | Integer minor-unit money; explicit advertised, required-dealer, conditional, and government-charge buckets. |
| Quote | none | Outside version 0.1; preserved only as an incubating experiment. |
| Soft Hold | none | Outside version 0.1. |
| Lead Transfer | none | Outside version 0.1; customer and CRM data are not accepted. |
| Conformance claim | Dealer Agent Protocol claim | Profile-specific signed self-assertion with immutable test-report digest; still not third-party certification. |
| MCP binding | MCP 2026-07-28 | Stateless discovery/cache/MRTR semantics are pinned. |
| A2A/UCP bindings | optional adapters | No core implementation obligation and no claim inheritance across bridges. |

## Conversion rules

DMC-12 exact-decimal money can map to `amount_minor` only when the currency exponent is known and conversion is exact. Values with excess fractional precision MUST fail; they MUST NOT be rounded silently. DMC-12 freshness and source fields should be retained, but an adapter may label authority `authoritative` only when it can prove the source is the dealer system of record.

A DMC-12 conformance claim does not imply a Dealer Agent Protocol claim. The
operator must run the Dealer Agent Protocol suite because tenancy, MCP revision,
retail-data scope, and schema requirements differ.

Sources: [DMC-12 site](https://dmc-12.ai/) and [v1 specification](https://github.com/mm-open/dmc-12/blob/main/SPEC.md).
