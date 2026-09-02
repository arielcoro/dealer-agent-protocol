# Auto Agent Protocol v1.2 mapping

Status: informative. This document does not assert endorsement by the AAP project.

AAP v1.2 is an A2A v1.0 profile whose typed payloads are carried in A2A
`DataPart` messages. Dealer Agent Protocol uses MCP for deterministic retail
catalog access. An adapter can bridge the dealer and inventory read surfaces,
but the protocols are not wire-compatible.

| AAP v1.2 skill | Dealer Agent Protocol mapping | Fidelity |
|---|---|---|
| `dealer.information` | `dealeragent.dealer.get` plus manifest | High; Dealer Agent Protocol adds organization/rooftop grants, provenance, and freshness. |
| `inventory.facets` | facets in `dealeragent.inventory.search` | High; a client may request a zero- or low-result search to obtain facets. |
| `inventory.search` | `dealeragent.inventory.search` | Medium; AAP's generic attributes need vocabulary mapping. Dealer Agent Protocol will not infer authority or freshness absent source evidence. |
| `inventory.vehicle` | `dealeragent.inventory.get_vehicle` | Medium; AAP's whole-dollar `price` must be classified before conversion. |
| `lead.submit` | none | Unsupported in version 0.1; it MUST NOT be routed through a read capability. |

## Price conversion

AAP `Vehicle.price` is a whole-US-dollar integer described as an FTC-final out-the-door amount. A bridge MUST NOT silently map it to Dealer Agent Protocol `advertised_price` or an out-the-door quote. It MUST:

1. multiply by 100 only when the source currency is affirmatively USD;
2. preserve the AAP source record in provenance;
3. set the Dealer Agent Protocol classification to conditional or unknown unless the adapter has itemized required dealer charges, government charges, buyer jurisdiction, and eligibility evidence; and
4. mark the result as asserted rather than authoritative unless the adapter can
   prove that the source is authoritative for that retail fact.

The reverse bridge may emit an AAP price only when rounding to whole dollars is accepted by policy. Otherwise it SHOULD omit the field or fail with a documented precision-loss error.

## A2A binding

An optional Dealer Agent may advertise Dealer Agent Protocol profiles as Agent
Card skills and carry unmodified Dealer Agent Protocol schema objects in A2A
data parts. The bridge MUST preserve caller identity, tenant grant, rooftop
scope, and trace context; it MUST NOT use a shared gateway identity that erases
the original actor.

Sources: [AAP v1.2 introduction](https://autoagentprotocol.org/docs/v1.2/intro), [A2A profile](https://autoagentprotocol.org/docs/v1.2/a2a-profile), [pricing model](https://autoagentprotocol.org/docs/v1.2/pricing-and-ftc), and [MCP adapter](https://autoagentprotocol.org/docs/v1.2/compatibility/mcp).
