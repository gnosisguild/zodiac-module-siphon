// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

contract MockVat {
    uint256 public ink = 87398990121333090869862;
    uint256 public art = 46450108830247710576145828;
    uint256 public rate = 1018727698144989684458817824;
    uint256 public spot = 1012806401478718750000000000000;
    uint256 public line = 1600000000000000000000000000;
    uint256 public dust = 15000000000000000000000000000000000000000000000000;

    function urns(bytes32, address) external view returns (uint256, uint256) {
        return (ink, art);
    }

    function ilks(bytes32)
        external
        view
        returns (
            uint256,
            uint256,
            uint256,
            uint256,
            uint256
        )
    {
        return (art, rate, spot, line, dust);
    }
}
