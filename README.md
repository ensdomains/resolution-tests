# ENS Resolution Tests

> [!WARNING]
> This repository is not yet ready for use. It is a work in progress.

This repository provides a stable, reproducible set of test cases for validating ENS resolution implementations. Library maintainers and integrators can use these tests to ensure their ENS support is complete and correct.

> **Note:** These resolution tests are specifically for testing usage of the Universal Resolver for ENS V2 readiness.

## Test Cases

See [test-cases.json](test-cases.json) for full details and expected values. It tests various resolution scenarios including:

- Forward onchain resolution (address, text, contenthash)
- Forward offchain resolution (CCIP-Read)
- Reverse resolution (L1 and L2)
- Support for all valid name types (.eth, DNS, Unicode, etc.)

## Library Coverage

Any library and app can use the above tests. For organization, we also run the tests and report coverage for the following libraries.

### TypeScript

- [x] `viem` v2.x
- [ ] `viem` v1.x
- [x] `ethers` v6.x
- [x] `ethers` v5.x
- [ ] `@ensdomains/ensjs` v3.x
- [ ] `web3.js` v4.x

### Python

- [ ] `web3.py`
- [ ] `ens-py`

### Rust

- [ ] `alloy`
- [ ] `ethers-rs`

### Go

- [ ] `go-ens`

## Local Development

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
```

After tests complete, a feature support table is displayed showing pass/fail status for each test case across all libraries. Results are automatically saved to `results/latest.md`.

### Adding a New TypeScript Library

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
    }
  ]
}
```

## Operational Notes

- Test names use various `.eth` names owned by ENS DevRel team or known stable names
- The DevRel team Safe (`devrel.enslabs.eth`) has `coldwallet.ens.eth` as a recoverer
- Test data is designed to remain stable over time
