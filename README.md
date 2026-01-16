# ENS Resolution Tests

A comprehensive test suite for ENS name resolution across multiple programming languages and libraries.

## Overview

This repository provides a stable, reproducible set of test cases for validating ENS resolution implementations. Library maintainers and integrators can use these tests to ensure their ENS support is complete and correct.

## Test Cases

| Category | Test ID | Description | Status |
|----------|---------|-------------|--------|
| Forward | `forward-eth-onchain` | ETH address resolution via Universal Resolver | Ready |
| Forward | `forward-base-onchain` | Base address resolution (cointype 2147492101) | Ready |
| Forward | `forward-base-offchain` | Base address via CCIP-Read | Pending |
| Forward | `forward-text-avatar` | Avatar text record | Ready |
| Forward | `forward-text-description` | Description text record (offchain) | Ready |
| Forward | `forward-contenthash` | Content hash resolution | Ready |
| Reverse | `reverse-eth-onchain` | Primary name from ETH address | Ready |
| Reverse | `reverse-eth-offchain` | Primary name via CCIP-Read | Pending |
| Reverse | `reverse-l2-base` | L2 reverse resolution (Base via L1) | Pending |
| Forward | `forward-wildcard` | Wildcard resolver resolution | Pending |
| Forward | `forward-dns` | DNS name with DNSSEC | Pending |

See `test-cases.json` for full details and expected values.

## Supported Libraries

### TypeScript
- `viem` v2.x
- `viem` v1.x
- `ethers` v6.x
- `ethers` v5.x
- `@ensdomains/ensjs` v3.x
- `web3.js` v4.x

### Python
- `web3.py`
- `ens-py`

### Rust
- `alloy`
- `ethers-rs`

### Go
- `go-ens`

## Quick Start

```bash
# Clone the repo
git clone https://github.com/ensdomains/resolution-tests.git
cd resolution-tests

# Copy env and set RPC URL
cp .env.example .env
# Edit .env and set RPC_URL

# Install all dependencies (workspace)
bun install

# Run all tests
bun run test

# Run tests for specific language
bun run test:typescript

# Aggregate results into markdown/CSV
bun run aggregate
```

## Project Structure

```
resolution-tests/
├── test-cases.json          # Single source of truth for all tests
├── shared/                  # Shared types and helpers for TS packages
│   ├── types.ts
│   └── index.ts
├── gateway/                 # Static CCIP-Read responses (future)
├── scripts/
│   ├── run-tests.ts         # Test runner (auto-discovers packages)
│   └── aggregate-results.ts # Results aggregator
├── results/                 # Generated results
├── packages/                # Library test implementations
│   ├── viem-v2/
│   ├── ethers-v6/
│   └── ...
└── .github/workflows/       # CI that runs tests and prints results
```

## Adding a New TypeScript Library

1. Create a new directory: `packages/{library-version}/`
2. Add a `package.json` (will be auto-discovered by bun workspaces)
3. Import shared types and helpers:
   ```typescript
   import { getTestCasesByCategory, type TestResult } from "../../../shared";
   ```
4. Output results to `results.json` in the package directory
5. Run `bun install` from root to link the new package

### Results Format

Each library must output a `results.json` file:

```json
{
  "library": "viem",
  "version": "2.21.0",
  "language": "typescript",
  "timestamp": "2025-01-16T12:00:00Z",
  "results": [
    {
      "caseId": "forward-eth-onchain",
      "passed": true,
      "actual": "0xeE9eeaAB0Bb7D9B969D701f6f8212609EDeA252E",
      "error": null,
      "durationMs": 150
    }
  ]
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `RPC_URL` | Yes | Ethereum mainnet RPC endpoint |

## Operational Notes

- Test names use various `.eth` names owned by ENS DevRel team or known stable names
- The DevRel team Safe (`devrel.enslabs.eth`) has `coldwallet.ens.eth` as a recoverer
- Test data is designed to remain stable over time

## License

MIT
