# ENS Resolution Test Results

Generated: 2026-04-09T18:40:57.000Z

## Feature Support

| Test Case             | ethers-v5 | viem-v2  | ethers-v6 |
| --------------------- | :-------: | :------: | :-------: |
| universal-resolver    |    ❌     |    ✅    |    ❌     |
| forward-base-onchain  |    ❌     |    ✅    |    ✅     |
| forward-wildcard      |    ✅     |    ✅    |    ✅     |
| forward-eth-offchain  |    ✅     |    ✅    |    ✅     |
| forward-text-onchain  |    ✅     |    ✅    |    ✅     |
| forward-text-offchain |    ✅     |    ✅    |    ✅     |
| forward-contenthash   |    ✅     |    -     |    ✅     |
| reverse-eth           |    ✅     |    ✅    |    ✅     |
| reverse-l2            |     -     |    ✅    |     -     |
| forward-dns-offchain  |    ✅     |    ❌    |    ✅     |
| **TOTAL**             | **7/10**  | **8/10** | **8/10**  |

### Legend

- ✅ Pass
- ❌ Fail
- `-` Not tested
