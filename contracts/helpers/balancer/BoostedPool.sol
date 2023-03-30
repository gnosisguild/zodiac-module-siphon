// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "../../lib/balancer/LinearMath.sol";
import "../../lib/balancer/FixedPoint.sol";

import "./LinearPool.sol";
import "./StablePhantomPool.sol";
import "./VaultQuery.sol";

library BoostedPoolHelper {
    using FixedPoint for uint256;

    function queryStableOutGivenStableIn(
        address pool,
        address tokenIn,
        uint256 amountIn,
        address tokenOut
    ) public returns (uint256) {
        address linearPoolLeft = findLinearPool(pool, tokenIn);
        address linearPoolRight = findLinearPool(pool, tokenOut);

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

    // Computing from LinearPoolLeft MainToken (e.g., a stable coint)
    // To -> LinearPoolLeft Bpt
    // To -> LinearPoolRight Bpt
    // To -> LinearPoolRight MainToken (e.g., another stable)
    function calcStableOutGivenStableIn(
        address pool,
        address tokenIn,
        uint256 amountIn,
        address tokenOut
    ) public view returns (uint256) {
        address linearPoolLeft = findLinearPool(pool, tokenIn);
        address linearPoolRight = findLinearPool(pool, tokenOut);

        // amountIn is mainToken of poolIn, i.e., its a stable coin
        // amoutOut is bpt of poolIn
        uint256 amountOut = LinearPoolHelper.calcBptOutGivenMainIn(
            linearPoolLeft,
            amountIn
        );

        // amountIn is bpt of poolIn
        // amoutOut is bpt of poolOut
        amountIn = amountOut;
        amountOut = StablePhantomPoolHelper.calcTokenOutGivenTokenIn(
            pool,
            linearPoolLeft,
            amountIn,
            linearPoolRight
        );

        // amountIn is bpt of poolOut
        // amoutOut is mainToken of poolOut, i.e., its a stable coin
        amountIn = amountOut;
        amountOut = LinearPoolHelper.calcMainOutGivenBptIn(
            linearPoolRight,
            amountIn
        );

        return amountOut;
    }

    // Computing from BoostedPool Bpt
    // To -> LinearPool Bpt
    // To -> LinearPool MainToken
    function queryStableOutGivenBptIn(
        address pool,
        uint256 amountIn,
        address tokenOut
    ) public returns (uint256) {
        address linearPool = findLinearPool(pool, tokenOut);
        return
            VaultQueryHelper.queryStableOutGivenBptIn(
                pool,
                amountIn,
                linearPool,
                tokenOut
            );
    }

    // Computing from BoostedPool Bpt
    // To -> LinearPool Bpt
    // To -> LinearPool MainToken
    function calcStableOutGivenBptIn(
        address pool,
        uint256 amountIn,
        address tokenOut
    ) public view returns (uint256) {
        address linearPool = findLinearPool(pool, tokenOut);

        // amountIn is boosted BPT
        // amountOut is linear BPT
        uint256 amountOut = StablePhantomPoolHelper.calcTokenOutGivenBptIn(
            pool,
            amountIn,
            linearPool
        );

        // amountIn is linear BPT
        // amountOut is linear MainToken, i.e., a stable coin
        amountIn = amountOut;
        amountOut = LinearPoolHelper.calcMainOutGivenBptIn(
            linearPool,
            amountIn
        );

        return amountOut;
    }

    function queryBptInGivenStableOut(
        address pool,
        address tokenOut,
        uint256 amountOut
    ) public returns (uint256) {
        address linearPool = findLinearPool(pool, tokenOut);
        return
            VaultQueryHelper.queryBptInGivenStableOut(
                pool,
                linearPool,
                tokenOut,
                amountOut
            );
    }

    function calcBptInGivenStableOut(
        address pool,
        address tokenOut,
        uint256 amountOut
    ) public view returns (uint256) {
        address linearPool = findLinearPool(pool, tokenOut);
        uint256 linearBptAmountIn = LinearPoolHelper.calcBptInGivenMainOut(
            linearPool,
            amountOut
        );

        tokenOut = linearPool;
        amountOut = linearBptAmountIn;

        return
            StablePhantomPoolHelper.calcBptInGivenTokenOut(
                pool,
                tokenOut,
                amountOut
            );
    }

    function calcPrices(address pool)
        public
        returns (address[] memory, uint256[] memory)
    {
        (address[] memory tokens, uint256[] memory balances) = nominalBalances(
            pool
        );

        uint256 min = 0;
        for (uint256 i = 1; i < balances.length; i++) {
            if (balances[i] < balances[min]) {
                min = i;
            }
        }

        uint256[] memory prices = new uint256[](balances.length);
        for (uint256 i = 0; i < prices.length; i++) {
            prices[i] = (i == min)
                ? FixedPoint.ONE
                : calcPrice(pool, tokens[min], tokens[i]);
        }

        return (tokens, prices);
    }

    function calcPrice(
        address pool,
        address stable1,
        address stable2
    ) public returns (uint256) {
        uint256 amountIn = 1000 * 10**ERC20(stable1).decimals();
        uint256 amountOut = queryStableOutGivenStableIn(
            pool,
            stable1,
            amountIn,
            stable2
        );

        return
            FixedPoint.divDown(
                Utils.inferAndUpscale(amountIn, stable1),
                Utils.inferAndUpscale(amountOut, stable2)
            );
    }

    function findLinearPools(address pool)
        public
        view
        returns (address[] memory linearPools, uint256[] memory linearBalances)
    {
        address vault = IPool(pool).getVault();
        bytes32 poolId = IPool(pool).getPoolId();
        (address[] memory tokens, uint256[] memory balances, ) = IVault(vault)
            .getPoolTokens(poolId);

        uint256 bptIndex = IStablePhantomPool(pool).getBptIndex();

        linearPools = new address[](tokens.length - 1);
        linearBalances = new uint256[](tokens.length - 1);
        for (uint256 i = 0; i < linearPools.length; i++) {
            uint256 j = i < bptIndex ? i : i + 1;
            linearPools[i] = tokens[j];
            linearBalances[i] = balances[j];
        }
    }

    function findLinearPool(address pool, address mainToken)
        public
        view
        returns (address)
    {
        (address[] memory linearPools, ) = findLinearPools(pool);
        for (uint256 i = 0; i < linearPools.length; i++) {
            if (ILinearPool(linearPools[i]).getMainToken() == mainToken) {
                return linearPools[i];
            }
        }

        revert("findLinearPool: Not found");
    }

    function nominalBalances(address _pool)
        internal
        view
        returns (address[] memory stables, uint256[] memory balances)
    {
        (
            address[] memory linearPools,
            uint256[] memory linearBalances
        ) = findLinearPools(_pool);

        stables = new address[](linearPools.length);
        balances = new uint256[](linearPools.length);
        for (uint256 i = 0; i < balances.length; i++) {
            stables[i] = ILinearPool(linearPools[i]).getMainToken();
            balances[i] = linearBalances[i].mulDown(
                ILinearPool(linearPools[i]).getRate()
            );
        }
    }

    function liquidStableBalance(address pool, address stable)
        public
        view
        returns (uint256)
    {
        address linearPool = findLinearPool(pool, stable);
        return LinearPoolHelper.liquidStableBalance(linearPool);
    }
}
