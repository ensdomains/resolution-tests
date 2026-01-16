# ENS Resolution Tests - Project Plan

## Overview

A comprehensive test suite for ENS name resolution across multiple programming languages and libraries. The goal is to provide a stable, reproducible set of test cases that library maintainers and integrators can use to validate their ENS implementations.

## Status

### Completed
- [x] Project structure defined
- [x] Git repo initialized
- [x] Bun workspace monorepo setup
- [x] Root package.json with scripts
- [x] test-cases.json with all cases
- [x] Shared types and helpers (`shared/`)
- [x] Reference implementation (viem-v2)
- [x] Results aggregation script
- [x] GitHub Actions workflow
- [x] Test cases configured with real expected values

### In Progress
- [ ] Gateway setup for CCIP-Read tests

### Pending Setup (Requires Contract Configuration)
- [ ] `forward-base-offchain` - CCIP-Read resolver for offchain Base address
- [ ] `reverse-eth-offchain` - CCIP-Read reverse resolution
- [ ] `reverse-l2-base` - L2 reverse resolution via L1
- [ ] `forward-wildcard` - Wildcard resolver on `integration-tests.eth`
- [ ] `forward-dns` - DNS name with DNSSEC

### Pending Library Implementations
- [ ] viem-v1
- [ ] ethers-v5
- [ ] ethers-v6
- [ ] ensjs-v3
- [ ] web3js-v4
- [ ] web3py
- [ ] ens-py
- [ ] alloy
- [ ] ethers-rs
- [ ] go-ens
- [ ] web3swift

---

## Test Cases

| ID | Category | Status | Input | Expected |
|----|----------|--------|-------|----------|
| `forward-eth-onchain` | Forward | Ready | `integration-tests.eth` | `0xeE9eeaAB0Bb7D9B969D701f6f8212609EDeA252E` |
| `forward-base-onchain` | Forward | Ready | `integration-tests.eth` | `0xeE9eeaAB0Bb7D9B969D701f6f8212609EDeA252E` |
| `forward-base-offchain` | Forward | Pending | `greg.offchaindemo.eth` | `0x8764f2939aE6d4EcB5baD2cdB7e2B81aA153bd1` |
| `forward-text-avatar` | Forward | Ready | `gregskril.eth` | NFT avatar |
| `forward-text-description` | Forward | Ready | `gtest.eth` | Hybrid resolver description |
| `forward-contenthash` | Forward | Ready | `gregskril.eth` | `ipfs://bafybei...` |
| `reverse-eth-onchain` | Reverse | Ready | `0xeE9eeaAB0Bb7D9B969D701f6f8212609EDeA252E` | `devrel.enslabs.eth` |
| `reverse-eth-offchain` | Reverse | Pending | `0x779981590E7Ccc0CFAe8040Ce7151324747cDb97` | `burner.offchaindemo.eth` |
| `reverse-l2-base` | Reverse | Pending | `0x179A862703a4adfb29896552DF9e307980D19285` | `greg.base.eth` |
| `forward-wildcard` | Forward | Pending | `*.integration-tests.eth` | TBD |
| `forward-dns` | Forward | Pending | TBD | TBD |

---

## Architecture

### Directory Structure
```
resolution-tests/
├── README.md
├── plan.md                      # This file
├── CLAUDE.md
├── .env.example
├── .gitignore
├── package.json                 # Workspace root
├── tsconfig.json                # Root TS config
├── tsconfig.base.json           # Shared TS config for packages
├── test-cases.json              # Single source of truth
├── shared/                      # Shared TS types and helpers
│   ├── types.ts
│   └── index.ts
├── gateway/                     # Static CCIP-Read responses
│   └── README.md
├── scripts/
│   ├── run-tests.ts             # Auto-discovers and runs packages
│   └── aggregate-results.ts
├── results/
│   └── .gitkeep
├── packages/
│   ├── viem-v2/                 # Reference implementation
│   └── ...
└── .github/
    └── workflows/
        └── test.yml
```

### Data Flow
1. `test-cases.json` defines all test cases (single source of truth)
2. `shared/` provides types and helpers for TypeScript packages
3. Each library package reads test cases and runs tests
4. Each package outputs `results.json` in standardized format
5. `scripts/aggregate-results.ts` combines all results into markdown/CSV
6. GitHub Actions prints results to job summary

### Environment Variables
- `RPC_URL` - Ethereum mainnet RPC endpoint (required)

---

## Gateway Setup (CCIP-Read)

For offchain test cases, we use static JSON files hosted on GitHub's raw CDN.

### URL Template
The resolver contract should use a gateway URL like:
```
https://raw.githubusercontent.com/{org}/{repo}/main/gateway/{sender}/{data}.json
```

### File Format
Each response file contains:
```json
{"data": "0x...abi-encoded-response..."}
```

### Setup Steps
1. Deploy or configure CCIP-Read resolver for offchain test names
2. Set gateway URL to point to this repo's `gateway/` folder
3. Pre-compute calldata for each offchain test case
4. Create corresponding JSON files with ABI-encoded responses

---

## Running Tests

```bash
# Install dependencies (workspace)
bun install

# Run all tests
bun run test

# Run specific language
bun run test:typescript
bun run test:python
bun run test:rust

# Aggregate results
bun run aggregate
```

---

## Contributing a New Library

### TypeScript
1. Create folder: `packages/{library-version}/`
2. Add `package.json` with dependencies
3. Add `tsconfig.json` extending `../../tsconfig.base.json`
4. Import from `../../../shared` for types and helpers
5. Output results to `results.json`
6. Run `bun install` from root

### Other Languages
1. Create folder: `packages/{library-version}/`
2. Add appropriate manifest (Cargo.toml, pyproject.toml, go.mod)
3. Read test cases from `../../test-cases.json`
4. Output results to `results.json` in standardized format
5. The test runner auto-discovers packages by their manifest file
