// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "../../lib/balancer/StableMath.sol";
import "../../lib/balancer/FixedPoint.sol";

import "./Interop.sol";
import "./Utils.sol";

library StablePoolHelper {
    using FixedPoint for uint256;

    function nominalValue(address pool) external pure returns (uint256) {
        return 0;
    }

    function calcPrice(
        address pool,
        address token1,
        address token2
    ) public view returns (uint256) {
        // feeler, 1000 USD
        uint256 amountIn = 1000 * 10**ERC20(token1).decimals();
        uint256 amountOut = calcTokenOutGivenTokenIn(
            pool,
            token1,
            amountIn,
            token2
        );

        uint256 price = FixedPoint.divDown(
            Utils.inferAndUpscale(amountOut, token2),
            Utils.inferAndUpscale(amountIn, token1)
        );

        return price;
    }

    function calcTokenOutGivenBptIn(
        address pool,
        uint256 bptAmountIn,
        address tokenOut
    ) public view returns (uint256) {
        (PoolTokens memory tokens, uint256 amplification) = query(pool);

        uint256 indexTokenOut = Utils.indexOf(tokens.addresses, tokenOut);
        Utils.upscaleArray(tokens.balances, tokens.scalingFactors);

        uint256 amountOut = StableMath._calcTokenOutGivenExactBptIn(
            amplification,
            tokens.balances,
            indexTokenOut,
            bptAmountIn,
            IPool(pool).totalSupply(),
            IPool(pool).getSwapFeePercentage()
        );

        return
            Utils.downscaleDown(
                amountOut,
                tokens.scalingFactors[indexTokenOut]
            );
    }

    function calcTokenOutGivenTokenIn(
        address pool,
        address tokenIn,
        uint256 amountIn,
        address tokenOut
    ) public view returns (uint256) {
        (PoolTokens memory tokens, uint256 amplification) = query(pool);

        uint256 indexIn = Utils.indexOf(tokens.addresses, tokenIn);
        uint256 indexOut = Utils.indexOf(tokens.addresses, tokenOut);

        Utils.upscaleArray(tokens.balances, tokens.scalingFactors);

        amountIn = Utils.upscale(
            Utils.subtractSwapFee(pool, amountIn),
            tokens.scalingFactors[indexIn]
        );

        uint256 invariant = StableMath._calculateInvariant(
            amplification,
            tokens.balances,
            true
        );

        uint256 amountOut = StableMath._calcOutGivenIn(
            amplification,
            tokens.balances,
            indexIn,
            indexOut,
            amountIn,
            invariant
        );

        return Utils.downscaleDown(amountOut, tokens.scalingFactors[indexOut]);
    }

    function calcBptInGivenTokenOut(
        address pool,
        address tokenOut,
        uint256 amountOut
    ) public view returns (uint256) {
        (PoolTokens memory tokens, uint256 amplification) = query(pool);
        uint256 indexTokenOut = Utils.indexOf(tokens.addresses, tokenOut);

        Utils.upscaleArray(tokens.balances, tokens.scalingFactors);

        uint256[] memory amountsOut = new uint256[](tokens.addresses.length);
        amountsOut[indexTokenOut] = amountOut = Utils.upscale(
            amountOut,
            tokens.scalingFactors[indexTokenOut]
        );

        uint256 amountIn = StableMath._calcBptInGivenExactTokensOut(
            amplification,
            tokens.balances,
            amountsOut,
            IPool(pool).totalSupply(),
            IPool(pool).getSwapFeePercentage()
        );

        return amountIn;
    }

    function query(address _pool)
        private
        view
        returns (PoolTokens memory tokens, uint256 amplification)
    {
        IStablePool pool = IStablePool(_pool);
        (tokens.addresses, tokens.balances, ) = IVault(pool.getVault())
            .getPoolTokens(pool.getPoolId());

        tokens.scalingFactors = new uint256[](tokens.addresses.length);
        for (uint256 i = 0; i < tokens.addresses.length; i++) {
            tokens.scalingFactors[i] = Utils.calcScalingFactor(
                tokens.addresses[i]
            );
        }

        (amplification, , ) = pool.getAmplificationParameter();
    }

    struct PoolTokens {
        address[] addresses;
        uint256[] balances;
        uint256[] scalingFactors;
    }
}
