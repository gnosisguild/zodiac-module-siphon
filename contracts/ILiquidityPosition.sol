// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

interface ILiquidityPosition {
    function asset() external view returns (address);

    function balance() external view returns (uint256);

    function isWithdrawalEnabled() external view returns (bool);

    function withdrawalInstructions(uint256 amount)
        external
        view
        returns (
            address,
            uint256,
            bytes memory
        );
}
