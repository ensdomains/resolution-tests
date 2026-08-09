# ENS Resolution Test Results

Generated: 2026-08-09T20:13:12.502Z

## Feature Support

| Test Case                  |  alloy   | ethers-v5 | viem-v3  | viem-v2  | ensjs-v4  | ensjs-v3 | ethers-v6 |  web3py  |
| -------------------------- | :------: | :-------: | :------: | :------: | :-------: | :------: | :-------: | :------: |
| universal-resolver         |    ✅    |    ❌     |    ✅    |    ✅    |    ✅     |    ❌    |    ✅     |    ✅    |
| forward-base-onchain       |    -     |    ❌     |    ✅    |    ✅    |    ✅     |    ✅    |    ✅     |    ✅    |
| forward-wildcard           |    ✅    |    ✅     |    ✅    |    ✅    |    ✅     |    ✅    |    ✅     |    ✅    |
| forward-eth-offchain       |    ❌    |    ✅     |    ✅    |    ✅    |    ✅     |    ✅    |    ✅     |    ✅    |
| forward-text-onchain       |    ✅    |    ✅     |    ✅    |    ✅    |    ✅     |    ✅    |    ✅     |    ✅    |
| forward-text-offchain      |    ❌    |    ✅     |    ✅    |    ✅    |    ✅     |    ✅    |    ✅     |    ✅    |
| forward-contenthash        |    -     |    ✅     |    -     |    -     |    ✅     |    ✅    |    ✅     |    -     |
| reverse-universal-resolver |    ❌    |    ❌     |    ✅    |    ✅    |    ✅     |    ❌    |    ✅     |    ✅    |
| reverse-eth                |    ✅    |    ✅     |    ✅    |    ✅    |    ✅     |    ✅    |    ✅     |    ✅    |
| reverse-l2                 |    -     |     -     |    ❌    |    ❌    |    ❌     |    -     |     -     |    -     |
| forward-dns-offchain       |    ❌    |    ✅     |    ✅    |    ❌    |    ✅     |    ✅    |    ✅     |    ❌    |
| **TOTAL**                  | **4/11** | **7/11**  | **9/11** | **8/11** | **10/11** | **8/11** | **10/11** | **8/11** |

### Legend

- ✅ Pass
- ❌ Fail
- `-` Not tested
