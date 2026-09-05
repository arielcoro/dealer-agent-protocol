#!/usr/bin/env python3
"""Build the protocol publication and reference gateway websites."""

from __future__ import annotations

import html
import json
import shutil
from pathlib import Path

import markdown


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "site" / "src"
DIST = ROOT / "site" / "dist"
GATEWAY_SOURCE = ROOT / "gateway-site" / "src"
GATEWAY_DIST = ROOT / "gateway-site" / "dist"
PRODUCT_SOURCE = ROOT / "dealershipmcp-site" / "src"
PRODUCT_DIST = ROOT / "dealershipmcp-site" / "dist"
VISIBILITY_SOURCE = ROOT / "dealer-ai-visibility-site" / "src"
VISIBILITY_DIST = ROOT / "dealer-ai-visibility-site" / "dist"
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


def render_comparison(destination: Path, product: bool) -> None:
    source = (ROOT / "compatibility" / "COMPARISON.md").read_text(encoding="utf-8")
    content = markdown.markdown(source, extensions=["tables", "fenced_code"])
    if product:
        brand = '<a class="brand" href="/"><span class="brand-mark">M</span><span>Dealership<br>MCP</span></a>'
        stylesheet = "/styles.css"
        home = "https://dealershipmcp.com/compare/"
        header_class = "site-header shell"
        main_class = "interior shell markdown-body"
        navigation = '<nav><a href="/visibility/">AI Visibility</a><a href="/ai-search/">AI Search</a><a href="/gateway/">Agent Gateway</a><a href="/live/">Live pilot</a></nav><a class="header-cta" href="/audit/">Start free →</a>'
    else:
        brand = '<a class="wordmark" href="/"><span class="wordmark-mark">D</span><span>Dealer Agent<br>Protocol</span></a>'
        stylesheet = "/styles.css"
        home = "https://dealeragentprotocol.com/compare/"
        header_class = "site-header page-shell"
        main_class = "page-shell markdown-body"
        navigation = '<nav><a href="/why/">Why DAP</a><a href="/docs/">Docs</a><a href="/pilot/">Pilot</a></nav><a class="header-cta" href="https://dealershipmcp.com/audit/">Free audit →</a>'
    faq = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {"@type": "Question", "name": "Is Dealer Agent Protocol the same as Auto Agent Protocol?", "acceptedAnswer": {"@type": "Answer", "text": "No. AAP is an A2A automotive profile. DAP is an MCP-native retail data and disclosure standard. They can run together through an adapter."}},
            {"@type": "Question", "name": "Can another vendor implement Dealer Agent Protocol?", "acceptedAnswer": {"@type": "Answer", "text": "Yes. The specification, schemas, tests, examples, and open gateway are Apache-2.0 licensed."}},
        ],
    }
    article = {"@context": "https://schema.org", "@type": "TechArticle", "headline": "Compare dealer agent standards", "dateModified": "2026-09-02", "author": {"@type": "Person", "name": "Ariel Coro"}, "url": home}
    page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="A dated, sourced comparison of Dealer Agent Protocol, DMC-12, Auto Agent Protocol, and AutomotiveMCP."><link rel="canonical" href="{home}"><link rel="stylesheet" href="{stylesheet}"><title>Compare dealer agent standards</title><script type="application/ld+json">{json.dumps(article)}</script><script type="application/ld+json">{json.dumps(faq)}</script></head><body><header class="{header_class}">{brand}{navigation}</header><main class="{main_class}">{content}</main></body></html>'''
    destination.mkdir(parents=True, exist_ok=True)
    (destination / "index.html").write_text(page, encoding="utf-8")


def main() -> int:
    if DIST.exists():
        shutil.rmtree(DIST)
    shutil.copytree(SOURCE, DIST)
    shutil.copytree(SPEC_SOURCE, DIST / "spec" / "v0.1")
    (DIST / "conformance").mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / "conformance" / "claim.schema.json", DIST / "conformance" / "claim.schema.json")
    (DIST / "conformance" / "claims").mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / "conformance" / "claims" / "example-claim.json", DIST / "conformance" / "claims" / "example-claim.json")
    shutil.copy2(ROOT / "registry" / "server.json", DIST / "server.json")
    write_schema_index(DIST / "spec" / "v0.1" / "schemas")
    shutil.copy2(ROOT / "LICENSE", DIST / "LICENSE.txt")
    shutil.copy2(ROOT / "NOTICE", DIST / "NOTICE.txt")
    shutil.copy2(ROOT / "CONTRIBUTING.md", DIST / "CONTRIBUTING.md")
    render_comparison(DIST / "compare", product=False)

    if GATEWAY_DIST.exists():
        shutil.rmtree(GATEWAY_DIST)
    shutil.copytree(GATEWAY_SOURCE, GATEWAY_DIST)
    shutil.copy2(ROOT / "registry" / "server.json", GATEWAY_DIST / "server.json")
    shutil.copy2(ROOT / "LICENSE", GATEWAY_DIST / "LICENSE.txt")
    shutil.copy2(ROOT / "NOTICE", GATEWAY_DIST / "NOTICE.txt")
    shutil.copy2(ROOT / "CONTRIBUTING.md", GATEWAY_DIST / "CONTRIBUTING.md")

    if PRODUCT_DIST.exists():
        shutil.rmtree(PRODUCT_DIST)
    shutil.copytree(PRODUCT_SOURCE, PRODUCT_DIST)
    render_comparison(PRODUCT_DIST / "compare", product=True)
    shutil.copy2(ROOT / "LICENSE", PRODUCT_DIST / "LICENSE.txt")
    shutil.copy2(ROOT / "NOTICE", PRODUCT_DIST / "NOTICE.txt")

    if VISIBILITY_DIST.exists():
        shutil.rmtree(VISIBILITY_DIST)
    shutil.copytree(VISIBILITY_SOURCE, VISIBILITY_DIST)

    print(f"Built protocol site at {DIST}")
    print(f"Built gateway site at {GATEWAY_DIST}")
    print(f"Built DealershipMCP site at {PRODUCT_DIST}")
    print(f"Built Dealer AI Visibility site at {VISIBILITY_DIST}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
