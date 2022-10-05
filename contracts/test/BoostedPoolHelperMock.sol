// SPDX-License-Identifier: LGPL-3.0-only
import "../helpers/balancer/BoostedPool.sol";

pragma solidity ^0.8.6;

contract BoostedPoolHelperMock {
    function queryStableOutGivenStableIn(
        address pool,
        address tokenIn,
        uint256 amountIn,
        address tokenOut
    ) public returns (uint256) {
        return
            BoostedPoolHelper.queryStableOutGivenStableIn(
                pool,
                tokenIn,
                amountIn,
                tokenOut
            );
    }

    function calcStableOutGivenStableIn(
        address pool,
        address tokenIn,
        uint256 amountIn,
        address tokenOut
    ) public view returns (uint256) {
        return
            BoostedPoolHelper.calcStableOutGivenStableIn(
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
        return
            BoostedPoolHelper.queryStableOutGivenBptIn(
                pool,
                amountIn,
                tokenOut
            );
    }

    function calcStableOutGivenBptIn(
        address pool,
        uint256 amountIn,
        address tokenOut
    ) public view returns (uint256) {
        return
            BoostedPoolHelper.calcStableOutGivenBptIn(pool, amountIn, tokenOut);
    }

    function queryBptInGivenStableOut(
        address pool,
        address tokenOut,
        uint256 amountOut
    ) public returns (uint256) {
        return
            BoostedPoolHelper.queryBptInGivenStableOut(
                pool,
                tokenOut,
                amountOut
            );
    }

    function calcBptInGivenStableOut(
        address pool,
        address tokenOut,
        uint256 amountOut
    ) public view returns (uint256) {
        return
            BoostedPoolHelper.calcBptInGivenStableOut(
                pool,
                tokenOut,
                amountOut
            );
    }

    function calcPrices(address pool)
        public
        returns (address[] memory, uint256[] memory)
    {
        return BoostedPoolHelper.calcPrices(pool);
    }

    function nominals(address pool)
        public
        view
        returns (address[] memory, uint256[] memory)
    {
        return BoostedPoolHelper.nominalBalances(pool);
    }

    function findLinearPool(address pool, address mainToken)
        public
        view
        returns (address)
    {
        return BoostedPoolHelper.findLinearPool(pool, mainToken);
    }

    function liquidStableBalance(address pool, address tokenOut)
        public
        view
        returns (uint256)
    {
        return BoostedPoolHelper.liquidStableBalance(pool, tokenOut);
    }
}
