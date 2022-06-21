// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

import "./Transaction.sol";

interface ILiquidityPosition {
    function asset() external view returns (address);

    function assetBalance() external view returns (uint256);

    function balance() external view returns (uint256);

    // still not sure about this name
    function isOpenForWithdrawals() external view returns (bool);

    function withdrawalInstructions(uint256 amount)
        external
        view
        returns (Transaction[] memory);
}
