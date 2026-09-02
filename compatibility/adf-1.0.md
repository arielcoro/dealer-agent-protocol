# ADF 1.0 handoff mapping

Status: implementation mapping for `dealeragent.handoff/0.1`. ADF is a delivery format, not the consent mechanism. The signed DAP binding remains the consent evidence.

| DAP field | ADF 1.0 location | Rule |
|---|---|---|
| `handoff_id` | `/adf/prospect/id` | `source="dealeragent"`; stable idempotent handoff identifier. |
| submission time | `/adf/prospect/requestdate` | RFC 3339 UTC. |
| `vehicle_id` | `/adf/prospect/vehicle/id` | `source="dealeragent"`; VIN/stock may be separate attributes when explicitly supplied. |
| `contact.name` | `/adf/prospect/customer/contact/name` | `part="full"`. |
| `contact.email` | `/adf/prospect/customer/contact/email` | Only when included in the consented categories/channels. |
| `contact.phone` | `/adf/prospect/customer/contact/phone` | Only when included in the consented categories/channels. |
| `message` | `/adf/prospect/customer/comments` | Escaped text; secrets and binding tokens prohibited. |
| `rooftop_id` | `/adf/prospect/vendor/id` | Dealer-approved destination identifier. |
| dealer name | `/adf/prospect/vendor/vendorname` | From dealer identity, not caller input. |
| buyer agent identity | `/adf/prospect/provider/name` | Authenticated agent/provider identity. |
| profile and handoff ID | `/adf/prospect/provider/service` | Must identify consented agent handoff and preserve `handoff_id`. |

Before emitting XML, implementations verify signature, expiry, single use, subject, organization, rooftop, vehicle, purpose, channels, and data categories. XML text and attribute values must be escaped. Delivery logs use `handoff_id` and `trace_id`, never raw contact data or the binding token.
