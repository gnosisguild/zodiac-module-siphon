// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

import "./Transaction.sol";

interface ILiquidityPosition {
    function asset() external view returns (address);

    function balance() external returns (uint256);

    function canWithdraw() external returns (bool);

    function withdrawalInstructions(uint256 amount)
        external
        returns (Transaction[] memory);
}
