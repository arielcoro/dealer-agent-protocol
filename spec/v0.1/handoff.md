# Consented Handoff Profile 0.1

This document is normative. `dealeragent.handoff/0.1` is an independently claimed, two-phase profile for delivering a buyer-requested contact to a dealer-approved destination. It is not part of `dealeragent.core-retail-read/0.1`; neither claim implies the other.

## Tools

| Tool | Access | Contract |
|---|---|---|
| `dealeragent.handoff.get_policy` | Public | Returns accepted purposes, channels, data categories, exact disclosure, retention ceiling, response commitment, and whether an ADF destination is configured. |
| `dealeragent.handoff.prepare` | Authenticated | Accepts purpose and requested channels/categories, but no customer PII. Returns an ES256-signed, expiring, single-use consent binding and the exact disclosure the buyer must see. |
| `dealeragent.handoff.submit` | Authenticated with `dealeragent:handoff:submit` | Accepts the binding and contact only after consent. Verifies signature, expiry, single use, subject, organization, rooftop, and vehicle before persistence or forwarding. Emits ADF/XML. |

A gateway [DAP-HO-001] MUST NOT advertise handoff tools when `get_policy` returns no accepted purposes or no delivery destination. The prepare request [DAP-HO-002] MUST NOT contain a name, email, phone number, message, or other direct identifier. A gateway [DAP-HO-003] MUST reject a prepared binding if the buyer does not consent to the exact disclosure digest.

## Binding order

Before any customer lookup, persistence, logging, or forwarding, submit performs these checks in order:

1. Parse without logging the token.
2. Verify the ES256 JWS signature and expected issuer/audience.
3. Verify expiry and single-use state.
4. Match subject, organization, rooftop, vehicle, purpose, channels, and data categories.
5. Atomically consume the binding.
6. Build and deliver ADF/XML to the configured destination.

Failure payloads, URLs, cursors, log lines, metric labels, cache keys, and trace fields [DAP-HO-004] MUST NOT contain customer PII or the binding token. Replays return a generic binding error and [DAP-HO-005] MUST NOT reveal whether a foreign binding exists.

## Consent evidence

The binding records the disclosure version and SHA-256 digest, purpose, channels, data categories, subject binding, grant/expiry times, single-use flag, issuer, and signature. Deployers remain responsible for jurisdiction-specific consent language and retention.

See [`compatibility/adf-1.0.md`](../../compatibility/adf-1.0.md) for the transport mapping.
