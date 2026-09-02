const SECURITY_HEADERS = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "connect-src 'self' https://mcp.dealeragentgateway.com",
    "font-src 'self' https://fonts.gstatic.com",
    "form-action 'none'",
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

export default {
  async fetch(request, env) {
    const requestUrl = new URL(request.url);
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
