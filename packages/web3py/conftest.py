"""Shared pytest fixtures and results aggregation for web3.py tests."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from results_collector import results

PACKAGE_DIR = Path(__file__).resolve().parent
RESULTS_PATH = PACKAGE_DIR / "results.json"


def pytest_sessionfinish(session, exitstatus) -> None:
    output = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "results": results,
    }
    RESULTS_PATH.write_text(json.dumps(output, indent=2) + "\n")
    print(f"\nResults written to {RESULTS_PATH}")
