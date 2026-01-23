// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";
import {URTestResolver} from "../src/URTestResolver.sol";

// source .env
// forge script contracts/script/URTestResolver.s.sol:ResolverScript --chain sepolia --rpc-url http://localhost:8545 --broadcast --unlocked --sender ${DEPLOYER_ADDRESS}
//
// forge verify-contract --chain sepolia --etherscan-api-key "${ETHERSCAN_API_KEY}" --watch <contract-address> contracts/src/URTestResolver.sol:URTestResolver
contract ResolverScript is Script {
    URTestResolver public resolver;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        resolver = new URTestResolver{salt: 0}();

        vm.stopBroadcast();
    }
}
