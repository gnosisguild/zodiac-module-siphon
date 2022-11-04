// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

import "@gnosis.pm/zodiac/contracts/factory/FactoryFriendly.sol";

import "./AbstractPoolAdapter.sol";

import "../../../helpers/balancer/BoostedPool.sol";

contract BoostedPoolAdapter is AbstractPoolAdapter {
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

    function isInParity() public override returns (bool) {
        (, uint256[] memory prices) = BoostedPoolHelper.calcPrices(pool);

        uint256 delta = 0;
        for (uint256 i = 0; i < prices.length; i++) {
            uint256 nextDelta = FixedPoint.ONE - prices[i];
            delta = Math.max(delta, nextDelta);
        }
        return delta < parityTolerance;
    }

    function balance() public override returns (uint256) {
        (uint256 unstakedBpt, uint256 stakedBpt) = bptBalances();
        return
            BoostedPoolHelper.queryStableOutGivenBptIn(
                pool,
                unstakedBpt + stakedBpt,
                tokenOut
            );
    }

    function encodeExit(
        uint8 kind,
        uint256 amountIn,
        uint256 amountOut
    ) internal view override returns (Transaction memory) {
        address linearPool = BoostedPoolHelper.findLinearPool(pool, tokenOut);

        address[] memory assets = new address[](3);
        assets[0] = pool;
        assets[1] = linearPool;
        assets[2] = tokenOut;

        int256[] memory limits = new int256[](3);
        limits[0] = int256(amountIn);
        limits[1] = 0;
        limits[2] = -1 * int256(amountOut);

        IVault.BatchSwapStep[] memory swapSteps = new IVault.BatchSwapStep[](2);
        if (IVault.SwapKind(kind) == IVault.SwapKind.GIVEN_OUT) {
            swapSteps[0] = IVault.BatchSwapStep({
                poolId: IPool(linearPool).getPoolId(),
                assetInIndex: 1,
                assetOutIndex: 2,
                amount: amountOut,
                userData: hex""
            });

            swapSteps[1] = IVault.BatchSwapStep({
                poolId: IPool(pool).getPoolId(),
                assetInIndex: 0,
                assetOutIndex: 1,
                amount: 0,
                userData: hex""
            });
        } else {
            swapSteps[0] = IVault.BatchSwapStep({
                poolId: IPool(pool).getPoolId(),
                assetInIndex: 0,
                assetOutIndex: 1,
                amount: amountIn,
                userData: hex""
            });

            swapSteps[1] = IVault.BatchSwapStep({
                poolId: IPool(linearPool).getPoolId(),
                assetInIndex: 1,
                assetOutIndex: 2,
                amount: 0,
                userData: hex""
            });
        }

        return
            Transaction({
                to: vault,
                value: 0,
                data: abi.encodeWithSelector(
                    0x945bcec9,
                    kind,
                    swapSteps,
                    assets,
                    IVault.FundManagement({
                        sender: investor,
                        fromInternalBalance: false,
                        recipient: investor,
                        toInternalBalance: false
                    }),
                    limits,
                    uint256(999999999999999999)
                ),
                operation: Enum.Operation.Call
            });
    }

    function calculateExit(uint256 requestedAmountOut)
        internal
        override
        returns (
            uint8 kind,
            uint256 amountIn,
            uint256 amountOut
        )
    {
        (uint256 unstakedBPT, uint256 stakedBPT) = bptBalances();

        // For BoostedPools there's a difference between the nominal balance and
        // liquid balance
        // This is dictated by LinearPools, where a good part of liquidity is held in
        // in wrapped tokens (e.g. AAVE's waToken)
        // The equilibirum is to be maintaned by external arbers. therefore we are capped
        // by what is promptly available as stable token
        requestedAmountOut = Math.min(
            requestedAmountOut,
            BoostedPoolHelper.liquidStableBalance(pool, tokenOut)
        );

        uint256 amountInAvailable = unstakedBPT + stakedBPT;
        uint256 amountInGivenOut = BoostedPoolHelper.queryBptInGivenStableOut(
            pool,
            tokenOut,
            requestedAmountOut
        );

        bool isFullExit = amountInGivenOut > amountInAvailable;

        // Default mode is GIVEN_OUT, retrieving the exactly requested liquidity
        // But balance doesn't suffice, we perform a full exit
        if (isFullExit) {
            kind = uint8(IVault.SwapKind.GIVEN_IN);
            amountIn = unstakedBPT + stakedBPT;
            amountOut = BoostedPoolHelper.queryStableOutGivenBptIn(
                pool,
                amountIn,
                tokenOut
            );
        } else {
            kind = uint8(IVault.SwapKind.GIVEN_OUT);
            amountIn = amountInGivenOut;

            amountOut = requestedAmountOut;

            assert(amountIn <= unstakedBPT + stakedBPT);
        }
    }
}
