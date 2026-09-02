const SECURITY_HEADERS = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "connect-src 'self' https://mcp.dealershipmcp.com",
    "font-src 'self' https://fonts.gstatic.com",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data:",
    "object-src 'none'",
    "script-src 'self' 'sha256-EtRh/Lpd/+zG9sc3VzdI4hQ4IZZZxAE6xNMhPg9AfBE=' 'sha256-lfc6WCwUB2uWDuTNaoiwHdXdVgzuxhcgarmhtB1mj78='",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "upgrade-insecure-requests",
  ].join("; "),
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

const PILOT_HOST = "dealeragentprotocol.com";
const PILOT_PATH = "/api/pilot-applications";
const MAX_PILOT_BODY_BYTES = 16_384;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      ...SECURITY_HEADERS,
    },
  });
}

function cleanField(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 200;
}

function isValidWebsite(value) {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

async function readPilotBody(request) {
  const contentLength = Number(request.headers.get("Content-Length") || "0");
  if (contentLength > MAX_PILOT_BODY_BYTES) {
    throw new Error("body_too_large");
  }

  const contentType = request.headers.get("Content-Type") || "";
  if (contentType.includes("application/json")) {
    return request.json();
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_PILOT_BODY_BYTES) {
      throw new Error("body_too_large");
    }
    return Object.fromEntries(new URLSearchParams(text));
  }

  throw new Error("unsupported_media_type");
}

async function handlePilotApplication(request, env, requestUrl) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const origin = request.headers.get("Origin");
  if (origin && origin !== requestUrl.origin) {
    return jsonResponse({ error: "origin_not_allowed" }, 403);
  }

  if (!env.PILOT_DB) {
    return jsonResponse({ error: "applications_temporarily_unavailable" }, 503);
  }

  let body;
  try {
    body = await readPilotBody(request);
  } catch (error) {
    const status = error?.message === "body_too_large" ? 413 : 415;
    return jsonResponse({ error: error?.message || "invalid_request" }, status);
  }

  const wantsHtml = !request.headers.get("Accept")?.includes("application/json");
  const honeypot = cleanField(body.website_company, 200);
  if (honeypot) {
    if (wantsHtml) {
      return Response.redirect(`${requestUrl.origin}/pilot/?submitted=1`, 303);
    }
    return jsonResponse({ accepted: true }, 201);
  }

  const application = {
    contactName: cleanField(body.contact_name, 120),
    workEmail: cleanField(body.work_email, 200).toLowerCase(),
    dealershipName: cleanField(body.dealership_name, 180),
    dealershipWebsite: cleanField(body.dealership_website, 300),
    role: cleanField(body.role, 120),
    rooftopCount: cleanField(body.rooftop_count, 20),
    pilotGoal: cleanField(body.pilot_goal, 1200),
    timeline: cleanField(body.timeline, 40) || null,
    sourcePath: cleanField(body.source_path, 120) || "/pilot/",
  };

  const consent = body.consent === true || body.consent === "true" || body.consent === "on" || body.consent === "1";
  const rooftopOptions = new Set(["1", "2-5", "6-20", "21+"]);
  const timelineOptions = new Set(["now", "30-60-days", "60-90-days", "exploring", ""]);
  const errors = {};

  if (!application.contactName) errors.contact_name = "Enter your name.";
  if (!isValidEmail(application.workEmail)) errors.work_email = "Enter a valid work email.";
  if (!application.dealershipName) errors.dealership_name = "Enter the dealership or dealer group name.";
  if (!isValidWebsite(application.dealershipWebsite)) errors.dealership_website = "Enter a complete website URL, including https://.";
  if (!application.role) errors.role = "Enter your role.";
  if (!rooftopOptions.has(application.rooftopCount)) errors.rooftop_count = "Select the number of rooftops.";
  if (application.pilotGoal.length < 20) errors.pilot_goal = "Tell us in at least 20 characters what you want agents to answer.";
  if (!timelineOptions.has(application.timeline || "")) errors.timeline = "Select a valid timeline.";
  if (!consent) errors.consent = "Consent is required so we can review and respond to your application.";

  if (Object.keys(errors).length) {
    if (wantsHtml) {
      return Response.redirect(`${requestUrl.origin}/pilot/?error=1`, 303);
    }
    return jsonResponse({ error: "validation_failed", fields: errors }, 400);
  }

  const id = crypto.randomUUID();
  try {
    await env.PILOT_DB.prepare(
      `INSERT INTO pilot_applications (
        id, contact_name, work_email, dealership_name, dealership_website,
        role, rooftop_count, pilot_goal, timeline, consent, source_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
    ).bind(
      id,
      application.contactName,
      application.workEmail,
      application.dealershipName,
      application.dealershipWebsite,
      application.role,
      application.rooftopCount,
      application.pilotGoal,
      application.timeline,
      application.sourcePath,
    ).run();
  } catch {
    return jsonResponse({ error: "application_not_saved" }, 500);
  }

  if (wantsHtml) {
    return Response.redirect(`${requestUrl.origin}/pilot/?submitted=1`, 303);
  }
  return jsonResponse({ accepted: true, application_id: id }, 201);
}

export default {
  async fetch(request, env) {
    const requestUrl = new URL(request.url);
    if (requestUrl.hostname === "dealeragentgateway.com") {
      const target = new URL(requestUrl.pathname + requestUrl.search, "https://dealershipmcp.com");
      return Response.redirect(target.toString(), 301);
    }
    if (requestUrl.hostname === PILOT_HOST && requestUrl.pathname === PILOT_PATH) {
      return handlePilotApplication(request, env, requestUrl);
    }

    let assetRequest = request;
    if (
      requestUrl.hostname === "dealeragentgateway.com" &&
      requestUrl.pathname === "/privacy/" &&
      (request.method === "GET" || request.method === "HEAD")
    ) {
      const assetUrl = new URL(requestUrl);
      assetUrl.searchParams.set("_asset", "privacy-20260901");
      assetRequest = new Request(assetUrl, request);
    }

    const response = await env.ASSETS.fetch(assetRequest);
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      headers.set(name, value);
    }

    const path = requestUrl.pathname;
    if (/^\/spec\/v[^/]+\//.test(path) || path.endsWith(".schema.json")) {
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
    } else if (headers.get("Content-Type")?.includes("text/html")) {
      headers.set("Cache-Control", "public, max-age=0, must-revalidate");
    } else {
      headers.set("Cache-Control", "public, max-age=3600");
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
