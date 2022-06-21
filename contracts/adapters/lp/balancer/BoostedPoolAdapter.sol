pragma solidity ^0.8.0;
// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "@gnosis.pm/zodiac/contracts/factory/FactoryFriendly.sol";

import "../../../ILiquidityPosition.sol";

import "../../../helpers/balancer/BoostedPool.sol";

/*FactoryFriendly*/
contract BoostedPoolAdapter is ILiquidityPosition  {
    using FixedPoint for uint256;

    error NotEnoughLitquidity();

    address public avatar;
    address public vault;
    address public boostedPool;
    address public gauge;
    address public tokenOut;

    uint256 public parityTolerance;
    uint256 public slippage;

    constructor(
        address _avatar,
        address _pool,
        address _gauge,
        address _tokenOut
    ) {
        bytes memory initParams = abi.encode(_avatar, _pool, _gauge, _tokenOut);
        setUp(initParams);
    }

    function setUp(bytes memory initParams) public {
        (
            address _avatar,
            address _pool,
            address _gauge,
            address _tokenOut
        ) = abi.decode(initParams, (address, address, address, address));
       // __Ownable_init();

        avatar = _avatar;
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

    function balance() external view override returns (uint256) {
        return balanceEffective();
    }

    function isWithdrawalAvailable() external view override returns (bool) {
        // we should make sure the pool has at least 1M nomimal value?
        return isInParity();
    }

    function withdrawalInstructions(uint256 amountOut)
        external
        view
        override
        returns (Transaction[] memory)
    {
        uint256 amountIn = BoostedPoolHelper.calcBptInGivenStableOut(
            boostedPool,
            tokenOut,
            amountOut
        );
        uint256 maxAmountIn = amountIn.add(amountIn.mulDown(slippage));
        (uint256 unstakedBalance, uint256 stakedBalance) = bptBalances();

        // The balance function is getting the effectively available balance
        // minus splippage, so if Siphon requests after query balance
        // the following invariant should hold
        require(
            maxAmountIn < unstakedBalance + stakedBalance,
            "Not enough BPT"
        );

        uint256 amountToUnstake = maxAmountIn > unstakedBalance
            ? Math.min(stakedBalance, maxAmountIn - unstakedBalance)
            : 0;

        Transaction[] memory result;
        if (amountToUnstake > 0) {
            result = new Transaction[](2);
            result[0] = encodeUnstake(amountToUnstake);
            result[1] = encodeExit(maxAmountIn, amountOut);
        } else {
            result = new Transaction[](1);
            result[0] = encodeExit(maxAmountIn, amountOut);
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
        unstakedBalance = IERC20(boostedPool).balanceOf(avatar);
        stakedBalance = IERC20(gauge).balanceOf(avatar);
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

    function encodeExit(uint256 maxAmountIn, uint256 amountOut)
        internal
        view
        returns (Transaction memory)
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
        return
            Transaction({
                to: vault,
                value: 0,
                data: abi.encodeWithSelector(
                    0x945bcec9,
                    uint8(IVault.SwapKind.GIVEN_OUT),
                    swapSteps,
                    assets,
                    IVault.FundManagement({
                        sender: avatar,
                        fromInternalBalance: false,
                        recipient: avatar,
                        toInternalBalance: false
                    }),
                    limits,
                    uint256(999999999999999999)
                ),
                operation: Enum.Operation.Call
            });
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



    function setParityTolerane(uint256 _parityTolerance) external  {
        parityTolerance = _parityTolerance;
    }

    function setSlippage(uint256 _slippage) external  {
        slippage = _slippage;
    }
}
