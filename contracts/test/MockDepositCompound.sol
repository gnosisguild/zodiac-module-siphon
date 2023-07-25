// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

interface DepositCompound {
    function calc_withdraw_one_coin(
        uint256 amount,
        int128 i
    ) external view returns (uint256);

    function curve() external view returns (address);

    function remove_liquidity_one_coin(
        uint256 amount,
        int128 i,
        uint256 minout,
        bool donateDust
    ) external;
}
