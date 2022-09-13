// SPDX-License-Identifier: 0BSD
pragma solidity ^0.8.17;

bytes4 constant ERC1271_MAGIC_VALUE = 0x1626ba7e;

interface IERC1271 {
    function isValidSignature(
        bytes32 hash,
        bytes calldata signature
    ) external view returns (bytes4 magicValue);
}
