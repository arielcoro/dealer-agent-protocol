# Public deployment

This deployment publishes three deliberately separate surfaces:

| Surface | Canonical URL | Purpose |
|---|---|---|
| Protocol publication | `https://dealeragentprotocol.com` | Specification, schemas, documentation, and registry metadata |
| Gateway website | `https://dealeragentgateway.com` | Human-facing implementation overview, boundary, and connection details |
| Gateway platform status | `https://mcp.dealeragentgateway.com/status` | Platform health and enrolled dealer directory |
| Howard Bentley Gateway | `https://mcp.dealeragentgateway.com/dealers/howard-bentley/mcp` | Public Streamable HTTP MCP endpoint for Howard Bentley retail inventory |

The first dealer Gateway is an experimental pilot. It exposes only approved
retail fields and keeps source credentials, customer data, and dealer-private
fields outside the public service.

## 1. Build and publish both websites

Prerequisites: the `dealeragentprotocol.com` zone is active in Cloudflare and
Wrangler is authenticated to the intended account.

Copy the public configuration templates to their local production names, then
replace every `replace-with-*` value. The production files are ignored so live
database identifiers and custom-domain routing do not enter source control:

```sh
cp deployment/cloudflare/wrangler.example.jsonc deployment/cloudflare/wrangler.jsonc
cp deployment/cloudflare/gateway-site.wrangler.example.jsonc deployment/cloudflare/gateway-site.wrangler.jsonc
cp deployment/cloudflare/dealershipmcp.wrangler.example.jsonc deployment/cloudflare/dealershipmcp.wrangler.jsonc
cp deployment/cloudflare/reference-gateway.wrangler.example.jsonc deployment/cloudflare/reference-gateway.wrangler.jsonc
```

```sh
python3 scripts/build_public_site.py
npx wrangler deploy --config deployment/cloudflare/wrangler.jsonc
npx wrangler deploy --config deployment/cloudflare/gateway-site.wrangler.jsonc
```

The Wrangler configuration attaches the Worker static-assets deployment to the
apex custom domain. Configure `www.dealeragentprotocol.com` as a permanent
redirect to the apex in Cloudflare; do not serve two canonical hosts.

After deployment, verify:

```sh
curl -fsS https://dealeragentprotocol.com/
curl -fsS https://dealeragentprotocol.com/llms.txt
curl -fsS https://dealeragentprotocol.com/server.json
curl -fsS https://dealeragentprotocol.com/spec/v0.1/schemas/manifest.schema.json
curl -fsS https://dealeragentgateway.com/
curl -fsS https://dealeragentgateway.com/llms.txt
```

Versioned paths are publication records. Do not change an already released
schema in place; publish a new versioned path.

The website Workers add a restrictive content security policy, transport and
framing protections, explicit cache rules, and immutable caching for versioned
specification artifacts. Configure `www` hostnames as permanent redirects to
their respective apex domains.

## 2. Publish the reference fixture locally

Build the container from the repository root:

```sh
docker build -f deployment/gateway/Dockerfile -t dealer-agent-gateway-reference:0.1.0 .
docker run --rm -p 8080:8080 \
  -e DEALER_AGENT_DEMO_MODE=1 \
  -e DEALER_AGENT_CURSOR_SECRET='replace-with-a-long-random-value' \
  dealer-agent-gateway-reference:0.1.0
```

Deploy the same image to an ASGI-capable container service. Set:

- `DEALER_AGENT_DEMO_MODE=1` only for this synthetic reference deployment;
- `DEALER_AGENT_CURSOR_SECRET` from the platform secret manager;
- `DEALER_AGENT_ALLOWED_ORIGINS=https://dealeragentprotocol.com,https://dealeragentgateway.com`; and
- `DEALER_AGENT_PROJECT_ROOT=/app`.

The container remains useful as a local synthetic interoperability fixture. Do
not map it over the operated service at `mcp.dealeragentgateway.com`. It
exposes:

- `POST /mcp` — stateless MCP requests in the local reference fixture;
- `GET /health` — public liveness and synthetic-data declaration; and
- `GET /` — human-readable service metadata as JSON.

Do not put customer data, real dealer credentials, or a pass-through DMS/CRM
token into the reference deployment.

## 3. Publish registry metadata

Only publish after the remote endpoint is reachable and tested. From the
`registry` directory:

```sh
mcp-publisher login dns --domain dealeragentgateway.com --private-key "$PRIVATE_KEY"
mcp-publisher publish
```

Follow the official publisher instructions to generate the DNS proof. Keep its
private key in a secret manager, never in this repository. The registry name is
`com.dealeragentgateway/howard-bentley`, matching the dealer-scoped deployment
under the verified domain. Verify the published entry through the official
Registry API and test the remote with MCP Inspector. Registry metadata versions
are immutable; increment the server version before republishing a change.

## 4. Operated Gateway boundary

The operated Gateway is a multi-tenant service and security boundary. Each dealer
deployment uses a dealer-authorized retail-data adapter, strict tenant routing,
upstream credential isolation, rate limiting, audit, monitoring, and incident
response. It must never inherit the demo grant or demo cursor secret.

Dealer MCP endpoints are namespaced as `/dealers/{dealer-slug}/mcp`. Platform
status lives at `/status`; dealer inventory health lives inside the matching
dealer namespace. The original root-level routes remain temporary deprecated
compatibility aliases and must not be used for new integrations.
