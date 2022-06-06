// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "../../lib/balancer/StableMath.sol";
import "../../lib/balancer/FixedPoint.sol";

import "./Interop.sol";
import "./Utils.sol";

library StablePhantomPool {
    using FixedPoint for uint256;

    function calcTokenOutGivenBptIn(
        address pool,
        uint256 bptAmountIn,
        address tokenOut
    ) public view returns (uint256) {
        (
            PoolTokens memory tokens,
            uint256 amplification,
            uint256 virtualSupply
        ) = query(pool);

        uint256 indexIn = IStablePhantomPool(pool).getBptIndex();
        uint256 indexOut = Utils.indexOf(tokens.addresses, tokenOut);

        uint256 indexBpt = indexIn;
        Utils.upscaleArray(tokens.balances, tokens.scalingFactors);

        uint256 amountIn = Utils.upscaleAmount(
            Utils.subtractSwapFee(pool, bptAmountIn),
            tokens.scalingFactors[indexIn]
        );
        uint256 amountOut = StableMath._calcTokenOutGivenExactBptIn(
            amplification,
            Utils.balancesWithoutBpt(tokens.balances, indexBpt),
            Utils.tokenIndexWithoutBpt(indexOut, indexBpt),
            amountIn,
            virtualSupply,
            0
        );

        return
            Utils.downscaleDownAmount(
                amountOut,
                tokens.scalingFactors[indexOut]
            );
    }

    function calcTokenOutGivenTokenIn(
        address pool,
        address tokenIn,
        uint256 amountIn,
        address tokenOut
    ) public view returns (uint256) {
        (PoolTokens memory tokens, uint256 amplification, ) = query(pool);

        uint256 indexBpt = IStablePhantomPool(pool).getBptIndex();
        uint256 indexIn = Utils.indexOf(tokens.addresses, tokenIn);
        uint256 indexOut = Utils.indexOf(tokens.addresses, tokenOut);

        Utils.upscaleArray(tokens.balances, tokens.scalingFactors);

        uint256[] memory balancesWithoutBpt = Utils.balancesWithoutBpt(
            tokens.balances,
            indexBpt
        );

        amountIn = Utils.upscaleAmount(
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
            Utils.tokenIndexWithoutBpt(indexIn, indexBpt),
            Utils.tokenIndexWithoutBpt(indexOut, indexBpt),
            amountIn,
            invariant
        );

        return
            Utils.downscaleDownAmount(
                amountOut,
                tokens.scalingFactors[indexOut]
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
