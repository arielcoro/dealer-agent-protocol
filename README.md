# Dealer Agent Protocol

[![License](https://img.shields.io/badge/license-Apache--2.0-174d3c.svg)](LICENSE)
[![Status](https://img.shields.io/badge/status-editor's%20draft-e94f2b.svg)](spec/v0.1/SPEC.md)
[![CI](https://github.com/arielcoro/dealer-agent-protocol/actions/workflows/ci.yml/badge.svg)](https://github.com/arielcoro/dealer-agent-protocol/actions/workflows/ci.yml)

Dealer Agent Protocol is an open, MCP-native profile that lets AI agents
understand dealer-published vehicles and retail offers. A server or adapter
implementing the profile is called a **Dealer Agent Gateway**.

## Protocol and gateway are different things

| Project layer | What it is | What it does |
|---|---|---|
| **Dealer Agent Protocol** | Open specification | Defines shared tools, schemas, retail semantics, disclosure rules, and conformance requirements that any gateway can implement. |
| **Dealer Agent Gateway** | Open reference software | Connects approved dealer sources, applies dealer policy, and serves protocol-compliant MCP tools to agents. |
| **MCP** | Transport layer | Carries tool discovery and calls between an agent and a gateway. |

Dealer Agent Gateway demonstrates one implementation. It does not own or replace
the protocol, and other organizations can build compatible gateways.

The project does not define another wire protocol. MCP is the normative
transport, tool, resource, authorization, discovery, and extension layer.
Dealer Agent Protocol defines the automotive schemas, capability bundles,
retail pricing semantics, provenance rules, and conformance evidence needed for
interoperable vehicle-shopping experiences. The name is never shortened to a
project acronym.

| Public surface | Purpose |
|---|---|
| [dealeragentprotocol.com](https://dealeragentprotocol.com) | Canonical specification, schemas, and conformance material |
| [dealeragentgateway.com](https://dealeragentgateway.com) | Reference gateway, connection details, and implementation boundary |
| [GitHub](https://github.com/arielcoro/dealer-agent-protocol) | Source, proposals, tests, and public review |

## Status

Version `0.1.0-draft.1` is a research-backed design draft. It is not a ratified
industry standard, certification program, legal opinion, or claim of endorsement.
The canonical publication host is `https://dealeragentprotocol.com`.

The v0.1 scope is intentionally narrow and read-focused:

- dealer/group discovery;
- inventory search, detail, and availability verification;
- itemized advertised-price and mandatory-charge disclosure; and
- discounts, rebates, incentives, eligibility conditions, and stacking rules.

Dealer Agent Protocol is not a DMS or CRM integration standard and does not
expose generic dealership-system access. Leads, customer records, appointments,
holds, desking, credit, lender decisions, payments, contracts, deal jackets,
service, parts, marketing audiences, and signed documents are out of scope for
v0.1.

## Start here

- [Landscape and gap analysis](research/landscape-and-gap-analysis.md)
- [Normative specification](spec/v0.1/SPEC.md)
- [Capability catalog](spec/v0.1/capabilities.yaml)
- [Security profile](spec/v0.1/security.md)
- [Pricing model](spec/v0.1/pricing.md)
- [Conformance model](conformance/README.md)
- [Reference gateway](reference/README.md)
- [Public deployment](deployment/README.md)
- [MCP Registry record](registry/server.json)
- [AAP mapping](compatibility/aap-v1.2.md)
- [Automotive MCP mapping](compatibility/automotive-mcp-v0.1.md)
- [DMC-12 mapping](compatibility/dmc-12-v1.0.md)

## Normative baseline

The primary protocol baseline is MCP revision `2026-07-28`. A deployment may
support older MCP revisions, but its conformance claim must list them and the
gateway must not silently substitute legacy semantics.

The minimum interoperable bundle is `dealeragent.core-retail-read/0.1`, which requires:

1. `dealeragent.discovery/0.1`
2. `dealeragent.inventory.read/0.1`
3. `dealeragent.inventory.availability/0.1`
4. `dealeragent.pricing.disclosure/0.1`

No write, lead-routing, customer-data, or transaction profile is part of v0.1.

## Validation

From this directory, run:

```bash
python3 -m pip install -r requirements-dev.txt
python3 scripts/validate_artifacts.py
```

The validator checks JSON syntax, JSON Schema 2020-12 metaschemas, examples,
the capability catalog, and the example conformance claim. See
`conformance/README.md` for claim requirements.

The working reference gateway and behavioral suite can be exercised with:

```bash
PYTHONPATH=reference/python python3 scripts/run_conformance.py
```

It implements the six tools in the Core Retail Read bundle over stateless MCP
`2026-07-28` stdio using only synthetic dealership data. It is a conformance
fixture, not a production deployment.

To build and validate the canonical public publication:

```bash
python3 scripts/build_public_site.py
python3 scripts/validate_deployment.py
```

The generated site is written to `site/dist`. Deployment instructions cover the
two Cloudflare custom domains, the portable HTTP gateway container, and official
MCP Registry publication. With Node.js installed, `npm run deploy:sites` builds
and publishes both public websites through the pinned Wrangler dependency.

## Project posture

The likely durable outcome is a small MCP profile, a rigorous schema/policy
package, executable conformance tests, and compatibility adapters offered to a
neutral working group. The project should converge with useful work in AAP,
Automotive MCP, DMC-12, STAR, and UCP where their scope overlaps.

## Contributing

Public review is part of the protocol. Start with [CONTRIBUTING.md](CONTRIBUTING.md),
open a proposal or interoperability issue, and include a concrete example or test
vector for normative changes. See [GOVERNANCE.md](governance/GOVERNANCE.md) for
the review and versioning process.

Contributions are welcome to both project layers. Protocol changes normally
touch normative text, schemas, examples, compatibility, or conformance tests.
Gateway changes normally improve adapters, server behavior, deployment,
security, or the synthetic reference implementation.

## License

Specification text, schemas, examples, tests, websites, and reference code in
this repository are licensed under Apache License 2.0. Its explicit patent grant
is a better fit for an interoperability standard than a minimal permissive
license without patent terms. See [LICENSE](LICENSE).

## Creator

Dealer Agent Protocol and Dealer Agent Gateway were created by **Ariel Coro**.
The project is developed in public with contributions welcomed under Apache
License 2.0.
