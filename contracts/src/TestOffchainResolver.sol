// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TestOffchainResolver {
    // https://github.com/ensdomains/docs/blob/master/functions/api/example/basic-gateway.ts
    string public constant url = "https://resolution-tests.docs-bao.pages.dev/api/example/basic-gateway";

    error OffchainLookup(address sender, string[] urls, bytes callData, bytes4 callbackFunction, bytes extraData);

    function addr(bytes32 node) external view returns (address) {
        bytes memory callData = abi.encodeWithSelector(bytes4(0x3b3b57de), node);

        string[] memory urls = new string[](1);
        urls[0] = url;

        revert OffchainLookup(
            address(this),
            urls,
            callData,
            TestOffchainResolver.addr1Callback.selector,
            abi.encode(callData, address(this))
        );
    }

    function addr1Callback(bytes calldata response, bytes calldata) external pure returns (address) {
        address _addr = abi.decode(response, (address));
        return _addr;
    }

    function addr(bytes32 node, uint256 coinType) external view returns (bytes memory) {
        bytes memory callData = abi.encodeWithSelector(bytes4(0xf1cb7e06), node, coinType);

        string[] memory urls = new string[](1);
        urls[0] = url;

        revert OffchainLookup(
            address(this),
            urls,
            callData,
            TestOffchainResolver.addr2Callback.selector,
            abi.encode(callData, address(this))
        );
    }

    function addr2Callback(bytes calldata response, bytes calldata) external pure returns (bytes memory) {
        return response;
    }

    function supportsInterface(bytes4 interfaceID) external pure returns (bool) {
        return interfaceID == TestOffchainResolver.supportsInterface.selector || interfaceID == bytes4(0x3b3b57de)
            || interfaceID == bytes4(0xf1cb7e06);
    }
}
