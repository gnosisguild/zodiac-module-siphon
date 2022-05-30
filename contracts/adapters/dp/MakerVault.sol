// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

import "../../IDebtPosition.sol";
import "@gnosis.pm/zodiac/contracts/factory/FactoryFriendly.sol";

interface ICDPManagger {
    function ilks(uint256 vault) external view returns (bytes32 ilk);

    function urns(uint256 vault) external view returns (address urnHandler);

    function vat() external view returns (address vat);
}

interface IDSProxy {
    function execute(address _target, bytes memory _data)
        external
        payable
        returns (bytes32 response);
}

interface IDSSProxyActions {
    function wipe(
        address manager,
        address daiJoin,
        uint256 cdp,
        uint256 wad
    ) external;
}

interface ISpotter {
    function ilks(bytes32 ilk) external view returns (address pip, uint256 mat);
}

interface IVat {
    function urns(bytes32 ilk, address urnHandler)
        external
        view
        returns (uint256 ink, uint256 art);

    function ilks(bytes32 ilk)
        external
        view
        returns (
            uint256 art,
            uint256 rate,
            uint256 spot,
            uint256 line,
            uint256 dust
        );
}

contract MakerVaultAdapter is IDebtPosition, FactoryFriendly {
    event SetAssetCollateral(address assetCollateral);
    event SetAssetDebt(address assetDebt);
    event SetcdpManager(address cdpManager);
    event SetDaiJoin(address daiJoin);
    event SetdsProxy(address dsProxy);
    event SetdsProxyActions(address dsProxyActions);
    event SetRatioTarget(uint256 ratioTarget);
    event SetRatioTrigger(uint256 ratioTrigger);
    event SetSpotter(address spotter);

    address public override assetCollateral;
    address public override assetDebt;
    address public cdpManager;
    address public daiJoin;
    address public dsProxy;
    address public dsProxyActions;
    address public spotter;
    address public urnHandler;
    address public vat;

    bytes32 public ilk;

    uint256 public override ratioTarget;
    uint256 public override ratioTrigger;
    uint256 public vault;

    function setUp() public {}

    function setAssetCollateral(address asset) external onlyOwner {
        assetCollateral = asset;
        emit SetAssetCollateral(assetCollateral);
    }

    function setAssetDebt(address asset) external onlyOwner {
        assetDebt = asset;
        emit SetAssetDebt(assetDebt);
    }

    function setcdpManager(address _cdpManager) external onlyOwner {
        cdpManager = _cdpManager;
        vat = ICDPManagger(cdpManager).vat();
        urnHandler = ICDPManagger(cdpManager).urns(vault);
        ilk = ICDPManagger(cdpManager).ilks(vault);
        emit SetcdpManager(cdpManager);
    }

    function setDaiJoin(address _daiJoin) external onlyOwner {
        daiJoin = _daiJoin;
        emit SetDaiJoin(daiJoin);
    }

    function setdsProxy(address _dsProxy) external onlyOwner {
        dsProxy = _dsProxy;
        emit SetdsProxy(dsProxy);
    }

    function setdsProxyActions(address _dsProxyActions) external onlyOwner {
        dsProxyActions = _dsProxyActions;
        emit SetdsProxyActions(dsProxyActions);
    }

    function setRatioTarget(uint256 _ratio) external override onlyOwner {
        ratioTarget = _ratio;
        emit SetRatioTarget(ratioTarget);
    }

    function setRatioTrigger(uint256 _ratio) external override onlyOwner {
        ratioTrigger = _ratio;
        emit SetRatioTrigger(ratioTrigger);
    }

    function setSpotter(address _spotter) external onlyOwner {
        spotter = _spotter;
        emit SetSpotter(spotter);
    }

    function ratio() external view override returns (uint256) {
        // Collateralization Ratio = Vat.urn.ink * Vat.ilk.spot * Spot.ilk.mat / (Vat.urn.art * Vat.ilk.rate)
        // or
        // Collateralization Ratio = collateral in vault * spot price * liquidation ratio / (dait debt)
        uint256 art;
        uint256 ink;
        uint256 mat;
        uint256 rate;
        uint256 spot;
        (ink, art) = IVat(vat).urns(ilk, urnHandler);
        (, rate, spot, , ) = IVat(vat).ilks(ilk);
        (, mat) = ISpotter(spotter).ilks(ilk);
        return (ink * spot * mat) / (art * rate);
    }

    function readDeltas(uint256 toRatio)
        external
        pure
        override
        returns (uint256, uint256)
    {
        return (toRatio - ratioTrigger, toRatio - ratioTarget);
    }

    function paymentInstructions(uint256 amount)
        external
        view
        override
        returns (
            address to,
            uint256 value,
            bytes memory data
        )
    {
        to = dsProxy;
        value = 0;
        bytes memory wipe = abi.encodeWithSignature(
            "wipe",
            cdpManager,
            daiJoin,
            vault,
            amount
        );
        data = abi.encodeWithSignature("execute", dsProxyActions, wipe);
    }
}
