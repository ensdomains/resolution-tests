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
- [x] `viem` v3.x
- [x] `ethers` v6.x
- [x] `ethers` v5.x
- [x] `@ensdomains/ensjs` v4.x
- [x] `@ensdomains/ensjs` v3.x
- [x] `thirdweb` v5.x

### Python

- [x] `web3.py`

### Rust

- [x] `alloy`

### Go

- [x] `go-ens` v4.x
- [x] `go-ens` v3.x

### Zig

- [x] `eth.zig`

### C#

- [x] `Nethereum`

### Outside Current Coverage

The following libraries and versions are not currently covered by this suite:

- `viem` v1.x
- `web3.js`
- `ens-py`
- `ethers-rs`

## Deployments

Custom resolvers are deployed to test specific resolution scenarios.

| Name               | Chain   | Address                                    | Notes |
| ------------------ | ------- | ------------------------------------------ | ----- |
| URTestResolver.sol | Mainnet | 0x1c7B2739AaA9ea0Fc79deB45e0Bb25A1fbb058df | pre-ENSv2 build: answers `0x1111…` through `UniversalResolverV2`, must be redeployed |
| URTestResolver.sol | Sepolia | 0x0887c5f652e81b8fb95359b04058a14b0fd0a9a9 | pre-ENSv2 build, same caveat |

### Redeploying `URTestResolver` for ENSv2

`UniversalResolverV2` does not call v1 resolvers itself: unmigrated `.eth` names are delegated to `ENSV1Resolver`
(`0x394D8EB4a4fDF599384DeAb25F31d111d755c398` on mainnet), which becomes the `msg.sender` the test resolver sees.
The resolver therefore takes a list of trusted mirror senders in its constructor; the deploy script fills it per chain.

```bash
source .env
# 1. deploy (any funded key)
forge script contracts/script/URTestResolver.s.sol:ResolverScript --chain mainnet --rpc-url "$RPC_URL" --broadcast --private-key "$PRIVATE_KEY"
# 2. point the test names at it (must be sent by the name owner, 0xeE9eeaAB0Bb7D9B969D701f6f8212609EDeA252E)
cast send 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e 'setResolver(bytes32,address)' $(cast namehash ur.integration-tests.eth) <resolver>
# 3. the reverse case: <0x3AF5CFc7C7f29Da9d7758339b8eaB6a78550Cbed>.addr.reverse, sent by 0x3AF5…Cbed
cast send 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e 'setResolver(bytes32,address)' $(cast namehash 3af5cfc7c7f29da9d7758339b8eab6a78550cbed.addr.reverse) <resolver>
```

Expected after the switch: `ur.integration-tests.eth` → `0x2222…` through the UR (and through ENSV1Resolver), `0x1111…` through
older UR deployments or a direct `addr()` call; `reverse(0x3AF5…Cbed)` → `ur-reverse.integration-tests.eth`.

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
bun run test:csharp
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
      "durationMs": 150
    }
  ]
}
```

## Operational Notes

- Test names use various `.eth` names owned by ENS DevRel team or known stable names
- The DevRel team Safe (`devrel.enslabs.eth`) has `coldwallet.ens.eth` as a recoverer
- Test data is designed to remain stable over time
