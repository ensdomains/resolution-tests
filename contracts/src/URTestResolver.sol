// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IExtendedResolver} from "@ens/resolvers/profiles/IExtendedResolver.sol";
import {IAddressResolver} from "@ens/resolvers/profiles/IAddressResolver.sol";
import {IAddrResolver} from "@ens/resolvers/profiles/IAddrResolver.sol";
import {INameResolver} from "@ens/resolvers/profiles/INameResolver.sol";
import {ITextResolver} from "@ens/resolvers/profiles/ITextResolver.sol";
import {IContentHashResolver} from "@ens/resolvers/profiles/IContentHashResolver.sol";
import {ENSIP19, COIN_TYPE_ETH} from "@ens/utils/ENSIP19.sol";

interface IProxy {
    function implementation() external view returns (address);
}

/// @dev ENS resolver that returns different values if it's called from the Universal Resolver for integration testing.
contract URTestResolver is IExtendedResolver, IAddressResolver, IAddrResolver, ITextResolver, IContentHashResolver {
    error UnsupportedResolverProfile(bytes4);

    address public constant UNIVERSAL_RESOLVER = 0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe;
    address public constant FALLBACK_RESOLVER = 0x422484c2D51f92830bFB563fa5e172aa2D8B884b;

    function supportsInterface(bytes4 interfaceId) external view returns (bool) {
        return isV2(msg.sender)
            ? interfaceId == type(IExtendedResolver).interfaceId
            : (interfaceId == type(IAddressResolver).interfaceId
                    || interfaceId == type(IAddrResolver).interfaceId
                    || interfaceId == type(ITextResolver).interfaceId
                    || interfaceId == type(IContentHashResolver).interfaceId);
    }

    function addr(bytes32) external pure returns (address payable) {
        return payable(_addr(false));
    }

    function addr(bytes32, uint256 coinType) external pure returns (bytes memory) {
        return _addr(coinType, false);
    }

    function name(bytes32) external pure returns (string memory) {
        return _name(false);
    }

    function text(bytes32, string calldata key) external pure returns (string memory) {
        return _text(key, false);
    }

    function contenthash(bytes32) external pure returns (bytes memory) {
        return _contenthash(false);
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
        } else if (bytes4(data) == IContentHashResolver.contenthash.selector) {
            return abi.encode(_contenthash(true));
        } else if (bytes4(data) == INameResolver.name.selector) {
            return abi.encode(_name(true));
        } else {
            revert UnsupportedResolverProfile(bytes4(data));
        }
    }

    function isV2(address sender) public view returns (bool) {
        if (sender == FALLBACK_RESOLVER) {
            return true;
        }
        address impl = UNIVERSAL_RESOLVER;
        for (; ; ) {
            try IProxy(impl).implementation() returns (address a) {
                if (a == sender) {
                    return true;
                }
                impl = a;
            } catch {
                break;
            }
        }
        return false;
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

    function _contenthash(bool ok) internal pure returns (bytes memory) {
        // IPFS CID: bafybeifx7yeb55armcsxwwitkymga5xf53dxiarykms3ygqic223w5sk3m
        bytes memory cid = hex"e30101701220b7fe081ef41160a57b591356186076e5eec77402385325bc1a0816b5bb764adb";
        return ok ? cid : bytes("");
    }

    function _name(bool ok) internal pure returns (string memory) {
        return ok ? "reverse2.integration-tests.eth" : "reverse1.integration-tests.eth";
    }
}
