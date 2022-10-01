// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "./Interop.sol";

library VaultHelper {
    function queryStableOutGivenStableIn(
        address pool,
        address tokenIn,
        uint256 amountIn,
        address tokenOut
    ) internal returns (uint256) {
        address linearPoolLeft = findLinearPool(pool, tokenIn);
        address linearPoolRight = findLinearPool(pool, tokenOut);

        address[] memory assets = new address[](4);
        assets[0] = tokenIn;
        assets[1] = linearPoolLeft;
        assets[2] = linearPoolRight;
        assets[3] = tokenOut;

        IVault.BatchSwapStep[] memory steps = new IVault.BatchSwapStep[](3);
        steps[0] = IVault.BatchSwapStep({
            poolId: IPool(linearPoolLeft).getPoolId(),
            assetInIndex: 0,
            assetOutIndex: 1,
            amount: amountIn,
            userData: hex""
        });

        steps[1] = IVault.BatchSwapStep({
            poolId: IPool(pool).getPoolId(),
            assetInIndex: 1,
            assetOutIndex: 2,
            amount: 0,
            userData: hex""
        });

        steps[2] = IVault.BatchSwapStep({
            poolId: IPool(linearPoolRight).getPoolId(),
            assetInIndex: 2,
            assetOutIndex: 3,
            amount: 0,
            userData: hex""
        });

        int256[] memory limits = IVault(IPool(pool).getVault()).queryBatchSwap(
            IVault.SwapKind.GIVEN_IN,
            steps,
            assets,
            IVault.FundManagement({
                sender: address(0),
                fromInternalBalance: false,
                recipient: address(0),
                toInternalBalance: false
            })
        );

        return uint256(-1 * limits[3]);
    }

    function queryStableOutGivenBptIn(
        address pool,
        uint256 amountIn,
        address tokenOut
    ) internal returns (uint256) {
        address linearPool = findLinearPool(pool, tokenOut);

        address[] memory assets = new address[](3);
        assets[0] = pool;
        assets[1] = linearPool;
        assets[2] = tokenOut;

        IVault.BatchSwapStep[] memory steps = new IVault.BatchSwapStep[](2);
        steps[0] = IVault.BatchSwapStep({
            poolId: IPool(pool).getPoolId(),
            assetInIndex: 0,
            assetOutIndex: 1,
            amount: amountIn,
            userData: hex""
        });

        steps[1] = IVault.BatchSwapStep({
            poolId: IPool(linearPool).getPoolId(),
            assetInIndex: 1,
            assetOutIndex: 2,
            amount: 0,
            userData: hex""
        });

        int256[] memory limits = IVault(IPool(pool).getVault()).queryBatchSwap(
            IVault.SwapKind.GIVEN_IN,
            steps,
            assets,
            IVault.FundManagement({
                sender: address(0),
                fromInternalBalance: false,
                recipient: address(0),
                toInternalBalance: false
            })
        );

        return uint256(-1 * limits[2]);
    }

    function queryBptInGivenStableOut(
        address pool,
        address tokenOut,
        uint256 amountOut
    ) internal returns (uint256) {
        address linearPool = findLinearPool(pool, tokenOut);

        address[] memory assets = new address[](3);
        assets[0] = pool;
        assets[1] = linearPool;
        assets[2] = tokenOut;

        IVault.BatchSwapStep[] memory steps = new IVault.BatchSwapStep[](2);
        steps[0] = IVault.BatchSwapStep({
            poolId: IPool(linearPool).getPoolId(),
            assetInIndex: 1,
            assetOutIndex: 2,
            amount: amountOut,
            userData: hex""
        });

        steps[1] = IVault.BatchSwapStep({
            poolId: IPool(pool).getPoolId(),
            assetInIndex: 0,
            assetOutIndex: 1,
            amount: 0,
            userData: hex""
        });

        int256[] memory limits = IVault(IPool(pool).getVault()).queryBatchSwap(
            IVault.SwapKind.GIVEN_OUT,
            steps,
            assets,
            IVault.FundManagement({
                sender: address(0),
                fromInternalBalance: false,
                recipient: address(0),
                toInternalBalance: false
            })
        );

        return uint256(limits[0]);
    }

    function findLinearPool(address pool, address mainToken)
        internal
        view
        returns (address)
    {
        (address[] memory tokens, , ) = IVault(IPool(pool).getVault())
            .getPoolTokens(IPool(pool).getPoolId());

        uint256 bptIndex = IStablePhantomPool(pool).getBptIndex();

        for (uint256 i = 0; i < tokens.length; i++) {
            if (
                i != bptIndex &&
                ILinearPool(tokens[i]).getMainToken() == mainToken
            ) {
                return tokens[i];
            }
        }

        revert("LinearPool: Not found");
    }
}
