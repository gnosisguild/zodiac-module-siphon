pragma solidity ^0.8.0;
// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@gnosis.pm/zodiac/contracts/factory/FactoryFriendly.sol";

import "../../../helpers/balancer/BoostedPool.sol";

import "../../../ILiquidityPosition.sol";

abstract contract BalV2WeightedPool is ILiquidityPosition, FactoryFriendly {
    using FixedPoint for uint256;

    event SetAsset(address asset);
    event SetInvestor(address target);
    event SetVault(address vault);

    error NotEnoughLitquidity();

    address public multisig;

    address public investor;
    address public vault;
    address public pool;
    address public gauge;
    address public tokenOut;

    // TODO having up and down is 3am code, will fix
    uint256 public slipUp;
    uint256 public slipDown;

    uint256 public parityTolerance;

    function setUp() public {
        // TODO will move defaults to a constructor
        // default slippage is 1%
        slipUp = 101 * 1e16;
        slipDown = 995 * 1e16;

        // 50 basis points
        parityTolerance = FixedPoint.ONE.sub(995 * 1e16);
    }

    function setInvestor(address _investor) external onlyOwner {
        investor = _investor;
        emit SetInvestor(_investor);
    }

    function setAsset(address asset) external onlyOwner {
        tokenOut = asset;
        emit SetAsset(asset);
    }

    function isInParity() public view returns (bool) {
        address[] memory stableTokens = BoostedPool.findStableTokens(pool);

        uint256 delta = 0;
        for (uint256 i = 1; i < stableTokens.length; i++) {
            uint256 price = BoostedPool.calcPrice(
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

    function isInTandem() public view returns (bool) {
        address[] memory stableTokens = BoostedPool.findStableTokens(pool);

        uint256 delta = 0;
        for (uint256 i = 1; i < stableTokens.length; i++) {
            uint256 price = BoostedPool.calcPriceIndirect(
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

    function balance() external pure override returns (uint256) {
        return 0;
    }

    function isWithdrawalEnabled() external view override returns (bool) {
        // we should pick one of those
        return isInParity() && isInTandem();
    }

    function withdrawalInstructions(uint256 amount)
        external
        view
        override
        returns (
            address,
            uint256,
            bytes memory
        )
    {
        uint256 amountOut = amount;
        uint256 requiredAmountIn = inFromOut(amountOut);
        (uint256 unstakedAmountIn, uint256 stakedAmountIn) = balancesIn();

        if (requiredAmountIn <= unstakedAmountIn) {
            return encodeExit();
        } else if (requiredAmountIn <= unstakedAmountIn + stakedAmountIn) {
            // TODO multisendEncode(encodeUnstake(), encodeExit())
            return encodeUnstake(requiredAmountIn - unstakedAmountIn);
        } else {
            revert NotEnoughLitquidity();
        }
    }

    function balancesIn()
        internal
        view
        returns (uint256 unstakedAmountIn, uint256 stakedAmountIn)
    {
        unstakedAmountIn = IERC20(pool).balanceOf(investor);
        stakedAmountIn = IERC20(gauge).balanceOf(investor);
    }

    function balancesOut()
        internal
        view
        returns (uint256 unstakedAmountOut, uint256 stakedAmountOut)
    {
        (uint256 unstakedAmountIn, uint256 stakedAmountIn) = balancesIn();

        unstakedAmountOut = outFromIn(unstakedAmountIn);
        stakedAmountOut = outFromIn(stakedAmountIn);
    }

    function outFromIn(uint256 amountIn)
        private
        pure
        returns (uint256 amountOut)
    {
        // uint256 existingIn = IERC20(pool).totalSupply();
        // uint256 existingOut = findAssetInPool();

        // uint256 ratio = amountIn.div(existingIn);

        // amountOut = existingOut.mul(ratio);
        return amountIn;
    }

    function inFromOut(uint256 amountOut)
        private
        pure
        returns (uint256 amountIn)
    {
        // uint256 existingIn = IERC20(pool).totalSupply();
        // uint256 existingOut = findAssetInPool();

        // uint256 ratio = amountOut.div(existingOut);

        // amountIn = existingIn.mul(ratio);

        return amountOut;
    }

    function encodeUnstake(uint256 amountIn)
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
        data = abi.encodeWithSignature("withdraw(uint256)", amountIn);
    }

    function encodeExit()
        internal
        view
        returns (
            address to,
            uint256 value,
            bytes memory data
        )
    {
        to = vault;
        value = 0;

        // address[] memory tokens = getPoolTokens();
        // uint256[] memory minAmountsOut = new uint256[](tokens.length);
        // minAmountsOut[findAssetIndex(tokens)] = amountOut;
        data = "0x";

        // data = abi.encodeWithSignature(
        //     "exitPool",
        //     poolId,
        //     investor,
        //     investor
        //     // (
        //     //     tokens: tokens,
        //     //     minAmountsOut: minAmountsOut,
        //     //     toInternalBalance: false,
        //     //     userData: abi.encode(PoolExitKind.EXACT_BPT_IN_FOR_TOKENS_OUT, amountIn)
        //     // )
        // );
    }
}
