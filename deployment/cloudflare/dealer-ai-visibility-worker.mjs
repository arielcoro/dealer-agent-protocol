const SUPABASE_URL = "https://dvnkcofnkmthlbhrkffl.supabase.co";
const MAX_BODY_BYTES = 16_384;

const SECURITY_HEADERS = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com",
    "font-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data:",
    "object-src 'none'",
    "script-src 'self' https://www.googletagmanager.com",
    "style-src 'self'",
    "upgrade-insecure-requests",
  ].join("; "),
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...SECURITY_HEADERS, "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8" },
  });
}

function clean(value, limit = 300) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 200;
}

function publicUrl(value) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".")) return null;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || host === "0.0.0.0" || host === "127.0.0.1" || host === "::1") return null;
    if (/^(10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

async function readJson(request) {
  const length = Number(request.headers.get("Content-Length") || "0");
  if (length > MAX_BODY_BYTES) throw new Error("body_too_large");
  if (!(request.headers.get("Content-Type") || "").includes("application/json")) throw new Error("unsupported_media_type");
  return request.json();
}

function sameOrigin(request, url) {
  const origin = request.headers.get("Origin");
  return !origin || origin === url.origin;
}

async function supabase(env, path, { method = "POST", body, timeout = 60_000, auth = true } = {}) {
  if (!env.SUPABASE_ANON_KEY) throw new Error("backend_not_configured");
  const headers = { apikey: env.SUPABASE_ANON_KEY, "Content-Type": "application/json" };
  if (auth) headers.Authorization = `Bearer ${env.SUPABASE_ANON_KEY}`;
  return fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
}

async function scan(request, env, url) {
  if (request.method !== "POST") return json({ message: "Method not allowed." }, 405);
  if (!sameOrigin(request, url)) return json({ message: "Origin not allowed." }, 403);
  let input;
  try { input = await readJson(request); } catch (error) { return json({ message: error.message }, error.message === "body_too_large" ? 413 : 415); }
  if (clean(input.website_company, 200)) return json({ message: "Request accepted." }, 202);

  const dealershipName = clean(input.dealershipName, 160);
  const city = clean(input.city, 120);
  const homepageUrl = publicUrl(clean(input.homepageUrl));
  const competitorInput = clean(input.competitorUrl);
  const competitorUrl = competitorInput ? publicUrl(competitorInput) : null;
  if (!dealershipName || !city || !homepageUrl || (competitorInput && !competitorUrl)) return json({ message: "Enter a valid dealership name, city and state, and public website URL." }, 400);
  try {
    const response = await supabase(env, "/functions/v1/analyze-ai-visibility", { body: { dealershipName, city, homepageUrl, competitorUrl } });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return json({ message: result.message || result.error || "The scan provider returned an error." }, response.status >= 500 ? 502 : response.status);
    return json(result);
  } catch (error) {
    return json({ message: error.name === "TimeoutError" ? "The scan timed out. Please try again." : "The scan is temporarily unavailable." }, 503);
  }
}

async function report(shortId, env) {
  if (!/^[a-z0-9]{6,20}$/i.test(shortId)) return json({ message: "Invalid report ID." }, 400);
  try {
    const response = await supabase(env, "/rest/v1/rpc/get_report_by_short_id", { body: { p_short_id: shortId }, timeout: 15_000 });
    const result = await response.json().catch(() => null);
    const value = Array.isArray(result) ? result[0] : result;
    if (!response.ok) return json({ message: "Report provider error." }, 502);
    if (!value) return json({ message: "Report not found." }, 404);
    return json(value);
  } catch {
    return json({ message: "The report is temporarily unavailable." }, 503);
  }
}

async function premium(request, env, url) {
  if (request.method !== "POST") return json({ message: "Method not allowed." }, 405);
  if (!sameOrigin(request, url)) return json({ message: "Origin not allowed." }, 403);
  let input;
  try { input = await readJson(request); } catch (error) { return json({ message: error.message }, 400); }
  const email = clean(input.email, 200).toLowerCase();
  const dealershipName = clean(input.dealershipName, 160);
  if (!validEmail(email) || !dealershipName) return json({ message: "Enter a valid work email and dealership." }, 400);
  const payload = {
    email,
    dealershipName,
    phone: clean(input.phone, 50) || null,
    reportId: clean(input.reportId, 80) || null,
    reportShortId: clean(input.reportShortId, 30) || null,
    domain: clean(input.domain, 200) || null,
    city: clean(input.city, 120) || null,
    overallScore: Number.isFinite(Number(input.overallScore)) ? Number(input.overallScore) : null,
  };
  try {
    const response = await supabase(env, "/functions/v1/submit-premium-analysis", { body: payload, timeout: 15_000 });
    const result = await response.json().catch(() => ({}));
    return response.ok ? json(result) : json({ message: result.message || "Could not save the request." }, 502);
  } catch { return json({ message: "Could not save the request." }, 503); }
}

async function unsubscribe(request, env, url) {
  if (request.method === "GET") {
    const token = clean(url.searchParams.get("token"), 500);
    if (!token) return json({ valid: false }, 400);
    try {
      const response = await supabase(env, `/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`, { method: "GET", timeout: 12_000, auth: false });
      return new Response(response.body, { status: response.status, headers: { ...SECURITY_HEADERS, "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8" } });
    } catch { return json({ valid: false }, 503); }
  }
  if (request.method === "POST") {
    if (!sameOrigin(request, url)) return json({ message: "Origin not allowed." }, 403);
    let input;
    try { input = await readJson(request); } catch { return json({ message: "Invalid request." }, 400); }
    const token = clean(input.token, 500);
    if (!token) return json({ message: "Invalid token." }, 400);
    try {
      const response = await supabase(env, "/functions/v1/handle-email-unsubscribe", { body: { token }, timeout: 12_000 });
      return new Response(response.body, { status: response.status, headers: { ...SECURITY_HEADERS, "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8" } });
    } catch { return json({ message: "Request unavailable." }, 503); }
  }
  return json({ message: "Method not allowed." }, 405);
}

function escapeMeta(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

async function reportPage(request, env, shortId) {
  let reportData = null;
  try {
    const response = await supabase(env, "/rest/v1/rpc/get_report_by_short_id", { body: { p_short_id: shortId }, timeout: 10_000 });
    const result = await response.json();
    reportData = Array.isArray(result) ? result[0] : result;
  } catch { /* client will retry through the first-party API */ }

  const assetUrl = new URL("/report/index.html", request.url);
  const asset = await env.ASSETS.fetch(new Request(assetUrl, { headers: request.headers }));
  let html = await asset.text();
  const name = reportData?.dealership_name || reportData?.domain || "Dealership";
  const score = Number(reportData?.overall_score ?? 0);
  const title = reportData ? `${name} AI visibility score: ${score}/100` : "Dealer AI visibility report";
  const description = reportData ? `${name} scored ${score}/100 on public signals that help AI systems understand and recommend a dealership.` : "A public dealership AI visibility report.";
  const canonical = `https://dealeraivisibility.com/report/${shortId}`;
  const image = reportData ? `${SUPABASE_URL}/functions/v1/og-report?shortId=${encodeURIComponent(shortId)}` : "https://dealeraivisibility.com/og.png";
  const replacements = { "{{REPORT_TITLE}}": title, "{{REPORT_DESCRIPTION}}": description, "{{REPORT_CANONICAL}}": canonical, "{{REPORT_IMAGE}}": image };
  for (const [token, value] of Object.entries(replacements)) html = html.replaceAll(token, escapeMeta(value));
  return new Response(html, { status: 200, headers: { ...SECURITY_HEADERS, "Cache-Control": "public, max-age=300", "Content-Type": "text/html; charset=utf-8" } });
}

function secureAsset(response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  const isHtml = headers.get("Content-Type")?.includes("text/html");
  headers.set("Cache-Control", isHtml ? "public, max-age=0, must-revalidate" : "public, max-age=3600");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === "www.dealeraivisibility.com") {
      url.hostname = "dealeraivisibility.com";
      return Response.redirect(url.toString(), 301);
    }
    if (url.pathname === "/api/scan") return scan(request, env, url);
    if (url.pathname === "/api/premium") return premium(request, env, url);
    if (url.pathname === "/api/unsubscribe") return unsubscribe(request, env, url);
    if (url.pathname.startsWith("/api/report/")) return report(url.pathname.split("/").filter(Boolean).pop(), env);

    const reportMatch = url.pathname.match(/^\/report\/([a-z0-9]{6,20})\/?$/i);
    if (reportMatch) return reportPage(request, env, reportMatch[1]);
    const shortMatch = url.pathname.match(/^\/r\/([a-z0-9]{6,20})\/?$/i);
    if (shortMatch) return Response.redirect(`https://dealeraivisibility.com/report/${shortMatch[1]}`, 301);

    return secureAsset(await env.ASSETS.fetch(request));
  },
};
