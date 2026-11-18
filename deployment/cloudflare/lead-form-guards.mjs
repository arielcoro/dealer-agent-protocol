import { checkLeadRateLimit, clientIp } from "./lead-rate-limiter.mjs";

export const FIELD_LIMITS = {
  contact_name: 120,
  work_email: 200,
  dealership_name: 180,
  dealership_website: 300,
  role: 120,
  rooftop_count: 20,
  market: 120,
  pilot_goal: 1200,
  audit_goal: 1200,
  timeline: 40,
  source_path: 120,
  website_company: 200,
  turnstile_token: 4096,
};

const RECIPIENT_OVERRIDE_KEYS = ["to", "cc", "bcc", "recipient", "recipients", "email_to", "email_cc", "mail_to", "reply_to"];
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const PLACEHOLDER_SITE_KEYS = new Set(["", "replace-with-turnstile-site-key", "0x4AAAAAAA_REPLACE_WITH_SITE_KEY"]);

export function cleanField(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function isValidEmail(value) {
  if (typeof value !== "string") return false;
  const email = value.trim();
  if (!email || email.length > FIELD_LIMITS.work_email) return false;
  if (/[\s,;:\r\n<>]/.test(email)) return false;
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email);
}

export function stripRecipientOverrides(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};
  const copy = { ...body };
  for (const key of RECIPIENT_OVERRIDE_KEYS) {
    delete copy[key];
    delete copy[key.toUpperCase()];
  }
  return copy;
}

export function turnstileToken(body) {
  if (!body || typeof body !== "object") return "";
  return cleanField(body["cf-turnstile-response"] || body.turnstile_token || "", FIELD_LIMITS.turnstile_token);
}

export async function verifyTurnstile({ secret, token, ip, fetchImpl = fetch }) {
  if (!secret) return { ok: false, reason: "secret_missing" };
  if (!token) return { ok: false, reason: "token_missing" };
  try {
    const payload = new URLSearchParams({ secret, response: token });
    if (ip && ip !== "unknown") payload.set("remoteip", ip);
    const response = await fetchImpl(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payload,
    });
    const result = await response.json();
    if (result?.success) return { ok: true };
    return { ok: false, reason: "verification_failed", codes: result?.["error-codes"] || [] };
  } catch {
    return { ok: false, reason: "verification_failed" };
  }
}

export function passingTurnstileFetch() {
  return async () => new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
}

export function failingTurnstileFetch(codes = ["invalid-input-response"]) {
  return async () => new Response(JSON.stringify({ success: false, "error-codes": codes }), { headers: { "Content-Type": "application/json" } });
}

export function isPlaceholderSiteKey(value) {
  return PLACEHOLDER_SITE_KEYS.has(String(value || "").trim());
}

/**
 * Shared pre-checks for public lead forms.
 * Recipients are never taken from the request; this only validates the submission.
 */
export async function protectLeadSubmission(request, env, body) {
  const ip = clientIp(request);
  const submitted = stripRecipientOverrides(body);

  if (cleanField(submitted.website_company, FIELD_LIMITS.website_company)) {
    return { ok: false, kind: "honeypot", ip };
  }

  if (!env?.EMAIL || !env?.TURNSTILE_SECRET) {
    return { ok: false, kind: "unavailable", ip };
  }

  const rate = await checkLeadRateLimit(env, ip);
  if (rate.missing) return { ok: false, kind: "unavailable", ip };
  if (!rate.allowed) return { ok: false, kind: "rate_limited", ip, retryAfter: rate.retryAfter };

  const verification = await verifyTurnstile({
    secret: env.TURNSTILE_SECRET,
    token: turnstileToken(submitted),
    ip,
    fetchImpl: env.TURNSTILE_FETCH || fetch,
  });
  if (!verification.ok) {
    return { ok: false, kind: "turnstile", ip, reason: verification.reason };
  }

  return { ok: true, kind: "ok", ip, body: submitted };
}
