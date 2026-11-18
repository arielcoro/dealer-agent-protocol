import test from "node:test";
import assert from "node:assert/strict";

import protocolWorker from "../deployment/cloudflare/static-site-worker.mjs";
import productWorker from "../deployment/cloudflare/product-site-worker.mjs";
import { passingTurnstileFetch, failingTurnstileFetch, isValidEmail, stripRecipientOverrides } from "../deployment/cloudflare/lead-form-guards.mjs";
import { memoryRateLimitNamespace, LEAD_RATE_LIMIT } from "../deployment/cloudflare/lead-rate-limiter.mjs";
import { INTERNAL_RECIPIENT } from "../deployment/cloudflare/lead-email.mjs";

function bindings(overrides = {}) {
  const databaseWrites = [];
  const emails = [];
  const tasks = [];
  return {
    databaseWrites,
    emails,
    tasks,
    env: {
      PILOT_DB: {
        prepare(sql) {
          return {
            bind(...values) {
              return {
                async run() {
                  databaseWrites.push({ sql, values });
                  return { success: true };
                },
              };
            },
          };
        },
      },
      EMAIL: {
        async send(message) {
          emails.push(message);
          return { messageId: `message-${emails.length}` };
        },
      },
      TURNSTILE_SECRET: "test-turnstile-secret",
      TURNSTILE_SITE_KEY: "test-site-key",
      TURNSTILE_FETCH: passingTurnstileFetch(),
      LEAD_RATE_LIMIT: memoryRateLimitNamespace(),
      ...overrides,
    },
    context: {
      waitUntil(promise) {
        tasks.push(Promise.resolve(promise));
      },
    },
  };
}

function protocolBody(sourcePath = "/pilot/") {
  return {
    contact_name: "Ariel",
    work_email: "ariel@example.com",
    dealership_name: "Example Motors",
    dealership_website: "https://example.com",
    role: "Dealer principal",
    rooftop_count: "1",
    pilot_goal: "Show accurate inventory availability and pricing.",
    timeline: "now",
    source_path: sourcePath,
    consent: true,
    "cf-turnstile-response": "test-turnstile-token",
  };
}

function auditBody() {
  return {
    contact_name: "Ariel",
    work_email: "ariel@example.com",
    dealership_name: "Example Motors",
    dealership_website: "https://example.com",
    role: "Dealer principal",
    rooftop_count: "1",
    market: "Miami, FL",
    audit_goal: "Check whether AI answers invent pricing or availability.",
    source_path: "/audit/",
    consent: true,
    "cf-turnstile-response": "test-turnstile-token",
  };
}

async function post(worker, url, payload, state) {
  const response = await worker.fetch(new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Origin: new URL(url).origin, "CF-Connecting-IP": "203.0.113.10" },
    body: JSON.stringify(payload),
  }), state.env, state.context);
  await Promise.all(state.tasks);
  return response;
}

test("Protocol applications save before sending the internal alert and acknowledgment", async () => {
  const state = bindings();
  const response = await post(protocolWorker, "https://dealeragentprotocol.com/api/pilot-applications", protocolBody(), state);

  assert.equal(response.status, 201);
  assert.equal(state.databaseWrites.length, 1);
  assert.equal(state.emails.length, 2);
  assert.equal(state.emails[0].to, INTERNAL_RECIPIENT);
  assert.equal(state.emails[0].replyTo, "ariel@example.com");
  assert.deepEqual(state.emails[0].from, { email: "notifications@dealeragentprotocol.com", name: "Dealer Agent Protocol" });
  assert.equal(state.emails[1].to, "ariel@example.com");
  assert.equal(state.emails[1].replyTo, INTERNAL_RECIPIENT);
  assert.match(state.emails[1].text, /Example Motors/);
  assert.equal(state.emails[0].cc, undefined);
  assert.equal(state.emails[1].cc, undefined);
});

test("Gateway-originated applications use Gateway acknowledgment branding", async () => {
  const state = bindings();
  const response = await post(protocolWorker, "https://dealeragentprotocol.com/api/pilot-applications", protocolBody("/pilot/?source=dealeragentgateway.com"), state);

  assert.equal(response.status, 201);
  assert.deepEqual(state.emails[0].from, { email: "notifications@dealeragentgateway.com", name: "Dealer Agent Gateway" });
  assert.match(state.emails[0].subject, /^\[Dealer Agent Gateway\]/);
  assert.deepEqual(state.emails[1].from, { email: "notifications@dealeragentgateway.com", name: "Dealer Agent Gateway" });
  assert.match(state.emails[1].subject, /Dealer Agent Gateway/);
});

test("DealershipMCP audit requests send the alert and acknowledgment", async () => {
  const state = bindings();
  const response = await post(productWorker, "https://dealershipmcp.com/api/audit-applications", auditBody(), state);

  assert.equal(response.status, 201);
  assert.equal(state.databaseWrites.length, 1);
  assert.equal(state.emails.length, 2);
  assert.equal(state.emails[0].to, INTERNAL_RECIPIENT);
  assert.deepEqual(state.emails[0].from, { email: "notifications@dealershipmcp.com", name: "DealershipMCP" });
  assert.equal(state.emails[1].to, "ariel@example.com");
  assert.match(state.emails[1].text, /AI Answer Audit request/);
});

test("A delivery failure does not turn a saved application into a failed submission", async () => {
  const state = bindings();
  state.env.EMAIL.send = async () => { throw new Error("email unavailable"); };

  const response = await post(protocolWorker, "https://dealeragentprotocol.com/api/pilot-applications", protocolBody(), state);
  const result = await response.json();

  assert.equal(response.status, 201);
  assert.equal(result.accepted, true);
  assert.equal(state.databaseWrites.length, 1);
});

test("The honeypot accepts bots without saving or sending anything", async () => {
  const state = bindings();
  const payload = { ...protocolBody(), website_company: "spam.example" };

  const response = await post(protocolWorker, "https://dealeragentprotocol.com/api/pilot-applications", payload, state);

  assert.equal(response.status, 201);
  assert.equal(state.databaseWrites.length, 0);
  assert.equal(state.emails.length, 0);
});

test("Missing EMAIL binding fails closed and does not save", async () => {
  const state = bindings({ EMAIL: undefined });
  const response = await post(protocolWorker, "https://dealeragentprotocol.com/api/pilot-applications", protocolBody(), state);
  assert.equal(response.status, 503);
  assert.equal(state.databaseWrites.length, 0);
  assert.equal(state.emails.length, 0);
});

test("Missing Turnstile secret fails closed and does not save", async () => {
  const state = bindings({ TURNSTILE_SECRET: undefined });
  const response = await post(productWorker, "https://dealershipmcp.com/api/audit-applications", auditBody(), state);
  assert.equal(response.status, 503);
  assert.equal(state.databaseWrites.length, 0);
  assert.equal(state.emails.length, 0);
});

test("A missing Turnstile token is rejected", async () => {
  const state = bindings();
  const payload = { ...protocolBody() };
  delete payload["cf-turnstile-response"];
  const response = await post(protocolWorker, "https://dealeragentprotocol.com/api/pilot-applications", payload, state);
  assert.equal(response.status, 400);
  assert.equal(state.databaseWrites.length, 0);
  assert.equal(state.emails.length, 0);
});

test("A failed Turnstile verification is rejected", async () => {
  const state = bindings({ TURNSTILE_FETCH: failingTurnstileFetch() });
  const response = await post(protocolWorker, "https://dealeragentprotocol.com/api/pilot-applications", protocolBody(), state);
  assert.equal(response.status, 403);
  assert.equal(state.databaseWrites.length, 0);
  assert.equal(state.emails.length, 0);
});

test("Per-IP rate limiting rejects further submissions", async () => {
  const state = bindings({ LEAD_RATE_LIMIT: memoryRateLimitNamespace({ limit: 2, windowMs: 60_000 }) });
  const url = "https://dealeragentprotocol.com/api/pilot-applications";
  assert.equal((await post(protocolWorker, url, protocolBody(), state)).status, 201);
  assert.equal((await post(protocolWorker, url, protocolBody(), state)).status, 201);
  const blocked = await post(protocolWorker, url, protocolBody(), state);
  assert.equal(blocked.status, 429);
  assert.equal(state.databaseWrites.length, 2);
  assert.equal(state.emails.length, 4);
});

test("Attacker-supplied to/cc fields are ignored; only the fixed internal address and the validated applicant get mail", async () => {
  const state = bindings();
  const payload = {
    ...protocolBody(),
    to: "attacker@evil.example",
    cc: "copy@evil.example",
    bcc: "hidden@evil.example",
    recipient: "other@evil.example",
  };
  const response = await post(protocolWorker, "https://dealeragentprotocol.com/api/pilot-applications", payload, state);
  assert.equal(response.status, 201);
  assert.deepEqual(state.emails.map((message) => message.to).sort(), [INTERNAL_RECIPIENT, "ariel@example.com"].sort());
  for (const message of state.emails) {
    assert.equal(message.cc, undefined);
    assert.equal(message.bcc, undefined);
    assert.notEqual(message.to, "attacker@evil.example");
  }
});

test("Header-injection and list-style emails are rejected", async () => {
  const state = bindings();
  const payload = { ...protocolBody(), work_email: "ariel@example.com,attacker@evil.example" };
  const response = await post(protocolWorker, "https://dealeragentprotocol.com/api/pilot-applications", payload, state);
  assert.equal(response.status, 400);
  assert.equal(state.databaseWrites.length, 0);
  assert.equal(state.emails.length, 0);
  assert.equal(isValidEmail("ariel@example.com\nbcc:attacker@evil.example"), false);
  assert.equal(isValidEmail("ariel@example.com"), true);
  assert.deepEqual(stripRecipientOverrides({ to: "x", work_email: "ariel@example.com" }).to, undefined);
});

test("Over-long fields are truncated to server limits before they are stored", async () => {
  const state = bindings();
  const payload = { ...protocolBody(), contact_name: "A".repeat(500), pilot_goal: `${"Need accurate inventory answers. ".repeat(80)}` };
  const response = await post(protocolWorker, "https://dealeragentprotocol.com/api/pilot-applications", payload, state);
  assert.equal(response.status, 201);
  const values = state.databaseWrites[0].values;
  assert.ok(values[1].length <= 120);
  assert.ok(values[7].length <= 1200);
});
