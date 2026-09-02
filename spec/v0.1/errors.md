# Error Contract

This document is normative.

## 1. Wire behavior

Malformed JSON-RPC or unsupported MCP operations use MCP/JSON-RPC errors.
Validation and business failures from a valid tool invocation return an MCP tool
result with `isError: true` and structured content shaped as:

```json
{
  "error_id": "err_01J7DEALERAGENT0001",
  "code": "dealeragent.vehicle.stale",
  "message": "Availability must be refreshed before this action.",
  "retryable": true,
  "retry_after_ms": 1000,
  "trace_id": "trc_01J7DEALERAGENT0001",
  "details": {},
  "created_at": "2026-09-01T14:00:00Z"
}
```

`message` is bounded to 500 characters and contains no PII, token, internal
stack trace, SQL, upstream body, or foreign resource identifier.

## 2. Closed code registry

| Code | Retryable | Meaning |
|---|---:|---|
| `dealeragent.validation.invalid` | no | Schema or cross-field validation failed |
| `dealeragent.protocol.unsupported_revision` | no | Requested MCP revision is unsupported |
| `dealeragent.capability.unsupported` | no | Profile/tool is not declared |
| `dealeragent.auth.required` | no | Authentication or step-up is required |
| `dealeragent.auth.invalid` | no | Credential is expired, revoked, malformed, or wrong-audience |
| `dealeragent.scope.insufficient` | no | Scope or dealer policy grant is insufficient |
| `dealeragent.tenant.forbidden` | no | Requested tenant/rooftop is outside the grant |
| `dealeragent.resource.not_found` | no | Resource is absent or indistinguishable from forbidden |
| `dealeragent.vehicle.unavailable` | no | Vehicle is authoritatively unavailable |
| `dealeragent.vehicle.stale` | yes | Fresh availability is required |
| `dealeragent.pricing.incomplete` | no | Required price components are unknown |
| `dealeragent.pricing.eligibility_unverified` | no | A claimed adjustment cannot be applied |
| `dealeragent.state.conflict` | yes | State changed during the operation; refresh first |
| `dealeragent.rate_limited` | yes | Caller exceeded a safe rate |
| `dealeragent.upstream.unavailable` | yes | Authoritative system is temporarily unavailable |
| `dealeragent.internal` | yes | Unexpected gateway failure |

`retryable` is derived from the code. A server MUST NOT accept it from caller
input or override it ad hoc. A retryable response SHOULD include bounded retry
guidance when known.

## 3. Validation details

Validation errors SHOULD return every safe, currently detectable violation with
JSON Pointer `instance_location`, failed `keyword`, and a bounded explanation.
They MUST NOT echo sensitive input values.

## 4. Enumeration resistance

For nonpublic resources, a deployment MAY collapse `not_found`,
`tenant.forbidden`, and selected scope failures to the same public response.
The detailed reason remains in the protected audit record.
