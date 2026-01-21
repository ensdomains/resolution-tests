// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";
import {URTestResolver} from "../src/URTestResolver.sol";

contract ResolverScript is Script {
    URTestResolver public resolver;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        resolver = new URTestResolver{salt: 0}();

        vm.stopBroadcast();
    }
}
