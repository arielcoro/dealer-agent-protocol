# Discovery and Capability Claims

This document is normative.

## 1. MCP-native discovery

Dealer Agent Protocol does not add a competing transport handshake. The gateway
implements MCP `server/discover`, which establishes supported MCP revisions and
base capabilities. The client then reads `dealeragent://manifest` or calls
`dealeragent.discovery.get_manifest`.

The manifest is an automotive conformance document, not a replacement for MCP
discovery. It identifies exactly which Dealer Agent Protocol profiles and tools are
available to the caller.

## 2. Public and authenticated views

The public manifest lists public capabilities only. An authenticated manifest
MAY include additional tools, rooftop scope, quotas, and policy requirements.
Authenticated content uses MCP `cacheScope: "private"`; it [DAP-DISC-001] MUST NOT expose
secrets or internal endpoints.

Capability absence is authoritative. A client [DAP-DISC-002] MUST NOT call or infer a profile
the manifest does not declare.

## 3. Required fields

The manifest includes:

- gateway identity and operator;
- organization and covered rooftops;
- Dealer Agent Protocol spec version;
- supported MCP revisions;
- exact profile IDs/versions and status;
- exact tool and resource names;
- public/authenticated access modes and scopes;
- schema base URI and extension declarations;
- freshness and data-authority policies; and
- conformance claim URL/digest and test result.

## 4. Static publication

A dealer without a running gateway MAY publish `/.well-known/dealer-agent.json`
using `schemas/well-known.schema.json`. The file points to a
`dealer-agent-inventory-csv/0.1` feed, declares rooftop identity and disclosure
defaults, and may name an upgrade path to a managed gateway.

A static publication is always `authority: asserted`. It [DAP-DISC-003] MUST NOT advertise or
imply `verified_current` availability. Clients [DAP-DISC-004] MUST describe its availability
as a dealer-published assertion and [DAP-DISC-005] MUST NOT turn it into “available now.” Only
an authenticated gateway check against an authoritative source can upgrade the
availability band.

The document and its feed [DAP-DISC-006] MUST be served over HTTPS in production. A publisher
SHOULD allow retrieval by search engines and agent crawlers, SHOULD use an ETag,
and SHOULD make the declared freshness SLA no shorter than the actual export
schedule. See `dealer-agent-inventory-csv.md` and the example document.

## 5. Stable resources

The following resource URIs are reserved:

```text
dealeragent://manifest
dealeragent://organization/{organization_id}
dealeragent://organization/{organization_id}/rooftop/{rooftop_id}
dealeragent://organization/{organization_id}/rooftop/{rooftop_id}/vehicle/{vehicle_id}
dealeragent://organization/{organization_id}/policy/{policy_id}
```

Resource URIs are identifiers, not authorization grants. Every read is
authorized independently. Resources containing caller-specific or nonpublic
data use private caching or no effective caching (`ttlMs: 0`).

## 6. Web and A2A advertisement

A dealer website MAY link to its MCP endpoint or manifest. An optional A2A agent
card MAY advertise a Dealer Agent Protocol bridge. Neither changes the normative MCP
contract or permits a client to skip MCP authorization and conformance checks.
