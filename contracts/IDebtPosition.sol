// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

import "./Transaction.sol";

interface IDebtPosition {
    function asset() external view returns (address);

    function ratio() external view returns (uint256);

    function delta() external view returns (uint256 amount);

    function needsRebalancing() external view returns (bool);

    function paymentInstructions(
        uint256 amount
    ) external view returns (Transaction[] memory);
}
