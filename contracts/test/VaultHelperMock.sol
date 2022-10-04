// SPDX-License-Identifier: LGPL-3.0-only
import "../helpers/balancer/VaultQuery.sol";

pragma solidity ^0.8.6;

contract VaultHelperMock {
    function queryStableOutGivenStableIn(
        address pool,
        address tokenIn,
        uint256 amountIn,
        address linearPoolLeft,
        address linearPoolRight,
        address tokenOut
    ) public returns (uint256) {
        return
            VaultQueryHelper.queryStableOutGivenStableIn(
                pool,
                tokenIn,
                amountIn,
                linearPoolLeft,
                linearPoolRight,
                tokenOut
            );
    }

    function queryStableOutGivenBptIn(
        address pool,
        uint256 amountIn,
        address linearPool,
        address tokenOut
    ) public returns (uint256) {
        return
            VaultQueryHelper.queryStableOutGivenBptIn(
                pool,
                amountIn,
                linearPool,
                tokenOut
            );
    }

    function queryBptInGivenStableOut(
        address pool,
        address linearPool,
        address tokenOut,
        uint256 amountOut
    ) public returns (uint256) {
        return
            VaultQueryHelper.queryBptInGivenStableOut(
                pool,
                linearPool,
                tokenOut,
                amountOut
            );
    }
}
