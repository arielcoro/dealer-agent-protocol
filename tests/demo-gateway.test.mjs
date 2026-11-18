import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { Validator } from "@cfworker/json-schema";

import worker, { TOOL_SPECS, SUPPORTED_MCP } from "../deployment/cloudflare/demo-gateway-core.mjs";

const ORIGIN = "https://demo.dealeragentprotocol.com";
const SCHEMA_DIR = new URL("../spec/v0.1/schemas/", import.meta.url);
const SCHEMA_BASE = "https://dealeragentprotocol.com/spec/v0.1/schemas/";
const schemas = readdirSync(SCHEMA_DIR).filter((name) => name.endsWith(".schema.json")).map((name) => JSON.parse(readFileSync(new URL(name, SCHEMA_DIR), "utf8")));

function validator(reference) {
  const instance = new Validator({ $ref: `${SCHEMA_BASE}${reference}` }, "2020-12", false);
  for (const schema of schemas) instance.addSchema(schema);
  return instance;
}

function assertValid(reference, value) {
  const result = validator(reference).validate(value);
  assert.ok(result.valid, `${reference} invalid: ${JSON.stringify(result.errors.slice(0, 5), null, 1)}`);
}

const env = {};
let counter = 0;
async function rpc(method, params) {
  const response = await worker.fetch(new Request(`${ORIGIN}/mcp`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++counter, method, params }) }), env);
  assert.equal(response.status, 200, `${method} returned ${response.status}`);
  return response.json();
}
async function call(name, args) {
  const message = await rpc("tools/call", { name, arguments: args });
  assert.ok(message.result, `no result for ${name}: ${JSON.stringify(message.error)}`);
  return message.result;
}
const ORG = "org.example-motors";
const DOWNTOWN = "roof.downtown";
const NORTH = "roof.north";

function hasRef(node) {
  if (Array.isArray(node)) return node.some(hasRef);
  if (node && typeof node === "object") return "$ref" in node || Object.values(node).some(hasRef);
  return false;
}

test("initialize negotiates a supported MCP revision and advertises instructions", async () => {
  const latest = await rpc("initialize", { protocolVersion: "2026-07-28", capabilities: {}, clientInfo: { name: "test", version: "0" } });
  assert.equal(latest.result.protocolVersion, "2026-07-28");
  const older = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } });
  assert.equal(older.result.protocolVersion, "2025-06-18");
  const unknown = await rpc("initialize", { protocolVersion: "1999-01-01", capabilities: {}, clientInfo: { name: "test", version: "0" } });
  assert.equal(unknown.result.protocolVersion, "2026-07-28");
  assert.match(latest.result.instructions, /SYNTHETIC/);
  const discover = await rpc("server/discover", {});
  assert.equal(discover.result.resultType, "complete");
});

test("notifications get 202 and malformed bodies get JSON-RPC errors", async () => {
  const notified = await worker.fetch(new Request(`${ORIGIN}/mcp`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) }), env);
  assert.equal(notified.status, 202);
  const broken = await worker.fetch(new Request(`${ORIGIN}/mcp`, { method: "POST", headers: { "content-type": "application/json" }, body: "{not json" }), env);
  assert.equal(broken.status, 400);
  assert.equal((await broken.json()).error.code, -32700);
  const get = await worker.fetch(new Request(`${ORIGIN}/mcp`), env);
  assert.equal(get.status, 405);
});

test("tools/list exposes every v0.1 tool with fully inlined schemas and UI metadata", async () => {
  const { result } = await rpc("tools/list", {});
  assert.deepEqual(result.tools.map((tool) => tool.name).sort(), Object.keys(TOOL_SPECS).sort());
  for (const tool of result.tools) {
    assert.ok(!hasRef(tool.inputSchema), `${tool.name} inputSchema still has $ref`);
    assert.ok(!hasRef(tool.outputSchema), `${tool.name} outputSchema still has $ref`);
    assert.equal(tool.inputSchema.type, "object");
  }
  const search = result.tools.find((tool) => tool.name === "dealeragent.inventory.search");
  assert.equal(search._meta.ui.resourceUri, "ui://dealer-agent-protocol/vehicles.html");
  assert.equal(search._meta["openai/outputTemplate"], "ui://dealer-agent-protocol/vehicles.html");
  assert.equal(search.annotations.readOnlyHint, true);
});

test("manifest, dealer, and resources validate against the normative schemas", async () => {
  const manifest = await call("dealeragent.discovery.get_manifest", {});
  assert.equal(manifest.isError, false);
  assertValid("manifest.schema.json#/$defs/manifest", manifest.structuredContent);
  assert.equal(manifest.structuredContent.capabilities.length, 6);
  assert.match(manifest.structuredContent.jwks_uri, /\.well-known\/jwks\.json$/);

  const dealer = await call("dealeragent.dealer.get", { organization_id: ORG, rooftop_ids: [NORTH] });
  assertValid("dealer.schema.json#/$defs/dealerOrganization", dealer.structuredContent);
  assert.equal(dealer.structuredContent.rooftops.length, 1);
  const everything = await call("dealeragent.dealer.get", {});
  assert.equal(everything.structuredContent.rooftops.length, 2);

  const resources = await rpc("resources/list", {});
  const uris = resources.result.resources.map((resource) => resource.uri);
  assert.ok(uris.includes("dealeragent://manifest"));
  assert.ok(uris.includes("ui://dealer-agent-protocol/pricing.html"));
  const read = await rpc("resources/read", { uri: "dealeragent://manifest" });
  assertValid("manifest.schema.json#/$defs/manifest", JSON.parse(read.result.contents[0].text));
  const ui = await rpc("resources/read", { uri: "ui://dealer-agent-protocol/vehicles.html" });
  assert.equal(ui.result.contents[0].mimeType, "text/html;profile=mcp-app");
  assert.match(ui.result.contents[0].text, /ui\/initialize/);
  assert.match(ui.result.contents[0].text, /ui\/notifications\/tool-result/);
  const missing = await rpc("resources/read", { uri: "ui://dealer-agent-protocol/nope.html" });
  assert.equal(missing.error.code, -32002);
});

test("search validates input, filters, sorts, pages with signed cursors, and re-stamps freshness", async () => {
  const rejected = await call("dealeragent.inventory.search", { organization_id: ORG, limit: 1 });
  assert.equal(rejected.isError, true);
  assert.equal(rejected.structuredContent.code, "dealeragent.validation.invalid");
  assertValid("error.schema.json", rejected.structuredContent);

  const all = await call("dealeragent.inventory.search", { organization_id: ORG });
  assertValid("vehicle.schema.json#/$defs/searchResponse", all.structuredContent);
  assert.equal(all.structuredContent.vehicles.length, 13);
  assert.equal(all.structuredContent.freshness.state, "stale", "one deliberately stale record must surface in aggregate freshness");
  const newest = all.structuredContent.vehicles.find((vehicle) => vehicle.vehicle_id === "veh.2026-001");
  assert.ok(Date.now() - Date.parse(newest.freshness.observed_at) < 10 * 60_000, "timestamps are re-stamped to the request clock");
  assert.match(all.content[0].text, /verify availability/i);

  const used = await call("dealeragent.inventory.search", { organization_id: ORG, filters: { condition: ["used", "certified"], price_max: { amount_minor: 3500000, currency: "USD" } }, sort: { field: "advertised_price", order: "desc" } });
  const prices = used.structuredContent.vehicles.map((vehicle) => vehicle.advertised_price.amount.amount_minor);
  assert.ok(prices.length >= 3);
  assert.ok(prices.every((price) => price <= 3500000));
  assert.deepEqual(prices, [...prices].sort((a, b) => b - a));
  assert.ok(used.structuredContent.vehicles.every((vehicle) => ["used", "certified"].includes(vehicle.condition)));

  const query = await call("dealeragent.inventory.search", { organization_id: ORG, query: "hybrid trailwind" });
  assert.ok(query.structuredContent.vehicles.length >= 2);
  assert.ok(query.structuredContent.vehicles.every((vehicle) => vehicle.model === "Trailwind"));

  const first = await call("dealeragent.inventory.search", { organization_id: ORG, page: { limit: 5 } });
  assert.equal(first.structuredContent.vehicles.length, 5);
  assert.equal(first.structuredContent.page.has_more, true);
  const second = await call("dealeragent.inventory.search", { organization_id: ORG, page: { limit: 5, cursor: first.structuredContent.page.next_cursor } });
  assert.equal(second.structuredContent.vehicles.length, 5);
  assert.notEqual(second.structuredContent.vehicles[0].vehicle_id, first.structuredContent.vehicles[0].vehicle_id);
  const tampered = await call("dealeragent.inventory.search", { organization_id: ORG, page: { limit: 5, cursor: `${first.structuredContent.page.next_cursor.slice(0, -2)}xx` } });
  assert.equal(tampered.structuredContent.code, "dealeragent.validation.invalid");
  const otherQuery = await call("dealeragent.inventory.search", { organization_id: ORG, filters: { condition: ["new"] }, page: { limit: 5, cursor: first.structuredContent.page.next_cursor } });
  assert.equal(otherQuery.structuredContent.code, "dealeragent.validation.invalid", "a cursor is bound to its query");

  const foreign = await call("dealeragent.inventory.search", { organization_id: "org.someone-else" });
  assert.equal(foreign.structuredContent.code, "dealeragent.resource.not_found");
});

test("vehicle, pricing, availability, and used-vehicle reads honor tenancy and freshness", async () => {
  const vehicle = await call("dealeragent.inventory.get_vehicle", { organization_id: ORG, rooftop_id: DOWNTOWN, vehicle_id: "veh.2026-001" });
  assertValid("vehicle.schema.json#/$defs/vehicle", vehicle.structuredContent);
  const wrongRooftop = await call("dealeragent.inventory.get_vehicle", { organization_id: ORG, rooftop_id: NORTH, vehicle_id: "veh.2026-001" });
  assert.equal(wrongRooftop.structuredContent.code, "dealeragent.resource.not_found");
  const byVin = await call("dealeragent.inventory.get_vehicle", { organization_id: ORG, rooftop_id: NORTH, vin: "EXM7A1B2C3D400007" });
  assert.equal(byVin.structuredContent.vehicle_id, "veh.2026-007");

  const pricing = await call("dealeragent.pricing.get_disclosure", { organization_id: ORG, rooftop_id: DOWNTOWN, vehicle_id: "veh.2026-001" });
  assertValid("pricing.schema.json#/$defs/pricingDisclosure", pricing.structuredContent);
  assert.equal(pricing.structuredContent.government_charges.status, "unknown");
  assert.match(pricing.content[0].text, /Unknown never means zero/);

  const available = await call("dealeragent.inventory.verify_availability", { organization_id: ORG, rooftop_id: DOWNTOWN, vehicle_id: "veh.2026-001" });
  assertValid("vehicle.schema.json#/$defs/availabilityResult", available.structuredContent);
  assert.equal(available.structuredContent.availability.authority_status, "authoritative");
  assert.ok(Date.parse(available.structuredContent.availability.valid_until) > Date.now());

  const stale = await call("dealeragent.inventory.verify_availability", { organization_id: ORG, rooftop_id: DOWNTOWN, vehicle_id: "veh.2024-002" });
  assert.equal(stale.isError, true);
  assert.equal(stale.structuredContent.code, "dealeragent.vehicle.stale");
  assert.equal(stale.structuredContent.retryable, true);
  assert.equal(stale.structuredContent.details.current_freshness.state, "stale");
  assertValid("error.schema.json", stale.structuredContent);

  const used = await call("dealeragent.inventory.get_used_vehicle_details", { organization_id: ORG, rooftop_id: DOWNTOWN, vehicle_id: "veh.2024-002" });
  assertValid("used-vehicle.schema.json#/$defs/usedVehicleDetails", used.structuredContent);
  assert.equal(used.structuredContent.history_reports.length, 2);
  assert.equal(used.structuredContent.discrepancies.length, 1);
  assert.equal(used.structuredContent.inventory_tenure.age_days, 47);
  const certified = await call("dealeragent.inventory.get_used_vehicle_details", { organization_id: ORG, rooftop_id: NORTH, stock_number: "C22011" });
  assert.equal(certified.structuredContent.certification.type, "manufacturer_cpo");
  const notUsed = await call("dealeragent.inventory.get_used_vehicle_details", { organization_id: ORG, rooftop_id: DOWNTOWN, vehicle_id: "veh.2026-001" });
  assert.equal(notUsed.structuredContent.code, "dealeragent.resource.not_found");
});

test("consented handoff: no PII before consent, signed single-use binding, verifiable with the published JWKS", async () => {
  const policy = await call("dealeragent.handoff.get_policy", { organization_id: ORG, rooftop_id: DOWNTOWN });
  assertValid("handoff.schema.json#/$defs/handoffPolicy", policy.structuredContent);

  const subject = `sha256:${"a".repeat(64)}`;
  const withPii = await call("dealeragent.handoff.prepare", { organization_id: ORG, rooftop_id: DOWNTOWN, purpose: "vehicle_inquiry", requested_channels: ["email"], requested_data_categories: ["contact"], subject_binding: subject, idempotency_key: "idem-pii-0123456789abcdef", email: "buyer@example.com" });
  assert.equal(withPii.structuredContent.code, "dealeragent.validation.invalid", "prepare must refuse direct identifiers");

  const prepareArgs = { organization_id: ORG, rooftop_id: DOWNTOWN, vehicle_id: "veh.2026-001", purpose: "vehicle_inquiry", requested_channels: ["email", "sms"], requested_data_categories: ["contact", "message"], subject_binding: subject, idempotency_key: "idem-prepare-1-0123456789abcdef" };
  const prepared = await call("dealeragent.handoff.prepare", prepareArgs);
  assert.equal(prepared.isError, false, JSON.stringify(prepared.structuredContent));
  const binding = prepared.structuredContent;
  assertValid("consent.schema.json#/$defs/consentBinding", binding);
  assert.equal(binding.signature_algorithm, "ES256");
  const again = await call("dealeragent.handoff.prepare", prepareArgs);
  assert.equal(again.structuredContent.binding_id, binding.binding_id, "prepare is idempotent");

  // Independent verification against the published key set.
  const jwksResponse = await worker.fetch(new Request(`${ORIGIN}/.well-known/jwks.json`), env);
  assert.equal(jwksResponse.headers.get("content-type"), "application/jwk-set+json");
  const { keys } = await jwksResponse.json();
  const [header, payload, signature] = binding.binding_token.split(".");
  const decodedHeader = JSON.parse(Buffer.from(header, "base64url").toString());
  const key = keys.find((candidate) => candidate.kid === decodedHeader.kid);
  assert.ok(key, "token kid must be published");
  const publicKey = await crypto.subtle.importKey("jwk", { kty: key.kty, crv: key.crv, x: key.x, y: key.y }, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  const verified = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, Buffer.from(signature, "base64url"), new TextEncoder().encode(`${header}.${payload}`));
  assert.equal(verified, true, "binding verifies with JWKS");
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
  assert.equal(claims.grant.disclosure_digest, binding.grant.disclosure_digest);
  assert.equal(claims.single_use, true);

  const wrongChannel = await call("dealeragent.handoff.submit", { organization_id: ORG, rooftop_id: DOWNTOWN, vehicle_id: "veh.2026-001", binding_id: binding.binding_id, binding_token: binding.binding_token, subject_binding: subject, contact: { name: "Test Buyer", email: "buyer@example.com", preferred_channels: ["voice"] }, idempotency_key: "idem-submit-wrong-0123456789abcdef" });
  assert.equal(wrongChannel.structuredContent.code, "dealeragent.auth.invalid");
  const tampered = await call("dealeragent.handoff.submit", { organization_id: ORG, rooftop_id: DOWNTOWN, vehicle_id: "veh.2026-001", binding_id: binding.binding_id, binding_token: `${binding.binding_token.slice(0, -3)}AAA`, subject_binding: subject, contact: { name: "Test Buyer", email: "buyer@example.com", preferred_channels: ["email"] }, idempotency_key: "idem-submit-tamper-0123456789abcdef" });
  assert.equal(tampered.structuredContent.code, "dealeragent.auth.invalid");

  const submitArgs = { organization_id: ORG, rooftop_id: DOWNTOWN, vehicle_id: "veh.2026-001", binding_id: binding.binding_id, binding_token: binding.binding_token, subject_binding: subject, contact: { name: "Test Buyer", email: "buyer@example.com", preferred_channels: ["email"] }, message: "Is the Northstar still available?", idempotency_key: "idem-submit-1-0123456789abcdef" };
  const submitted = await call("dealeragent.handoff.submit", submitArgs);
  assert.equal(submitted.isError, false, JSON.stringify(submitted.structuredContent));
  assertValid("handoff.schema.json#/$defs/handoffResult", submitted.structuredContent);
  assert.equal(submitted.structuredContent.status, "accepted");
  assert.match(submitted.structuredContent.adf_xml, /<name part="full">Test Buyer<\/name>/);
  assert.match(submitted.structuredContent.external_reference, /^sandbox-not-forwarded:/);
  assert.match(submitted.content[0].text, /not forwarded/i);

  const duplicate = await call("dealeragent.handoff.submit", submitArgs);
  assert.equal(duplicate.structuredContent.status, "duplicate");
  assert.doesNotMatch(duplicate.structuredContent.adf_xml, /Test Buyer/, "duplicate replies never replay contact details");

  const replay = await call("dealeragent.handoff.submit", { ...submitArgs, idempotency_key: "idem-submit-2-0123456789abcdef" });
  assert.equal(replay.structuredContent.code, "dealeragent.auth.invalid", "a consumed binding cannot be reused");
  assert.doesNotMatch(JSON.stringify(replay.structuredContent), /buyer@example\.com|Test Buyer/);
});

test("plain HTTP surface: health, manifest, well-known discovery, policy, llms.txt, redirect", async () => {
  const health = await worker.fetch(new Request(`${ORIGIN}/health`), env);
  assert.equal((await health.json()).vehicles_published, 13);
  const manifest = await worker.fetch(new Request(`${ORIGIN}/manifest.json`), env);
  assertValid("manifest.schema.json#/$defs/manifest", await manifest.json());
  const wellKnown = await worker.fetch(new Request(`${ORIGIN}/.well-known/dealer-agent.json`), env);
  assert.equal(wellKnown.status, 200);
  assertValid("well-known.schema.json", await wellKnown.json());
  const csv = await worker.fetch(new Request(`${ORIGIN}/feeds/inventory.csv`), env);
  assert.equal(csv.headers.get("content-type"), "text/csv; charset=utf-8");
  const csvLines = (await csv.text()).trim().split("\r\n");
  assert.equal(csvLines.length, 14, "header plus 13 vehicles");
  assert.match(csvLines[0], /^organization_id,rooftop_id,vin,stock_number,year,make,model,trim,condition,listing_url,observed_at,advertised_price_minor,currency,required_dealer_charges_json/);
  const policy = await worker.fetch(new Request(`${ORIGIN}/policy`), env);
  assert.match(await policy.text(), /Unknown never means zero/);
  const llms = await worker.fetch(new Request(`${ORIGIN}/llms.txt`), env);
  assert.match(await llms.text(), /demo\.dealeragentprotocol\.com\/mcp/);
  const home = await worker.fetch(new Request(`${ORIGIN}/`, { redirect: "manual" }), env);
  assert.equal(home.status, 302);
  assert.equal(home.headers.get("location"), "https://dealeragentprotocol.com/try/");
  const missing = await worker.fetch(new Request(`${ORIGIN}/nothing`), env);
  assert.equal(missing.status, 404);
});

test("text summaries of data tools label the data as synthetic", async () => {
  const base = { organization_id: ORG, rooftop_id: DOWNTOWN, vehicle_id: "veh.2026-001" };
  const results = [
    await call("dealeragent.inventory.search", { organization_id: ORG }),
    await call("dealeragent.inventory.get_vehicle", base),
    await call("dealeragent.inventory.verify_availability", base),
    await call("dealeragent.pricing.get_disclosure", base),
    await call("dealeragent.inventory.get_used_vehicle_details", { organization_id: ORG, rooftop_id: DOWNTOWN, vehicle_id: "veh.2024-002" }),
  ];
  for (const result of results) {
    assert.equal(result.isError, false);
    assert.match(result.content[0].text, /synthetic/i);
  }
});

async function rpcWithVersion(method, params, version, expectedStatus = 200) {
  const headers = { "content-type": "application/json", accept: "application/json, text/event-stream" };
  if (version) headers["mcp-protocol-version"] = version;
  const body = { jsonrpc: "2.0", id: ++counter, method, params };
  if (version && method !== "initialize") {
    body.params = { ...(params || {}), _meta: { "io.modelcontextprotocol/protocolVersion": version } };
  }
  const response = await worker.fetch(new Request(`${ORIGIN}/mcp`, { method: "POST", headers, body: JSON.stringify(body) }), env);
  assert.equal(response.status, expectedStatus, `${method} @ ${version} returned ${response.status}`);
  return { status: response.status, protocolHeader: response.headers.get("mcp-protocol-version"), message: await response.json() };
}

test("initialize also negotiates 2025-11-25 and 2024-11-05", async () => {
  const current = await rpc("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "0" } });
  assert.equal(current.result.protocolVersion, "2025-11-25");
  const oldest = await rpc("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "0" } });
  assert.equal(oldest.result.protocolVersion, "2024-11-05");
  assert.ok(SUPPORTED_MCP.includes("2026-07-28"));
});

test("2026-07-28 list and call results include resultType and caching hints", async () => {
  const listed = await rpcWithVersion("tools/list", {}, "2026-07-28");
  assert.equal(listed.protocolHeader, "2026-07-28");
  assert.equal(listed.message.result.resultType, "complete");
  assert.equal(listed.message.result.cacheScope, "public");
  assert.equal(listed.message.result.ttlMs, 3_600_000);
  assert.ok(Array.isArray(listed.message.result.tools));
  assert.equal(listed.message.result.tools.length, Object.keys(TOOL_SPECS).length);

  const called = await rpcWithVersion("tools/call", { name: "dealeragent.dealer.get", arguments: { organization_id: ORG } }, "2026-07-28");
  assert.equal(called.message.result.resultType, "complete");
  assert.equal(called.message.result.isError, false);
  assert.equal(called.message.result.ttlMs, undefined);
});

test("legacy 2025-11-25 list results omit modern resultType fields", async () => {
  const listed = await rpcWithVersion("tools/list", {}, "2025-11-25");
  assert.equal(listed.protocolHeader, "2025-11-25");
  assert.equal(listed.message.result.resultType, undefined);
  assert.equal(listed.message.result.ttlMs, undefined);
  assert.ok(listed.message.result.tools.length > 0);
});

test("an unsupported protocol version is rejected with -32022", async () => {
  const listed = await rpcWithVersion("tools/list", {}, "1999-01-01", 400);
  assert.equal(listed.message.error.code, -32022);
  assert.equal(listed.message.error.data.requested, "1999-01-01");
  assert.deepEqual(listed.message.error.data.supported, SUPPORTED_MCP);
});

test("pricing summaries do not garble eligibility text", async () => {
  const result = await call("dealeragent.pricing.get_disclosure", { organization_id: ORG, rooftop_id: DOWNTOWN, vehicle_id: "veh.2024-002" });
  const textSummary = result.content[0].text;
  assert.equal(textSummary.includes("requires Dealer verification of current or qualifying prior service is required"), false);
  assert.match(textSummary, /Military appreciation incentive discount \$500\.00; eligibility: Dealer verification of current or qualifying prior service is required\./);
  assert.match(textSummary, /synthetic/i);
});
