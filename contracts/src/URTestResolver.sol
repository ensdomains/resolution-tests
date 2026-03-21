// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IExtendedResolver} from "@ens/resolvers/profiles/IExtendedResolver.sol";
import {IAddressResolver} from "@ens/resolvers/profiles/IAddressResolver.sol";
import {IAddrResolver} from "@ens/resolvers/profiles/IAddrResolver.sol";
import {ITextResolver} from "@ens/resolvers/profiles/ITextResolver.sol";
import {ENSIP19, COIN_TYPE_ETH} from "@ens/utils/ENSIP19.sol";

interface IProxy {
    function implementation() external view returns (address);
}

/// @dev ENS resolver that returns different values if it's called from the Universal Resolver for integration testing.
contract URTestResolver is IExtendedResolver, IAddressResolver, IAddrResolver, ITextResolver {
    error UnsupportedResolverProfile(bytes4);

    address public immutable UR;

    constructor(address ur) {
        UR = ur;
    }

    function supportsInterface(bytes4 interfaceId) external view returns (bool) {
        return msg.sender == IProxy(UR).implementation()
            ? interfaceId == type(IExtendedResolver).interfaceId
            : (interfaceId == type(IAddressResolver).interfaceId || interfaceId == type(IAddrResolver).interfaceId
                    || interfaceId == type(ITextResolver).interfaceId);
    }

    function addr(bytes32) external pure returns (address payable) {
        return payable(_addr(false));
    }

    function addr(bytes32, uint256 coinType) external pure returns (bytes memory) {
        return _addr(coinType, false);
    }

    function text(bytes32, string calldata key) external pure returns (string memory) {
        return _text(key, false);
    }

    function resolve(bytes calldata, bytes calldata data) external pure returns (bytes memory) {
        if (bytes4(data) == IAddrResolver.addr.selector) {
            return abi.encode(_addr(true));
        } else if (bytes4(data) == IAddressResolver.addr.selector) {
            (, uint256 coinType) = abi.decode(data[4:], (bytes32, uint256));
            return abi.encode(_addr(coinType, true));
        } else if (bytes4(data) == ITextResolver.text.selector) {
            (, string memory key) = abi.decode(data[4:], (bytes32, string));
            return abi.encode(_text(key, true));
        } else {
            revert UnsupportedResolverProfile(bytes4(data));
        }
    }

    function _text(string memory key, bool ok) internal pure returns (string memory) {
        if (keccak256(bytes(key)) == keccak256(bytes("description"))) {
            return ok ? unicode"✅️ Universal Resolver" : unicode"❌️ Universal Resolver";
        } else {
            return "";
        }
    }

    function _addr(bool ok) internal pure returns (address) {
        return address(bytes20(_addr(COIN_TYPE_ETH, ok)));
    }

    function _addr(uint256 coinType, bool ok) internal pure returns (bytes memory) {
        if (ENSIP19.isEVMCoinType(coinType)) {
            return abi.encodePacked(
                ok ? 0x2222222222222222222222222222222222222222 : 0x1111111111111111111111111111111111111111
            );
        } else {
            return "";
        }
    }
}
