// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";
import {TestOffchainResolver} from "../src/TestOffchainResolver.sol";

// source .env
// forge script contracts/script/TestOffchainResolver.s.sol:TestOffchainResolverScript --chain sepolia --rpc-url http://localhost:8545 --broadcast --unlocked --sender ${DEPLOYER_ADDRESS}
//
// forge verify-contract --chain sepolia --etherscan-api-key "${ETHERSCAN_API_KEY}" --watch <contract-address> contracts/src/TestOffchainResolver.sol:TestOffchainResolver
contract TestOffchainResolverScript is Script {
    TestOffchainResolver public resolver;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        resolver = new TestOffchainResolver{salt: 0}();

        vm.stopBroadcast();
    }
}
