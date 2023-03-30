// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@gnosis.pm/zodiac/contracts/core/Module.sol";

import "./MultisendEncoder.sol";
import "./IDebtPosition.sol";
import "./ILiquidityPosition.sol";

struct Tube {
    address dp;
    address lp;
}

contract Siphon is Module, MultisendEncoder {
    mapping(string => Tube) public tubes;

    error TubeIsConnected();

    error TubeIsDisconnected();

    error UnsuitableAdapter();

    error AssetMismatch();

    error TriggerRatioNotSet();

    error TargetRatioNotSet();

    error DebtPositionIsHealthy();

    error NoLiquidityInvested();

    error NoLiquidityWithdrawn();

    error WithdrawalBlocked();

    error WithdrawalFailed();

    error PaymentFailed();

    /// @param _owner Address of the owner
    /// @param _avatar Address of the avatar (e.g. a Gnosis Safe)
    /// @param _target Address of the contract that will call exec function
    constructor(address _owner, address _avatar, address _target) {
        bytes memory initParams = abi.encode(_owner, _avatar, _target);
        setUp(initParams);
    }

    function setUp(bytes memory initParams) public override initializer {
        (address _owner, address _avatar, address _target) = abi.decode(
            initParams,
            (address, address, address)
        );
        __Ownable_init();

        avatar = _avatar;
        target = _target;

        transferOwnership(_owner);
    }

    function connectTube(
        string memory tube,
        address dp,
        address lp
    ) public onlyOwner {
        if (isConnected(tube)) {
            revert TubeIsConnected();
        }

        if (dp == address(0) || lp == address(0)) {
            revert UnsuitableAdapter();
        }

        if (ILiquidityPosition(dp).asset() != IDebtPosition(lp).asset()) {
            revert AssetMismatch();
        }

        tubes[tube] = Tube({dp: dp, lp: lp});
    }

    function disconnectTube(string memory tube) public onlyOwner {
        if (!isConnected(tube)) {
            revert TubeIsDisconnected();
        }

        delete tubes[tube];
    }

    function siphon(string memory tube) public {
        if (!isConnected(tube)) {
            revert TubeIsDisconnected();
        }

        IDebtPosition dp = IDebtPosition(tubes[tube].dp);
        ILiquidityPosition lp = ILiquidityPosition(tubes[tube].lp);

        if (dp.needsRebalancing() == false) {
            revert DebtPositionIsHealthy();
        }

        if (lp.balance() == 0) {
            revert NoLiquidityInvested();
        }

        if (!lp.assessPreWithdraw()) {
            revert WithdrawalBlocked();
        }

        address asset = lp.asset();
        uint256 prevBalance = IERC20(asset).balanceOf(avatar);
        uint256 nextBalance;
        uint256 requestedAmountOut = dp.delta();
        uint256 actualAmountOut;

        address to;
        uint256 value;
        bytes memory data;
        Enum.Operation operation;

        (to, value, data, operation) = encodeMultisend(
            lp.withdrawalInstructions(requestedAmountOut)
        );
        if (!exec(to, value, data, Enum.Operation.Call)) {
            revert WithdrawalFailed();
        }

        if (!lp.assessPostWithdraw()) {
            revert WithdrawalBlocked();
        }

        nextBalance = IERC20(asset).balanceOf(avatar);
        actualAmountOut = nextBalance - prevBalance;

        if (actualAmountOut == 0) {
            revert NoLiquidityWithdrawn();
        }

        (to, value, data, operation) = encodeMultisend(
            dp.paymentInstructions(actualAmountOut)
        );
        if (!exec(to, value, data, Enum.Operation.Call)) {
            revert PaymentFailed();
        }
    }

    function isConnected(string memory tube) public view returns (bool) {
        return tubes[tube].dp != address(0) && tubes[tube].lp != address(0);
    }
}
