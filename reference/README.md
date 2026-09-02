# Reference Dealer Agent Gateway

This directory contains a non-production reference implementation of the Dealer Agent Protocol `dealeragent.core-retail-read/0.1` bundle. It proves the domain schemas and stateless MCP `2026-07-28` wire contract against realistic synthetic data.

Implemented profiles and tools:

| Profile | Tools |
|---|---|
| `dealeragent.discovery/0.1` | `dealeragent.discovery.get_manifest`, `dealeragent.dealer.get` |
| `dealeragent.inventory.read/0.1` | `dealeragent.inventory.search`, `dealeragent.inventory.get_vehicle` |
| `dealeragent.inventory.availability/0.1` | `dealeragent.inventory.verify_availability` |
| `dealeragent.pricing.disclosure/0.1` | `dealeragent.pricing.get_disclosure` |

The server also exposes `dealeragent://manifest` and the synthetic organization resource. It implements newline-delimited JSON-RPC over stdio for `server/discover`, `tools/list`, `tools/call`, `resources/list`, and `resources/read`.

## Run locally

From the project root:

```sh
python3 -m pip install -r requirements-dev.txt
PYTHONPATH=reference/python python3 -m dealer_agent_protocol_reference.server --demo-grant
```

The `--demo-grant` flag installs an operator-controlled grant for the synthetic downtown rooftop so authoritative availability can be exercised. It is not authentication and MUST NOT be used in production.

To send the included discovery and inventory requests:

```sh
PYTHONPATH=reference/python python3 -m dealer_agent_protocol_reference.server --demo-grant < reference/examples/requests.ndjson
```

Stdout contains only one compact MCP JSON message per request. Diagnostics, if added, belong on stderr and must not include tokens, PII, opaque cursors, or source payloads.

## Run verification

```sh
python3 scripts/validate_artifacts.py
python3 scripts/run_conformance.py
```

The behavioral suite covers schema enforcement, public search, per-record rooftop/freshness preservation, cursor integrity and query binding, authenticated availability, cross-rooftop denial, stale-data refusal, classified pricing, enumeration resistance, error redaction, MCP discovery, structured tool results, manifest/resource agreement, and actual stdio framing.

## Synthetic scenario

The fixture generates two rooftops and three published vehicles relative to an injected clock:

- a current authoritative new vehicle at `roof.downtown`;
- a stale, asserted used vehicle that cannot pass authoritative availability; and
- a current vehicle at `roof.north`, outside the demo grant.

Pricing includes a mandatory dealer charge already included in the advertised price, a separately modeled conditional military incentive, and explicitly unknown government charges. No customer data or real credentials are present.

## Security boundary

The domain gateway receives an `AuthContext` from a trusted transport boundary. It never treats tool arguments or caller-supplied MCP `_meta` as authorization. A real remote gateway must validate audience-bound credentials, issuer, subject, scopes, organization/rooftop grants, and policy before constructing that context.

The reference implementation intentionally omits OAuth/HTTP, persistence,
upstream retail-data integrations, rate limiting, production key management,
and telemetry. Version 0.1 intentionally defines no quote, hold, appointment,
handoff, customer-data, or system-write profiles. These characteristics make
the implementation a conformance fixture, not deployable dealer software.
