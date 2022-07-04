// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@gnosis.pm/zodiac/contracts/core/Module.sol";

import "./MultisendEncoder.sol";
import "./IDebtPosition.sol";
import "./ILiquidityPosition.sol";

struct AssetFlow {
    address dp;
    address lp;
}

contract Siphon is Module, MultisendEncoder {
    mapping(string => AssetFlow) public flows;

    error FlowIsPlugged();

    error FlowIsUnplugged();

    error UnsuitableAdapter();

    error AssetMismatch();

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

    function plug(
        string memory flow,
        address dp,
        address lp
    ) public onlyOwner {
        if (isPlugged(flow)) {
            revert FlowIsPlugged();
        }

        if (dp == address(0) || lp == address(0)) {
            revert UnsuitableAdapter();
        }

        if (ILiquidityPosition(dp).asset() != IDebtPosition(lp).asset()) {
            revert AssetMismatch();
        }

        flows[flow] = AssetFlow({dp: dp, lp: lp});
    }

    function unplug(string memory flow) public onlyOwner {
        if (!isPlugged(flow)) {
            revert FlowIsUnplugged();
        }

        delete flows[flow];
    }

    function payDebt(string memory flow) public {
        if (!isPlugged(flow)) {
            revert FlowIsUnplugged();
        }

        IDebtPosition dp = IDebtPosition(flows[flow].dp);
        ILiquidityPosition lp = ILiquidityPosition(flows[flow].lp);

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

        uint256 prevBalance = IERC20(lp.asset()).balanceOf(avatar);
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

        nextBalance = IERC20(lp.asset()).balanceOf(avatar);
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

    function isPlugged(string memory flow) internal view returns (bool) {
        return flows[flow].dp != address(0) && flows[flow].lp != address(0);
    }
}
