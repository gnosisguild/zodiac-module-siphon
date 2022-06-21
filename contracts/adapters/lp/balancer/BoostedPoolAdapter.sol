pragma solidity ^0.8.0;
// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "@gnosis.pm/zodiac/contracts/factory/FactoryFriendly.sol";

import "../../../ILiquidityPosition.sol";

import "../../../helpers/balancer/BoostedPool.sol";

/*FactoryFriendly*/
contract BoostedPoolAdapter is ILiquidityPosition {
    using FixedPoint for uint256;

    address public investor;
    address public vault;
    address public boostedPool;
    address public gauge;
    address public tokenOut;

    uint256 public parityTolerance;
    uint256 public slippage;

    constructor(
        address _investor,
        address _pool,
        address _gauge,
        address _tokenOut
    ) {
        bytes memory initParams = abi.encode(
            _investor,
            _pool,
            _gauge,
            _tokenOut
        );
        setUp(initParams);
    }

    function setUp(bytes memory initParams) public {
        (
            address _investor,
            address _pool,
            address _gauge,
            address _tokenOut
        ) = abi.decode(initParams, (address, address, address, address));
        // __Ownable_init();

        investor = _investor;
        vault = IPool(_pool).getVault();
        boostedPool = _pool;
        gauge = _gauge;

        tokenOut = _tokenOut;

        // 20 basis points
        parityTolerance = 2e15;
        // 50 basis points
        slippage = 5e15;
    }

    function asset() external view override returns (address) {
        return tokenOut;
    }

    function assetBalance() external view override returns (uint256) {
        return IERC20(tokenOut).balanceOf(investor);
    }

    function balance() external view override returns (uint256) {
        return balanceEffective();
    }

    function isOpenForWithdrawals() external view override returns (bool) {
        // we should make sure the pool has at least 1M nomimal value?
        return isInParity();
    }

    function withdrawalInstructions(uint256 requestedAmountOut)
        external
        view
        override
        returns (Transaction[] memory)
    {
        (uint256 unstakedBalance, ) = bptBalances();

        (
            IVault.SwapKind kind,
            uint256 amountIn,
            uint256 amountOut
        ) = inferExitConditions(requestedAmountOut);

        uint256 amountToUnstake = amountIn > unstakedBalance
            ? amountIn - unstakedBalance
            : 0;

        Transaction[] memory result;
        if (amountToUnstake > 0) {
            result = new Transaction[](2);
            result[0] = encodeUnstake(amountToUnstake);
            result[1] = encodeExit(kind, amountIn, amountOut);
        } else {
            result = new Transaction[](1);
            result[0] = encodeExit(kind, amountIn, amountOut);
        }
        return result;
    }

    function isInParity() public view returns (bool) {
        address[] memory stableTokens = BoostedPoolHelper.findStableTokens(
            boostedPool
        );

        uint256 delta = 0;
        for (uint256 i = 1; i < stableTokens.length; i++) {
            // should we use calcPriceIndirect?
            uint256 price = BoostedPoolHelper.calcPrice(
                boostedPool,
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

    function balanceNominal() public view returns (uint256) {
        (uint256 unstakedBalance, uint256 stakedBalance) = bptBalances();
        return balanceNominal(unstakedBalance + stakedBalance);
    }

    function balanceNominal(uint256 bptAmount) public view returns (uint256) {
        uint256 ratio = bptAmount.divDown(
            IStablePhantomPool(boostedPool).getVirtualSupply()
        );
        uint256 nominalValue = BoostedPoolHelper.nominalValue(boostedPool);
        return ratio.mulDown(nominalValue);
    }

    function balanceEffective() public view returns (uint256) {
        (uint256 unstakedBalance, uint256 stakedBalance) = bptBalances();
        return balanceEffective(unstakedBalance + stakedBalance);
    }

    function balanceEffective(uint256 bptAmount) public view returns (uint256) {
        return
            BoostedPoolHelper
                .calcStableOutGivenBptIn(boostedPool, bptAmount, tokenOut)
                .mulDown((FixedPoint.ONE - slippage));
    }

    function bptBalances()
        public
        view
        returns (uint256 unstakedBalance, uint256 stakedBalance)
    {
        unstakedBalance = IERC20(boostedPool).balanceOf(investor);
        stakedBalance = IERC20(gauge).balanceOf(investor);
    }

    function encodeUnstake(uint256 amount)
        internal
        view
        returns (Transaction memory)
    {
        //abi.encodeWithSignature("withdraw(uint256)", amount);
        return
            Transaction({
                to: gauge,
                value: 0,
                data: abi.encodeWithSelector(0x2e1a7d4d, amount),
                operation: Enum.Operation.Call
            });
    }

    function encodeExit(
        IVault.SwapKind kind,
        uint256 amountIn,
        uint256 amountOut
    ) internal view returns (Transaction memory) {
        address linearPool = BoostedPoolHelper.findLinearPool(
            boostedPool,
            tokenOut
        );

        address[] memory assets = new address[](3);
        assets[0] = boostedPool;
        assets[1] = linearPool;
        assets[2] = tokenOut;

        int256[] memory limits = new int256[](3);
        limits[0] = int256(amountIn);
        limits[1] = 0;
        limits[2] = -1 * int256(amountOut);

        IVault.BatchSwapStep[] memory swapSteps = new IVault.BatchSwapStep[](2);
        if (kind == IVault.SwapKind.GIVEN_OUT) {
            swapSteps[0] = IVault.BatchSwapStep({
                poolId: IPool(linearPool).getPoolId(),
                assetInIndex: 1,
                assetOutIndex: 2,
                amount: amountOut,
                userData: hex""
            });

            swapSteps[1] = IVault.BatchSwapStep({
                poolId: IPool(boostedPool).getPoolId(),
                assetInIndex: 0,
                assetOutIndex: 1,
                amount: 0,
                userData: hex""
            });
        } else {
            swapSteps[0] = IVault.BatchSwapStep({
                poolId: IPool(boostedPool).getPoolId(),
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

        // the actual return values
        return
            Transaction({
                to: vault,
                value: 0,
                data: abi.encodeWithSelector(
                    0x945bcec9,
                    uint8(kind),
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

    function inferExitConditions(uint256 requestedAmountOut)
        internal
        view
        returns (
            IVault.SwapKind kind,
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

        bool isTooCloseToCall = requestedAmountOut >
            balanceEffective().mulDown(FixedPoint.ONE - (slippage + slippage));

        (uint256 unstakedBPT, uint256 stakedBPT) = bptBalances();

        // We can't know in advance how much we'll be getting out
        // If the effective balance estimate is close to the requested amount,
        // we just exit the entire position. This also avoids leaving
        // crumbs in the liquidity position
        if (isTooCloseToCall) {
            kind = IVault.SwapKind.GIVEN_IN;
            amountIn = unstakedBPT + stakedBPT;
            amountOut = FixedPoint.mulDown(
                BoostedPoolHelper.calcStableOutGivenBptIn(
                    boostedPool,
                    amountIn,
                    tokenOut
                ),
                FixedPoint.ONE - slippage
            );
        } else {
            kind = IVault.SwapKind.GIVEN_OUT;
            amountIn = FixedPoint.mulDown(
                BoostedPoolHelper.calcBptInGivenStableOut(
                    boostedPool,
                    tokenOut,
                    requestedAmountOut
                ),
                FixedPoint.ONE + slippage
            );
            amountOut = requestedAmountOut;

            require(amountIn <= unstakedBPT + stakedBPT, "Invariant");
        }
    }

    function _debugPriceDeltas() public view returns (uint256, uint256) {
        (uint256 price1, uint256 price2) = _debugPrices();
        uint256 delta1 = price1 > FixedPoint.ONE
            ? price1 - FixedPoint.ONE
            : FixedPoint.ONE - price1;

        uint256 delta2 = price2 > FixedPoint.ONE
            ? price2 - FixedPoint.ONE
            : FixedPoint.ONE - price2;

        return (delta1, delta2);
    }

    function _debugPrices() public view returns (uint256, uint256) {
        address[] memory stableTokens = BoostedPoolHelper.findStableTokens(
            boostedPool
        );

        uint256 price1 = BoostedPoolHelper.calcPrice(
            boostedPool,
            stableTokens[0],
            stableTokens[1]
        );

        uint256 price2 = BoostedPoolHelper.calcPrice(
            boostedPool,
            stableTokens[0],
            stableTokens[2]
        );

        return (price1, price2);
    }

    function setParityTolerane(uint256 _parityTolerance) external {
        parityTolerance = _parityTolerance;
    }

    function setSlippage(uint256 _slippage) external {
        slippage = _slippage;
    }
}
