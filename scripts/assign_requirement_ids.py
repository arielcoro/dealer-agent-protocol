#!/usr/bin/env python3
"""Assign stable inline IDs to every untagged MUST in normative Markdown.

Run deliberately after adding normative requirements, then review and commit the
result. Re-running is idempotent. IDs are file-local and must never be renumbered
after a public candidate release; append new IDs instead at that point.
"""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FILES = {
    "SPEC.md": "DAP-CORE",
    "pricing.md": "DAP-PR",
    "security.md": "DAP-SEC",
    "discovery.md": "DAP-DISC",
    "errors.md": "DAP-ERR",
    "handoff.md": "DAP-HO",
    "dealer-agent-inventory-csv.md": "DAP-CSV",
    "a2a-binding.md": "DAP-A2A",
}
MUST = re.compile(r"\bMUST(?: NOT)?\b")
TAGGED = re.compile(r"\[DAP-[A-Z0-9-]+-\d{3}\]\s*$")


def assign(path: Path, prefix: str) -> int:
    counter = 0
    changed = 0
    output = []
    for line in path.read_text(encoding="utf-8").splitlines(keepends=True):
        if "key words" in line and "BCP 14" not in line:
            output.append(line)
            continue
        cursor = 0
        parts = []
        for match in MUST.finditer(line):
            counter += 1
            parts.append(line[cursor:match.start()])
            preceding = line[max(0, match.start() - 32):match.start()]
            if not TAGGED.search(preceding):
                parts.append(f"[{prefix}-{counter:03d}] ")
                changed += 1
            parts.append(match.group(0))
            cursor = match.end()
        parts.append(line[cursor:])
        output.append("".join(parts))
    path.write_text("".join(output), encoding="utf-8")
    return changed


def main() -> int:
    changed = 0
    for name, prefix in FILES.items():
        path = ROOT / "spec" / "v0.1" / name
        if path.exists():
            changed += assign(path, prefix)
    print(f"Assigned {changed} requirement IDs.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
