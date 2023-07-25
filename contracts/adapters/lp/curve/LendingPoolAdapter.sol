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

abstract contract LendingPoolAdapter is ILiquidityPosition {
    uint256 public constant scale = 10 ** 18;

    address public immutable investor;

    IERC20 public immutable lpToken;
    ICurvePool public immutable pool;
    ICurveDeposit public immutable deposit;
    IConvexRewards public immutable rewards;

    // a stable coin
    IERC20 public immutable underlyingTokenOut;
    // the stable coin's lent version
    address public immutable lendingTokenOut;
    int128 public immutable indexOut;
    uint256 public immutable scaleFactorOut;

    // a stable coin
    IERC20 public immutable underlyingTokenOther;
    // the stable coin's lent version
    address public immutable lendingTokenOther;
    int128 public immutable indexOther;
    uint256 public immutable scaleFactorOther;

    constructor(address _investor, Config memory config) {
        investor = _investor;

        lpToken = config.lpToken;
        pool = config.pool;
        deposit = config.deposit;
        rewards = config.rewards;

        lendingTokenOut = config.lendingTokenOut;
        underlyingTokenOut = config.underlyingTokenOut;
        indexOut = config.indexOut;
        scaleFactorOut = config.scaleFactorOut;

        lendingTokenOther = config.lendingTokenOther;
        underlyingTokenOther = config.underlyingTokenOther;
        indexOther = config.indexOther;
        scaleFactorOther = config.scaleFactorOther;
    }

    function asset() public view override returns (address) {
        return address(underlyingTokenOut);
    }

    function balance() public view override returns (uint256) {
        return deposit.calc_withdraw_one_coin(effectiveLptBalance(), indexOut);
    }

    function assessPreWithdraw() public pure override returns (bool) {
        return true;
    }

    function assessPostWithdraw() public pure override returns (bool) {
        // TODO
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
        unstakedBalance = lpToken.balanceOf(investor);
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
        uint256 totalSupply = lpToken.totalSupply();

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
                to: address(lpToken),
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
        uint256 lendingTokenAmount = _calcUnderlyingTokenWrap(
            lendingTokenOut,
            amountOut
        );
        return pool.calc_token_amount([lendingTokenAmount, 0], false);
    }

    /*
     * Determines the maximum ratio of the pool that can the withdrawn in out token
     * Used to determine the effective LPBalance. Example:
     * OutToken in reserves 20%
     * OtherToken in reserves 80%
     * Whale has 30% of the pool
     */
    function _calcLiquidRatio() public view returns (uint256) {
        uint256 reservesUnderlyingOut = _calcLendingTokenUnwrap(
            lendingTokenOut,
            pool.balances(indexOut)
        ) * scaleFactorOut;

        uint256 reservesUnderlyingOther = _calcLendingTokenUnwrap(
            lendingTokenOther,
            pool.balances(indexOther)
        ) * scaleFactorOther;

        return
            _div(
                reservesUnderlyingOut,
                reservesUnderlyingOut + reservesUnderlyingOther
            );
    }

    function _calcUnderlyingTokenWrap(
        address lendingToken,
        uint256 amount
    ) public view virtual returns (uint256);

    function _calcLendingTokenUnwrap(
        address lendingToken,
        uint256 amount
    ) public view virtual returns (uint256);

    function _div(uint256 n, uint256 d) internal pure returns (uint256) {
        return (n * scale) / d;
    }

    function _mul(uint256 val, uint256 ratio) internal pure returns (uint256) {
        return (val * ratio) / scale;
    }

    struct Config {
        IERC20 lpToken;
        ICurvePool pool;
        ICurveDeposit deposit;
        IConvexRewards rewards;
        IERC20 underlyingTokenOut;
        address lendingTokenOut;
        int128 indexOut;
        uint256 scaleFactorOut;
        IERC20 underlyingTokenOther;
        address lendingTokenOther;
        int128 indexOther;
        uint256 scaleFactorOther;
    }
}
