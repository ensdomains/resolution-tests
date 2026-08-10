"""ENS resolution tests for web3.py."""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any

import pytest
from eth_utils import to_checksum_address
from web3 import Web3
from ens import ENS

from results_collector import results

PACKAGE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = PACKAGE_DIR.parent.parent
TEST_CASES_PATH = ROOT_DIR / "test-cases.json"

# Methods without a public web3.py ENS API (or known unsupported)
UNSUPPORTED_METHODS = {"contenthash", "reverse-l2"}


def _load_rpc_url() -> str:
    rpc_url = os.environ.get("RPC_URL")
    if rpc_url:
        return rpc_url

    env_path = ROOT_DIR / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            if key.strip() == "RPC_URL" and value.strip():
                return value.strip().strip('"').strip("'")

    raise RuntimeError("RPC_URL environment variable is required")


def _load_test_cases(category: str) -> list[dict[str, Any]]:
    cases = json.loads(TEST_CASES_PATH.read_text())
    return [
        case
        for case in cases
        if case["status"] == "ready"
        and case["category"] == category
        and case["method"] not in UNSUPPORTED_METHODS
    ]


@pytest.fixture(scope="session")
def ens() -> ENS:
    w3 = Web3(Web3.HTTPProvider(_load_rpc_url()))
    return ENS.from_web3(w3)


def _record(
    case_id: str,
    passed: bool,
    actual: str | None,
    error: str | None,
    duration_ms: int,
) -> None:
    results.append(
        {
            "caseId": case_id,
            "passed": passed,
            "actual": actual,
            "error": error,
            "durationMs": duration_ms,
        }
    )


FORWARD_CASES = _load_test_cases("forward")
REVERSE_CASES = _load_test_cases("reverse")


@pytest.mark.parametrize(
    "test_case",
    FORWARD_CASES,
    ids=[case["id"] for case in FORWARD_CASES],
)
def test_forward_resolution(ens: ENS, test_case: dict[str, Any]) -> None:
    start = time.perf_counter()
    actual: str | None = None

    try:
        name = test_case["input"]["name"]
        method = test_case["method"]

        if method == "addr":
            coin_type = test_case["params"]["coinType"]
            resolved = ens.address(name, coin_type=coin_type)
            if resolved is not None:
                actual = to_checksum_address(resolved)
        elif method == "text":
            key = test_case["params"]["key"]
            actual = ens.get_text(name, key) or None
        else:
            raise AssertionError(f"Unexpected method: {method}")

        duration_ms = int((time.perf_counter() - start) * 1000)
        expected = (
            test_case["expected"].get("address")
            or test_case["expected"].get("value")
        )
        passed = actual == expected
        _record(
            test_case["id"],
            passed,
            actual,
            None if passed else f"Expected {expected}, got {actual}",
            duration_ms,
        )
        assert actual == expected
    except Exception as exc:
        duration_ms = int((time.perf_counter() - start) * 1000)
        if not any(r["caseId"] == test_case["id"] for r in results):
            _record(test_case["id"], False, None, str(exc), duration_ms)
        raise


@pytest.mark.parametrize(
    "test_case",
    REVERSE_CASES,
    ids=[case["id"] for case in REVERSE_CASES],
)
def test_reverse_resolution(ens: ENS, test_case: dict[str, Any]) -> None:
    start = time.perf_counter()
    actual: str | None = None

    try:
        method = test_case["method"]
        if method == "reverse":
            address = to_checksum_address(test_case["input"]["address"])
            actual = ens.name(address)
        else:
            raise AssertionError(f"Unexpected method: {method}")

        duration_ms = int((time.perf_counter() - start) * 1000)
        expected = test_case["expected"].get("name")
        passed = actual == expected
        _record(
            test_case["id"],
            passed,
            actual,
            None if passed else f"Expected {expected}, got {actual}",
            duration_ms,
        )
        assert actual == expected
    except Exception as exc:
        duration_ms = int((time.perf_counter() - start) * 1000)
        if not any(r["caseId"] == test_case["id"] for r in results):
            _record(test_case["id"], False, None, str(exc), duration_ms)
        raise
