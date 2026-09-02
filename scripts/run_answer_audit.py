#!/usr/bin/env python3
"""Score a captured AI Answer Audit response set without calling answer engines."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


WEIGHTS = {"inventory": 25, "pricing": 25, "disclosure": 20, "availability": 15, "citation": 10, "risk": 5}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("responses", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    document = json.loads(args.responses.read_text(encoding="utf-8"))
    responses = document.get("responses", [])
    totals = {dimension: [] for dimension in WEIGHTS}
    severity = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for response in responses:
        if not all(response.get(field) for field in ("question_id", "platform", "answer")):
            raise SystemExit("Every response requires question_id, platform, and answer")
        for dimension, value in response.get("scores", {}).items():
            if dimension not in WEIGHTS or value is None:
                continue
            if not isinstance(value, (int, float)) or not 0 <= value <= 100:
                raise SystemExit(f"Invalid {dimension} score for {response['question_id']}")
            totals[dimension].append(float(value))
        for flag in response.get("flags", []):
            level = flag.get("severity")
            if level not in severity or not flag.get("evidence"):
                raise SystemExit(f"Invalid evidence flag for {response['question_id']}")
            severity[level] += 1
    dimensions = {name: (round(sum(values) / len(values), 1) if values else None) for name, values in totals.items()}
    covered_weight = sum(WEIGHTS[name] for name, value in dimensions.items() if value is not None)
    weighted = sum(dimensions[name] * WEIGHTS[name] for name in WEIGHTS if dimensions[name] is not None)
    summary = {
        "dealership": document.get("dealership"),
        "website": document.get("website"),
        "reviewed_at": document.get("reviewed_at"),
        "responses_reviewed": len(responses),
        "coverage_weight": covered_weight,
        "overall_score": round(weighted / covered_weight, 1) if covered_weight else None,
        "dimensions": dimensions,
        "flags": severity,
        "methodology": "audit/RUBRIC.md",
        "notice": "Diagnostic only; risk flags require human and legal review."
    }
    rendered = json.dumps(summary, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.write_text(rendered, encoding="utf-8")
    else:
        print(rendered, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
