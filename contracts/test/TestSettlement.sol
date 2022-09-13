// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import { ICoWSwapSettlement } from "../interfaces/ICoWSwapSettlement.sol";

contract TestSettlement is ICoWSwapSettlement {
    function domainSeparator() external pure returns (bytes32) {
        return bytes32(uint256(42));
    }

    function vaultRelayer() external pure returns (address) {
        return address(uint160(0x1337));
    }
}
