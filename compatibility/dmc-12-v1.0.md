# DMC-12 v1.0 mapping

Status: informative. DMC-12 is the closest public semantic predecessor found during research; this mapping gives credit without asserting affiliation.

DMC-12's separation of merchant profiles, bindings, and claims; exact money;
freshness; and price disclosure directly informed Dealer Agent Protocol. DAP
also adopts and credits DMC-12's per-merchant `freshness_sla_seconds`, named
agent trust levels (Anonymous, Accountable, Verified, Contracted), and
requirement-ID practice. DAP keeps Core read-only and claims consented handoff
separately.

| DMC-12 concept | Dealer Agent Protocol mapping | Difference |
|---|---|---|
| Merchant Core | Discovery Core | Dealer-specific organization/rooftop identity and explicit group delegation. |
| Inventory Core | Inventory Read | Per-object provenance and authoritative availability semantics are required. |
| Price Disclosure | Pricing Disclosure | Integer minor-unit money; explicit advertised, required-dealer, conditional, and government-charge buckets. |
| Quote | none | Outside version 0.1; preserved only as an incubating experiment. |
| Soft Hold | none | Outside version 0.1. |
| Lead Transfer | `dealeragent.handoff/0.1` | Two-phase prepare/submit with ES256-signed, expiring, single-use consent binding and ADF delivery. |
| Conformance claim | Dealer Agent Protocol claim | Profile-specific signed self-assertion with immutable test-report digest; still not third-party certification. |
| MCP binding | MCP 2026-07-28 | Stateless discovery/cache/MRTR semantics are pinned. |
| A2A/UCP bindings | optional adapters | No core implementation obligation and no claim inheritance across bridges. |

## UCP carriage

A UCP Merchant Binding may carry DAP discovery and disclosure references without
changing either standard. The binding should advertise the DAP A2A extension URI,
gateway/manifest URI, organization and rooftop identifiers, and conformance claim
digest. DAP structured objects travel unchanged; UCP must not flatten price,
drop eligibility, upgrade asserted availability, or broaden authorization. A UCP
claim does not imply DAP conformance, and a DAP claim does not imply UCP support.

## Conversion rules

DMC-12 exact-decimal money can map to `amount_minor` only when the currency exponent is known and conversion is exact. Values with excess fractional precision MUST fail; they MUST NOT be rounded silently. DMC-12 freshness and source fields should be retained, but an adapter may label authority `authoritative` only when it can prove the source is the dealer system of record.

A DMC-12 conformance claim does not imply a Dealer Agent Protocol claim. The
operator must run the Dealer Agent Protocol suite because tenancy, MCP revision,
retail-data scope, and schema requirements differ.

Sources: [DMC-12 site](https://dmc-12.ai/) and [v1 specification](https://github.com/mm-open/dmc-12/blob/main/SPEC.md).
