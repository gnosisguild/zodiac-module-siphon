// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "../../lib/balancer/StableMath.sol";
import "../../lib/balancer/FixedPoint.sol";

import "./Interop.sol";
import "./Utils.sol";

library StablePhantomPoolHelper {
    using FixedPoint for uint256;

    function calcTokenOutGivenBptIn(
        address pool,
        uint256 bptAmountIn,
        address tokenOut
    ) external view returns (uint256) {
        (
            PoolTokens memory tokens,
            uint256 amplification,
            uint256 virtualSupply
        ) = query(pool);

        uint256 indexIn = IStablePhantomPool(pool).getBptIndex();
        uint256 indexOut = Utils.indexOf(tokens.addresses, tokenOut);

        uint256 indexBpt = indexIn;
        Utils.upscaleArray(tokens.balances, tokens.scalingFactors);

        uint256 amountIn = Utils.upscale(
            Utils.subtractSwapFee(pool, bptAmountIn),
            tokens.scalingFactors[indexIn]
        );
        uint256 amountOut = StableMath._calcTokenOutGivenExactBptIn(
            amplification,
            Utils.balancesWithoutBpt(tokens.balances, indexBpt),
            Utils.indexWithoutBpt(indexOut, indexBpt),
            amountIn,
            virtualSupply,
            0
        );

        return Utils.downscaleDown(amountOut, tokens.scalingFactors[indexOut]);
    }

    function calcTokenOutGivenTokenIn(
        address pool,
        address tokenIn,
        uint256 amountIn,
        address tokenOut
    ) external view returns (uint256) {
        (PoolTokens memory tokens, uint256 amplification, ) = query(pool);

        uint256 indexBpt = IStablePhantomPool(pool).getBptIndex();
        uint256 indexIn = Utils.indexOf(tokens.addresses, tokenIn);
        uint256 indexOut = Utils.indexOf(tokens.addresses, tokenOut);

        Utils.upscaleArray(tokens.balances, tokens.scalingFactors);

        uint256[] memory balancesWithoutBpt = Utils.balancesWithoutBpt(
            tokens.balances,
            indexBpt
        );

        amountIn = Utils.upscale(
            Utils.subtractSwapFee(pool, amountIn),
            tokens.scalingFactors[indexIn]
        );

        uint256 invariant = StableMath._calculateInvariant(
            amplification,
            balancesWithoutBpt,
            true
        );

        uint256 amountOut = StableMath._calcOutGivenIn(
            amplification,
            balancesWithoutBpt,
            Utils.indexWithoutBpt(indexIn, indexBpt),
            Utils.indexWithoutBpt(indexOut, indexBpt),
            amountIn,
            invariant
        );

        return Utils.downscaleDown(amountOut, tokens.scalingFactors[indexOut]);
    }

    function calcBptInGivenTokenOut(
        address pool,
        address tokenOut,
        uint256 amountOut
    ) external view returns (uint256) {
        (
            PoolTokens memory tokens,
            uint256 amplification,
            uint256 virtualSupply
        ) = query(pool);

        uint256 indexBpt = IStablePhantomPool(pool).getBptIndex();
        uint256 indexOut = Utils.indexOf(tokens.addresses, tokenOut);

        Utils.upscaleArray(tokens.balances, tokens.scalingFactors);

        amountOut = Utils.upscale(amountOut, tokens.scalingFactors[indexOut]);

        uint256[] memory balancesWithoutBpt = Utils.balancesWithoutBpt(
            tokens.balances,
            indexBpt
        );

        uint256[] memory amountsOutWithoutBpt = new uint256[](
            balancesWithoutBpt.length
        );
        amountsOutWithoutBpt[
            Utils.indexWithoutBpt(indexOut, indexBpt)
        ] = amountOut;

        uint256 amountIn = StableMath._calcBptInGivenExactTokensOut(
            amplification,
            balancesWithoutBpt,
            amountsOutWithoutBpt,
            virtualSupply,
            0
        );

        return
            Utils.addSwapFee(
                pool,
                Utils.downscaleUp(amountIn, tokens.scalingFactors[indexBpt])
            );
    }

    function query(address _pool)
        private
        view
        returns (
            PoolTokens memory tokens,
            uint256 amplification,
            uint256 virtualSupply
        )
    {
        IStablePhantomPool pool = IStablePhantomPool(_pool);
        tokens.scalingFactors = pool.getScalingFactors();
        (tokens.addresses, tokens.balances, ) = IVault(pool.getVault())
            .getPoolTokens(pool.getPoolId());
        (amplification, , ) = pool.getAmplificationParameter();
        virtualSupply = pool.getVirtualSupply();
    }

    struct PoolTokens {
        address[] addresses;
        uint256[] balances;
        uint256[] scalingFactors;
    }
}
