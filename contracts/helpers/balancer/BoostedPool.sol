// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "../../lib/balancer/LinearMath.sol";
import "../../lib/balancer/FixedPoint.sol";

import "./LinearPool.sol";
import "./StablePhantomPool.sol";

library BoostedPool {
    using FixedPoint for uint256;

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
        uint256 amountOut = LinearPool.calcBptOutGivenMainIn(
            linearPoolLeft,
            amountIn
        );

        // amountIn is bpt of poolIn
        // amoutOut is bpt of poolOut
        amountIn = amountOut;
        amountOut = StablePhantomPool.calcTokenOutGivenTokenIn(
            pool,
            linearPoolLeft,
            amountIn,
            linearPoolRight
        );

        // amountIn is bpt of poolOut
        // amoutOut is mainToken of poolOut, i.e., its a stable coin
        amountIn = amountOut;
        amountOut = LinearPool.calcMainOutGivenBptIn(linearPoolRight, amountIn);

        return amountOut;
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
        uint256 amountOut = StablePhantomPool.calcTokenOutGivenBptIn(
            pool,
            amountIn,
            tokenOut
        );

        // amountIn is linear BPT
        // amountOut is linear MainToken, i.e., a stable coin
        amountIn = amountOut;
        amountOut = LinearPool.calcMainOutGivenBptIn(linearPool, amountIn);

        return amountOut;
    }

    function calcPrice(
        address pool,
        address stable1,
        address stable2
    ) public view returns (uint256) {
        uint256 amountIn = 1000 * 10**ERC20(stable1).decimals();
        uint256 amountOut = calcStableOutGivenStableIn(
            pool,
            stable1,
            amountIn,
            stable2
        );

        return Utils.price(stable1, amountIn, stable2, amountOut);
    }

    function calcPriceIndirect(
        address pool,
        address stable1,
        address stable2
    ) public view returns (uint256) {
        // simulate a tradew wth 1 basis point of supply
        uint256 feeler = IStablePhantomPool(pool).getVirtualSupply().divDown(
            10000
        );

        uint256 amountIn = feeler;
        uint256 amountOutInStable1 = calcStableOutGivenBptIn(
            pool,
            amountIn,
            stable1
        );

        uint256 amountOutInStable2 = calcStableOutGivenBptIn(
            pool,
            amountIn,
            stable2
        );

        return
            Utils.price(
                stable1,
                amountOutInStable1,
                stable2,
                amountOutInStable2
            );
    }

    function findLinearPool(address pool, address mainToken)
        internal
        view
        returns (address)
    {
        address vault = IPool(pool).getVault();
        bytes32 poolId = IPool(pool).getPoolId();
        (address[] memory tokens, , ) = IVault(vault).getPoolTokens(poolId);

        for (uint256 i = 0; i < tokens.length; i++) {
            if (ILinearPool(tokens[i]).getMainToken() == mainToken) {
                return tokens[i];
            }
        }

        revert("findLinearPool: Not found");
    }

    function findStableTokens(address pool)
        public
        view
        returns (
            address,
            address,
            address
        )
    {
        address vault = IPool(pool).getVault();
        bytes32 poolId = IPool(pool).getPoolId();
        (address[] memory tokens, , ) = IVault(vault).getPoolTokens(poolId);

        return (tokens[0], tokens[1], tokens[2]);
    }
}
