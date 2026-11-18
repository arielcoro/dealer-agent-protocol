# Five-minute demo for AI agent developers

This is a public, synthetic Dealer Agent Protocol gateway. It is for builders who want to connect Claude, ChatGPT, Cursor, or MCP Inspector and see how a dealership endpoint is supposed to behave.

The published endpoint is live at:

`https://demo.dealeragentprotocol.com/mcp`

There is no sign-in. The data is synthetic Example Motors Group inventory: 13 vehicles across two rooftops. Nothing here is a real car, a real price, or a real dealership, and nothing is forwarded to a store. To run a local copy instead, use `wrangler dev --local` and point your client at `http://127.0.0.1:8787/mcp` (or whatever port Wrangler prints).

## 1. Claude (Desktop or Connectors)

1. Open **Settings → Connectors** and choose **Add custom connector**.
2. Name it `Example Motors (DAP demo)`.
3. Paste the endpoint above (or your local URL). Choose **No sign-in**. If Claude still offers a sign-in step, choose **Connect** to skip it.
4. Start a new chat. Claude may ask before the first call to each tool. For this demo, allowing the read tools is safe.

Claude Code:

```sh
claude mcp add --transport http dap-demo https://demo.dealeragentprotocol.com/mcp
```

## 2. ChatGPT

1. Enable **Developer mode**.
2. Add a custom MCP server / connector.
3. Paste the same endpoint. Do not add an authentication header.
4. Start a new chat and ask one of the sample prompts below.

## 3. Cursor

Add a Streamable HTTP MCP server to your Cursor MCP config:

```json
{
  "mcpServers": {
    "dap-demo": {
      "url": "https://demo.dealeragentprotocol.com/mcp"
    }
  }
}
```

Restart Cursor and ask a question in a chat that can use tools.

## 4. MCP Inspector

The current Inspector CLI talks to this gateway in two eras. The default (`legacy`) uses the initialize handshake that Claude, ChatGPT, and Cursor still send (`2025-11-25` and earlier). `--protocol-era modern` or `auto` uses the current MCP revision, `2026-07-28`. This gateway accepts both.

List the tools:

```sh
npx @modelcontextprotocol/inspector --cli \
  --server-url https://demo.dealeragentprotocol.com/mcp \
  --transport http \
  --method tools/list
```

To exercise the current revision:

```sh
npx @modelcontextprotocol/inspector --cli \
  --server-url https://demo.dealeragentprotocol.com/mcp \
  --transport http \
  --protocol-era modern \
  --method tools/list
```

Call a tool:

```sh
npx @modelcontextprotocol/inspector --cli \
  --server-url https://demo.dealeragentprotocol.com/mcp \
  --transport http \
  --protocol-era modern \
  --method tools/call \
  --tool-name dealeragent.inventory.search \
  --tool-args-json '{"organization_id":"org.example-motors","filters":{"vehicle_type":["suv"],"price_max":{"amount_minor":4000000,"currency":"USD"}}}'
```

## Sample prompts

Use these once the client is connected. Ask the model to use the demo tools, and to treat every answer as synthetic.

1. “Using the Example Motors demo, which SUVs are advertised under $40,000? For each one, tell me the advertised price and whether availability has been verified. If availability is unknown or stale, say so.”
2. “Pick the cheapest of those SUVs, show me the exact vehicle record, and explain the pricing disclosure: advertised price, required dealer charges, any conditional offers, and whether government charges are known.”
3. “What used-vehicle evidence is published for a used Example Northstar — odometer, days in stock, history reports, title, and any conflicts? Do not call a vehicle accident-free unless the evidence says that.”

## What you should expect

- Ten tools covering discovery, dealer identity, inventory search, vehicle detail, availability verification, pricing disclosure, used-vehicle evidence, and a sandbox consented handoff. The handoff returns a sample ADF and does not contact a dealership.
- Typed filters, signed cursors, and explicit freshness. Search results are discovery snapshots. Verify availability before saying a vehicle is available now.
- Unknown prices or charges are labeled unknown. Unknown never means zero.
- Text summaries say the data is synthetic.

This walkthrough does not promise rankings, leads, or a particular client result. It only shows the protocol contract against a fixed synthetic fleet.
