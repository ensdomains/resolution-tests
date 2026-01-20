# ENS Resolution Tests

## Project Overview

Comprehensive test suite for ENS name resolution across multiple programming languages and libraries. Tests validate forward resolution, reverse resolution, CCIP-Read (offchain), and various record types.

## Key Files

- `test-cases.json` - Single source of truth for all test cases
- `shared/` - Shared TypeScript types and helpers
- `plan.md` - Project roadmap and status tracking
- `scripts/run-tests.ts` - Discovers and runs all package tests
- `scripts/aggregate-results.ts` - Combines results into markdown/CSV

## Commands

```bash
bun install                 # Install all workspace dependencies
bun run test                # Run all tests (outputs feature table to results/latest.md)
bun run test:typescript     # Run TypeScript tests only
```

## Workspace Setup

This is a bun workspace monorepo. TypeScript packages in `packages/` are auto-discovered and share dependencies from root `node_modules/`.

## Adding TypeScript Tests

1. Create package in `packages/{library-version}/`
2. Add `package.json` with dependencies
3. Create `tsconfig.json` extending `../../tsconfig.base.json`
4. Import shared types: `import { getTestCasesByCategory } from "../../../shared"`
5. Output results to `results.json`

## Shared Helpers

```typescript
import {
  loadTestCases,           // Load all test cases
  getReadyTestCases,       // Get only "ready" status cases
  getTestCasesByCategory,  // Filter by "forward" or "reverse"
  type TestCase,
  type TestResult,
  type LibraryResults,
} from "../../../shared";
```

## Test Case Status

- `ready` - Test case is configured and can be run
- `pending-setup` - Needs contract/infrastructure configuration

## Environment

- `RPC_URL` - Required, Ethereum mainnet RPC endpoint
