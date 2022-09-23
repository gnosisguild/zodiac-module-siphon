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

    function isInParity() public view override returns (bool) {
        address[] memory stableTokens = BoostedPoolHelper.findStableTokens(
            pool
        );

        uint256 delta = 0;
        for (uint256 i = 1; i < stableTokens.length; i++) {
            uint256 price = BoostedPoolHelper.calcPrice(
                pool,
                stableTokens[0],
                stableTokens[i]
            );
            uint256 nextDelta = price > FixedPoint.ONE
                ? price - FixedPoint.ONE
                : FixedPoint.ONE - price;

            delta = Math.max(delta, nextDelta);
        }
        return delta < parityTolerance;
    }

    function balance() public view override returns (uint256) {
        (uint256 unstakedBpt, uint256 stakedBpt) = bptBalances();
        return
            BoostedPoolHelper.calcStableOutGivenBptIn(
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
        view
        override
        returns (
            uint8 kind,
            uint256 amountIn,
            uint256 amountOut
        )
    {
        // GIVEN_IN
        // If we are performing a GIVEN_IN batchSwap and wanted to apply a 1% slippage tolerance,
        // we would multiple our negative assetDeltas by 0.99. We do not need to modify
        // our positive amounts because we know the exact amount we are putting in.
        // GIVEN_OUT
        // If we are performing a GIVEN_OUT batchSwap and wanted to apply a 1% slippage tolerance,
        // we would multiple our positive assetDeltas by 1.01. We do not need to modify
        // our negative amounts because we know the exact amount we are getting out.
        (uint256 unstakedBPT, uint256 stakedBPT) = bptBalances();

        // For BoostedPools there's a difference between the nominal balance and
        // withdrawable balance
        // This is dictated by LinearPools, where most of the liquidity is held in AAVE's
        // aTokens. The actual stable will outnumbered vs AAVE's yield bearing equivalents.
        // The equilibirum is to be maintaned by arbers. therefore we are limited on the
        // batch swap to warever is readily available in stables
        // For example, even tho a position is 20M, we might only be able to withdraw 5M
        // In principle, some minutes later, our 15M position will be again good for
        // another 5M withdraw
        requestedAmountOut = Math.min(
            requestedAmountOut,
            BoostedPoolHelper.calcMaxStableOut(pool, tokenOut)
        );

        uint256 amountInAvailable = unstakedBPT + stakedBPT;
        uint256 amountInGivenOut = BoostedPoolHelper.calcBptInGivenStableOut(
            pool,
            tokenOut,
            requestedAmountOut
        );

        bool isFullExit = amountInGivenOut >
            FixedPoint.mulDown(
                amountInAvailable,
                FixedPoint.ONE - basisPoints(100)
            );

        // Default mode is GIVEN_OUT, retrieving the exactly requested liquidity
        // But if we are close, then we do GIVEN_IN
        // we just exit everything, and get warever was out
        if (isFullExit) {
            kind = uint8(IVault.SwapKind.GIVEN_IN);
            amountIn = unstakedBPT + stakedBPT;
            amountOut = BoostedPoolHelper.calcStableOutGivenBptIn(
                pool,
                amountIn,
                tokenOut
            );
        } else {
            kind = uint8(IVault.SwapKind.GIVEN_OUT);
            amountIn = amountInGivenOut;

            amountOut = requestedAmountOut;

            require(amountIn <= unstakedBPT + stakedBPT, "Invariant");
        }
    }

    function _debugPrices() public view returns (uint256, uint256) {
        address[] memory stableTokens = BoostedPoolHelper.findStableTokens(
            pool
        );

        uint256 price1 = BoostedPoolHelper.calcPrice(
            pool,
            stableTokens[0],
            stableTokens[1]
        );

        uint256 price2 = BoostedPoolHelper.calcPrice(
            pool,
            stableTokens[0],
            stableTokens[2]
        );

        return (price1, price2);
    }

    function _balanceNominal(uint256 bptAmount) public view returns (uint256) {
        uint256 ratio = bptAmount.divDown(
            IStablePhantomPool(pool).getVirtualSupply()
        );
        uint256 nominalValue = BoostedPoolHelper.nominalValue(pool);
        return ratio.mulDown(nominalValue);
    }
}
