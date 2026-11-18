// Per-IP rate limiter for public lead forms.
// Used as a Durable Object in production; tests use memoryRateLimitNamespace().

export const LEAD_RATE_LIMIT = 5;
export const LEAD_RATE_WINDOW_MS = 15 * 60 * 1000;

export function clientIp(request) {
  const cf = request.headers.get("CF-Connecting-IP");
  if (cf && cf.trim()) return cf.trim();
  const forwarded = request.headers.get("X-Forwarded-For");
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }
  return "unknown";
}

function evaluate(hits, now, limit, windowMs) {
  const recent = (Array.isArray(hits) ? hits : []).filter((stamp) => now - stamp < windowMs);
  if (recent.length >= limit) {
    const retryAfter = Math.max(1, Math.ceil((windowMs - (now - recent[0])) / 1000));
    return { allowed: false, retryAfter, remaining: 0, recent };
  }
  recent.push(now);
  return { allowed: true, retryAfter: 0, remaining: Math.max(0, limit - recent.length), recent };
}

export class LeadRateLimiter {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const ip = url.searchParams.get("ip") || "unknown";
    const now = Number(url.searchParams.get("now")) || Date.now();
    const limit = Number(url.searchParams.get("limit")) || LEAD_RATE_LIMIT;
    const windowMs = Number(url.searchParams.get("window_ms")) || LEAD_RATE_WINDOW_MS;
    const hits = (await this.state.storage.get("hits")) || [];
    const result = evaluate(hits, now, limit, windowMs);
    await this.state.storage.put("hits", result.recent);
    return Response.json({ allowed: result.allowed, retryAfter: result.retryAfter, remaining: result.remaining });
  }
}

export function memoryRateLimitNamespace({ limit = LEAD_RATE_LIMIT, windowMs = LEAD_RATE_WINDOW_MS } = {}) {
  const buckets = new Map();
  return {
    idFromName(name) {
      return { name: String(name) };
    },
    get(id) {
      const key = id?.name || "unknown";
      return {
        async fetch(input) {
          const url = new URL(typeof input === "string" ? input : input.url, "https://rate-limit.local");
          const now = Number(url.searchParams.get("now")) || Date.now();
          const result = evaluate(buckets.get(key) || [], now, limit, windowMs);
          buckets.set(key, result.recent);
          return new Response(JSON.stringify({ allowed: result.allowed, retryAfter: result.retryAfter, remaining: result.remaining }), {
            headers: { "Content-Type": "application/json" },
          });
        },
      };
    },
  };
}

export async function checkLeadRateLimit(env, ip) {
  if (!env?.LEAD_RATE_LIMIT) return { allowed: false, missing: true, retryAfter: 0 };
  const id = env.LEAD_RATE_LIMIT.idFromName(ip || "unknown");
  const stub = env.LEAD_RATE_LIMIT.get(id);
  const response = await stub.fetch(`https://lead-rate-limit/check?ip=${encodeURIComponent(ip || "unknown")}`);
  const body = await response.json();
  return { allowed: Boolean(body.allowed), missing: false, retryAfter: Number(body.retryAfter) || 0, remaining: body.remaining };
}
