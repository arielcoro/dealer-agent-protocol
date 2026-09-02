const VERSION = "2026-07-28";
const NOW = "2026-09-02T14:03:11Z";
const VALID_UNTIL = "2026-09-02T14:05:11Z";
const TOOLS = [
  ["dealeragent.discovery.get_manifest", "Discover the DAP profiles, tools, rooftop scope, policies, and conformance evidence."],
  ["dealeragent.dealer.get", "Read the synthetic public dealer and rooftop identity."],
  ["dealeragent.inventory.search", "Search synthetic published vehicles with source and freshness attached."],
  ["dealeragent.inventory.get_vehicle", "Read one synthetic vehicle detail record."],
  ["dealeragent.inventory.verify_availability", "Verify availability against the synthetic authoritative source."],
  ["dealeragent.pricing.get_disclosure", "Read the classified advertised price, required charges, conditions, and government-charge status."]
].map(([name, description]) => ({
  name,
  description,
  inputSchema: { type: "object", additionalProperties: true },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
}));

const provenance = authority => ({ sources: [{ source_name: "synthetic-reference-source", source_record_id: "N26001", authority, observed_at: NOW }], authority_status: authority === "authoritative_dealer_system" ? "authoritative" : "asserted", transformed_at: NOW });
const freshness = { observed_at: NOW, valid_until: VALID_UNTIL, state: "current", max_age_seconds: 120 };
const vehicle = {
  vehicle_id: "veh.2026-001", organization_id: "org.example-motors", rooftop_id: "roof.downtown",
  vin: "1HGBH41JXMN109186", stock_number: "N26001", vehicle_type: "suv", year: 2026,
  make: "Example", model: "Northstar", trim: "Touring AWD", condition: "new", body_style: "SUV",
  listing_url: "https://dealer.example/inventory/N26001",
  advertised_price: { amount: { amount_minor: 4287500, currency: "USD" }, availability: "generally_available", includes_required_dealer_charges: true, valid_until: "2026-09-04T14:03:11Z" },
  availability: { status: "available", authority_status: "authoritative", observed_at: NOW, valid_until: VALID_UNTIL, human_verification_required: false },
  provenance: provenance("authoritative_dealer_system"), freshness
};
const manifest = {
  standard: "dealer-agent-protocol", standard_version: "0.1", mcp_revision: VERSION,
  gateway_id: "gateway.dealershipmcp.synthetic-reference", operator: { name: "Dealer Agent Protocol synthetic reference", uri: "https://dealeragentprotocol.com/" },
  organization_ids: ["org.example-motors"], rooftop_ids: ["roof.downtown"],
  capabilities: [
    { profile: "dealeragent.discovery/0.1", status: "supported", tools: TOOLS.slice(0, 2).map(x => x.name), scopes: [] },
    { profile: "dealeragent.inventory.read/0.1", status: "supported", tools: TOOLS.slice(2, 4).map(x => x.name), scopes: ["dealeragent:inventory:read"] },
    { profile: "dealeragent.inventory.availability/0.1", status: "supported", tools: [TOOLS[4].name], scopes: ["dealeragent:inventory:read"] },
    { profile: "dealeragent.pricing.disclosure/0.1", status: "supported", tools: [TOOLS[5].name], scopes: ["dealeragent:pricing:read"] }
  ],
  resources: ["dealeragent://manifest", "dealeragent://organization/org.example-motors"], auth_modes: ["public"],
  tenant_routing: { organization_id_required: true, rooftop_id_required_for_unit_reads: true, group_delegation_explicit: true },
  schema_base_uri: "https://dealeragentprotocol.com/spec/v0.1/schemas/", policy_uri: "https://dealeragentprotocol.com/spec/v0.1/security.md",
  authority_policy: { uri: "https://dealeragentprotocol.com/spec/v0.1/security.md#availability-and-abuse", inventory_max_age_seconds: 900, authoritative_availability_required_for_actions: true },
  freshness_sla_seconds: { "roof.downtown": { inventory: 900, availability: 120, pricing: 3600 } },
  conformance: { claim_uri: "https://dealeragentprotocol.com/conformance/claims/example-claim.json", claim_digest: "sha256:6e701b914b375ca9b775570c9983a9312f874e33bff86d52c9b4360fd90220e7" },
  issued_at: NOW, expires_at: "2026-09-02T15:03:11Z"
};
const dealer = { organization_id: "org.example-motors", name: "Example Motors Group", legal_name: "Example Motors Group LLC", rooftops: [{ rooftop_id: "roof.downtown", name: "Example Motors Downtown", website: "https://dealer.example/downtown", address: { lines: ["100 Example Avenue"], locality: "Miami", region: "FL", postal_code: "33101", country: "US" }, timezone: "America/New_York", departments: ["sales"], contacts: [], supported_languages: ["en-US"], supported_currencies: ["USD"] }], provenance: provenance("dealer_asserted"), freshness: { ...freshness, max_age_seconds: 3600 } };
const pricing = {
  disclosure_id: "pricing.veh.2026-001", vehicle_id: vehicle.vehicle_id, organization_id: vehicle.organization_id, rooftop_id: vehicle.rooftop_id,
  advertised_price: vehicle.advertised_price,
  required_dealer_charges: [{ charge_id: "charge.documentation", name: "Documentation charge", amount: { amount_minor: 99500, currency: "USD" }, payee: "dealer", included_in_advertised_price: true, taxable_status: "jurisdiction_dependent", required: true, provenance: provenance("authoritative_dealer_system") }],
  conditional_adjustments: [{ adjustment_id: "incentive.military", name: "Military appreciation incentive", direction: "discount", amount_status: "known", amount: { amount_minor: 50000, currency: "USD" }, criteria: [{ criterion: "military", operator: "verified", value: true, evidence_status: "required", description: "Dealer verification is required." }], criteria_mode: "all", stacking: { group: "affinity", combinability: "rule_defined" }, provenance: provenance("authoritative_dealer_system") }],
  government_charges: { status: "unknown", assumptions: ["Buyer registration jurisdiction has not been supplied."], provenance: provenance("dealer_asserted") },
  disclosure_completeness: { score: 85, components: { advertised_price_present_and_authoritative: true, required_dealer_charges_itemized: true, conditional_adjustments_have_eligibility_and_stacking: true, government_charges_classified: true, availability_band: "verified_current" } },
  disclosure_text: "Government charges depend on buyer and registration facts. Conditional incentives require verification.", uncertainty: { status: "unknown", reason: "Government charges and incentive eligibility are not yet known." }, provenance: provenance("authoritative_dealer_system"), freshness: { ...freshness, max_age_seconds: 3600 }
};

function rpc(id, result) { return Response.json({ jsonrpc: "2.0", id, result }, { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } }); }
function error(id, code, message) { return Response.json({ jsonrpc: "2.0", id, error: { code, message } }, { status: 400, headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } }); }
function toolResult(value) { return { content: [{ type: "text", text: JSON.stringify(value) }], structuredContent: value, isError: false }; }
function runtime(value) {
  const observed = new Date(Date.now() - 60_000).toISOString();
  const now = new Date().toISOString();
  const valid = new Date(Date.now() + 120_000).toISOString();
  const expires = new Date(Date.now() + 3_600_000).toISOString();
  return JSON.parse(JSON.stringify(value), (key, item) => {
    if (key === "observed_at") return observed;
    if (key === "transformed_at" || key === "issued_at") return now;
    if (key === "valid_until") return valid;
    if (key === "expires_at") return expires;
    return item;
  });
}

function callTool(name, args) {
  if (name === TOOLS[0].name) return runtime(manifest);
  if (name === TOOLS[1].name) return runtime(dealer);
  if (name === TOOLS[2].name) return runtime({ vehicles: [vehicle], facets: { make: [{ value: "Example", count: 1 }], model: [{ value: "Northstar", count: 1 }], condition: [{ value: "new", count: 1 }], year: [{ value: 2026, count: 1 }] }, page: { has_more: false }, provenance: provenance("derived"), freshness, trace_id: crypto.randomUUID() });
  if (name === TOOLS[3].name) return runtime(vehicle);
  if (name === TOOLS[4].name) return runtime({ vehicle_id: vehicle.vehicle_id, organization_id: vehicle.organization_id, rooftop_id: vehicle.rooftop_id, availability: vehicle.availability, provenance: vehicle.provenance, freshness, trace_id: crypto.randomUUID() });
  if (name === TOOLS[5].name) return runtime(pricing);
  throw new Error("unsupported");
}

export default { async fetch(request) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, authorization, mcp-protocol-version", "Access-Control-Allow-Methods": "POST, GET, OPTIONS" } });
  if (request.method === "GET" && url.pathname === "/health") return Response.json({ status: "ok", data: "synthetic-only", standard: "dealer-agent-protocol/0.1" }, { headers: { "Cache-Control": "no-store" } });
  if (request.method !== "POST" || url.pathname !== "/mcp") return new Response("Not found", { status: 404 });
  let message;
  try { message = await request.json(); } catch { return error(null, -32700, "Parse error"); }
  const { id, method, params = {} } = message;
  if (method === "initialize") return rpc(id, { protocolVersion: VERSION, capabilities: { tools: {}, resources: {} }, serverInfo: { name: "dealer-agent-protocol-reference", version: "0.1.0" }, instructions: "Synthetic data only. Verify availability before presenting it, and never turn unknown government charges into zero." });
  if (method === "server/discover") return rpc(id, { resultType: "complete", supportedVersions: [VERSION], capabilities: { tools: {}, resources: {} }, instructions: "Synthetic data only.", ttlMs: 3600000, cacheScope: "public" });
  if (method === "tools/list") return rpc(id, { tools: TOOLS });
  if (method === "resources/list") return rpc(id, { resources: [{ uri: "dealeragent://manifest", name: "DAP manifest", mimeType: "application/json" }, { uri: "dealeragent://organization/org.example-motors", name: "Synthetic dealer", mimeType: "application/json" }] });
  if (method === "resources/read") {
    const value = params.uri === "dealeragent://manifest" ? runtime(manifest) : params.uri === "dealeragent://organization/org.example-motors" ? runtime(dealer) : null;
    if (!value) return error(id, -32602, "Resource not found");
    return rpc(id, { contents: [{ uri: params.uri, mimeType: "application/json", text: JSON.stringify(value) }] });
  }
  if (method === "tools/call") { try { return rpc(id, toolResult(callTool(params.name, params.arguments || {}))); } catch { return error(id, -32602, "Unsupported tool or invalid arguments"); } }
  if (typeof method === "string" && method.startsWith("notifications/")) return new Response(null, { status: 202 });
  return error(id, -32601, "Method not found");
} };
