# Security Policy

## Reporting

Do not place vulnerability details, credentials, customer data, VIN-linked
private records, or exploit payloads in a public issue. Use GitHub's private
vulnerability reporting flow under the repository's **Security** tab. If that
flow is unavailable, open a public issue containing no vulnerability details
and ask a maintainer to establish a private channel.

No bounty or response-time commitment exists for this draft.

## Supported versions

Only the newest published draft receives security corrections. A future stable
release policy must state support windows and immutable errata handling.

## Credential handling

- Never commit secrets, tokens, API keys, refresh tokens, or customer records.
- Never pass an MCP access token through to an upstream retail-data source.
  Obtain a separately audience-bound upstream credential.
- Treat cursors and all caller-supplied identifiers as attacker-controlled
  inputs.
- Redact customer data, authorization data, and opaque state from returned
  errors and logs.

The normative requirements are in `spec/v0.1/security.md`.
