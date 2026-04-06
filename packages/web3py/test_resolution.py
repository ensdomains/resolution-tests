from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Optional

import pytest
from web3 import Web3
from ens import ENS

# Load test cases
TEST_CASES_PATH = Path(__file__).parent.parent.parent / "test-cases.json"
with open(TEST_CASES_PATH) as f:
    ALL_TEST_CASES = json.load(f)

READY_CASES = [tc for tc in ALL_TEST_CASES if tc["status"] == "ready"]
FORWARD_CASES = [tc for tc in READY_CASES if tc["category"] == "forward"]
REVERSE_CASES = [tc for tc in READY_CASES if tc["category"] == "reverse"]

# Results collection
results = []

# Setup provider
RPC_URL = os.environ.get("RPC_URL")
if not RPC_URL:
    raise RuntimeError("RPC_URL environment variable is required")

w3 = Web3(Web3.HTTPProvider(RPC_URL))
ns = ENS.from_web3(w3)


def record_result(case_id: str, passed: bool, actual: str | None, error: str | None, duration_ms: int):
    results.append({
        "caseId": case_id,
        "passed": passed,
        "actual": actual,
        "error": error,
        "durationMs": duration_ms,
    })


def get_test_id(tc):
    return tc["id"]


@pytest.fixture(autouse=True, scope="session")
def write_results():
    yield
    output = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
        "results": results,
    }
    output_path = Path(__file__).parent / "results.json"
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\nResults written to {output_path}")


class TestForwardResolution:
    @pytest.mark.parametrize("test_case", FORWARD_CASES, ids=[tc["id"] for tc in FORWARD_CASES])
    def test_forward(self, test_case):
        start = time.time()
        try:
            actual = None
            method = test_case["method"]
            name = test_case["input"]["name"]

            if method == "addr":
                coin_type = test_case["params"].get("coinType", 60)
                result = ns.address(name, coin_type=coin_type)
                if result:
                    actual = Web3.to_checksum_address(result)

            elif method == "text":
                key = test_case["params"]["key"]
                actual = ns.get_text(name, key)

            elif method == "contenthash":
                resolver = ns.resolver(name)
                if resolver:
                    raw = resolver.caller.contenthash()
                    if raw and raw != b"" and raw != b"\x00" * len(raw):
                        actual = _decode_contenthash(raw)

            duration_ms = int((time.time() - start) * 1000)
            expected = test_case["expected"].get("address") or test_case["expected"].get("value")

            passed = actual == expected
            record_result(
                test_case["id"],
                passed,
                actual,
                None if passed else f"Expected {expected}, got {actual}",
                duration_ms,
            )
            assert actual == expected, f"Expected {expected}, got {actual}"

        except Exception as e:
            duration_ms = int((time.time() - start) * 1000)
            error_msg = str(e)
            if not any(r["caseId"] == test_case["id"] for r in results):
                record_result(test_case["id"], False, None, error_msg, duration_ms)
            raise


class TestReverseResolution:
    @pytest.mark.parametrize("test_case", REVERSE_CASES, ids=[tc["id"] for tc in REVERSE_CASES])
    def test_reverse(self, test_case):
        start = time.time()
        try:
            actual = None
            address = test_case["input"]["address"]

            if test_case["method"] == "reverse":
                actual = ns.name(address)
            elif test_case["method"] == "reverse-l2":
                # web3.py doesn't have direct L2 reverse resolution support
                # Skip with a descriptive error
                raise NotImplementedError("L2 reverse resolution not supported by web3.py")

            duration_ms = int((time.time() - start) * 1000)
            expected = test_case["expected"].get("name")

            passed = actual == expected
            record_result(
                test_case["id"],
                passed,
                actual,
                None if passed else f"Expected {expected}, got {actual}",
                duration_ms,
            )
            assert actual == expected, f"Expected {expected}, got {actual}"

        except Exception as e:
            duration_ms = int((time.time() - start) * 1000)
            error_msg = str(e)
            if not any(r["caseId"] == test_case["id"] for r in results):
                record_result(test_case["id"], False, None, error_msg, duration_ms)
            raise


def _decode_contenthash(raw: bytes) -> str | None:
    """Decode contenthash bytes to a human-readable URI."""
    if not raw or len(raw) < 2:
        return None

    # First byte is the storage system codec
    # 0xe3 = ipfs, 0xe5 = swarm
    codec = raw[0]

    if codec == 0xE3:
        # IPFS: skip codec byte (0xe3) and CID prefix byte (0x01)
        # The remaining bytes are the CID
        import base64
        # raw is: 0xe3 0x01 0x01 0x70 ... (dag-pb multicodec + multihash)
        # We need to encode the CID portion as base32
        cid_bytes = raw[1:]  # skip 0xe3
        # CIDv1 base32
        import base64 as _b64
        cid = _multibase_base32(cid_bytes)
        return f"ipfs://{cid}"
    elif codec == 0xE5:
        # Swarm
        content_hash = raw[1:].hex()
        return f"bzz://{content_hash}"

    return None


def _multibase_base32(data: bytes) -> str:
    """Encode bytes as base32lower (RFC 4648) CIDv1 format, with 'b' multibase prefix."""
    import base64
    encoded = base64.b32encode(data).decode("ascii").lower().rstrip("=")
    return "b" + encoded
