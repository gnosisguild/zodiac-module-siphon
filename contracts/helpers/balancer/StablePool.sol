// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "../../lib/balancer/StableMath.sol";
import "../../lib/balancer/FixedPoint.sol";

import "./Interop.sol";
import "./Utils.sol";

library StablePoolHelper {
    using FixedPoint for uint256;

    function nominalValue(address pool) external view returns (uint256) {
        return
            ILinearPool(pool).getVirtualSupply().mulDown(
                ILinearPool(pool).getRate()
            );
    }

    function calcPrice(
        address pool,
        address token1,
        address token2
    ) public view returns (uint256) {
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
    ) external view returns (uint256) {
        (PoolTokens memory tokens, uint256 amplification) = query(pool);

        uint256 indexOut = Utils.indexOf(tokens.addresses, tokenOut);

        Utils.upscaleArray(tokens.balances, tokens.scalingFactors);
        subtractDueFeeAmounts(pool, tokens.balances);

        uint256 amountOut = StableMath._calcTokenOutGivenExactBptIn(
            amplification,
            tokens.balances,
            indexOut,
            bptAmountIn,
            IPool(pool).totalSupply(),
            IPool(pool).getSwapFeePercentage()
        );

        return Utils.downscaleDown(amountOut, tokens.scalingFactors[indexOut]);
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

    function subtractDueFeeAmounts(address pool, uint256[] memory balances)
        internal
        view
    {
        uint256[] memory fees = dueFeeAmounts(pool);

        for (uint256 i = 0; i < fees.length; ++i) {
            balances[i] = FixedPoint.sub(balances[i], fees[i]);
        }
    }

    function dueFeeAmounts(address pool)
        private
        view
        returns (uint256[] memory)
    {
        (PoolTokens memory tokens, ) = query(pool);

        uint256[] memory result = new uint256[](tokens.balances.length);
        uint256 swapFeePercentage = IPool(pool).getSwapFeePercentage();
        if (swapFeePercentage == 0) {
            return result;
        }

        uint256 chosenTokenIndex = 0;
        uint256 maxBalance = tokens.balances[0];
        for (uint256 i = 1; i < tokens.balances.length; ++i) {
            uint256 currentBalance = tokens.balances[i];
            if (currentBalance > maxBalance) {
                chosenTokenIndex = i;
                maxBalance = currentBalance;
            }
        }

        (uint256 lastInvariant, uint256 lastAmplification) = IStablePool(pool)
            .getLastInvariant();

        // Set the fee amount to pay in the selected token
        result[chosenTokenIndex] = StableMath
            ._calcDueTokenProtocolSwapFeeAmount(
                lastAmplification,
                tokens.balances,
                lastInvariant,
                chosenTokenIndex,
                swapFeePercentage
            );

        return result;
    }

    function query(address _pool)
        private
        view
        returns (PoolTokens memory tokens, uint256 amplification)
    {
        IStablePool pool = IStablePool(_pool);
        tokens.scalingFactors = pool.getScalingFactors();
        (tokens.addresses, tokens.balances, ) = IVault(pool.getVault())
            .getPoolTokens(pool.getPoolId());
        (amplification, , ) = pool.getAmplificationParameter();
    }

    struct PoolTokens {
        address[] addresses;
        uint256[] balances;
        uint256[] scalingFactors;
    }
}
