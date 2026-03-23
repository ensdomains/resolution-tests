# ENS Resolution Test Results

Generated: 2026-03-23T06:41:59.600Z

## Feature Support

| Test Case             | ethers-v5 | viem-v2 | ethers-v6 |
| --------------------- | :-------: | :-----: | :-------: |
| universal-resolver    |    ❌     |   ✅    |    ❌     |
| forward-base-onchain  |    ❌     |   ✅    |    ✅     |
| forward-eth-offchain  |    ✅     |   ✅    |    ✅     |
| forward-text-onchain  |    ✅     |   ✅    |    ✅     |
| forward-text-offchain |    ✅     |   ✅    |    ✅     |
| forward-contenthash   |    ✅     |   ❌    |    ✅     |
| reverse-eth           |    ✅     |   ✅    |    ✅     |
| reverse-l2            |    ❌     |   ✅    |    ❌     |
| forward-dns-offchain  |    ✅     |   ❌    |    ✅     |
| **TOTAL**             |  **6/9**  | **7/9** |  **7/9**  |

### Legend

- ✅ Pass
- ❌ Fail
- `-` Not tested
