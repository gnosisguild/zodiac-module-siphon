// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

import "@gnosis.pm/zodiac/contracts/factory/FactoryFriendly.sol";
import "../../../ILiquidityPosition.sol";

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);

    function balanceOf(address account) external view returns (uint256);

    function decimals() external view returns (uint8);

    function totalSupply() external view returns (uint256);
}

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

    function balances(int128 i) external view returns (uint256);

    function fee() external view returns (uint256);

    function get_dy(
        int128 i,
        int128 j,
        uint256 dx
    ) external view returns (uint256);

    function get_dy_underlying(
        int128 i,
        int128 j,
        uint256 dx
    ) external view returns (uint256);

    function exchange(int128 i, int128 j, uint256 dx, uint256 minDy) external;

    function remove_liquidity(uint256 amount, uint256[2] memory) external;
}

interface IConvexRewards {
    function withdrawAndUnwrap(
        uint256 amount,
        bool claim
    ) external returns (bool);

    function balanceOf(address) external view returns (uint256);
}

abstract contract LendingPoolAdapter is FactoryFriendly, ILiquidityPosition {
    uint256 public constant SCALE = 10 ** 18;

    IERC20 public immutable lpToken;
    ICurvePool public immutable pool;
    ICurveDeposit public immutable deposit;
    IConvexRewards public immutable rewards;

    // Out
    IERC20 public immutable underlyingTokenOut;
    address public immutable lendingTokenOut;
    int128 public immutable indexOut;
    uint256 public immutable scaleFactorOut;

    // Other
    IERC20 public immutable underlyingTokenOther;
    address public immutable lendingTokenOther;
    int128 public immutable indexOther;
    uint256 public immutable scaleFactorOther;

    /**
     * @dev the owner of the LendingPool position
     */
    address public investor;

    /**
     * @dev the minimum acceptable price of tokenOut in tokenOther
     *
     * NOTE: as 18 decimal fixed point
     */
    uint256 public minAcceptablePrice;

    constructor(Config memory config) {
        /*
         * Only initialize common immutable variables here. These will be the
         * same even across different proxy deployments of the concrete adapter
         */
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
        return _calcAmountOutGivenIn(effectiveLptBalance());
    }

    function assessPreWithdraw() public pure override returns (bool) {
        return true;
    }

    function assessPostWithdraw() public view override returns (bool) {
        return price() > minAcceptablePrice;
    }

    function withdrawalInstructions(
        uint256 requestedAmountOut
    ) external view override returns (Transaction[] memory result) {
        uint256 amountOut = balance() > requestedAmountOut
            ? requestedAmountOut
            : balance();
        uint256 amountIn = _calcAmountInGivenOut(amountOut);

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

    /// @notice gets out price in terms of other
    /// @return the price as fixed point with 18 decimal places
    function price() public view returns (uint256) {
        // A thousand units
        uint256 dx = 1000 * 10 ** 18;
        uint256 dy = pool.get_dy_underlying(indexOut, indexOther, dx);

        return _div(dy * scaleFactorOther, dx);
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

        uint256 total = unstakedBalance + stakedBalance;
        uint256 cap = _calcMaxAmountIn();

        return total > cap ? cap : total;
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

    /// @dev calculates lptAmountIn given assetAmountOut
    function _calcAmountInGivenOut(
        uint256 amountOut
    ) internal view returns (uint256) {
        uint256 assetAmountAvailable = balance();
        assert(amountOut <= assetAmountAvailable);

        uint256 ratio = _div(amountOut, assetAmountAvailable);
        return _mul(ratio, effectiveLptBalance());
    }

    /// @dev calculates assetAmountOut given lptAmountIn
    function _calcAmountOutGivenIn(
        uint256 amountIn
    ) internal view returns (uint256) {
        return deposit.calc_withdraw_one_coin(amountIn, indexOut);
    }

    /*
     * Determines the maximum LPToken amount that can be used for withdraw
     * Useful as a whale could be sitting on a too BPT position. Example:
     * OutToken in reserves 20%
     * OtherToken in reserves 80%
     * Whale has 30% of the pool LPToken
     */
    function _calcMaxAmountIn() public view returns (uint256) {
        uint256 reservesUnderlyingOut = _calcLendingToUnderlying(
            lendingTokenOut,
            pool.balances(indexOut)
        ) * scaleFactorOut;

        uint256 reservesUnderlyingOther = _calcLendingToUnderlying(
            lendingTokenOther,
            pool.balances(indexOther)
        ) * scaleFactorOther;

        uint256 liquidRatio = _div(
            reservesUnderlyingOut,
            reservesUnderlyingOut + reservesUnderlyingOther
        );

        // safety buffer, only allow half
        liquidRatio = liquidRatio / 2;

        return _mul(liquidRatio, lpToken.totalSupply());
    }

    function _calcUnderlyingToLending(
        address lendingToken,
        uint256 amount
    ) public view virtual returns (uint256);

    function _calcLendingToUnderlying(
        address lendingToken,
        uint256 amount
    ) public view virtual returns (uint256);

    function _div(uint256 x, uint256 y) internal pure returns (uint256) {
        return (x * SCALE) / y;
    }

    function _mul(uint256 x, uint256 y) internal pure returns (uint256) {
        return (x * y) / SCALE;
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
