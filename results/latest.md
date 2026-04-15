# ENS Resolution Test Results

## Feature Support

| Test Case                        | ethers-v5 |  viem-v2  | ethers-v6 |
| -------------------------------- | :-------: | :-------: | :-------: |
| universal-resolver               |    ❌     |    ✅     |    ❌     |
| forward-base-onchain             |    ❌     |    ✅     |    ✅     |
| forward-wildcard                 |    ✅     |    ✅     |    ✅     |
| forward-eth-offchain             |    ✅     |    ✅     |    ✅     |
| forward-eth-onchain-normalized   |    ✅     |    ✅     |    ✅     |
| forward-invalid-punycode-literal |    ❌     |    ✅     |    ✅     |
| forward-circled-normalized       |    ✅     |    ✅     |    ✅     |
| forward-text-onchain             |    ✅     |    ✅     |    ✅     |
| forward-text-offchain            |    ✅     |    ✅     |    ✅     |
| forward-contenthash              |    ✅     |     -     |    ✅     |
| reverse-eth                      |    ✅     |    ✅     |    ✅     |
| reverse-l2                       |     -     |    ✅     |     -     |
| reverse-falsy-primary-name       |    ✅     |    ✅     |    ✅     |
| forward-dns-offchain             |    ✅     |    ❌     |    ✅     |
| **TOTAL**                        | **11/14** | **12/14** | **12/14** |

### Legend

- ✅ Pass
- ❌ Fail
- `-` Not tested
