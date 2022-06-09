pragma solidity ^0.8.0;
// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "../../../ILiquidityPosition.sol";

import "../../../helpers/balancer/BoostedPool.sol";

contract BoostedPoolAdapter is ILiquidityPosition {
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
    //uint256 public slipUp;
    //uint256 public slipDown;

    uint256 public parityTolerance;

    constructor(
        address _investor,
        address _pool,
        address _tokenOut
    ) {
        investor = _investor;
        pool = _pool;
        tokenOut = _tokenOut;
        // 50 basis points
        parityTolerance = FixedPoint.ONE.sub(995 * 1e15);
    }

    function asset() external view override returns (address) {
        return tokenOut;
    }

    function balance() external view override returns (uint256) {
        return debugNominalBalance(IERC20(pool).balanceOf(investor));
    }

    function setInvestor(address _investor) external {
        investor = _investor;
        emit SetInvestor(_investor);
    }

    function setAsset(address _asset) external {
        tokenOut = _asset;
        emit SetAsset(_asset);
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
        address[] memory stableTokens = BoostedPool.findStableTokens(pool);

        uint256 price1 = BoostedPool.calcPrice(
            pool,
            stableTokens[0],
            stableTokens[1]
        );

        uint256 price2 = BoostedPool.calcPrice(
            pool,
            stableTokens[0],
            stableTokens[2]
        );

        return (price1, price2);
    }

    function _debugPricesIndirect() public view returns (uint256, uint256) {
        address[] memory stableTokens = BoostedPool.findStableTokens(pool);

        uint256 price1 = BoostedPool.calcPriceIndirect(
            pool,
            stableTokens[0],
            stableTokens[1]
        );

        uint256 price2 = BoostedPool.calcPriceIndirect(
            pool,
            stableTokens[0],
            stableTokens[2]
        );

        return (price1, price2);
    }

    function debugNominalBalance(uint256 bptAmountIn)
        public
        view
        returns (uint256)
    {
        // TODO first balance is just naive
        // pending taking into account how much liquidity is in the LinearPool
        address[] memory linearPools = BoostedPool.findLinearPools(pool);
        uint256 tvl;
        for (uint256 i = 0; i < linearPools.length; i++) {
            tvl = tvl + LinearPool.calcNominalValue(linearPools[i]);
        }

        uint256 cut = bptAmountIn.divDown(
            IStablePhantomPool(pool).getVirtualSupply()
        );

        return cut.mulDown(tvl);
    }

    function debugExitBalance(uint256 bptAmountIn)
        public
        view
        returns (uint256)
    {
        return BoostedPool.calcStableOutGivenBptIn(pool, bptAmountIn, tokenOut);
    }

    function isWithdrawalAvailable() external view override returns (bool) {
        // we should pick one of those
        return isInParity() && isInTandem();
    }

    function withdrawalInstructions(uint256 amount)
        external
        pure
        override
        returns (
            address,
            uint256,
            bytes memory
        )
    {
        address bla;
        return (bla, 0, "0x");
        // uint256 amountOut = amount;
        // uint256 requiredAmountIn = inFromOut(amountOut);
        // (uint256 unstakedAmountIn, uint256 stakedAmountIn) = balancesIn();

        // if (requiredAmountIn <= unstakedAmountIn) {
        //     return encodeExit();
        // } else if (requiredAmountIn <= unstakedAmountIn + stakedAmountIn) {
        //     // TODO multisendEncode(encodeUnstake(), encodeExit())
        //     return encodeUnstake(requiredAmountIn - unstakedAmountIn);
        // } else {
        //     revert NotEnoughLitquidity();
        // }
    }

    // function balancesIn()
    //     internal
    //     view
    //     returns (uint256 unstakedAmountIn, uint256 stakedAmountIn)
    // {
    //     unstakedAmountIn = IERC20(pool).balanceOf(investor);
    //     stakedAmountIn = IERC20(gauge).balanceOf(investor);
    // }

    // function balancesOut()
    //     internal
    //     view
    //     returns (uint256 unstakedAmountOut, uint256 stakedAmountOut)
    // {
    //     (uint256 unstakedAmountIn, uint256 stakedAmountIn) = balancesIn();

    //     unstakedAmountOut = outFromIn(unstakedAmountIn);
    //     stakedAmountOut = outFromIn(stakedAmountIn);
    // }

    // function outFromIn(uint256 amountIn)
    //     private
    //     pure
    //     returns (uint256 amountOut)
    // {
    //     // uint256 existingIn = IERC20(pool).totalSupply();
    //     // uint256 existingOut = findAssetInPool();

    //     // uint256 ratio = amountIn.div(existingIn);

    //     // amountOut = existingOut.mul(ratio);
    //     return amountIn;
    // }

    // function inFromOut(uint256 amountOut)
    //     private
    //     pure
    //     returns (uint256 amountIn)
    // {
    //     // uint256 existingIn = IERC20(pool).totalSupply();
    //     // uint256 existingOut = findAssetInPool();

    //     // uint256 ratio = amountOut.div(existingOut);

    //     // amountIn = existingIn.mul(ratio);

    //     return amountOut;
    // }

    // function encodeUnstake(uint256 amountIn)
    //     internal
    //     view
    //     returns (
    //         address to,
    //         uint256 value,
    //         bytes memory data
    //     )
    // {
    //     to = gauge;
    //     value = 0;
    //     data = abi.encodeWithSignature("withdraw(uint256)", amountIn);
    // }

    // function encodeExit()
    //     internal
    //     view
    //     returns (
    //         address to,
    //         uint256 value,
    //         bytes memory data
    //     )
    // {
    //     to = vault;
    //     value = 0;

    //     // address[] memory tokens = getPoolTokens();
    //     // uint256[] memory minAmountsOut = new uint256[](tokens.length);
    //     // minAmountsOut[findAssetIndex(tokens)] = amountOut;
    //     data = "0x";

    //     // data = abi.encodeWithSignature(
    //     //     "exitPool",
    //     //     poolId,
    //     //     investor,
    //     //     investor
    //     //     // (
    //     //     //     tokens: tokens,
    //     //     //     minAmountsOut: minAmountsOut,
    //     //     //     toInternalBalance: false,
    //     //     //     userData: abi.encode(PoolExitKind.EXACT_BPT_IN_FOR_TOKENS_OUT, amountIn)
    //     //     // )
    //     // );
    // }
}
