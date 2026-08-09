# ENS Resolution Test Results

Generated: 2026-08-09T19:59:42.768Z

## Summary

| Test Case                  | ethers-v5 | viem-v3 | viem-v2 | ensjs-v4 | ethers-v6 | web3py |
| -------------------------- | --------- | ------- | ------- | -------- | --------- | ------ |
| universal-resolver         | ❌        | ✅      | ✅      | ✅       | ✅        | ✅     |
| forward-base-onchain       | ❌        | ✅      | ✅      | ✅       | ✅        | ✅     |
| forward-wildcard           | ✅        | ✅      | ✅      | ✅       | ✅        | ✅     |
| forward-eth-offchain       | ✅        | ✅      | ✅      | ✅       | ✅        | ✅     |
| forward-text-onchain       | ✅        | ✅      | ✅      | ✅       | ✅        | ✅     |
| forward-text-offchain      | ✅        | ✅      | ✅      | ✅       | ✅        | ✅     |
| forward-contenthash        | ✅        | -       | -       | ✅       | ✅        | -      |
| reverse-universal-resolver | ❌        | ✅      | ✅      | ✅       | ✅        | ✅     |
| reverse-eth                | ✅        | ✅      | ✅      | ✅       | ✅        | ✅     |
| reverse-l2                 | -         | ❌      | ❌      | ❌       | -         | -      |
| forward-dns-offchain       | ✅        | ✅      | ❌      | ✅       | ✅        | ❌     |

### Legend

- ✅ Pass
- ❌ Fail
- `-` Not tested

## Detailed Results

### ethers-v5

Tested: 2026-08-09T19:53:44.492Z

**7/11 tests passed**

#### Failures

- **universal-resolver**: Expected 0x2222222222222222222222222222222222222222, got 0x1111111111111111111111111111111111111111
  - Actual: `0x1111111111111111111111111111111111111111`
- **forward-base-onchain**: unsupported coin type: 2147492101 (operation="getAddress(2147492101)", code=UNSUPPORTED_OPERATION, version=providers/5.8.0)
- **reverse-universal-resolver**: Expected ur-reverse.integration-tests.eth, got v1-reverse.integration-tests.eth
  - Actual: `v1-reverse.integration-tests.eth`

### viem-v3

Tested: 2026-08-09T19:53:56.009Z

**9/11 tests passed**

#### Failures

- **reverse-l2**: Expected coins.integration-tests.eth, got null

### viem-v2

Tested: 2026-08-09T19:54:00.550Z

**8/11 tests passed**

#### Failures

- **forward-dns-offchain**: Number "475411618940684652382658899876961866559843549903n" is not in safe integer range (-9007199254740991 to 9007199254740991)

Version: viem@2.48.11

- **reverse-l2**: Expected coins.integration-tests.eth, got null

### ensjs-v4

Tested: 2026-08-09T19:59:39.257Z

**10/11 tests passed**

#### Failures

- **reverse-l2**: Expected coins.integration-tests.eth, got null

### ethers-v6

Tested: 2026-08-09T19:54:09.095Z

**10/11 tests passed**

### web3py

Tested: 2026-08-09T19:40:37.616539+00:00

**8/11 tests passed**

#### Failures

- **forward-dns-offchain**: Invalid pointer in tuple at location 0 in payload
