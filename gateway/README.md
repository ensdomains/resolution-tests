# CCIP-Read Static Gateway

This folder contains static JSON files that serve as responses for CCIP-Read (EIP-3668) offchain lookups.

## How It Works

1. The CCIP-Read resolver contract for `offchain.integration-tests.eth` is configured with a gateway URL pointing to this folder on GitHub's raw CDN
2. When a client queries an offchain name, the contract reverts with `OffchainLookup`
3. The client fetches the response from the static JSON file
4. The client calls back to the contract with the response data

## URL Template

The resolver should be configured with a gateway URL like:

```
https://raw.githubusercontent.com/{org}/resolution-tests/main/gateway/{sender}/{data}.json
```

Replace `{org}` with the GitHub organization/user.

## File Format

Each response file contains a single JSON object:

```json
{"data": "0x...abi-encoded-response..."}
```

## Adding New Responses

1. Determine the calldata that will be sent to the gateway
2. ABI-encode the expected response
3. Create a JSON file at the appropriate path
4. Update `test-cases.json` with the test case details

## Pending Setup

- [ ] Deploy/configure CCIP-Read resolver for `offchain.integration-tests.eth`
- [ ] Set gateway URL in resolver contract
- [ ] Generate calldata file names for each offchain test case
- [ ] Create response JSON files with ABI-encoded data
