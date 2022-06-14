pragma solidity ^0.8.0;
// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "../../../ILiquidityPosition.sol";

import "../../../helpers/balancer/BoostedPool.sol";

contract BoostedPoolAdapter is ILiquidityPosition {
    using FixedPoint for uint256;

    error NotEnoughLitquidity();

    address public multisend;

    address public investor;
    address public vault;
    address public boostedPool;
    address public gauge;
    address public tokenOut;

    uint256 public slippage;
    uint256 public parityTolerance;

    constructor(
        address _investor,
        address _pool,
        address _gauge,
        address _tokenOut
    ) {
        multisend = 0x8D29bE29923b68abfDD21e541b9374737B49cdAD;
        investor = _investor;
        vault = IPool(_pool).getVault();
        boostedPool = _pool;
        gauge = _gauge;

        tokenOut = _tokenOut;

        slippage = FixedPoint.ONE;
        // 50 basis points
        parityTolerance = FixedPoint.ONE.sub(995 * 1e15);
    }

    function asset() external view override returns (address) {
        return tokenOut;
    }

    function balance() external view override returns (uint256) {
        return balanceNominal();
    }

    function isWithdrawalAvailable() external view override returns (bool) {
        // we should make sure the pool has at least 1M nomimal value?
        return isInParity();
    }

    function withdrawalInstructions(uint256 amountOut)
        external
        view
        override
        returns (
            address,
            uint256,
            bytes memory
        )
    {
        uint256 amountIn = BoostedPoolHelper.calcBptInGivenStableOut(
            boostedPool,
            tokenOut,
            amountOut
        );
        uint256 maxAmountIn = amountIn.add(amountIn.mulDown(slippage));
        (uint256 unstakedBalance, uint256 stakedBalance) = bptBalances();

        uint256 amountToUnstake = maxAmountIn > unstakedBalance
            ? Math.min(stakedBalance, maxAmountIn - unstakedBalance)
            : 0;

        if(amountToUnstake > 0){
            return encodeUnstakeAndExit(amountToUnstake, maxAmountIn, amountOut);
        } else {
             return encodeExit(maxAmountIn, amountOut);
        }
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

    function balanceEffective() public view returns (uint256) {
        (uint256 unstakedBalance, uint256 stakedBalance) = bptBalances();
        return balanceEffective(unstakedBalance + stakedBalance);
    }

    function balanceNominal(uint256 bptAmount) public view returns (uint256) {
        uint256 ratio = bptAmount.divDown(
            IStablePhantomPool(boostedPool).getVirtualSupply()
        );
        uint256 nominalValue = BoostedPoolHelper.nominalValue(boostedPool);
        return ratio.mulDown(nominalValue);
    }

    function balanceEffective(uint256 bptAmount) public view returns (uint256) {
        return
            BoostedPoolHelper.calcStableOutGivenBptIn(
                boostedPool,
                bptAmount,
                tokenOut
            );
    }

    function bptBalances()
        internal
        view
        returns (uint256 unstakedBalance, uint256 stakedBalance)
    {
        unstakedBalance = IERC20(boostedPool).balanceOf(investor);
        stakedBalance = IERC20(gauge).balanceOf(investor);
    }

    function encodeUnstake(uint256 amount)
        internal
        view
        returns (
            address to,
            uint256 value,
            bytes memory data
        )
    {
        to = gauge;
        value = 0;
        data = abi.encodeWithSignature("withdraw(uint256)", amount);
    }

    function encodeExit(uint256 maxAmountIn, uint256 amountOut)
        internal
        view
        returns (
            address to,
            uint256 value,
            bytes memory data
        )
    {
        address linearPool = BoostedPoolHelper.findLinearPool(
            boostedPool,
            tokenOut
        );

        // Note we need to encode a dynamic type array
        // hence the ugly instantiation style
        address[] memory assets = new address[](3);
        assets[0] = boostedPool;
        assets[1] = linearPool;
        assets[2] = tokenOut;

        int256[] memory limits = new int256[](3);
        limits[0] = int256(maxAmountIn);
        limits[1] = 0;
        limits[2] = -1 * int256(amountOut);

        IVault.BatchSwapStep[] memory swapSteps = new IVault.BatchSwapStep[](2);
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

        // the actual return values
        to = vault;
        value = 0;
        data = abi.encodeWithSelector(
            0x945bcec9,
            uint8(IVault.SwapKind.GIVEN_OUT),
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
        );
    }

    function encodeUnstakeAndExit(
        uint256 amontUnstake,
        uint256 maxAmountIn,
        uint256 amountOut
    )
        public
        view
        returns (
            address to,
            uint256 value,
            bytes memory data
        )
    {
        (address to1, uint256 value1, bytes memory data1) = encodeUnstake(
            amontUnstake
        );
        (address to2, uint256 value2, bytes memory data2) = encodeExit(
            maxAmountIn,
            amountOut
        );

        to = multisend;
        value = 0;
        data = abi.encodePacked(
            abi.encodePacked(
                uint8(0),
                to1,
                value1,
                uint256(data1.length),
                data1
            ),
            abi.encodePacked(
                uint8(0),
                to2,
                value2,
                uint256(data2.length),
                data2
            )
        );
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

    function _debugPricesIndirect() public view returns (uint256, uint256) {
        address[] memory stableTokens = BoostedPoolHelper.findStableTokens(
            boostedPool
        );

        uint256 price1 = BoostedPoolHelper.calcPriceIndirect(
            boostedPool,
            stableTokens[0],
            stableTokens[1]
        );

        uint256 price2 = BoostedPoolHelper.calcPriceIndirect(
            boostedPool,
            stableTokens[0],
            stableTokens[2]
        );

        return (price1, price2);
    }
}
