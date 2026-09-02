# A2A Binding 0.1

Identifier: `dealeragent.binding.a2a/0.1`

Extension URI: `https://dealeragentprotocol.com/extensions/core-retail-read/0.1`

This optional binding lets an A2A Agent Card advertise DAP without replacing MCP as the normative Core transport. Each DAP tool maps one-to-one to an A2A skill. Input and output objects travel unchanged in `DataPart`; a bridge must not flatten money, drop provenance, alter freshness, or upgrade authority.

The bridge preserves authenticated identity, tenant grant, organization and rooftop scope, purpose, delegation chain, trace context, and cache/privacy policy end to end. A2A discovery is not authorization. An A2A conformance claim does not imply DAP conformance, and DAP Core conformance does not imply A2A support.

An Agent Card advertises:

```json
{
  "extensions": [
    {
      "uri": "https://dealeragentprotocol.com/extensions/core-retail-read/0.1",
      "required": false,
      "description": "Dealer Agent Protocol Core Retail Read 0.1"
    }
  ]
}
```

See [`compatibility/aap-v1.2.md`](../../compatibility/aap-v1.2.md) for the Auto Agent Protocol mapping.
