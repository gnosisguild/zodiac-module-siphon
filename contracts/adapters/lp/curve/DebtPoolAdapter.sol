// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../../ILiquidityPosition.sol";

interface ICurveDeposit {
    function calc_withdraw_one_coin(
        uint256 amount,
        int128 index
    ) external view returns (uint256);

    function remove_liquidity_one_coin(
        uint256 amount,
        int128 index,
        uint256 minAmountOut
    ) external;
}

interface ICurvePool {
    function calc_token_amount(
        uint256[2] memory amounts,
        bool deposit
    ) external view returns (uint256);

    function balances(int128 i) external view returns (uint256);
}

interface IConvexRewards {
    function withdrawAndUnwrap(
        uint256 amount,
        bool claim
    ) external returns (bool);

    function balanceOf(address) external view returns (uint256);
}

interface ICompoundToken {
    function exchangeRateStored() external view returns (uint256);
}

contract CurveDebtPoolAdapter is ILiquidityPosition {
    uint256 public constant scale = 10 ** 18;

    address public immutable investor;

    ICurvePool public immutable pool;
    IERC20 public immutable token;
    ICurveDeposit public immutable deposit;
    IConvexRewards public immutable rewards;

    IERC20 public immutable stableOut;
    ICompoundToken public immutable cTokenOut;
    int128 public immutable indexOut;
    uint256 public immutable scaleFactorStableOut;

    IERC20 public immutable stableOther;
    ICompoundToken public immutable cTokenOther;
    int128 public immutable indexOther;
    uint256 public immutable scaleFactorStableOther;

    constructor(address _investor) {
        investor = _investor;

        pool = ICurvePool(0xA2B47E3D5c44877cca798226B7B8118F9BFb7A56);
        token = IERC20(0x845838DF265Dcd2c412A1Dc9e959c7d08537f8a2);
        deposit = ICurveDeposit(0xeB21209ae4C2c9FF2a86ACA31E123764A3B6Bc06);
        rewards = IConvexRewards(0xf34DFF761145FF0B05e917811d488B441F33a968);

        // DAI
        cTokenOut = ICompoundToken(0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643);
        stableOut = IERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);
        indexOut = 0;
        scaleFactorStableOut = 1;

        // USDC
        cTokenOther = ICompoundToken(
            0x39AA39c021dfbaE8faC545936693aC917d5E7563
        );
        stableOther = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
        indexOther = 1;
        scaleFactorStableOther = 10 ** 12;
    }

    function asset() public view override returns (address) {
        return address(stableOut);
    }

    function balance() public view override returns (uint256) {
        return deposit.calc_withdraw_one_coin(effectiveLptBalance(), indexOut);
    }

    function assessPreWithdraw() public pure override returns (bool) {
        return true;
    }

    function assessPostWithdraw() public pure override returns (bool) {
        return true;
    }

    function withdrawalInstructions(
        uint256 requestedAmountOut
    ) external view override returns (Transaction[] memory result) {
        uint256 amountOut = balance() > requestedAmountOut
            ? requestedAmountOut
            : balance();
        uint256 amountIn = _calcAmountIn(amountOut);

        (uint256 unstakedBalance, ) = lptBalances();
        uint256 amountToUnstake = amountIn > unstakedBalance
            ? amountIn - unstakedBalance
            : 0;

        if (amountToUnstake > 0) {
            result = new Transaction[](4);
            result[0] = _encodeUnstake(amountToUnstake);
            result[1] = _encodeApprove(0);
            result[2] = _encodeApprove(amountIn);
            result[3] = _encodeExit(amountIn);
        } else {
            result = new Transaction[](3);
            result[0] = _encodeApprove(0);
            result[1] = _encodeApprove(amountIn);
            result[2] = _encodeExit(amountIn);
        }
    }

    function lptBalances()
        public
        view
        returns (uint256 unstakedBalance, uint256 stakedBalance)
    {
        unstakedBalance = token.balanceOf(investor);
        stakedBalance = rewards.balanceOf(investor);
    }

    function effectiveLptBalance() public view returns (uint256) {
        (uint256 unstakedBalance, uint256 stakedBalance) = lptBalances();

        uint256 lptBalance = unstakedBalance + stakedBalance;
        uint256 lptLiquidAmount = getLiquidLptAmount();

        return lptBalance > lptLiquidAmount ? lptLiquidAmount : lptBalance;
    }

    function getLiquidLptAmount() public view returns (uint256) {
        uint256 liquidRatio = _calcLiquidRatio();
        uint256 percent90 = _div(9, 10);

        uint256 effectiveLiquidRatio = _mul(percent90, liquidRatio);
        uint256 totalSupply = token.totalSupply();

        return _mul(effectiveLiquidRatio, totalSupply);
    }

    function _encodeUnstake(
        uint256 amount
    ) internal view returns (Transaction memory) {
        return
            Transaction({
                to: address(rewards),
                value: 0,
                data: abi.encodeWithSelector(
                    IConvexRewards.withdrawAndUnwrap.selector,
                    amount,
                    false
                ),
                operation: Enum.Operation.Call
            });
    }

    function _encodeApprove(
        uint256 amount
    ) internal view returns (Transaction memory) {
        return
            Transaction({
                to: address(token),
                value: 0,
                data: abi.encodeWithSelector(
                    IERC20.approve.selector,
                    address(deposit),
                    amount
                ),
                operation: Enum.Operation.Call
            });
    }

    function _encodeExit(
        uint256 amount
    ) internal view returns (Transaction memory) {
        return
            Transaction({
                to: address(deposit),
                value: 0,
                data: abi.encodeWithSelector(
                    ICurveDeposit.remove_liquidity_one_coin.selector,
                    amount,
                    indexOut,
                    0
                ),
                operation: Enum.Operation.Call
            });
    }

    function _calcAmountIn(uint256 amountOut) public view returns (uint256) {
        uint256 cTokenAmount = _calcCompoundWrap(cTokenOut, amountOut);
        return pool.calc_token_amount([cTokenAmount, 0], false);
    }

    /*
     * Determines the maximum ratio of the pool that can the withdrawn in out token
     * Used to determine the effective LPBalance. Example:
     * OutToken in reserves 20%
     * OtherToken in reserves 80%
     * Whale has 30% of the pool
     */
    function _calcLiquidRatio() public view returns (uint256) {
        uint256 reservesStableOut = _calcCompoundUnwrap(
            cTokenOut,
            pool.balances(indexOut)
        ) * scaleFactorStableOut;

        uint256 reservesStableOther = _calcCompoundUnwrap(
            cTokenOther,
            pool.balances(indexOther)
        ) * scaleFactorStableOther;

        return _div(reservesStableOut, reservesStableOut + reservesStableOther);
    }

    function _calcCompoundWrap(
        ICompoundToken cToken,
        uint256 amount
    ) public view returns (uint256) {
        return (amount * scale) / cToken.exchangeRateStored();
    }

    function _calcCompoundUnwrap(
        ICompoundToken cToken,
        uint256 amount
    ) public view returns (uint256) {
        return (amount * cToken.exchangeRateStored()) / scale;
    }

    function _div(uint256 n, uint256 d) public pure returns (uint256) {
        return (n * scale) / d;
    }

    function _mul(uint256 val, uint256 ratio) public pure returns (uint256) {
        return (val * ratio) / scale;
    }
}
