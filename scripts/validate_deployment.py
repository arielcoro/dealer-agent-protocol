#!/usr/bin/env python3
"""Validate canonical publication URLs, generated site, and registry metadata."""

from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CANONICAL = "https://dealeragentprotocol.com"
REMOTE = "https://mcp.dealeragentgateway.com/mcp"


def main() -> int:
    failures: list[str] = []

    schema_paths = sorted((ROOT / "spec" / "v0.1" / "schemas").glob("*.schema.json"))
    schema_paths.append(ROOT / "conformance" / "claim.schema.json")
    for path in schema_paths:
        schema = json.loads(path.read_text(encoding="utf-8"))
        if not schema.get("$id", "").startswith(f"{CANONICAL}/"):
            failures.append(f"{path.relative_to(ROOT)}: noncanonical $id")

    server_path = ROOT / "registry" / "server.json"
    server = json.loads(server_path.read_text(encoding="utf-8"))
    if server.get("name") != "com.dealeragentgateway/reference":
        failures.append("registry/server.json: unexpected registry name")
    if len(server.get("description", "")) > 100:
        failures.append("registry/server.json: description exceeds registry limit")
    remotes = server.get("remotes", [])
    if remotes != [{"type": "streamable-http", "url": REMOTE}]:
        failures.append("registry/server.json: remote endpoint differs from canonical deployment")
    if server.get("websiteUrl") != f"{CANONICAL}/":
        failures.append("registry/server.json: websiteUrl is not canonical")

    required_site_files = [
        "index.html",
        "styles.css",
        "robots.txt",
        "sitemap.xml",
        "llms.txt",
        "server.json",
        "spec/v0.1/SPEC.md",
        "spec/v0.1/capabilities.yaml",
        "spec/v0.1/schemas/index.html",
        "spec/v0.1/schemas/manifest.schema.json",
        "site.webmanifest",
        "LICENSE.txt",
        "og.png",
    ]
    for relative in required_site_files:
        if not (ROOT / "site" / "dist" / relative).is_file():
            failures.append(f"site/dist/{relative}: missing generated publication file")

    source_text = "\n".join(
        path.read_text(encoding="utf-8")
        for path in [
            ROOT / "site" / "src" / "index.html",
            ROOT / "site" / "src" / "robots.txt",
            ROOT / "site" / "src" / "sitemap.xml",
            ROOT / "site" / "src" / "llms.txt",
        ]
    )
    if CANONICAL not in source_text or REMOTE not in source_text:
        failures.append("site source: canonical protocol or gateway URL is absent")
    if "dealeragentprotocol.example" in source_text:
        failures.append("site source: placeholder domain remains")

    required_gateway_files = [
        "index.html",
        "styles.css",
        "app.js",
        "robots.txt",
        "sitemap.xml",
        "llms.txt",
        "site.webmanifest",
        "server.json",
        "LICENSE.txt",
        "og.png",
    ]
    for relative in required_gateway_files:
        if not (ROOT / "gateway-site" / "dist" / relative).is_file():
            failures.append(f"gateway-site/dist/{relative}: missing generated publication file")

    gateway_source_text = "\n".join(
        path.read_text(encoding="utf-8")
        for path in [
            ROOT / "gateway-site" / "src" / "index.html",
            ROOT / "gateway-site" / "src" / "robots.txt",
            ROOT / "gateway-site" / "src" / "sitemap.xml",
            ROOT / "gateway-site" / "src" / "llms.txt",
        ]
    )
    for required_value in ["https://dealeragentgateway.com", REMOTE, CANONICAL]:
        if required_value not in gateway_source_text:
            failures.append(f"gateway site source: {required_value} is absent")
    if failures:
        print("Deployment validation failed:", file=sys.stderr)
        for failure in failures:
            print(f"- {failure}", file=sys.stderr)
        return 1

    print(
        f"Validated {len(schema_paths)} canonical schema IDs, registry metadata, "
        f"{len(required_site_files)} protocol files, and {len(required_gateway_files)} gateway files."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
