// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ENS as IENS} from "@ensdomains/registry/ENS.sol";
import {Multicallable} from "@ensdomains/resolvers/Multicallable.sol";
import {AddrResolver} from "@ensdomains/resolvers/profiles/AddrResolver.sol";
import {ContentHashResolver} from "@ensdomains/resolvers/profiles/ContentHashResolver.sol";
import {TextResolver} from "@ensdomains/resolvers/profiles/TextResolver.sol";
import {IUniversalResolver} from "@ensdomains/universalResolver/IUniversalResolver.sol";

interface IProxy {
    function implementation() external view returns (address);
}

/// @dev ENS resolver that only returns data when called via the Universal Resolver. Useful for integration testing.
contract URTestResolver is Multicallable, AddrResolver, ContentHashResolver, TextResolver {
    IENS public constant ENS = IENS(0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e);
    address public constant UNIVERSAL_RESOLVER = 0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe;

    function text(bytes32 node, string calldata key) external view override returns (string memory) {
        if (msg.sender != _ur()) {
            return "";
        }
        return versionable_texts[recordVersions[node]][node][key];
    }

    function contenthash(bytes32 node) external view override returns (bytes memory) {
        if (msg.sender != _ur()) {
            return new bytes(0);
        }
        return versionable_hashes[recordVersions[node]][node];
    }

    function addr(bytes32 node) public view override returns (address payable) {
        if (msg.sender != _ur()) {
            return payable(address(0));
        }
        return super.addr(node);
    }

    function addr(bytes32 node, uint256 coinType) public view override returns (bytes memory) {
        if (msg.sender != _ur()) {
            return new bytes(64);
        }
        return super.addr(node, coinType);
    }

    function supportsInterface(bytes4 interfaceID)
        public
        view
        override(Multicallable, AddrResolver, ContentHashResolver, TextResolver)
        returns (bool)
    {
        return super.supportsInterface(interfaceID);
    }

    /// @dev Does not support wrapped names.
    function isAuthorised(bytes32 node) internal view override returns (bool) {
        address owner = ENS.owner(node);
        return owner == msg.sender;
    }

    function _ur() internal view returns (address) {
        return IProxy(UNIVERSAL_RESOLVER).implementation();
    }
}
