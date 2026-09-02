#!/usr/bin/env python3
"""Build the protocol publication and reference gateway websites."""

from __future__ import annotations

import html
import json
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "site" / "src"
DIST = ROOT / "site" / "dist"
GATEWAY_SOURCE = ROOT / "gateway-site" / "src"
GATEWAY_DIST = ROOT / "gateway-site" / "dist"
SPEC_SOURCE = ROOT / "spec" / "v0.1"


def write_schema_index(schema_dir: Path) -> None:
    links = []
    for path in sorted(schema_dir.glob("*.schema.json")):
        schema = json.loads(path.read_text(encoding="utf-8"))
        title = html.escape(schema.get("title", path.name))
        links.append(f'<li><a href="{html.escape(path.name)}">{title}</a><code>{html.escape(path.name)}</code></li>')
    page = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="canonical" href="https://dealeragentprotocol.com/spec/v0.1/schemas/"><title>JSON Schemas — Dealer Agent Protocol</title></head>
<body><main class="page-shell" style="padding:9vh 0"><p class="eyebrow"><span></span>Version 0.1</p><h1 style="font-size:clamp(54px,9vw,110px)">Normative<br><em>JSON Schemas.</em></h1><p class="lede">Canonical JSON Schema 2020-12 documents for Dealer Agent Protocol.</p><ul class="schema-index">%s</ul><p><a class="button button-secondary" href="/">Return home</a></p></main></body></html>""" % "".join(links)
    (schema_dir / "index.html").write_text(page, encoding="utf-8")


def main() -> int:
    if DIST.exists():
        shutil.rmtree(DIST)
    shutil.copytree(SOURCE, DIST)
    shutil.copytree(SPEC_SOURCE, DIST / "spec" / "v0.1")
    (DIST / "conformance").mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / "conformance" / "claim.schema.json", DIST / "conformance" / "claim.schema.json")
    shutil.copy2(ROOT / "registry" / "server.json", DIST / "server.json")
    write_schema_index(DIST / "spec" / "v0.1" / "schemas")
    shutil.copy2(ROOT / "LICENSE", DIST / "LICENSE.txt")

    if GATEWAY_DIST.exists():
        shutil.rmtree(GATEWAY_DIST)
    shutil.copytree(GATEWAY_SOURCE, GATEWAY_DIST)
    shutil.copy2(ROOT / "registry" / "server.json", GATEWAY_DIST / "server.json")
    shutil.copy2(ROOT / "LICENSE", GATEWAY_DIST / "LICENSE.txt")

    print(f"Built protocol site at {DIST}")
    print(f"Built gateway site at {GATEWAY_DIST}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
