// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";
import {URTestResolver} from "../src/URTestResolver.sol";

// source .env
// forge script contracts/script/URTestResolver.s.sol:ResolverScript --chain sepolia --rpc-url http://localhost:8545 --broadcast --unlocked --sender ${DEPLOYER_ADDRESS}
//
// forge verify-contract --chain sepolia --etherscan-api-key "${ETHERSCAN_API_KEY}" --watch <contract-address> \
//   --constructor-args $(cast abi-encode "constructor(address[])" "[<ENSV1Resolver>]") contracts/src/URTestResolver.sol:URTestResolver
//
// After deploying, point the test names at the new resolver:
//   ur.integration-tests.eth                      -> registry.setResolver(node, <resolver>)
//   <0x3AF5…Cbed>.addr.reverse (ur-reverse case)  -> registry.setResolver(node, <resolver>)
contract ResolverScript is Script {
    URTestResolver public resolver;

    function setUp() public {}

    /// @dev `ENSV1Resolver` from ensdomains/contracts-v2 `deployments/<network>/ENSV1Resolver.json`:
    /// the mirror resolver that `UniversalResolverV2` delegates unmigrated v1 names to.
    function ensV1Resolver() public view returns (address) {
        if (block.chainid == 1) return 0x394D8EB4a4fDF599384DeAb25F31d111d755c398;
        if (block.chainid == 11155111) return 0x322B7581cA210a69c6D0e0D7c88a7688D2789Cb0;
        return vm.envAddress("ENS_V1_RESOLVER");
    }

    function run() public {
        address[] memory trusted = new address[](1);
        trusted[0] = ensV1Resolver();

        vm.startBroadcast();

        resolver = new URTestResolver{salt: 0}(trusted);

        vm.stopBroadcast();
    }
}
