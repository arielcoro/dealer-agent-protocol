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
Authenticated content uses MCP `cacheScope: "private"`; it MUST NOT expose
secrets or internal endpoints.

Capability absence is authoritative. A client MUST NOT call or infer a profile
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

## 4. Stable resources

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

## 5. Web and A2A advertisement

A dealer website MAY link to its MCP endpoint or manifest. An optional A2A agent
card MAY advertise a Dealer Agent Protocol bridge. Neither changes the normative MCP
contract or permits a client to skip MCP authorization and conformance checks.
