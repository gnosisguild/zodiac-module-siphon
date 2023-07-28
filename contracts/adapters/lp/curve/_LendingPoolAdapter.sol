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
    function curve() external view returns (address);

    function token() external view returns (address);

    function coins(int128 i) external view returns (address);

    function underlying_coins(int128 i) external view returns (address);

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

    IERC20 public lpToken;
    ICurvePool public pool;
    ICurveDeposit public deposit;
    IConvexRewards public rewards;

    // Out
    IERC20 public underlyingTokenOut;
    address public lendingTokenOut;
    int128 public indexOut;
    uint256 public scaleFactorOut;

    // Other
    IERC20 public underlyingTokenOther;
    address public lendingTokenOther;
    int128 public indexOther;
    uint256 public scaleFactorOther;

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

    constructor(
        address _deposit,
        address _rewards,
        uint256 _indexOut,
        uint256 _indexOther,
        address _investor,
        uint256 _minAcceptablePrice
    ) {
        bytes memory initParams = abi.encode(
            _deposit,
            _rewards,
            _indexOut,
            _indexOther,
            _investor,
            _minAcceptablePrice
        );
        setUp(initParams);
    }

    function setUp(bytes memory initParams) public override initializer {
        (
            address _deposit,
            address _rewards,
            int128 _indexOut,
            int128 _indexOther,
            address _investor,
            uint256 _minAcceptablePrice
        ) = abi.decode(
                initParams,
                (address, address, int128, int128, address, uint256)
            );

        __Ownable_init();

        lpToken = IERC20(ICurveDeposit(_deposit).token());
        pool = ICurvePool(ICurveDeposit(_deposit).curve());
        deposit = ICurveDeposit(_deposit);
        rewards = IConvexRewards(_rewards);

        indexOut = _indexOut;
        lendingTokenOut = deposit.coins(_indexOut);
        underlyingTokenOut = IERC20(deposit.underlying_coins(_indexOut));
        scaleFactorOut = 10 ** (18 - underlyingTokenOut.decimals());

        indexOther = _indexOther;
        lendingTokenOther = deposit.coins(_indexOther);
        underlyingTokenOther = IERC20(deposit.underlying_coins(_indexOther));
        scaleFactorOther = 10 ** (18 - underlyingTokenOther.decimals());

        investor = _investor;
        minAcceptablePrice = _minAcceptablePrice;
        _transferOwnership(investor);
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

    function setMinAcceptablePrice(
        uint256 nextMinAcceptablePrice
    ) external onlyOwner {
        minAcceptablePrice = nextMinAcceptablePrice;
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
