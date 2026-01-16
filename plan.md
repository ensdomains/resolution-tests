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

### In Progress
- [ ] Gateway setup for CCIP-Read tests
- [ ] Update test-cases.json with correct expected values

### Pending Setup (Requires Contract Configuration)
- [ ] Deploy/configure CCIP-Read resolver for `offchain.integration-tests.eth`
- [ ] Configure gateway URL in resolver to point to GitHub raw files
- [ ] Set up wildcard resolver on `integration-tests.eth`
- [ ] Identify DNS name with DNSSEC for testing

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
| `forward-eth-onchain` | Forward | Ready | `integration-tests.eth` | TBD |
| `forward-base-onchain` | Forward | Ready | `integration-tests.eth` | TBD |
| `forward-base-offchain` | Forward | Pending Setup | `offchain.integration-tests.eth` | `0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB` |
| `forward-text-avatar` | Forward | Ready | `integration-tests.eth` | TBD |
| `forward-text-url` | Forward | Ready | `integration-tests.eth` | TBD |
| `forward-text-description` | Forward | Ready | `integration-tests.eth` | TBD |
| `forward-contenthash` | Forward | Ready | `integration-tests.eth` | TBD |
| `reverse-eth-onchain` | Reverse | Ready | TBD | `integration-tests.eth` |
| `reverse-eth-offchain` | Reverse | Pending Setup | TBD | TBD |
| `reverse-l2-base` | Reverse | Pending Setup | TBD | TBD |
| `forward-wildcard` | Forward | Pending Setup | `*.integration-tests.eth` | TBD |
| `forward-dns` | Forward | Pending Setup | TBD | TBD |

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
1. Deploy or configure CCIP-Read resolver for `offchain.integration-tests.eth`
2. Set gateway URL to point to this repo's `gateway/` folder
3. Pre-compute calldata for each offchain test case
4. Create corresponding JSON files with ABI-encoded responses

---

## Questions to Resolve

1. **Gateway URL template**: What format does the resolver use? `{sender}/{data}` or custom?
2. **Wildcard resolver**: Is one already configured on `integration-tests.eth`?
3. **DNS name**: Which DNSSEC-enabled domain should we use?
4. **Expected values**: Need to populate test-cases.json with actual on-chain values

---

## Running Tests

```bash
# Install dependencies (workspace)
bun install

# Run all tests
bun test

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
