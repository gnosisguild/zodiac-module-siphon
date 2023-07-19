// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../../lib/balancer/StableMath.sol";
import "../../lib/balancer/FixedPoint.sol";
import "./Interop.sol";

library Utils {
    using FixedPoint for uint256;

    function addSwapFee(
        address pool,
        uint256 amount
    ) public view returns (uint256) {
        return
            amount.divUp(
                FixedPoint.ONE.sub(IPool(pool).getSwapFeePercentage())
            );
    }

    function subtractSwapFee(
        address pool,
        uint256 amount
    ) external view returns (uint256) {
        uint256 feeAmount = amount.mulUp(IPool(pool).getSwapFeePercentage());
        return amount.sub(feeAmount);
    }

    function upscaleArray(
        uint256[] memory amounts,
        uint256[] memory scalingFactors
    ) internal pure {
        for (uint256 i = 0; i < amounts.length; i++) {
            amounts[i] = FixedPoint.mulDown(amounts[i], scalingFactors[i]);
        }
    }

    function upscale(
        uint256 amount,
        uint256 scalingFactor
    ) external pure returns (uint256) {
        return FixedPoint.mulDown(amount, scalingFactor);
    }

    function inferAndUpscale(
        uint256 amount,
        address token
    ) public view returns (uint256) {
        // Tokens with more than 18 decimals are not supported.
        uint256 scalingFactor = FixedPoint.ONE *
            10 ** Math.sub(18, ERC20(token).decimals());

        return FixedPoint.mulDown(amount, scalingFactor);
    }

    function price(
        address token1,
        uint256 amount1,
        address token2,
        uint256 amount2
    ) public view returns (uint256) {
        return
            FixedPoint.divDown(
                inferAndUpscale(amount1, token1),
                inferAndUpscale(amount2, token2)
            );
    }

    function downscaleUpArray(
        uint256[] memory amounts,
        uint256[] memory scalingFactors
    ) internal pure {
        for (uint256 i = 0; i < amounts.length; ++i) {
            amounts[i] = FixedPoint.divUp(amounts[i], scalingFactors[i]);
        }
    }

    function downscaleDownArray(
        uint256[] memory amounts,
        uint256[] memory scalingFactors
    ) internal pure {
        for (uint256 i = 0; i < amounts.length; ++i) {
            amounts[i] = FixedPoint.divDown(amounts[i], scalingFactors[i]);
        }
    }

    function downscaleUp(
        uint256 amount,
        uint256 scalingFactor
    ) external pure returns (uint256) {
        return FixedPoint.divUp(amount, scalingFactor);
    }

    function downscaleDown(
        uint256 amount,
        uint256 scalingFactor
    ) external pure returns (uint256) {
        return FixedPoint.divDown(amount, scalingFactor);
    }

    function balancesWithoutBpt(
        uint256[] memory balances,
        uint256 bptIndex
    ) internal pure returns (uint256[] memory result) {
        result = new uint256[](balances.length - 1);
        for (uint256 i = 0; i < result.length; i++) {
            result[i] = balances[i < bptIndex ? i : i + 1];
        }
    }

    function indexWithoutBpt(
        uint256 tokenIndex,
        uint256 bptIndex
    ) external pure returns (uint256) {
        return tokenIndex < bptIndex ? tokenIndex : tokenIndex - 1;
    }

    function calcScalingFactor(address token) external view returns (uint256) {
        // Tokens that don't implement the `decimals` method are not supported.
        uint256 tokenDecimals = ERC20(token).decimals();

        // Tokens with more than 18 decimals are not supported.
        uint256 decimalsDifference = Math.sub(18, tokenDecimals);
        return FixedPoint.ONE * 10 ** decimalsDifference;
    }

    function indexOf(
        address[] memory arr,
        address searchFor
    ) external pure returns (uint256) {
        for (uint256 i = 0; i < arr.length; i++) {
            if (arr[i] == searchFor) {
                return i;
            }
        }
        revert("Never happens");
    }
}
