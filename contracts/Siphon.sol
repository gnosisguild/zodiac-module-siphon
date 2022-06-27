// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

import "@gnosis.pm/zodiac/contracts/core/Module.sol";

import "./MultisendEncoder.sol";
import "./IDebtPosition.sol";
import "./ILiquidityPosition.sol";

struct PaymentChannel {
    address dp;
    address lp;
}

contract Siphon is Module, MultisendEncoder {
    mapping(string => PaymentChannel) public channels;

    error PaymentChannelAlreadyExists();

    error PaymentChannelNotFound();

    error UnsuitableAdapterAddress();

    error UnsuitableAdapterAsset();

    error TriggerRatioNotSet();

    error TargetRatioNotSet();

    error DebtPositionIsHealthy();

    error UnstableLiquiditySource();

    error NoLiquidityInvested();

    error NoLiquidityWithdrawn();

    error WithdrawalFailed();

    error PaymentFailed();

    /// @param _owner Address of the owner
    /// @param _avatar Address of the avatar (e.g. a Gnosis Safe)
    /// @param _target Address of the contract that will call exec function
    constructor(
        address _owner,
        address _avatar,
        address _target
    ) {
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

    function enableChannel(
        string memory name,
        address dp,
        address lp
    ) public onlyOwner {
        if (isChannelEnabled(name)) {
            revert PaymentChannelAlreadyExists();
        }

        if (dp == address(0) || lp == address(0)) {
            revert UnsuitableAdapterAddress();
        }

        if (ILiquidityPosition(dp).asset() != IDebtPosition(lp).asset()) {
            revert UnsuitableAdapterAsset();
        }

        channels[name] = PaymentChannel({dp: dp, lp: lp});
    }

    function disableChannel(string memory name) public onlyOwner {
        if (!isChannelEnabled(name)) {
            revert PaymentChannelNotFound();
        }

        delete channels[name];
    }

    function payDebt(string memory name) public {
        if (!isChannelEnabled(name)) {
            revert PaymentChannelNotFound();
        }

        PaymentChannel storage channel = channels[name];

        IDebtPosition dp = IDebtPosition(channel.dp);
        ILiquidityPosition lp = ILiquidityPosition(channel.lp);

        uint256 triggerRatio = dp.ratioTrigger();
        if (triggerRatio == 0) {
            revert TriggerRatioNotSet();
        }

        uint256 ratio = dp.ratio();
        if (ratio > triggerRatio) {
            revert DebtPositionIsHealthy();
        }

        uint256 targetRatio = dp.ratioTarget();
        if (targetRatio < triggerRatio) {
            revert TargetRatioNotSet();
        }

        if (lp.balance() == 0) {
            revert NoLiquidityInvested();
        }

        if (!lp.canWithdraw()) {
            revert UnstableLiquiditySource();
        }

        uint256 prevBalance = lp.assetBalance();
        uint256 requiredAmountOut = dp.delta();

        address to;
        uint256 value;
        bytes memory data;
        Enum.Operation operation;

        (to, value, data, operation) = encodeMultisend(
            lp.withdrawalInstructions(requiredAmountOut)
        );
        if (!exec(to, value, data, Enum.Operation.Call)) {
            revert WithdrawalFailed();
        }

        uint256 actualAmountOut = lp.assetBalance() - prevBalance;

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

    function isChannelEnabled(string memory name) internal view returns (bool) {
        PaymentChannel storage channel = channels[name];
        return channel.dp != address(0) && channel.lp != address(0);
    }
}
