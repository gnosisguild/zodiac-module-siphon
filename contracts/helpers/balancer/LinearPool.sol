// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "../../lib/balancer/LinearMath.sol";
import "../../lib/balancer/FixedPoint.sol";

import "./Interop.sol";
import "./Utils.sol";

library LinearPool {
    using FixedPoint for uint256;

    function calcMainOutGivenBptIn(address pool, uint256 bptAmountIn)
        public
        view
        returns (uint256)
    {
        (
            PoolTokens memory tokens,
            LinearMath.Params memory swapParams,
            uint256 virtualSupply
        ) = query(pool);

        uint256 bptIndex = ILinearPool(pool).getBptIndex();
        uint256 mainIndex = ILinearPool(pool).getMainIndex();
        uint256 wrappedIndex = ILinearPool(pool).getWrappedIndex();

        Utils.upscaleArray(tokens.balances, tokens.scalingFactors);
        uint256 amountIn = Utils.upscale(
            bptAmountIn,
            tokens.scalingFactors[bptIndex]
        );

        uint256 amountOut = LinearMath._calcMainOutPerBptIn(
            amountIn,
            tokens.balances[mainIndex],
            tokens.balances[wrappedIndex],
            virtualSupply,
            swapParams
        );

        return Utils.downscaleDown(amountOut, tokens.scalingFactors[mainIndex]);
    }

    function calcBptOutGivenMainIn(address pool, uint256 mainAmountIn)
        public
        view
        returns (uint256)
    {
        (
            PoolTokens memory tokens,
            LinearMath.Params memory swapParams,
            uint256 virtualSupply
        ) = query(pool);

        uint256 bptIndex = ILinearPool(pool).getBptIndex();
        uint256 mainIndex = ILinearPool(pool).getMainIndex();
        uint256 wrappedIndex = ILinearPool(pool).getWrappedIndex();

        Utils.upscaleArray(tokens.balances, tokens.scalingFactors);
        uint256 amountIn = Utils.upscale(
            mainAmountIn,
            tokens.scalingFactors[mainIndex]
        );

        uint256 amountOut = LinearMath._calcBptOutPerMainIn(
            amountIn,
            tokens.balances[mainIndex],
            tokens.balances[wrappedIndex],
            virtualSupply,
            swapParams
        );

        return Utils.downscaleDown(amountOut, tokens.scalingFactors[bptIndex]);
    }

    function calcNominalValue(address pool) public view returns (uint256) {
        return
            ILinearPool(pool).getVirtualSupply().mulDown(
                ILinearPool(pool).getRate()
            );
    }

    function query(address _pool)
        public
        view
        returns (
            PoolTokens memory tokens,
            LinearMath.Params memory swapParams,
            uint256 virtualSupply
        )
    {
        ILinearPool pool = ILinearPool(_pool);
        tokens.scalingFactors = pool.getScalingFactors();
        (tokens.addresses, tokens.balances, ) = IVault(pool.getVault())
            .getPoolTokens(pool.getPoolId());

        (uint256 lowerTarget, uint256 upperTarget) = pool.getTargets();
        swapParams = LinearMath.Params({
            fee: pool.getSwapFeePercentage(),
            lowerTarget: lowerTarget,
            upperTarget: upperTarget
        });
        virtualSupply = pool.getVirtualSupply();
    }

    struct PoolTokens {
        address[] addresses;
        uint256[] balances;
        uint256[] scalingFactors;
    }
}
