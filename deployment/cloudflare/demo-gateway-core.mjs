// Dealer Agent Protocol public demo gateway.
//
// A stateless Streamable HTTP MCP server for the synthetic dealer "Example
// Motors Group". It implements every v0.1 profile, including the separately
// claimed consented handoff, over clearly labeled synthetic data. Nothing here
// reaches a real dealership. The purpose is to let anyone paste one URL into
// Claude, ChatGPT, Claude Code, Cursor, or MCP Inspector and see what a
// conformant Dealer Agent Gateway answers.
//
// Design rules the worker enforces:
//   - every input is validated against the normative JSON Schemas;
//   - every record carries provenance, freshness, and authority;
//   - stale availability is refused, never upgraded;
//   - unknown government charges are never turned into zero;
//   - handoff accepts contact data only against an ES256-signed, expiring,
//     single-use consent binding, and the gateway publishes its JWKS.

import { Validator } from "@cfworker/json-schema";
import fixture from "./demo-fixture.json" with { type: "json" };
import actionCommon from "../../spec/v0.1/schemas/action-common.schema.json" with { type: "json" };
import common from "../../spec/v0.1/schemas/common.schema.json" with { type: "json" };
import consent from "../../spec/v0.1/schemas/consent.schema.json" with { type: "json" };
import dealer from "../../spec/v0.1/schemas/dealer.schema.json" with { type: "json" };
import errorSchema from "../../spec/v0.1/schemas/error.schema.json" with { type: "json" };
import handoff from "../../spec/v0.1/schemas/handoff.schema.json" with { type: "json" };
import manifestSchema from "../../spec/v0.1/schemas/manifest.schema.json" with { type: "json" };
import pricing from "../../spec/v0.1/schemas/pricing.schema.json" with { type: "json" };
import usedVehicle from "../../spec/v0.1/schemas/used-vehicle.schema.json" with { type: "json" };
import vehicle from "../../spec/v0.1/schemas/vehicle.schema.json" with { type: "json" };
import wellKnown from "../../spec/v0.1/schemas/well-known.schema.json" with { type: "json" };
import { uiHtml, uiResourceUri, uiResourceView, uiResources } from "./demo-ui.mjs";

export const STANDARD_VERSION = "0.1";
export const MCP_REVISION = "2026-07-28";
const SUPPORTED_MCP = ["2026-07-28", "2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const PROTOCOL_VERSION_META = "io.modelcontextprotocol/protocolVersion";
const UNSUPPORTED_PROTOCOL_VERSION = -32022;
const LIST_TTL_MS = 3_600_000;
const CACHEABLE_METHODS = new Set(["server/discover", "tools/list", "prompts/list", "resources/list", "resources/templates/list", "resources/read"]);
export { SUPPORTED_MCP };

function isModernProtocol(version) {
  return version === MCP_REVISION;
}

function requestedProtocolVersion(message, request) {
  const header = request?.headers?.get("mcp-protocol-version");
  const meta = message?.params && typeof message.params === "object" ? message.params._meta?.[PROTOCOL_VERSION_META] : undefined;
  const initializeVersion = message?.method === "initialize" && typeof message.params?.protocolVersion === "string" ? message.params.protocolVersion : undefined;
  const candidate = [header, meta, initializeVersion].find((value) => typeof value === "string" && value.trim());
  return candidate ? candidate.trim() : null;
}

function decorateModernResult(payload, version, method) {
  if (!payload?.result || !isModernProtocol(version)) return payload;
  const result = { resultType: payload.result.resultType || "complete", ...payload.result };
  if (CACHEABLE_METHODS.has(method)) {
    if (result.ttlMs == null) result.ttlMs = LIST_TTL_MS;
    if (!result.cacheScope) result.cacheScope = "public";
  }
  return { ...payload, result };
}

const SERVER_NAME = "dealer-agent-protocol-demo-gateway";
const SERVER_VERSION = "0.2.0";
const ORGANIZATION_ID = "org.example-motors";
const ROOFTOPS = ["roof.downtown", "roof.north"];
const SCHEMA_BASE = "https://dealeragentprotocol.com/spec/v0.1/schemas/";
const DEFAULT_PUBLIC_ORIGIN = "https://demo.dealeragentprotocol.com";
const TRY_URL = "https://dealeragentprotocol.com/try/";
const FIXTURE_CLOCK_MS = Date.parse(fixture.generated_with_clock);
const MAX_BODY_BYTES = 262_144;

const SCHEMA_DOCS = {
  "action-common.schema.json": actionCommon,
  "common.schema.json": common,
  "consent.schema.json": consent,
  "dealer.schema.json": dealer,
  "error.schema.json": errorSchema,
  "handoff.schema.json": handoff,
  "manifest.schema.json": manifestSchema,
  "pricing.schema.json": pricing,
  "used-vehicle.schema.json": usedVehicle,
  "vehicle.schema.json": vehicle,
  "well-known.schema.json": wellKnown,
};

// ---------------------------------------------------------------------------
// Schema helpers

function pointer(document, fragment) {
  const parts = fragment.replace(/^\/?/, "").split("/").filter(Boolean);
  let node = document;
  for (const part of parts) {
    node = node?.[part.replace(/~1/g, "/").replace(/~0/g, "~")];
    if (node === undefined) throw new Error(`Unknown schema pointer ${fragment}`);
  }
  return node;
}

function inlineSchema(node, fileName, depth = 0) {
  if (depth > 64) throw new Error("Schema reference depth exceeded");
  if (Array.isArray(node)) return node.map((item) => inlineSchema(item, fileName, depth + 1));
  if (!node || typeof node !== "object") return node;
  if (typeof node.$ref === "string") {
    const [file, fragment = ""] = node.$ref.split("#");
    const targetFile = file ? file.replace(SCHEMA_BASE, "") : fileName;
    const target = pointer(SCHEMA_DOCS[targetFile], fragment);
    const { $ref, ...rest } = node;
    return { ...inlineSchema(target, targetFile, depth + 1), ...inlineSchema(rest, fileName, depth + 1) };
  }
  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "$id" || key === "$schema" || key === "$defs") continue;
    out[key] = inlineSchema(value, fileName, depth + 1);
  }
  return out;
}

const inlineCache = new Map();
function definition(reference) {
  if (inlineCache.has(reference)) return inlineCache.get(reference);
  const [file, fragment] = reference.split("#");
  const schema = { $schema: "https://json-schema.org/draft/2020-12/schema", ...inlineSchema(pointer(SCHEMA_DOCS[file], fragment), file) };
  inlineCache.set(reference, schema);
  return schema;
}

const validatorCache = new Map();
function validatorFor(reference) {
  if (validatorCache.has(reference)) return validatorCache.get(reference);
  const validator = new Validator({ $ref: `${SCHEMA_BASE}${reference}` }, "2020-12", false);
  for (const doc of Object.values(SCHEMA_DOCS)) validator.addSchema(doc);
  validatorCache.set(reference, validator);
  return validator;
}

export function validate(reference, value) {
  const result = validatorFor(reference).validate(value);
  if (result.valid) return;
  const structural = new Set(["$ref", "properties", "items", "allOf", "anyOf", "oneOf", "if", "then", "else", "false"]);
  const leaf = result.errors.filter((error) => !structural.has(error.keyword));
  const fieldErrors = (leaf.length ? leaf : result.errors).slice(0, 50).map((error) => ({
    instance_location: error.instanceLocation.replace(/^#/, "") || "/",
    keyword: error.keyword,
    explanation: `Value failed validation for keyword '${error.keyword}'.`,
  }));
  throw new GatewayError(
    "dealeragent.validation.invalid",
    "The request did not satisfy its Dealer Agent Protocol schema.",
    { field_errors: fieldErrors },
  );
}

// ---------------------------------------------------------------------------
// Errors

const RETRYABLE = new Set(["dealeragent.vehicle.stale", "dealeragent.state.conflict", "dealeragent.rate_limited", "dealeragent.upstream.unavailable", "dealeragent.internal"]);

export class GatewayError extends Error {
  constructor(code, message, details = undefined, retryAfterMs = undefined) {
    super(message);
    this.code = code;
    this.details = details;
    this.retryAfterMs = retryAfterMs;
  }
  asResult(traceId) {
    const payload = {
      error_id: `err.${crypto.randomUUID().replace(/-/g, "")}`,
      code: this.code,
      message: this.message.slice(0, 500),
      retryable: RETRYABLE.has(this.code),
      trace_id: traceId,
      created_at: ts(new Date()),
    };
    if (this.retryAfterMs !== undefined) payload.retry_after_ms = this.retryAfterMs;
    if (this.details) payload.details = this.details;
    return payload;
  }
}

const notFound = () => new GatewayError("dealeragent.resource.not_found", "The requested resource was not found.");
// Replays, tampering, and foreign bindings all get the same generic answer [DAP-HO-005].
const invalidBinding = () => new GatewayError("dealeragent.auth.invalid", "The consent binding is invalid.");

// ---------------------------------------------------------------------------
// Time, encoding, and crypto helpers

export function ts(date) {
  return new Date(date).toISOString().replace(/\.\d{3}Z$/, "Z");
}
const traceId = () => `trace.${crypto.randomUUID().replace(/-/g, "")}`;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

/** Re-stamp fixture timestamps relative to the request clock, keeping every relationship intact. */
function reclock(value, nowMs) {
  const delta = nowMs - FIXTURE_CLOCK_MS;
  return JSON.parse(JSON.stringify(value), (_key, item) => (typeof item === "string" && TIMESTAMP.test(item) ? ts(Date.parse(item) + delta) : item));
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
function b64url(bytes) {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64url(text) {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function hmac(secret, text) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, encoder.encode(text)));
}

let signingKeyPromise;
async function signingKey(env) {
  if (!signingKeyPromise) {
    signingKeyPromise = (async () => {
      const algorithm = { name: "ECDSA", namedCurve: "P-256" };
      if (env?.HANDOFF_SIGNING_JWK) {
        const jwk = JSON.parse(env.HANDOFF_SIGNING_JWK);
        const publicJwk = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
        return {
          kid: jwk.kid || "demo-handoff-1",
          ephemeral: false,
          privateKey: await crypto.subtle.importKey("jwk", jwk, algorithm, false, ["sign"]),
          publicKey: await crypto.subtle.importKey("jwk", publicJwk, algorithm, true, ["verify"]),
          publicJwk,
        };
      }
      const pair = await crypto.subtle.generateKey(algorithm, true, ["sign", "verify"]);
      const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
      delete publicJwk.key_ops;
      delete publicJwk.ext;
      return { kid: `ephemeral-${crypto.randomUUID().slice(0, 8)}`, ephemeral: true, privateKey: pair.privateKey, publicKey: pair.publicKey, publicJwk };
    })();
  }
  return signingKeyPromise;
}

async function signJws(env, claims) {
  const key = await signingKey(env);
  const header = b64url(encoder.encode(canonical({ alg: "ES256", kid: key.kid, typ: "JWT" })));
  const payload = b64url(encoder.encode(canonical(claims)));
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key.privateKey, encoder.encode(`${header}.${payload}`));
  return `${header}.${payload}.${b64url(signature)}`;
}

async function verifyJws(env, token, expectedClaims) {
  try {
    const [header, payload, signature] = token.split(".");
    if (!header || !payload || !signature) return false;
    const decodedHeader = JSON.parse(decoder.decode(unb64url(header)));
    if (decodedHeader.alg !== "ES256") return false;
    if (canonical(JSON.parse(decoder.decode(unb64url(payload)))) !== canonical(expectedClaims)) return false;
    const key = await signingKey(env);
    return crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key.publicKey, unb64url(signature), encoder.encode(`${header}.${payload}`));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// State (KV when bound, in-memory for local runs)

const MEMORY = new Map();
class Store {
  constructor(kv) {
    this.kv = kv;
  }
  async get(key) {
    if (this.kv) return this.kv.get(key, "json");
    const entry = MEMORY.get(key);
    if (!entry) return null;
    if (entry.expires && entry.expires < Date.now()) {
      MEMORY.delete(key);
      return null;
    }
    return entry.value;
  }
  async put(key, value, ttlSeconds) {
    if (this.kv) return this.kv.put(key, JSON.stringify(value), { expirationTtl: Math.max(60, ttlSeconds) });
    MEMORY.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
  }
}

// ---------------------------------------------------------------------------
// Tool catalog

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

export const TOOL_SPECS = {
  "dealeragent.discovery.get_manifest": {
    title: "Get Dealer Agent Protocol manifest",
    description: "Discover supported profiles, tools, rooftop scope, authority policy, freshness SLAs, and the honest conformance state of this gateway. Call this first.",
    input: "manifest.schema.json#/$defs/manifestRequest",
    output: "manifest.schema.json#/$defs/manifest",
    annotations: READ,
  },
  "dealeragent.dealer.get": {
    title: "Get dealer and rooftops",
    description: "Public dealer identity, rooftops, addresses, hours, departments, and public business contacts for Example Motors Group (synthetic).",
    input: "dealer.schema.json#/$defs/dealerRequest",
    output: "dealer.schema.json#/$defs/dealerOrganization",
    annotations: READ,
  },
  "dealeragent.inventory.search": {
    title: "Search published inventory",
    description: "Search published vehicles with typed filters (condition, type, make, model, year, price in integer minor units, odometer, inventory age, certification), sort, facets, and opaque cursor pagination. Every result carries provenance and freshness. Results are discovery snapshots: verify availability before saying a vehicle is available now.",
    input: "vehicle.schema.json#/$defs/searchRequest",
    output: "vehicle.schema.json#/$defs/searchResponse",
    annotations: READ,
    ui: "vehicles",
  },
  "dealeragent.inventory.get_vehicle": {
    title: "Get one vehicle",
    description: "Exact published record for one vehicle by vehicle_id, VIN, or stock number within one rooftop, with advertised price, availability snapshot, provenance, and freshness.",
    input: "vehicle.schema.json#/$defs/vehicleRequest",
    output: "vehicle.schema.json#/$defs/vehicle",
    annotations: READ,
    ui: "vehicle",
  },
  "dealeragent.inventory.verify_availability": {
    title: "Verify availability",
    description: "Authoritative availability check for one vehicle: authority class, observation time, validity window, and whether human verification is required. Refuses stale evidence instead of guessing. Required before presenting a vehicle as available now.",
    input: "vehicle.schema.json#/$defs/availabilityRequest",
    output: "vehicle.schema.json#/$defs/availabilityResult",
    annotations: READ,
    ui: "availability",
  },
  "dealeragent.pricing.get_disclosure": {
    title: "Get pricing disclosure",
    description: "Classified price disclosure: advertised price, required dealer charges, conditional adjustments with eligibility and stacking rules, and government-charge status (unknown is never zero). Money is integer minor units plus ISO currency.",
    input: "pricing.schema.json#/$defs/disclosureRequest",
    output: "pricing.schema.json#/$defs/pricingDisclosure",
    annotations: READ,
    ui: "pricing",
  },
  "dealeragent.inventory.get_used_vehicle_details": {
    title: "Get used-vehicle evidence",
    description: "Used-vehicle facts with provenance: odometer status, dated inventory tenure (which clock, as of when), provider-specific history report summaries, title, inspection, certification, reconditioning, and unresolved source conflicts.",
    input: "used-vehicle.schema.json#/$defs/usedVehicleRequest",
    output: "used-vehicle.schema.json#/$defs/usedVehicleDetails",
    annotations: READ,
    ui: "used",
  },
  "dealeragent.handoff.get_policy": {
    title: "Get consented handoff policy",
    description: "Accepted handoff purposes, channels, data categories, the exact disclosure text, retention ceiling, response commitment, and whether a delivery destination exists. Call before collecting any personal information.",
    input: "handoff.schema.json#/$defs/policyRequest",
    output: "handoff.schema.json#/$defs/handoffPolicy",
    annotations: READ,
  },
  "dealeragent.handoff.prepare": {
    title: "Prepare a consented handoff",
    description: "Create an ES256-signed, expiring, single-use consent binding for a purpose and channels WITHOUT sending any name, email, phone, or message. Show the buyer the returned disclosure_text; only after they agree call submit.",
    input: "handoff.schema.json#/$defs/prepareRequest",
    output: "consent.schema.json#/$defs/consentBinding",
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    ui: "consent",
  },
  "dealeragent.handoff.submit": {
    title: "Submit a consented handoff",
    description: "Submit contact details against a valid consent binding. The gateway verifies signature, expiry, single use, subject, tenant, vehicle, purpose, and channels before building ADF/XML. SANDBOX: the ADF is returned to you and recorded, never forwarded to a dealership.",
    input: "handoff.schema.json#/$defs/handoffRequest",
    output: "handoff.schema.json#/$defs/handoffResult",
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
};

export function toolDefinitions() {
  return Object.entries(TOOL_SPECS).map(([name, spec]) => {
    const tool = {
      name,
      title: spec.title,
      description: spec.description,
      inputSchema: definition(spec.input),
      outputSchema: definition(spec.output),
      annotations: spec.annotations,
    };
    if (spec.ui) {
      tool._meta = { ui: { resourceUri: uiResourceUri(spec.ui) }, "openai/outputTemplate": uiResourceUri(spec.ui) };
    }
    return tool;
  });
}

const PROFILES = [
  { profile: "dealeragent.discovery/0.1", tools: ["dealeragent.discovery.get_manifest", "dealeragent.dealer.get"], scopes: [] },
  { profile: "dealeragent.inventory.read/0.1", tools: ["dealeragent.inventory.search", "dealeragent.inventory.get_vehicle"], scopes: ["dealeragent:inventory:read"] },
  { profile: "dealeragent.inventory.availability/0.1", tools: ["dealeragent.inventory.verify_availability"], scopes: ["dealeragent:inventory:read"] },
  { profile: "dealeragent.pricing.disclosure/0.1", tools: ["dealeragent.pricing.get_disclosure"], scopes: ["dealeragent:pricing:read"] },
  { profile: "dealeragent.used-vehicle.read/0.1", tools: ["dealeragent.inventory.get_used_vehicle_details"], scopes: ["dealeragent:inventory:read"] },
  { profile: "dealeragent.handoff/0.1", tools: ["dealeragent.handoff.get_policy", "dealeragent.handoff.prepare", "dealeragent.handoff.submit"], scopes: ["dealeragent:handoff:submit"] },
];

const INSTRUCTIONS = `Dealer Agent Protocol demo gateway for Example Motors Group, a SYNTHETIC dealer. Every vehicle, price, VIN, and person is fictional, and nothing you do here reaches a dealership. Say so when it matters.

How to work:
- Call dealeragent.discovery.get_manifest first. organization_id is "${ORGANIZATION_ID}"; rooftops are "${ROOFTOPS[0]}" (Example Motors Downtown, Miami FL) and "${ROOFTOPS[1]}" (Example Motors North, Fort Lauderdale FL).
- Money is integer minor units plus ISO currency (4287500 USD = $42,875.00). Never invent a price or a payment.
- Search results are discovery snapshots. Before telling anyone a car is available now, call dealeragent.inventory.verify_availability and repeat the authority class and observation time. If it returns dealeragent.vehicle.stale, say availability could not be verified.
- Prices: call dealeragent.pricing.get_disclosure and present the advertised price, required dealer charges, each conditional adjustment with its eligibility conditions, and the government-charge status. "unknown" never means zero.
- Used vehicles: call dealeragent.inventory.get_used_vehicle_details. Report inventory age with its basis and as-of date, keep history providers separate, and surface unresolved conflicts. "No events reported" is not "accident-free".
- Contacting the dealer: dealeragent.handoff.get_policy, then dealeragent.handoff.prepare with NO personal data, show the exact disclosure_text, and only after the buyer agrees call dealeragent.handoff.submit with the binding. The ADF/XML comes back to you and is NOT sent anywhere.
- Hosts that support MCP Apps render results as cards; keep your prose short and do not repeat card contents.`;

// ---------------------------------------------------------------------------
// Domain logic

const PUBLISHED = new Set(fixture.vehicles.map((item) => item.vehicle_id));

function requireTenant(args) {
  if (args.organization_id !== ORGANIZATION_ID) throw notFound();
  if (args.rooftop_id !== undefined && !ROOFTOPS.includes(args.rooftop_id)) throw notFound();
}

function findVehicle(args) {
  requireTenant(args);
  const selector = ["vehicle_id", "vin", "stock_number"].find((key) => key in args);
  if (!selector) throw new GatewayError("dealeragent.validation.invalid", "One of vehicle_id, vin, or stock_number is required.");
  const match = fixture.vehicles.find((item) => item.rooftop_id === args.rooftop_id && item[selector] === args[selector] && PUBLISHED.has(item.vehicle_id));
  if (!match) throw notFound();
  return match;
}

function searchText(item) {
  return ["year", "make", "model", "trim", "condition", "stock_number", "vin", "body_style", "vehicle_type", "exterior_color"].map((field) => String(item[field] ?? "")).join(" ").toLowerCase();
}

const distanceMicrometers = (distance) => distance.value * (distance.unit === "mi" ? 1_609_344 : 1_000_000);

function filterVehicles(list, filters) {
  let result = list;
  for (const field of ["vehicle_type", "make", "model", "condition"]) {
    if (filters[field]) {
      const allowed = new Set(filters[field].map((value) => String(value).toLowerCase()));
      result = result.filter((item) => allowed.has(String(item[field]).toLowerCase()));
    }
  }
  if (filters.availability) {
    const allowed = new Set(filters.availability);
    result = result.filter((item) => allowed.has(item.availability.status));
  }
  if (filters.year_min !== undefined) result = result.filter((item) => item.year >= filters.year_min);
  if (filters.year_max !== undefined) result = result.filter((item) => item.year <= filters.year_max);
  if (filters.odometer_min) result = result.filter((item) => item.odometer && distanceMicrometers(item.odometer) >= distanceMicrometers(filters.odometer_min));
  if (filters.odometer_max) result = result.filter((item) => item.odometer && distanceMicrometers(item.odometer) <= distanceMicrometers(filters.odometer_max));
  const age = (item) => item.used_vehicle?.inventory_tenure?.age_days;
  if (filters.inventory_age_min_days !== undefined) result = result.filter((item) => age(item) !== undefined && age(item) >= filters.inventory_age_min_days);
  if (filters.inventory_age_max_days !== undefined) result = result.filter((item) => age(item) !== undefined && age(item) <= filters.inventory_age_max_days);
  for (const field of ["history_report_status", "certification_type"]) {
    if (filters[field]) {
      const allowed = new Set(filters[field]);
      result = result.filter((item) => allowed.has(item.used_vehicle?.[field]));
    }
  }
  for (const [field, compare] of [["price_min", (a, b) => a >= b], ["price_max", (a, b) => a <= b]]) {
    if (filters[field]) {
      if (filters[field].currency !== "USD") throw new GatewayError("dealeragent.validation.invalid", "Price filter currency does not match inventory currency.");
      result = result.filter((item) => compare(item.advertised_price.amount.amount_minor, filters[field].amount_minor));
    }
  }
  for (const field of ["vin", "stock_number"]) {
    if (filters[field]) result = result.filter((item) => item[field] === filters[field]);
  }
  return result;
}

function sortVehicles(list, sort) {
  if (!sort) return [...list].sort((a, b) => a.vehicle_id.localeCompare(b.vehicle_id));
  const reverse = sort.order === "desc";
  const missing = reverse ? -1 : Number.POSITIVE_INFINITY;
  const key = {
    advertised_price: (item) => item.advertised_price.amount.amount_minor,
    odometer: (item) => item.odometer?.value ?? 0,
    observed_at: (item) => item.freshness.observed_at,
    inventory_age_days: (item) => item.used_vehicle?.inventory_tenure?.age_days ?? missing,
    year: (item) => item.year,
  }[sort.field];
  return [...list].sort((a, b) => {
    const left = key(a);
    const right = key(b);
    const order = left < right ? -1 : left > right ? 1 : 0;
    return reverse ? -order : order;
  });
}

function facets(list) {
  const counts = { make: new Map(), model: new Map(), condition: new Map(), year: new Map() };
  for (const item of list) for (const field of Object.keys(counts)) counts[field].set(item[field], (counts[field].get(item[field]) ?? 0) + 1);
  return Object.fromEntries(Object.entries(counts).map(([field, map]) => [field, [...map.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]))).map(([value, count]) => ({ value, count }))]));
}

function aggregateFreshness(list, now) {
  if (!list.length) return { observed_at: ts(now), valid_until: ts(now + 15 * 60_000), state: "current", max_age_seconds: 900 };
  const state = list.some((item) => item.freshness.state === "stale") ? "stale" : "current";
  const observed = list.map((item) => item.freshness.observed_at).sort()[0];
  const valid = list.map((item) => item.freshness.valid_until).sort()[0];
  return { observed_at: observed, valid_until: valid, state, max_age_seconds: 900 };
}

async function queryHash(args) {
  const normalized = JSON.parse(JSON.stringify(args));
  if (normalized.page) delete normalized.page.cursor;
  return sha256Hex(canonical(normalized));
}

async function encodeCursor(env, offset, hash) {
  const payload = canonical({ offset, query: hash });
  return `${b64url(encoder.encode(payload))}.${await hmac(cursorSecret(env), payload)}`;
}

async function decodeCursor(env, cursor, hash) {
  try {
    const [payloadPart, signature] = cursor.split(".");
    const payload = decoder.decode(unb64url(payloadPart));
    if ((await hmac(cursorSecret(env), payload)) !== signature) throw new Error("signature");
    const decoded = JSON.parse(payload);
    if (decoded.query !== hash || !Number.isInteger(decoded.offset) || decoded.offset < 0) throw new Error("scope");
    return decoded.offset;
  } catch {
    throw new GatewayError("dealeragent.validation.invalid", "The pagination cursor is invalid for this query.");
  }
}

const cursorSecret = (env) => env?.CURSOR_SECRET || "synthetic-demo-cursor-secret";

function manifest(origin, now, key) {
  return {
    standard: "dealer-agent-protocol",
    standard_version: STANDARD_VERSION,
    mcp_revision: MCP_REVISION,
    gateway_id: "gateway.dealeragentprotocol.demo",
    operator: { name: "Dealer Agent Protocol project (synthetic demo)", uri: "https://dealeragentprotocol.com/" },
    organization_ids: [ORGANIZATION_ID],
    rooftop_ids: ROOFTOPS,
    capabilities: PROFILES.map((profile) => ({ ...profile, status: "experimental" })),
    resources: ["dealeragent://manifest", `dealeragent://organization/${ORGANIZATION_ID}`],
    auth_modes: ["public"],
    tenant_routing: { organization_id_required: true, rooftop_id_required_for_unit_reads: true, group_delegation_explicit: true },
    schema_base_uri: SCHEMA_BASE,
    policy_uri: `${origin}/policy`,
    authority_policy: { uri: `${origin}/policy#authority`, inventory_max_age_seconds: 900, authoritative_availability_required_for_actions: true },
    freshness_sla_seconds: Object.fromEntries(ROOFTOPS.map((rooftop) => [rooftop, { inventory: 900, availability: 120, pricing: 3600 }])),
    conformance: { claim_uri: "https://dealeragentprotocol.com/conformance/claims/example-claim.json", claim_digest: fixture.example_claim_digest },
    jwks_uri: `${origin}/.well-known/jwks.json`,
    issued_at: ts(now),
    expires_at: ts(now + 60 * 60_000),
    extensions: {
      "com.dealeragentprotocol.demo": {
        synthetic_data: true,
        vehicles_published: fixture.vehicles.length,
        handoff_delivery: "sandbox_recorded_not_forwarded",
        signing_key: key.ephemeral ? "ephemeral_per_instance" : "configured",
        try_url: TRY_URL,
      },
    },
  };
}

function handoffPolicy(args, now) {
  requireTenant(args);
  const observed = now - 60_000;
  return {
    organization_id: ORGANIZATION_ID,
    rooftop_id: args.rooftop_id,
    accepted_purposes: ["vehicle_inquiry", "quote_follow_up", "appointment", "trade_discussion"],
    accepted_channels: ["email", "sms", "voice"],
    required_data_categories: ["contact"],
    optional_data_categories: ["vehicle_interest", "message", "appointment_preferences", "trade_summary"],
    disclosure_text: "By continuing, you ask Example Motors to contact you about this vehicle using the channels you select. Your contact details will be sent to the dealership and retained under its published privacy policy for no more than 30 days unless you become a customer. This is a synthetic demonstration gateway: no dealership exists and nothing is delivered.",
    disclosure_version: "demo-handoff-2026-10-25",
    retention_ceiling_days: 30,
    response_commitment_seconds: 900,
    adf_destination_present: true,
    provenance: { sources: [{ source_name: "demo-handoff-policy", authority: "dealer_asserted", observed_at: ts(observed) }], authority_status: "asserted", transformed_at: ts(now) },
    freshness: { observed_at: ts(observed), valid_until: ts(now + 3_600_000), state: "current", max_age_seconds: 3600 },
  };
}

function escapeXml(value) {
  return String(value).replace(/[<>&'"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[char]);
}

function buildAdf(handoffId, args, now) {
  const contact = args.contact;
  const email = contact.email ? `<email>${escapeXml(contact.email)}</email>` : "";
  const phone = contact.phone ? `<phone>${escapeXml(contact.phone)}</phone>` : "";
  const vehicleXml = args.vehicle_id ? `<vehicle><id source="dealeragent">${escapeXml(args.vehicle_id)}</id></vehicle>` : "";
  const comments = args.message ? `<comments>${escapeXml(args.message)}</comments>` : "";
  return `<?xml version="1.0" encoding="UTF-8"?><adf><prospect status="sandbox"><id source="dealeragent">${escapeXml(handoffId)}</id><requestdate>${ts(now)}</requestdate>${vehicleXml}<customer><contact><name part="full">${escapeXml(contact.name)}</name>${email}${phone}</contact>${comments}</customer><vendor><id source="dealeragent">${escapeXml(args.rooftop_id)}</id><vendorname>Example Motors (synthetic)</vendorname></vendor><provider><name part="full">Dealer Agent Protocol demo gateway</name><service>consented agent handoff (sandbox, not forwarded)</service></provider></prospect></adf>`;
}

async function callTool(name, args, context) {
  const { env, store, origin, now } = context;
  const spec = TOOL_SPECS[name];
  if (!spec) throw new GatewayError("dealeragent.capability.unsupported", "The requested tool is not declared by this gateway.");
  validate(spec.input, args);

  switch (name) {
    case "dealeragent.discovery.get_manifest": {
      if (args.organization_id !== undefined && args.organization_id !== ORGANIZATION_ID) throw notFound();
      return manifest(origin, now, await signingKey(env));
    }
    case "dealeragent.dealer.get": {
      if (args.organization_id !== undefined) requireTenant(args);
      const organization = reclock(fixture.dealer, now);
      if (args.rooftop_ids) {
        if (!args.rooftop_ids.every((rooftop) => ROOFTOPS.includes(rooftop))) throw notFound();
        organization.rooftops = organization.rooftops.filter((rooftop) => args.rooftop_ids.includes(rooftop.rooftop_id));
      }
      return organization;
    }
    case "dealeragent.inventory.search": {
      if (args.organization_id !== ORGANIZATION_ID) throw notFound();
      const rooftops = new Set(args.rooftop_ids ?? ROOFTOPS);
      if (![...rooftops].every((rooftop) => ROOFTOPS.includes(rooftop))) throw notFound();
      let list = reclock(fixture.vehicles, now).filter((item) => rooftops.has(item.rooftop_id));
      const tokens = (args.query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
      if (tokens.length) list = list.filter((item) => tokens.every((token) => searchText(item).includes(token)));
      list = sortVehicles(filterVehicles(list, args.filters ?? {}), args.sort);
      const limit = args.page?.limit ?? 50;
      const hash = await queryHash(args);
      const offset = args.page?.cursor ? await decodeCursor(env, args.page.cursor, hash) : 0;
      const selected = list.slice(offset, offset + limit);
      const nextOffset = offset + selected.length;
      const page = { has_more: nextOffset < list.length };
      if (page.has_more) page.next_cursor = await encodeCursor(env, nextOffset, hash);
      return {
        vehicles: selected,
        facets: facets(list),
        page,
        provenance: { sources: [{ source_name: "demo-inventory-index", authority: "derived", observed_at: ts(now - 120_000) }], authority_status: "derived", transformed_at: ts(now), transformations: ["filtered published synthetic inventory"] },
        freshness: aggregateFreshness(list, now),
        trace_id: traceId(),
      };
    }
    case "dealeragent.inventory.get_vehicle":
      return reclock(findVehicle(args), now);
    case "dealeragent.inventory.get_used_vehicle_details": {
      const match = findVehicle(args);
      const details = fixture.used_vehicle_details[match.vehicle_id];
      if (!details) throw notFound();
      return { ...reclock(details, now), trace_id: traceId() };
    }
    case "dealeragent.inventory.verify_availability": {
      const match = reclock(findVehicle(args), now);
      if (match.freshness.state !== "current" || match.availability.authority_status !== "authoritative") {
        throw new GatewayError("dealeragent.vehicle.stale", "Authoritative availability is stale; refresh the retail source before presenting it as current.", { current_freshness: match.freshness }, 1000);
      }
      return { vehicle_id: match.vehicle_id, organization_id: match.organization_id, rooftop_id: match.rooftop_id, availability: match.availability, provenance: match.provenance, freshness: match.freshness, trace_id: traceId() };
    }
    case "dealeragent.pricing.get_disclosure": {
      const match = findVehicle(args);
      return reclock(fixture.pricing[match.vehicle_id], now);
    }
    case "dealeragent.handoff.get_policy":
      return handoffPolicy(args, now);
    case "dealeragent.handoff.prepare": {
      const policy = handoffPolicy(args, now);
      if (!policy.accepted_purposes.includes(args.purpose)) throw new GatewayError("dealeragent.validation.invalid", "The requested handoff purpose is not accepted.");
      if (!args.requested_channels.every((channel) => policy.accepted_channels.includes(channel))) throw new GatewayError("dealeragent.validation.invalid", "One or more requested handoff channels are not accepted.");
      const accepted = new Set([...policy.required_data_categories, ...policy.optional_data_categories]);
      if (!args.requested_data_categories.every((category) => accepted.has(category))) throw new GatewayError("dealeragent.validation.invalid", "One or more requested data categories are not accepted.");
      if (args.vehicle_id) findVehicle({ organization_id: args.organization_id, rooftop_id: args.rooftop_id, vehicle_id: args.vehicle_id });

      const existing = await store.get(`prepare:${args.idempotency_key}`);
      if (existing) {
        const record = await store.get(`binding:${existing}`);
        if (record) return record.public;
      }
      const bindingId = `binding.${crypto.randomUUID().replace(/-/g, "")}`;
      const expiresMs = now + 10 * 60_000;
      const grant = {
        purpose: args.purpose,
        channels: args.requested_channels,
        data_categories: args.requested_data_categories,
        disclosure_version: policy.disclosure_version,
        disclosure_digest: `sha256:${await sha256Hex(policy.disclosure_text)}`,
        granted_at: ts(now),
        expires_at: ts(expiresMs),
      };
      const claims = {
        binding_id: bindingId,
        organization_id: args.organization_id,
        rooftop_id: args.rooftop_id,
        vehicle_id: args.vehicle_id ?? null,
        subject_binding: args.subject_binding,
        grant,
        single_use: true,
        exp: Math.floor(expiresMs / 1000),
        nonce: b64url(crypto.getRandomValues(new Uint8Array(16))),
        iss: origin,
        aud: origin,
      };
      const token = await signJws(env, claims);
      const binding = {
        binding_id: bindingId,
        organization_id: args.organization_id,
        rooftop_id: args.rooftop_id,
        ...(args.vehicle_id ? { vehicle_id: args.vehicle_id } : {}),
        grant,
        status: "prepared",
        disclosure_text: policy.disclosure_text,
        subject_binding: args.subject_binding,
        single_use: true,
        expires_at: ts(expiresMs),
        binding_token: token,
        issuer: origin,
        signature: token,
        signature_algorithm: "ES256",
        provenance: { sources: [{ source_name: "demo-consent-service", authority: "authoritative_dealer_system", observed_at: ts(now) }], authority_status: "authoritative", transformed_at: ts(now) },
        freshness: { observed_at: ts(now), valid_until: ts(expiresMs), state: "current", max_age_seconds: 600 },
      };
      await store.put(`binding:${bindingId}`, { public: binding, claims, consumed: false, idempotency_key: args.idempotency_key }, 900);
      await store.put(`prepare:${args.idempotency_key}`, bindingId, 900);
      return binding;
    }
    case "dealeragent.handoff.submit": {
      requireTenant(args);
      const duplicate = await store.get(`submit:${args.idempotency_key}`);
      if (duplicate) return { ...duplicate, status: "duplicate" };
      const record = await store.get(`binding:${args.binding_id}`);
      if (!record || record.consumed || args.binding_token !== record.public.binding_token) throw invalidBinding();
      if (!(await verifyJws(env, args.binding_token, record.claims))) throw invalidBinding();
      const { claims } = record;
      if (claims.exp * 1000 <= now) throw invalidBinding();
      if (claims.organization_id !== args.organization_id || claims.rooftop_id !== args.rooftop_id) throw invalidBinding();
      if (claims.subject_binding !== args.subject_binding) throw invalidBinding();
      if (claims.vehicle_id && args.vehicle_id !== claims.vehicle_id) throw invalidBinding();
      if (!args.contact.preferred_channels.every((channel) => claims.grant.channels.includes(channel))) throw invalidBinding();
      if (args.message && !claims.grant.data_categories.includes("message")) throw invalidBinding();

      record.consumed = true;
      await store.put(`binding:${args.binding_id}`, record, 900);
      const handoffId = `handoff.${crypto.randomUUID().replace(/-/g, "")}`;
      const result = {
        handoff_id: handoffId,
        organization_id: args.organization_id,
        rooftop_id: args.rooftop_id,
        status: "accepted",
        binding_status: "consumed",
        department: "internet_sales",
        external_reference: `sandbox-not-forwarded:${handoffId}`,
        adf_xml: buildAdf(handoffId, args, now),
        provenance: { sources: [{ source_name: "demo-adf-emitter", authority: "authoritative_dealer_system", observed_at: ts(now) }], authority_status: "authoritative", transformed_at: ts(now), transformations: ["sandbox: ADF generated and returned, not delivered"] },
        freshness: { observed_at: ts(now), valid_until: ts(now + 15 * 60_000), state: "current", max_age_seconds: 900 },
        trace_id: traceId(),
      };
      // Idempotency record keeps the result shape but never the contact details.
      await store.put(`submit:${args.idempotency_key}`, { ...result, adf_xml: "<!-- duplicate submission: ADF withheld -->" }, 900);
      return result;
    }
    default:
      throw new GatewayError("dealeragent.capability.unsupported", "The requested tool is not declared by this gateway.");
  }
}

// ---------------------------------------------------------------------------
// Human-readable summaries for hosts without MCP Apps

const money = (value) => (value && typeof value.amount_minor === "number" ? (value.amount_minor / 100).toLocaleString("en-US", { style: "currency", currency: value.currency || "USD" }) : "unknown");
const title = (item) => [item.year, item.make, item.model, item.trim].filter(Boolean).join(" ");

function summarize(name, value) {
  switch (name) {
    case "dealeragent.discovery.get_manifest":
      return `Dealer Agent Protocol ${value.standard_version} manifest for ${value.organization_ids.join(", ")} (rooftops: ${value.rooftop_ids.join(", ")}). Profiles: ${value.capabilities.map((item) => item.profile).join(", ")}. Synthetic demo data; no certification is claimed.`;
    case "dealeragent.dealer.get":
      return `${value.name}: ${value.rooftops.map((rooftop) => `${rooftop.name} (${rooftop.rooftop_id}) in ${rooftop.address.locality}, ${rooftop.address.region}`).join("; ")}. Synthetic dealer.`;
    case "dealeragent.inventory.search": {
      const lines = value.vehicles.map((item) => `- ${title(item)} [${item.condition}, ${item.rooftop_id}, ${item.vehicle_id}]: ${money(item.advertised_price.amount)} advertised${item.advertised_price.includes_required_dealer_charges ? " incl. required dealer charges" : ""}; availability ${item.availability.status} (${item.availability.authority_status}, observed ${item.availability.observed_at}); freshness ${item.freshness.state}.`);
      return `${value.vehicles.length} vehicle(s)${value.page.has_more ? ", more available via next_cursor" : ""}. Discovery snapshot (${value.provenance.authority_status}); verify availability before saying "available now". Synthetic demo data.\n${lines.join("\n")}`;
    }
    case "dealeragent.inventory.get_vehicle":
      return `${title(value)} (${value.condition}, stock ${value.stock_number}, VIN ${value.vin}) at ${value.rooftop_id}: ${money(value.advertised_price.amount)} advertised; availability ${value.availability.status} (${value.availability.authority_status}); source ${value.provenance.sources[0].source_name}; freshness ${value.freshness.state} observed ${value.freshness.observed_at}. Synthetic demo data.`;
    case "dealeragent.inventory.verify_availability":
      return `Availability for ${value.vehicle_id}: ${value.availability.status}, authority ${value.availability.authority_status}, observed ${value.availability.observed_at}, valid until ${value.availability.valid_until}, human verification ${value.availability.human_verification_required ? "required" : "not required"}. Source: ${value.provenance.sources[0].source_name} (synthetic demo; no real dealership system is queried).`;
    case "dealeragent.pricing.get_disclosure": {
      const charges = value.required_dealer_charges.map((item) => `${item.name} ${money(item.amount)} (${item.included_in_advertised_price ? "included in" : "added to"} advertised price)`).join("; ") || "none";
      const adjustments = value.conditional_adjustments.map((item) => {
        const amount = item.amount_status === "known" ? money(item.amount) : item.amount_status;
        const eligibility = (item.criteria || []).map((criterion) => criterion.description || criterion.criterion).filter(Boolean).join("; ");
        return eligibility ? `${item.name} ${item.direction} ${amount}; eligibility: ${eligibility}` : `${item.name} ${item.direction} ${amount}`;
      }).join("; ") || "none";
      return `Advertised price ${money(value.advertised_price.amount)} (${value.advertised_price.availability.replace(/_/g, " ")}). Required dealer charges: ${charges}. Conditional adjustments: ${adjustments.replace(/\.$/, "")}. Government charges: ${value.government_charges.status}${value.government_charges.assumptions ? ` (${value.government_charges.assumptions.join(" ")})` : ""}. Unknown never means zero. ${value.disclosure_text} Synthetic demo data.`;
    }
    case "dealeragent.inventory.get_used_vehicle_details": {
      const reports = value.history_reports.map((report) => `${report.provider_name}: ${report.summary?.accident_status?.replace(/_/g, " ") ?? report.status}`).join("; ");
      const conflicts = value.discrepancies?.length ? ` Unresolved conflicts: ${value.discrepancies.map((item) => item.description).join(" ")}` : "";
      return `Odometer ${value.odometer.reading.value.toLocaleString()} ${value.odometer.reading.unit} (${value.odometer.status}). In stock ${value.inventory_tenure.age_days} days (basis ${value.inventory_tenure.age_basis}, as of ${value.inventory_tenure.age_as_of}). Title ${value.title.status}. Certification ${value.certification.type.replace(/_/g, " ")}. History: ${reports}.${conflicts} "No events reported" is not "accident-free". Synthetic demo data.`;
    }
    case "dealeragent.handoff.get_policy":
      return `Handoff accepted for purposes ${value.accepted_purposes.join(", ")} over ${value.accepted_channels.join(", ")}. Disclosure (version ${value.disclosure_version}): "${value.disclosure_text}" Prepare a binding before collecting any contact details.`;
    case "dealeragent.handoff.prepare":
      return `Consent binding ${value.binding_id} prepared (${value.signature_algorithm}, expires ${value.expires_at}, single use). Show the buyer this exact text and get agreement before submitting: "${value.disclosure_text}"`;
    case "dealeragent.handoff.submit":
      return `Handoff ${value.handoff_id} ${value.status}; binding ${value.binding_status}. SANDBOX: the ADF/XML was generated and returned but not forwarded to any dealership.`;
    default:
      return JSON.stringify(value);
  }
}

// ---------------------------------------------------------------------------
// MCP over Streamable HTTP

const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" };
const CORS_HEADERS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, authorization, accept, mcp-protocol-version, mcp-session-id", "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS", "Access-Control-Expose-Headers": "mcp-protocol-version" };

const rpcResult = (id, result) => ({ jsonrpc: "2.0", id, result });
const rpcError = (id, code, message, data) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message, ...(data ? { data } : {}) } });

function resourceList() {
  return [
    { uri: "dealeragent://manifest", name: "Dealer Agent Protocol manifest", description: "Gateway manifest: profiles, tools, rooftops, policies, freshness SLAs, conformance state.", mimeType: "application/json" },
    { uri: `dealeragent://organization/${ORGANIZATION_ID}`, name: "Example Motors Group (synthetic)", description: "Public dealer and rooftop identity.", mimeType: "application/json" },
    ...uiResources(),
  ];
}

async function readResource(uri, context) {
  if (uri === "dealeragent://manifest") return { uri, mimeType: "application/json", text: JSON.stringify(manifest(context.origin, context.now, await signingKey(context.env))) };
  if (uri === `dealeragent://organization/${ORGANIZATION_ID}`) return { uri, mimeType: "application/json", text: JSON.stringify(reclock(fixture.dealer, context.now)) };
  const view = uiResourceView(uri);
  if (view) return { uri, mimeType: "text/html;profile=mcp-app", text: uiHtml(view), _meta: { ui: { prefersBorder: true } } };
  return null;
}

async function handleMessage(message, context) {
  if (!message || typeof message !== "object" || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return rpcError(message?.id, -32600, "Invalid Request");
  }
  const { id, method, params = {} } = message;
  const isNotification = id === undefined;
  if (method.startsWith("notifications/")) return null;

  try {
    switch (method) {
      case "initialize": {
        const requested = typeof params.protocolVersion === "string" ? params.protocolVersion : MCP_REVISION;
        const protocolVersion = SUPPORTED_MCP.includes(requested) ? requested : MCP_REVISION;
        return rpcResult(id, {
          protocolVersion,
          capabilities: { tools: { listChanged: false }, resources: { listChanged: false, subscribe: false }, prompts: { listChanged: false } },
          serverInfo: { name: SERVER_NAME, title: "Example Motors Group · Dealer Agent Protocol demo gateway", version: SERVER_VERSION, websiteUrl: TRY_URL },
          instructions: INSTRUCTIONS,
        });
      }
      case "server/discover":
        return rpcResult(id, {
          resultType: "complete",
          supportedVersions: SUPPORTED_MCP,
          capabilities: { tools: {}, resources: {}, prompts: {} },
          serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
          instructions: INSTRUCTIONS,
          ttlMs: 3_600_000,
          cacheScope: "public",
        });
      case "ping":
        return rpcResult(id, {});
      case "logging/setLevel":
        return rpcResult(id, {});
      case "tools/list":
        return rpcResult(id, { tools: toolDefinitions() });
      case "tools/call": {
        if (typeof params.name !== "string") return rpcError(id, -32602, "Tool name is required.");
        const args = params.arguments ?? {};
        if (!args || typeof args !== "object" || Array.isArray(args)) return rpcError(id, -32602, "Tool arguments must be an object.");
        try {
          const value = await callTool(params.name, args, context);
          return rpcResult(id, { content: [{ type: "text", text: summarize(params.name, value) }], structuredContent: value, isError: false });
        } catch (error) {
          if (error instanceof GatewayError) {
            const payload = error.asResult(traceId());
            return rpcResult(id, { content: [{ type: "text", text: `${payload.code}: ${payload.message}` }], structuredContent: payload, isError: true });
          }
          throw error;
        }
      }
      case "resources/list":
        return rpcResult(id, { resources: resourceList() });
      case "resources/templates/list":
        return rpcResult(id, { resourceTemplates: [] });
      case "resources/read": {
        if (typeof params.uri !== "string") return rpcError(id, -32602, "Resource uri is required.");
        const contents = await readResource(params.uri, context);
        if (!contents) return rpcError(id, -32002, "Resource not found", { uri: params.uri });
        return rpcResult(id, { contents: [contents] });
      }
      case "prompts/list":
        return rpcResult(id, { prompts: [{ name: "shopping_guide", title: "Honest dealer shopping guide", description: "How to use this gateway without inventing availability, prices, or eligibility." }] });
      case "prompts/get":
        if (params.name !== "shopping_guide") return rpcError(id, -32602, "Unknown prompt");
        return rpcResult(id, { description: "Honest dealer shopping guide", messages: [{ role: "user", content: { type: "text", text: INSTRUCTIONS } }] });
      default:
        return rpcError(id, -32601, "Method not found");
    }
  } catch (error) {
    console.error(JSON.stringify({ event: "mcp_internal_error", method, message: error?.message }));
    return isNotification ? null : rpcError(id, -32603, "Internal server error");
  }
}

function text(body, status = 200, headers = {}) {
  return new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300", ...CORS_HEADERS, ...headers } });
}
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } });

function csvCell(value) {
  const textValue = value === undefined || value === null ? "" : String(value);
  return /[",\n\r]/.test(textValue) ? `"${textValue.replace(/"/g, '""')}"` : textValue;
}

/** dealer-agent-inventory-csv/0.1 export of the same synthetic fleet; always authority "asserted". */
function csvFeed(now) {
  const columns = ["organization_id", "rooftop_id", "vin", "stock_number", "year", "make", "model", "trim", "condition", "listing_url", "observed_at", "advertised_price_minor", "currency", "required_dealer_charges_json", "conditional_adjustments_json", "government_charges_status", "availability_status", "odometer_value", "odometer_unit", "stocked_at", "first_public_listing_at", "history_reports_json", "certification_type"];
  const rows = reclock(fixture.vehicles, now).map((item) => {
    const disclosure = reclock(fixture.pricing[item.vehicle_id], now);
    const tenure = item.used_vehicle?.inventory_tenure;
    const history = fixture.used_vehicle_details[item.vehicle_id]?.history_reports?.map((report) => ({ provider_id: report.provider_id, provider_name: report.provider_name, status: report.status, access: report.access, ...(report.report_url ? { report_url: report.report_url } : {}), summary_sharing_authorized: report.summary_sharing_authorized }));
    const condition = item.condition === "demo" ? "new" : item.condition;
    return {
      organization_id: item.organization_id,
      rooftop_id: item.rooftop_id,
      vin: item.vin,
      stock_number: item.stock_number,
      year: item.year,
      make: item.make,
      model: item.model,
      trim: item.trim,
      condition,
      listing_url: item.listing_url,
      observed_at: item.freshness.observed_at,
      advertised_price_minor: item.advertised_price.amount.amount_minor,
      currency: item.advertised_price.amount.currency,
      required_dealer_charges_json: JSON.stringify(disclosure.required_dealer_charges.map((charge) => ({ label: charge.name, amount_minor: charge.amount.amount_minor, payee: charge.payee, required: charge.required, included_in_advertised_price: charge.included_in_advertised_price }))),
      conditional_adjustments_json: JSON.stringify(disclosure.conditional_adjustments.map((adjustment) => ({ name: adjustment.name, direction: adjustment.direction, ...(adjustment.amount ? { amount_minor: adjustment.amount.amount_minor } : {}), eligibility: adjustment.criteria.map((criterion) => criterion.description || criterion.criterion).join("; "), stacking: adjustment.stacking?.combinability }))),
      government_charges_status: disclosure.government_charges.status,
      availability_status: item.availability.status,
      odometer_value: item.odometer?.value,
      odometer_unit: item.odometer?.unit,
      stocked_at: tenure?.stocked_at,
      first_public_listing_at: tenure?.first_public_listing_at,
      history_reports_json: history ? JSON.stringify(history) : "",
      certification_type: item.used_vehicle?.certification_type,
    };
  });
  return [columns.join(","), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))].join("\r\n") + "\r\n";
}

function wellKnownDocument(origin) {
  return {
    dealer_agent_protocol: STANDARD_VERSION,
    organization_id: ORGANIZATION_ID,
    rooftops: fixture.dealer.rooftops.map((rooftop) => ({ rooftop_id: rooftop.rooftop_id, name: rooftop.name })),
    gateway: `${origin}/mcp`,
    published_feed: { format: "dealer-agent-inventory-csv/0.1", url: `${origin}/feeds/inventory.csv`, freshness_sla_seconds: 3600, authority: "asserted" },
    disclosure_defaults: {
      required_dealer_charges: [{ label: "Documentation charge", amount_minor: 99500, currency: "USD", included_in_advertised_price: true }],
      government_charges: "unknown",
    },
    handoff: { adf_endpoint: null, policy_url: `${origin}/policy#handoff` },
    upgrade_path: TRY_URL,
  };
}

const POLICY_TEXT = `Dealer Agent Protocol demo gateway: data and authority policy

Operator: Dealer Agent Protocol project. Data: synthetic Example Motors Group fleet. No real dealer, vehicle, VIN, price, or person.

authority
- Inventory search results are derived discovery snapshots (authority "derived").
- Vehicle records and pricing carry per-record provenance. Most records are "authoritative_dealer_system"; one used vehicle is deliberately stale and "dealer_asserted" so clients can see refusal behavior.
- verify_availability returns authoritative availability only when the observation is current. Stale evidence returns dealeragent.vehicle.stale.
- Government charges are "unknown" until a buyer jurisdiction is supplied. Unknown never means zero.

handoff
- prepare accepts no personal data and returns an ES256-signed, single-use binding that expires in 10 minutes. Keys: /.well-known/jwks.json.
- submit verifies signature, expiry, single use, subject, tenant, vehicle, purpose, and channels before building ADF/XML.
- Sandbox: ADF is returned to the caller and recorded for idempotency without contact details. Nothing is forwarded.

access
- Public, unauthenticated, rate limited at the edge. No customer data is stored beyond the binding lifetime.
`;

function llmsText(origin) {
  return `# Dealer Agent Protocol demo gateway
> Synthetic Example Motors Group dealer served over MCP (Streamable HTTP). Paste ${origin}/mcp into Claude, ChatGPT, Claude Code, Cursor, or MCP Inspector. Nothing here is real and nothing reaches a dealership.

- MCP endpoint: ${origin}/mcp
- Manifest: ${origin}/manifest.json
- Static discovery: ${origin}/.well-known/dealer-agent.json
- CSV feed (dealer-agent-inventory-csv/0.1, asserted authority): ${origin}/feeds/inventory.csv
- Handoff signing keys: ${origin}/.well-known/jwks.json
- Policy: ${origin}/policy
- Health: ${origin}/health
- How to connect: ${TRY_URL}
- Specification: https://dealeragentprotocol.com/spec/v0.1/SPEC.md
- Schemas: ${SCHEMA_BASE}

Tools: ${Object.keys(TOOL_SPECS).join(", ")}
organization_id: ${ORGANIZATION_ID}; rooftops: ${ROOFTOPS.join(", ")}. Money is integer minor units plus ISO 4217 currency.
`;
}

export default {
  async fetch(request, env = {}, executionContext) {
    const url = new URL(request.url);
    const origin = env.PUBLIC_ORIGIN || (url.hostname === "localhost" || url.hostname === "127.0.0.1" ? url.origin : DEFAULT_PUBLIC_ORIGIN);
    const now = Date.now();
    const context = { env, store: new Store(env.DEMO_STATE), origin, now, executionContext };

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });

    if (url.pathname === "/mcp") {
      if (request.method === "GET") return json({ error: "sse_not_offered", message: "This stateless gateway answers POST requests only." }, 405, { Allow: "POST, OPTIONS" });
      if (request.method === "DELETE") return new Response(null, { status: 405, headers: { Allow: "POST, OPTIONS", ...CORS_HEADERS } });
      if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST, OPTIONS", ...CORS_HEADERS } });
      const length = Number(request.headers.get("content-length") || 0);
      if (length > MAX_BODY_BYTES) return json(rpcError(null, -32600, "Request body too large"), 413);
      let body;
      try {
        const raw = await request.text();
        if (raw.length > MAX_BODY_BYTES) return json(rpcError(null, -32600, "Request body too large"), 413);
        body = JSON.parse(raw);
      } catch {
        return json(rpcError(null, -32700, "Parse error"), 400);
      }
      const messages = Array.isArray(body) ? body : [body];
      if (!messages.length) return json(rpcError(null, -32600, "Invalid Request"), 400);
      const responses = [];
      let httpStatus = 200;
      let responseVersion = MCP_REVISION;
      for (const message of messages) {
        const requested = requestedProtocolVersion(message, request);
        if (requested && !SUPPORTED_MCP.includes(requested) && message?.method !== "initialize" && !String(message?.method || "").startsWith("notifications/")) {
          responses.push(rpcError(message?.id, UNSUPPORTED_PROTOCOL_VERSION, "Unsupported protocol version", { supported: [...SUPPORTED_MCP], requested }));
          httpStatus = 400;
          continue;
        }
        const raw = await handleMessage(message, context);
        if (!raw) continue;
        const usedVersion = raw.result?.protocolVersion || (SUPPORTED_MCP.includes(requested) ? requested : null);
        if (usedVersion) responseVersion = usedVersion;
        responses.push(decorateModernResult(raw, usedVersion, message?.method));
      }
      if (!responses.length) return new Response(null, { status: 202, headers: { ...CORS_HEADERS, "MCP-Protocol-Version": responseVersion } });
      const payload = Array.isArray(body) ? responses : responses[0];
      return json(payload, httpStatus, { "MCP-Protocol-Version": responseVersion });
    }

    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method Not Allowed", { status: 405, headers: CORS_HEADERS });
    switch (url.pathname) {
      case "/":
        return Response.redirect(TRY_URL, 302);
      case "/health":
        return json({ status: "ok", data: "synthetic-only", standard: `dealer-agent-protocol/${STANDARD_VERSION}`, mcp_revision: MCP_REVISION, vehicles_published: fixture.vehicles.length, endpoint: `${origin}/mcp` });
      case "/manifest.json":
        return json(manifest(origin, now, await signingKey(env)), 200, { "Cache-Control": "public, max-age=300" });
      case "/.well-known/dealer-agent.json":
        return json(wellKnownDocument(origin), 200, { "Cache-Control": "public, max-age=3600" });
      case "/.well-known/jwks.json": {
        const key = await signingKey(env);
        return new Response(JSON.stringify({ keys: [{ ...key.publicJwk, kid: key.kid, use: "sig", alg: "ES256" }] }), { status: 200, headers: { "Content-Type": "application/jwk-set+json", "Cache-Control": key.ephemeral ? "no-store" : "public, max-age=3600", ...CORS_HEADERS } });
      }
      case "/feeds/inventory.csv":
        return new Response(csvFeed(now), { status: 200, headers: { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "public, max-age=900", ...CORS_HEADERS } });
      case "/policy":
        return text(POLICY_TEXT);
      case "/llms.txt":
        return text(llmsText(origin));
      default:
        return new Response("Not found", { status: 404, headers: CORS_HEADERS });
    }
  },
};
