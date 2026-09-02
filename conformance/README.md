# Conformance

Dealer Agent Protocol conformance is profile-based, test-backed, and self-asserted in v0.1. A claim is evidence, not certification or endorsement.

An implementation claiming `dealeragent.core-retail-read/0.1` MUST pass the
discovery, inventory read, authoritative availability, pricing disclosure,
tenancy, security-negative, and freshness tests for the pinned MCP revision. A
claim MUST name every claimed profile, include an immutable report digest, and
be signed by the operator. Failed, skipped, or untested required cases prohibit
the claim.

The claim schema is [claim.schema.json](claim.schema.json). [example-claim.json](claims/example-claim.json) is deliberately non-production sample data; its signature is not valid.

## Minimum test categories

1. Schema: every tool input, structured output, error payload, manifest, and claim validates under JSON Schema 2020-12.
2. Discovery: `server/discover` and `dealeragent://manifest` agree; profile dependencies and tools are present.
3. Tenancy: mismatched organization/rooftop grants fail closed; group access exists only through explicit delegation.
4. Data integrity: provenance, freshness, authority status, currency, and price classifications survive round trips.
5. Cursor safety: pagination state is integrity-protected and cannot cross query, tenant, rooftop, or authorization boundaries.
6. Privacy: tools reject customer data; logs and errors do not contain tokens or unredacted source payloads.
7. Failure behavior: stale authoritative data, conflicts, throttling, and dependency outages return the documented stable errors.

## Local artifact check

Install the development dependencies and run:

```sh
python3 -m pip install -r requirements-dev.txt
python3 scripts/validate_artifacts.py
```

This validates every JSON Schema, verifies local references, checks the capability catalog, and validates the published examples and example claim. It does not test a running gateway; a network conformance runner is a post-v0.1 deliverable.

## Reference behavioral suite

After installing `requirements-dev.txt`, run:

```sh
PYTHONPATH=reference/python python3 scripts/run_conformance.py
```

To retain a machine-readable result:

```sh
PYTHONPATH=reference/python python3 scripts/run_conformance.py --report /tmp/dealeragent-conformance-report.json
```

The current suite executes against the in-process reference adapter and its real stdio server. It covers the Core Retail Read bundle only. A transport-neutral adapter contract and remote HTTP/OAuth runner remain future work, so this suite cannot establish production certification.
