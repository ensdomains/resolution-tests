// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";

import {ERC1967Proxy} from "@oz-v5/proxy/ERC1967/ERC1967Proxy.sol";
import {ERC721Holder} from "@oz-v5/token/ERC721/utils/ERC721Holder.sol";
import {ENSRegistry, ENS} from "@ens/registry/ENSRegistry.sol";
import {BaseRegistrarImplementation} from "@ens/ethregistrar/BaseRegistrarImplementation.sol";
import {ReverseRegistrar} from "@ens/reverseRegistrar/ReverseRegistrar.sol";
import {GatewayProvider} from "@ens/ccipRead/GatewayProvider.sol";
import {UniversalResolver} from "@ens/universalResolver/UniversalResolver.sol";
import {NameCoder} from "@ens/utils/NameCoder.sol";
import {ENSIP19} from "@ens/utils/ENSIP19.sol";
import {IAddrResolver} from "@ens/resolvers/profiles/IAddrResolver.sol";
import {INameResolver} from "@ens/resolvers/profiles/INameResolver.sol";
import {DummyShapeshiftResolver} from "@ens/universalResolver/mocks/DummyShapeshiftResolver.sol";

import {URTestResolver} from "../src/URTestResolver.sol";

contract URTestResolverTest is Test {
    ENSRegistry registry;
    BaseRegistrarImplementation baseRegistrar;
    ReverseRegistrar reverseRegistrar;
    GatewayProvider batchGatewayProvider;
    UniversalResolver universalResolverImpl;
    UniversalResolver universalResolver = UniversalResolver(0x422484c2D51f92830bFB563fa5e172aa2D8B884b); // using fallback since no ERC1967Proxy is not IProxy
    DummyShapeshiftResolver ssResolver;
    URTestResolver testResolver;

    function setUp() external {
        registry = new ENSRegistry();
        baseRegistrar = new BaseRegistrarImplementation(registry, NameCoder.ETH_NODE);
        baseRegistrar.addController(address(this));
        reverseRegistrar = new ReverseRegistrar(registry);
        registry.setSubnodeOwner(bytes32(0), keccak256("eth"), address(baseRegistrar));
        registry.setSubnodeOwner(bytes32(0), keccak256("reverse"), address(this));
        registry.setSubnodeOwner(
            NameCoder.namehash(NameCoder.encode("reverse"), 0), keccak256("addr"), address(reverseRegistrar)
        );
        batchGatewayProvider = new GatewayProvider(address(this), new string[](0));
        universalResolverImpl = new UniversalResolver(address(this), registry, batchGatewayProvider);
        vm.etch(address(universalResolver), type(ERC1967Proxy).runtimeCode);
        vm.store(
            address(universalResolver),
            bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1),
            bytes32(uint256(uint160(address(universalResolverImpl))))
        );
        testResolver = new URTestResolver();
        ssResolver = new DummyShapeshiftResolver();
        vm.warp(100 days); // avoid timestamp issues
    }

    function test_forward_good() external {
        (bytes memory name, bytes32 node) = _register("test");
        registry.setResolver(node, address(testResolver));

        (bytes memory response, address resolver) =
            universalResolver.resolve(name, abi.encodeCall(IAddrResolver.addr, (node)));
        assertEq(abi.decode(response, (address)), address(0x2222222222222222222222222222222222222222));
        assertEq(resolver, address(testResolver));
    }

    function test_forward_bad() external {
        (bytes memory name, bytes32 node) = _register("test");
        registry.setResolver(node, address(testResolver));

        (bytes memory response, address resolver) =
            universalResolverImpl.resolve(name, abi.encodeCall(IAddrResolver.addr, (node)));
        assertEq(abi.decode(response, (address)), address(0x1111111111111111111111111111111111111111));
        assertEq(resolver, address(testResolver));
    }

    function test_reverse_good() external {
        (, bytes32 node) = _register("integration-tests");
        bytes32 labelHash = keccak256("ur-reverse");
        registry.setSubnodeRecord(node, labelHash, address(this), address(ssResolver), 0);
        ssResolver.setResponse(
            abi.encodeCall(IAddrResolver.addr, (NameCoder.namehash(node, labelHash))), abi.encode(address(this))
        );
        reverseRegistrar.claimWithResolver(address(this), address(testResolver));

        (string memory primary, address addrResolver, address nameResolver) =
            universalResolver.reverse(abi.encodePacked(address(this)), 60);
        assertEq(primary, "ur-reverse.integration-tests.eth");
        assertEq(addrResolver, address(ssResolver));
        assertEq(nameResolver, address(testResolver));
    }

    function test_reverse_bad() external {
        (, bytes32 node) = _register("integration-tests");
        bytes32 labelHash = keccak256("v1-reverse");
        registry.setSubnodeRecord(node, labelHash, address(this), address(ssResolver), 0);
        ssResolver.setResponse(
            abi.encodeCall(IAddrResolver.addr, (NameCoder.namehash(node, labelHash))), abi.encode(address(this))
        );
        reverseRegistrar.claimWithResolver(address(this), address(testResolver));

        (string memory primary, address addrResolver, address nameResolver) =
            universalResolverImpl.reverse(abi.encodePacked(address(this)), 60);
        assertEq(primary, "v1-reverse.integration-tests.eth");
        assertEq(addrResolver, address(ssResolver));
        assertEq(nameResolver, address(testResolver));
    }

    function _register(string memory label) public returns (bytes memory name, bytes32 node) {
        name = NameCoder.ethName(label);
        node = NameCoder.namehash(name, 0);
        baseRegistrar.register(uint256(keccak256(bytes(label))), address(this), 365 days);
    }
}
