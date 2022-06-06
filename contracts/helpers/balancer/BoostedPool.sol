// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "../../lib/balancer/LinearMath.sol";
import "../../lib/balancer/FixedPoint.sol";

import "./LinearPool.sol";
import "./StablePhantomPool.sol";

library BoostedPoolHelper {
    using FixedPoint for uint256;

    // Computing from LinearPoolLeft MainToken (e.g., a stable coint)
    // To -> LinearPoolLeft Bpt
    // To -> LinearPoolRight Bpt
    // To -> LinearPoolRight MainToken (e.g., another stable)

    function calcMainOutGivenMainIn(
        address boostedPool,
        address tokenIn,
        uint256 amountIn,
        address tokenOut
    ) public view returns (uint256) {
        address linearPoolLeft = findLinearBytItsMain(boostedPool, tokenIn);
        address linearPoolRight = findLinearBytItsMain(boostedPool, tokenOut);

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
            boostedPool,
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
    function calcMainOutGivenBptIn(
        address boostedPool,
        uint256 amountIn,
        address tokenOut
    ) public view returns (uint256) {
        address linearPool = findLinearBytItsMain(boostedPool, tokenOut);

        // amountIn is boosted BPT
        // amountOut is linear BPT
        uint256 amountOut = StablePhantomPool.calcTokenOutGivenBptIn(
            boostedPool,
            amountIn,
            tokenOut
        );

        // amountIn is linear BPT
        // amountOut is linear MainToken, i.e., a stable coin
        amountIn = amountOut;
        amountOut = LinearPool.calcMainOutGivenBptIn(linearPool, amountIn);

        return amountOut;
    }

    function findLinearBytItsMain(address pool, address mainToken)
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

        revert("findLinearBytItsMain: Not found");
    }
}
