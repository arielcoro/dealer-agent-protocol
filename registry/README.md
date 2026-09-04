# MCP Registry publication

`server.json` describes the public Dealer Agent Gateway. The official
registry discovers server implementations, not the protocol specification
itself. The canonical protocol publication remains
`https://dealeragentprotocol.com`.

Before publication:

1. deploy and test `https://mcp.dealeragentgateway.com/dealers/howard-bentley/mcp`;
2. add the public source repository to `server.json` after its final URL is
   known;
3. install the official `mcp-publisher` release;
4. verify `dealeragentgateway.com` using DNS or HTTP authentication; and
5. run `mcp-publisher publish` from this directory.

For HTTP authentication, host the generated public proof at
`https://dealeragentgateway.com/.well-known/mcp-registry-auth`. Never commit the
private registry signing key or a login token.

The registry is currently a preview service. Published version metadata is
immutable, so increment `version` for every metadata update.
