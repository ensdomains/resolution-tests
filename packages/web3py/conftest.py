"""Shared pytest fixtures and results aggregation for web3.py tests."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import pytest

from results_collector import results, setup_failures

PACKAGE_DIR = Path(__file__).resolve().parent
RESULTS_PATH = PACKAGE_DIR / "results.json"


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    report = outcome.get_result()
    if report.when != "setup" or not report.failed:
        return

    test_case = getattr(item, "callspec", None)
    if test_case is None:
        return
    case = test_case.params.get("test_case")
    if case is None:
        return

    setup_failures.append(case["id"])
    results.append(
        {
            "caseId": case["id"],
            "passed": False,
            "actual": None,
            "error": "Test setup failed; see pytest output",
            "durationMs": int(report.duration * 1000),
        }
    )


def pytest_sessionfinish(session, exitstatus) -> None:
    output = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "runFailed": bool(setup_failures)
        or exitstatus not in (pytest.ExitCode.OK, pytest.ExitCode.TESTS_FAILED),
        "results": results,
    }
    RESULTS_PATH.write_text(json.dumps(output, indent=2) + "\n")
    print(f"\nResults written to {RESULTS_PATH}")
