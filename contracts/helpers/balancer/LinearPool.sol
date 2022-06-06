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
        uint256 amountIn = Utils.upscaleAmount(
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

        return
            Utils.downscaleDownAmount(
                amountOut,
                tokens.scalingFactors[mainIndex]
            );
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
        uint256 amountIn = Utils.upscaleAmount(
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

        return
            Utils.downscaleDownAmount(
                amountOut,
                tokens.scalingFactors[bptIndex]
            );
    }

    //  function valueInMainToken(address pool) public view returns (uint256) {

    //     address vault = IPool(pool).getVault();
    //     bytes32 poolId = IPool(pool).getPoolId();
    //     (, uint256[] memory balances, ) = IVault(vault).getPoolTokens(poolId);
    //     uint256[] memory scalingFactors = IPool(pool).getScalingFactors();

    //     PoolReader.upscaleArray(balances, scalingFactors);

    //     (uint256 lowerTarget, uint256 upperTarget) = ILinearPool(pool).getTargets();
    //     LinearMath.Params memory params = LinearMath.Params({
    //         fee: IPool(pool).getSwapFeePercentage(),
    //         lowerTarget: lowerTarget,
    //         upperTarget: upperTarget
    //     });

    //     uint256 mainIndex = ILinearPool(pool).getMainIndex();
    //     uint256 wrappedIndex = ILinearPool(pool).getWrappedIndex();

    //     uint256 totalBalance = LinearMath._calcInvariant(
    //         LinearMath._toNominal(balances[mainIndex], params),
    //         balances[wrappedIndex].mulDown(ILinearPool(pool).getWrappedTokenRate())
    //     );

    //     return PoolReader.downscaleDownAmount(totalBalance, scalingFactors, mainIndex);
    // }

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
