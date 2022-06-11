// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

contract MockSpot {
    uint256 public mat = 1600000000000000000000000000;

    // unused variables
    address public pip = address(0xbaddad);

    function ilks(bytes32) external view returns (address, uint256) {
        return (pip, mat);
    }
}
