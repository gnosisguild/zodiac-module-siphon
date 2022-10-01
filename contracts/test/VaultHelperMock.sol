// SPDX-License-Identifier: LGPL-3.0-only
import "../helpers/balancer/Vault.sol";

pragma solidity ^0.8.6;

contract VaultHelperMock {
    function queryStableOutGivenStableIn(
        address pool,
        address tokenIn,
        uint256 amountIn,
        address tokenOut
    ) public returns (uint256) {
        return
            VaultHelper.queryStableOutGivenStableIn(
                pool,
                tokenIn,
                amountIn,
                tokenOut
            );
    }

    function queryStableOutGivenBptIn(
        address pool,
        uint256 amountIn,
        address tokenOut
    ) public returns (uint256) {
        return VaultHelper.queryStableOutGivenBptIn(pool, amountIn, tokenOut);
    }

    function queryBptInGivenStableOut(
        address pool,
        address tokenOut,
        uint256 amountOut
    ) public returns (uint256) {
        return VaultHelper.queryBptInGivenStableOut(pool, tokenOut, amountOut);
    }
}
