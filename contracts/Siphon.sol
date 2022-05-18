// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

import "@gnosis.pm/zodiac/contracts/core/Module.sol";
import "./DebtPosition.sol";
import "./LiquidityPosition.sol";

struct Couple {
    LiquidityPosition lp;
    DebtPosition dp;
}

contract Siphon is Module {
    mapping(address => bool) public dps;
    mapping(address => bool) public lps;

    error DebtPositionNotEnabled();

    error LiquidityPositionNotEnabled();

    error TriggerRatioNotSet();

    error TargetRatioNotSet();

    error DebtPositionIsHealthy();

    error UnsuitableLiquidityForPayment();

    error NotEnoughLiquidityForPayment();

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

    function setUp(bytes memory initParams) public override {
        (address _owner, address _avatar, address _target) = abi.decode(
            initParams,
            (address, address, address)
        );
        __Ownable_init();

        avatar = _avatar;
        target = _target;

        transferOwnership(_owner);

        // TODO missing setups
    }

    function enableDebtPosition(address dp) public onlyOwner {
        dps[dp] = true;
    }

    function disableDebtPosition(address dp) public onlyOwner {
        delete dps[dp];
    }

    function enableLiquidityPosition(address lp) public onlyOwner {
        lps[lp] = true;
    }

    function disableLiquidityPosition(address lp) public onlyOwner {
        delete lps[lp];
    }

    // missing openzeppelin
    function payDebt(address _dp, address _lp) public {
        if (dps[_dp] != true) {
            revert DebtPositionNotEnabled();
        }

        if (lps[_lp] != true) {
            revert LiquidityPositionNotEnabled();
        }

        DebtPosition dp = DebtPosition(_dp);
        LiquidityPosition lp = LiquidityPosition(_lp);

        uint256 triggerRatio = dp.ratioTrigger();
        if (triggerRatio == 0) {
            revert TriggerRatioNotSet();
        }

        uint256 ratio = dp.ratio();
        if (ratio > triggerRatio) {
            revert DebtPositionIsHealthy();
        }

        uint256 targetRatio = dp.ratioTarget();
        if (targetRatio <= triggerRatio) {
            revert TargetRatioNotSet();
        }

        if (dp.assetDebt() != lp.asset()) {
            revert UnsuitableLiquidityForPayment();
        }

        (, uint256 amount) = dp.readDeltas(targetRatio);

        if (lp.balance() < amount) {
            revert NotEnoughLiquidityForPayment();
        }

        address to;
        uint256 value;
        bytes memory data;

        (to, value, data) = lp.withdrawInstructions(amount);
        if (!exec(to, value, data, Enum.Operation.Call)) {
            revert WithdrawalFailed();
        }

        (to, value, data) = dp.paymentInstructions(amount);
        if (!exec(to, value, data, Enum.Operation.Call)) {
            revert PaymentFailed();
        }
    }
}
