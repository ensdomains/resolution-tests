# ENS Resolution Test Results

Generated: 2026-06-02T16:43:06.108Z

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
| forward-dns-offchain  |    ✅     |    ❌    |    ✅     |
| reverse-eth-offchain  |    ❌     |    ✅    |    ❌     |
| **TOTAL**             | **7/10**  | **8/10** | **8/10**  |

### Legend

- ✅ Pass
- ❌ Fail
- `-` Not tested
