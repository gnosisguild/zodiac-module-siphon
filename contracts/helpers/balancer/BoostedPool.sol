// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "../../lib/balancer/LinearMath.sol";
import "../../lib/balancer/FixedPoint.sol";

import "./LinearPool.sol";
import "./StablePhantomPool.sol";

library BoostedPoolHelper {
    using FixedPoint for uint256;

    function nominalValue(address pool) external view returns (uint256) {
        // TODO first balance is just naive
        // pending taking into account how much liquidity is in the LinearPool
        address[] memory linearPools = findLinearPools(pool);
        uint256 total;
        for (uint256 i = 0; i < linearPools.length; i++) {
            total += LinearPoolHelper.nominalValue(linearPools[i]);
        }

        return total;
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

    function calcMaxStableOut(address pool, address tokenOut)
        public
        view
        returns (uint256)
    {
        return LinearPoolHelper.calcMaxMainOut(findLinearPool(pool, tokenOut));
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

        uint256 price = FixedPoint.divDown(
            Utils.inferAndUpscale(amountIn, stable1),
            Utils.inferAndUpscale(amountOut, stable2)
        );

        return price;
    }

    function calcPriceIndirect(
        address pool,
        address stable1,
        address stable2
    ) public view returns (uint256) {
        // feeler is 1 basis point of the total supply
        uint256 feeler = IStablePhantomPool(pool).getVirtualSupply().divDown(
            FixedPoint.ONE * 10000
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

        uint256 price = FixedPoint.divDown(
            Utils.inferAndUpscale(amountOutInStable1, stable1),
            Utils.inferAndUpscale(amountOutInStable2, stable2)
        );

        return price;
    }

    function findLinearPools(address pool)
        public
        view
        returns (address[] memory)
    {
        address vault = IPool(pool).getVault();
        bytes32 poolId = IPool(pool).getPoolId();
        (address[] memory tokens, , ) = IVault(vault).getPoolTokens(poolId);

        uint256 bptIndex = IStablePhantomPool(pool).getBptIndex();

        address[] memory result = new address[](tokens.length - 1);
        for (uint256 i = 0; i < result.length; i++) {
            result[i] = tokens[i < bptIndex ? i : i + 1];
        }

        return result;
    }

    function findLinearPool(address pool, address mainToken)
        internal
        view
        returns (address)
    {
        address[] memory linearPools = findLinearPools(pool);
        for (uint256 i = 0; i < linearPools.length; i++) {
            if (ILinearPool(linearPools[i]).getMainToken() == mainToken) {
                return linearPools[i];
            }
        }

        revert("findLinearPool: Not found");
    }

    function findStableTokens(address pool)
        public
        view
        returns (address[] memory)
    {
        address[] memory result = findLinearPools(pool);
        for (uint256 i = 0; i < result.length; i++) {
            result[i] = ILinearPool(result[i]).getMainToken();
        }
        return result;
    }
}
