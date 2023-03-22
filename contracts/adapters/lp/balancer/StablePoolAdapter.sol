// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

import "@gnosis.pm/zodiac/contracts/factory/FactoryFriendly.sol";

import "./AbstractPoolAdapter.sol";

import "../../../helpers/balancer/StablePool.sol";

contract StablePoolAdapter is AbstractPoolAdapter {
    using FixedPoint for uint256;

    constructor(
        address _owner,
        address _investor,
        address _pool,
        address _gauge,
        address _tokenOut
    ) {
        bytes memory initParams = abi.encode(
            _owner,
            _investor,
            _pool,
            _gauge,
            _tokenOut
        );
        setUp(initParams);
    }

    function isInParity() public view override returns (bool) {
        (address[] memory tokens, , ) = IVault(vault).getPoolTokens(
            IPool(pool).getPoolId()
        );

        uint256 delta = 0;
        for (uint256 i = 1; i < tokens.length; i++) {
            uint256 price = StablePoolHelper.calcPrice(
                pool,
                tokens[0],
                tokens[i]
            );
            uint256 nextDelta = price > FixedPoint.ONE
                ? price - FixedPoint.ONE
                : FixedPoint.ONE - price; // @audit - what if the token does not have 18 decimals, like USDT?

            delta = Math.max(delta, nextDelta);
        }
        return delta < parityTolerance;
    }

    function balance() public view override returns (uint256) {
        (uint256 stakedBpt, uint256 unstakedBpt) = bptBalances();
        return
            StablePoolHelper.calcTokenOutGivenBptIn(
                pool,
                stakedBpt + unstakedBpt,
                tokenOut
            );
    }

    function encodeExit(
        uint256 amountIn
    ) internal view override returns (Transaction memory) {
        bytes32 poolId = IPool(pool).getPoolId();
        (address[] memory tokens, , ) = IVault(vault).getPoolTokens(poolId);
        uint256 tokenOutIndex = Utils.indexOf(tokens, tokenOut);
        uint256[] memory amountsOut = new uint256[](tokens.length);
        //amountsOut[tokenOutIndex] = amountOut;

        return
            Transaction({
                to: vault,
                value: 0,
                data: abi.encodeWithSelector(
                    0x8bdb3913,
                    poolId,
                    investor,
                    investor,
                    IVault.ExitPoolRequest({
                        assets: tokens,
                        minAmountsOut: amountsOut,
                        userData: abi.encode(
                            IVault.ExitKind.EXACT_BPT_IN_FOR_ONE_TOKEN_OUT,
                            amountIn,
                            tokenOutIndex
                        ),
                        toInternalBalance: false
                    })
                ),
                operation: Enum.Operation.Call
            });
    }

    function calculateExit(
        uint256 requestedAmountOut
    ) internal view override returns (uint256 amountIn) {
        (uint256 unstakedBPT, uint256 stakedBPT) = bptBalances();

        uint256 amountInAvailable = unstakedBPT + stakedBPT;
        uint256 amountInGivenOut = StablePoolHelper.calcBptInGivenTokenOut(
            pool,
            tokenOut,
            requestedAmountOut
        );

        return Math.min(amountInAvailable, amountInGivenOut);
    }
}
