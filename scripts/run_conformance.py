#!/usr/bin/env python3
"""Run the Dealer Agent Protocol reference behavioral suite and optionally write a JSON report."""

from __future__ import annotations

import argparse
import json
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REFERENCE = ROOT / "reference" / "python"
sys.path.insert(0, str(REFERENCE))
CLIENT = ROOT / "packages" / "dealer-agent-client-python" / "src"
sys.path.insert(0, str(CLIENT))


def _test_name(test) -> str:
    return test.id() if hasattr(test, "id") else str(test)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", type=Path, help="Write a machine-readable test report to this path.")
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()

    suite = unittest.defaultTestLoader.discover(str(ROOT / "conformance" / "tests"), pattern="test_*.py")
    runner = unittest.TextTestRunner(verbosity=1 if args.quiet else 2)
    result = runner.run(suite)
    report = {
        "suite": "dealer-agent-protocol-reference-behavioral",
        "suite_version": "0.1.0-dev.2",
        "standard_version": "0.1",
        "mcp_revision": "2026-07-28",
        "completed_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "result": "pass" if result.wasSuccessful() else "fail",
        "tests_run": result.testsRun,
        "failures": [{"test": _test_name(test), "message": message} for test, message in result.failures],
        "errors": [{"test": _test_name(test), "message": message} for test, message in result.errors],
        "skipped": [{"test": _test_name(test), "reason": reason} for test, reason in result.skipped],
    }
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(report, sort_keys=True))
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    raise SystemExit(main())
