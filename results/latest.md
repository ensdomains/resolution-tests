# ENS Resolution Test Results

Generated: 2026-08-09T20:05:43.827Z

## Feature Support

| Test Case                  | ethers-v5 | viem-v3  | viem-v2  | ensjs-v4  | ethers-v6 |  web3py  |
| -------------------------- | :-------: | :------: | :------: | :-------: | :-------: | :------: |
| universal-resolver         |    ❌     |    ✅    |    ✅    |    ✅     |    ✅     |    ✅    |
| forward-base-onchain       |    ❌     |    ✅    |    ✅    |    ✅     |    ✅     |    ✅    |
| forward-wildcard           |    ✅     |    ✅    |    ✅    |    ✅     |    ✅     |    ✅    |
| forward-eth-offchain       |    ✅     |    ✅    |    ✅    |    ✅     |    ✅     |    ✅    |
| forward-text-onchain       |    ✅     |    ✅    |    ✅    |    ✅     |    ✅     |    ✅    |
| forward-text-offchain      |    ✅     |    ✅    |    ✅    |    ✅     |    ✅     |    ✅    |
| forward-contenthash        |    ✅     |    -     |    -     |    ✅     |    ✅     |    -     |
| reverse-universal-resolver |    ❌     |    ✅    |    ✅    |    ✅     |    ✅     |    ✅    |
| reverse-eth                |    ✅     |    ✅    |    ✅    |    ✅     |    ✅     |    ✅    |
| reverse-l2                 |     -     |    ❌    |    ❌    |    ❌     |     -     |    -     |
| forward-dns-offchain       |    ✅     |    ✅    |    ❌    |    ✅     |    ✅     |    ❌    |
| **TOTAL**                  | **7/11**  | **9/11** | **8/11** | **10/11** | **10/11** | **8/11** |

### Legend

- ✅ Pass
- ❌ Fail
- `-` Not tested
