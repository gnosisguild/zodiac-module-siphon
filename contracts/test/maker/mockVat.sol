// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

contract MockVat {
    uint256 public ink = 95480232009854541507183;
    uint256 public art = 34461532672219058025602831;
    uint256 public rate = 1018846417343871009162585355;
    uint256 public spot = 743518602213218875000000000000;
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
