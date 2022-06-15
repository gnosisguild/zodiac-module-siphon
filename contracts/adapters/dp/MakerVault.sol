// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

import "../../IDebtPosition.sol";
import "@gnosis.pm/zodiac/contracts/factory/FactoryFriendly.sol";

uint256 constant WAD = 10**18;
uint256 constant RAY = 10**27;

interface ICDPManager {
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

// temporary: marked abstract to silence compiler
contract MakerVaultAdapter is IDebtPosition, FactoryFriendly {
    event SetAssetCollateral(address assetCollateral);
    event SetAssetDebt(address assetDebt);
    event SetRatioTarget(uint256 ratioTarget);
    event SetRatioTrigger(uint256 ratioTrigger);
    event AdapterSetup(
        address cdpManager,
        address daiJoin,
        address dsProxy,
        address dsProxyActions,
        address spotter,
        address urnHandler,
        address vat,
        bytes32 ilk,
        uint256 ratioTarget,
        uint256 ratioTrigger,
        uint256 vault
    );

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

    constructor(
        address _assetDebt,
        address _cdpManager,
        address _daiJoin,
        address _dsProxy,
        address _dsProxyActions,
        address _spotter,
        uint256 _ratioTarget,
        uint256 _ratioTrigger,
        uint256 _vault
    ) {
        bytes memory initParams = abi.encode(
            _assetDebt,
            _cdpManager,
            _daiJoin,
            _dsProxy,
            _dsProxyActions,
            _spotter,
            _ratioTarget,
            _ratioTrigger,
            _vault
        );
        setUp(initParams);
    }

    function setUp(bytes memory initParams) public override initializer {
        (
            address _assetDebt,
            address _cdpManager,
            address _daiJoin,
            address _dsProxy,
            address _dsProxyActions,
            address _spotter,
            uint256 _ratioTarget,
            uint256 _ratioTrigger,
            uint256 _vault
        ) = abi.decode(
                initParams,
                (
                    address,
                    address,
                    address,
                    address,
                    address,
                    address,
                    uint256,
                    uint256,
                    uint256
                )
            );
        __Ownable_init();

        assetDebt = _assetDebt;
        cdpManager = _cdpManager;
        daiJoin = _daiJoin;
        dsProxy = _dsProxy;
        dsProxyActions = _dsProxyActions;
        spotter = _spotter;

        ratioTarget = _ratioTarget;
        ratioTrigger = _ratioTrigger;
        vault = _vault;

        ilk = ICDPManager(cdpManager).ilks(vault);
        urnHandler = ICDPManager(cdpManager).urns(vault);
        vat = ICDPManager(cdpManager).vat();

        emit AdapterSetup(
            cdpManager,
            daiJoin,
            dsProxy,
            dsProxyActions,
            spotter,
            urnHandler,
            vat,
            ilk,
            ratioTarget,
            ratioTrigger,
            vault
        );
    }

    // @dev Sets the address of debtAsset (dai)
    // @param _assetDebt The address of debtAsset (dai)
    // @notice Can only be called by owner.
    function setAssetDebt(address _assetDebt) external onlyOwner {
        assetDebt = _assetDebt;
        emit SetAssetDebt(assetDebt);
    }

    // @dev Sets the target callateralization ratio for the vault.
    // @param _ratio Target collateralization ratio for the vault.
    // @notice Can only be called by owner.
    function setRatioTarget(uint256 _ratio) external override onlyOwner {
        ratioTarget = _ratio;
        emit SetRatioTarget(ratioTarget);
    }

    // @dev Sets the collateralization ratio below which debt repayment can be triggered.
    // @param _ratio The ratio below which debt repayment can be triggered.
    // @notice Can only be called by owner.
    function setRatioTrigger(uint256 _ratio) external override onlyOwner {
        ratioTrigger = _ratio;
        emit SetRatioTrigger(ratioTrigger);
    }

    // @dev Returns the current collateralization ratio of the vault as ray.
    function ratio() public view override returns (uint256) {
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
        // return (ink * spot * mat) / ((art * rate) / RAY) / RAY;
        uint256 currentRatio = (((ink * spot) / RAY) * mat) /
            ((art * rate) / RAY);
        return currentRatio;
    }

    // @dev Returns the amount of Dai that should be repaid to bring vault to target ratio.
    // @return Amount of Dai necessary that should be repaid to bring vault to target ratio.
    function delta() external view override returns (uint256 amount) {
        uint256 art;
        uint256 rate;
        uint256 debt;
        (, art) = IVat(vat).urns(ilk, urnHandler);
        (, rate, , , ) = IVat(vat).ilks(ilk);
        debt = art * rate;
        amount = (debt / ratioTarget) - (debt / ratio());
    }

    // @dev Returns the call data to repay debt on the vault.
    // @param amount The amount of tokens to repay to the vault.
    // @return to Address that the call should be to.
    // @return value Native token value attached to the call.
    // @return data Call data for the call.
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
        bytes memory wipe = abi.encodeWithSignature(
            "wipe(address,address,uint256,uint256)",
            cdpManager,
            daiJoin,
            vault,
            amount
        );

        to = dsProxy;
        value = 0;
        data = abi.encodeWithSignature(
            "execute(address,bytes)",
            dsProxyActions,
            wipe
        );
    }
}
