// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

contract MockVat {
    uint256 public ink = 96324918780519001386926;
    uint256 public art = 26751337541211281991216750;
    uint256 public rate = 1019360381237530060256253967;
    uint256 public spot = 737807466943343750000000000000;
    uint256 public line = 1600000000000000000000000000;
    uint256 public dust = 15000000000000000000000000000000000000000000000000;

    function urns(bytes32, address) external view returns (uint256, uint256) {
        return (ink, art);
    }

    function ilks(
        bytes32
    ) external view returns (uint256, uint256, uint256, uint256, uint256) {
        return (art, rate, spot, line, dust);
    }
}
