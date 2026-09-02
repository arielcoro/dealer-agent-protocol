const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'self'; base-uri 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; upgrade-insecure-requests",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};

const MAX_BODY_BYTES = 16384;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...SECURITY_HEADERS, "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8" } });
}

function clean(value, limit) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 200;
}

function validWebsite(value) {
  try {
    const parsed = new URL(value);
    return ["https:", "http:"].includes(parsed.protocol) && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

async function body(request) {
  const length = Number(request.headers.get("Content-Length") || "0");
  if (length > MAX_BODY_BYTES) throw new Error("body_too_large");
  const contentType = request.headers.get("Content-Type") || "";
  if (contentType.includes("application/json")) return request.json();
  if (contentType.includes("multipart/form-data")) return Object.fromEntries(await request.formData());
  if (contentType.includes("application/x-www-form-urlencoded")) return Object.fromEntries(new URLSearchParams(await request.text()));
  throw new Error("unsupported_media_type");
}

async function submitAudit(request, env, url) {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const origin = request.headers.get("Origin");
  if (origin && origin !== url.origin) return json({ error: "origin_not_allowed" }, 403);
  if (!env.PILOT_DB) return json({ error: "applications_temporarily_unavailable" }, 503);
  let input;
  try { input = await body(request); } catch (error) { return json({ error: error.message }, error.message === "body_too_large" ? 413 : 415); }
  if (clean(input.website_company, 200)) return json({ accepted: true }, 201);
  const application = {
    contactName: clean(input.contact_name, 120),
    workEmail: clean(input.work_email, 200).toLowerCase(),
    dealershipName: clean(input.dealership_name, 180),
    dealershipWebsite: clean(input.dealership_website, 300),
    role: clean(input.role, 120),
    rooftopCount: clean(input.rooftop_count, 20),
    market: clean(input.market, 120),
    auditGoal: clean(input.audit_goal, 1200),
    sourcePath: clean(input.source_path, 120) || "/audit/"
  };
  const consent = [true, "true", "on", "1"].includes(input.consent);
  const validRooftops = new Set(["1", "2-5", "6-20", "21+"]);
  if (!application.contactName || !validEmail(application.workEmail) || !application.dealershipName || !validWebsite(application.dealershipWebsite) || !application.role || !validRooftops.has(application.rooftopCount) || !application.market || application.auditGoal.length < 20 || !consent) {
    return json({ error: "validation_failed" }, 400);
  }
  const id = crypto.randomUUID();
  try {
    await env.PILOT_DB.prepare(`INSERT INTO audit_applications (id, contact_name, work_email, dealership_name, dealership_website, role, rooftop_count, market, audit_goal, consent, source_path) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 1, ?10)`).bind(id, application.contactName, application.workEmail, application.dealershipName, application.dealershipWebsite, application.role, application.rooftopCount, application.market, application.auditGoal, application.sourcePath).run();
  } catch {
    return json({ error: "application_not_saved" }, 500);
  }
  return json({ accepted: true, application_id: id }, 201);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === "www.dealershipmcp.com") {
      url.hostname = "dealershipmcp.com";
      return Response.redirect(url.toString(), 301);
    }
    if (url.pathname === "/api/audit-applications") return submitAudit(request, env, url);
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
    headers.set("Cache-Control", headers.get("Content-Type")?.includes("text/html") ? "public, max-age=0, must-revalidate" : "public, max-age=3600");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
};
