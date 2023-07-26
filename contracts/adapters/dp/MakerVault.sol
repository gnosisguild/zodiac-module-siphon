// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

import "../../IDebtPosition.sol";
import "@gnosis.pm/zodiac/contracts/factory/FactoryFriendly.sol";

uint256 constant WAD = 10 ** 18;
uint256 constant RAY = 10 ** 27;

interface ICDPManager {
    function ilks(uint256 vault) external view returns (bytes32 ilk);

    function urns(uint256 vault) external view returns (address urnHandler);

    function vat() external view returns (address vat);
}

interface IDSProxy {
    function execute(
        address _target,
        bytes memory _data
    ) external payable returns (bytes32 response);
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
    function urns(
        bytes32 ilk,
        address urnHandler
    ) external view returns (uint256 ink, uint256 art);

    function ilks(
        bytes32 ilk
    )
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

interface IERC20 {
    function decimals() external view returns (uint256);
}

// temporary: marked abstract to silence compiler
contract MakerVaultAdapter is IDebtPosition, FactoryFriendly {
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

    /// @notice the asset we are borrowing
    address public override asset;

    /**
     * @notice the CDP manager contract
     * @dev The DssCdpManager (aka manager) was created to enable a formalized process
     *  for Vaults to be transferred between owners, much like assets are transferred.
     *  It is recommended that all interactions with Vaults be done through the CDP Manager.
     *
     *  This is a global contract that manages all Vaults (must identify vault when using).
     */
    address public cdpManager;

    /**
     * @notice the Dai Join contract
     * @dev allows users to withdraw their Dai from the system into a standard ERC20 token.
     *  This is a global contract (must identify vault when using).
     */
    address public daiJoin;

    /**
     * @notice the DSProxy contract
     * @dev The DSProxy is used to interact with other smart contracts
     *  without having to send a transaction from the owner’s account.
     *
     *  e.g. DSProxy can be used to interact with MakerDAO Vaults without having to send a
     *  transaction from the owner’s account.
     *
     *  Execute arbitrary call sequences with a persistent identity.
     *
     *  This is specific to the vault. The owner of this contract is the vault owner.
     */
    address public dsProxy;

    /**
     * @notice the DSProxyActions contract
     * @dev The DSProxyActions contract is a collection of functions that can be called
     *  via DSProxy.execute() to interact with the Maker system.
     *  The Proxy Actions contract is a generalized wrapper for the Maker Protocol. It's
     *  basically a set of proxy functions for MCD (using dss-cdp-manager). The contract’s
     *  purpose is to be used via a personal ds-proxy and can be compared to the original
     *  Sag-Proxy as it offers the ability to execute a sequence of actions atomically.
     */
    address public dsProxyActions;

    /**
     * @notice the Spotter contract
     * @dev The Spotter contract is responsible for tracking the price of collateral
     *  in the Maker system. It is used to calculate the liquidation price of Vaults.
     *
     *  A spotter, is a core module contract (spot.sol) that serves as a liaison between the
     *  Oracles and the Core Contracts. It is responsible
     *  for updating and maintaining the current spot price of various collateral types (ilks)
     *  in the system. The spotter contract receives price information from trusted oracles,
     *  calculates the liquidation price for each collateral type, and updates the core contract
     *  (vat) with the latest information. This ensures that the system operates with the most
     *  up-to-date and accurate pricing data, allowing it to manage collateralized debt positions
     *  (CDPs) and liquidations effectively.
     *
     *  This is a global contract (must identify collateral types (ilk) when using).
     */
    address public spotter;

    /**
     * @notice the Urn Handler contract is the CDP??
     */
    address public urnHandler;

    /**
     * @notice the core Vault engine
     * @dev The vat is the central contract in the Dai system.
     *  It is responsible for tracking the Dai supply, debt, and collateral.
     */
    address public vat;

    /**
     * @notice the collateral type
     */
    bytes32 public ilk;

    /**
     * @notice the target collateralization ratio
     * @dev the target collateralization ratio is the ratio of collateral to debt
     *  that we want to maintain. If the collateralization ratio is below the target
     *  ratio, we will need to add more collateral to the Vault. Represented as ray.
     */
    uint256 public ratioTarget;

    /**
     * @notice the trigger threshold for the collateralization ratio
     * @dev represented as ray - 27 decimal places.
     */
    uint256 public ratioTrigger;

    /**
     * @notice the Vault ID
     */
    uint256 public vault;

    constructor(
        address _asset,
        address _cdpManager,
        address _daiJoin,
        address _dsProxy,
        address _dsProxyActions,
        address _owner,
        address _spotter,
        uint256 _ratioTarget,
        uint256 _ratioTrigger,
        uint256 _vault
    ) {
        bytes memory initParams = abi.encode(
            _asset,
            _cdpManager,
            _daiJoin,
            _dsProxy,
            _dsProxyActions,
            _owner,
            _spotter,
            _ratioTarget,
            _ratioTrigger,
            _vault
        );
        setUp(initParams);
    }

    function setUp(bytes memory initParams) public override initializer {
        (
            address _asset,
            address _cdpManager,
            address _daiJoin,
            address _dsProxy,
            address _dsProxyActions,
            address _owner,
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
                    address,
                    uint256,
                    uint256,
                    uint256
                )
            );
        __Ownable_init();

        asset = _asset;
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
        transferOwnership(_owner);

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

    // @dev Sets the target collateralization ratio for the vault.
    // @param _ratio Target collateralization ratio for the vault.
    // @notice Can only be called by owner.
    function setRatioTarget(uint256 _ratio) external onlyOwner {
        ratioTarget = _ratio;
        emit SetRatioTarget(ratioTarget);
    }

    /// @dev Sets the collateralization ratio below which debt repayment can be triggered.
    /// @param _ratio The ratio below which debt repayment can be triggered.
    /// @notice Can only be called by owner.
    function setRatioTrigger(uint256 _ratio) external onlyOwner {
        ratioTrigger = _ratio;
        emit SetRatioTrigger(ratioTrigger);
    }

    /// @notice Returns the current collateralization ratio of the vault.
    /// @return ratio as fixed point ray (27 decimals)
    function _ratio_old() public view returns (uint256) {
        // Collateralization Ratio = Vat.urn.ink * Vat.ilk.spot * Spot.ilk.mat / (Vat.urn.art * Vat.ilk.rate)
        // or
        // Collateralization Ratio = collateral in vault * spot price * liquidation ratio / (dait debt)
        // or
        // r = (c * s * l) / d
        uint256 art; //outstanding stablecoin debt
        uint256 ink; // collateral balance
        uint256 mat; // the liquidation ratio
        uint256 rate; // stablecoin debt multiplier (accumulated stability fees)
        uint256 spot; // collateral price with safety margin, i.e. the maximum stablecoin allowed per unit of collateral
        (ink, art) = IVat(vat).urns(ilk, urnHandler);
        (, rate, spot, , ) = IVat(vat).ilks(ilk);
        (, mat) = ISpotter(spotter).ilks(ilk);
        uint256 currentRatio = (((ink * spot) / RAY) * mat) /
            ((art * rate) / RAY);
        return currentRatio;
    }

    // @dev Returns the amount of Dai that should be repaid to bring vault to target ratio.
    // @return Amount of Dai necessary that should be repaid to bring vault to target ratio.
    function _delta_old() external view returns (uint256 amount) {
        uint256 art; //outstanding stablecoin debt @audit - will fail if art is 0
        uint256 ink; // collateral balance
        uint256 mat; // the liquidation ratio
        uint256 rate; // stablecoin debt multiplier (accumulated stability fees)
        uint256 spot; // collateral price with safety margin, i.e. the maximum stablecoin allowed per unit of collateral
        uint256 debt; // the total quantity of stablecoin issued
        (ink, art) = IVat(vat).urns(ilk, urnHandler);
        (, rate, spot, , ) = IVat(vat).ilks(ilk);
        (, mat) = ISpotter(spotter).ilks(ilk);
        debt = (art * rate) / RAY;
        // Equation to get debt at a given ratio:
        // d = (c * s * l) / r
        uint256 debtTarget = (((ink * spot) / RAY) * mat) / ratioTarget;
        amount = debt - debtTarget;
    }

    /// @dev Returns whether the current debt positions needs rebelance.
    function needsRebalancing() public view override returns (bool) {
        require(
            ratioTrigger != 0 && ratioTarget != 0 && ratioTrigger < ratioTarget,
            "DebtPosition: Incorrect Configuration"
        );

        uint256 currentRatio = ratio();

        return currentRatio < ratioTrigger;
    }

    /// @dev Returns the call data to repay debt on the vault.
    /// @param amount The amount of tokens to repay to the vault.
    /// @return result array of transactions to be executed to repay debt.
    function paymentInstructions(
        uint256 amount
    ) external view override returns (Transaction[] memory) {
        Transaction[] memory result = new Transaction[](2);
        result[0] = Transaction({
            to: asset,
            value: 0,
            data: abi.encodeWithSignature(
                "approve(address,uint256)",
                dsProxy,
                amount
            ),
            operation: Enum.Operation.Call
        });
        result[1] = Transaction({
            to: dsProxy,
            value: 0,
            data: abi.encodeWithSignature(
                "execute(address,bytes)",
                dsProxyActions,
                abi.encodeWithSignature(
                    "wipe(address,address,uint256,uint256)",
                    cdpManager,
                    daiJoin,
                    vault,
                    amount
                )
            ),
            operation: Enum.Operation.Call
        });

        return result;
    }

    /// @notice Returns the current collateralization ratio of the vault.
    /// @return ratio as fixed point ray (27 decimals)
    function ratio() public view override returns (uint256) {
        // Collateralization Ratio = Vat.urn.ink * Vat.ilk.spot * Spot.ilk.mat / (Vat.urn.art * Vat.ilk.rate)
        // or
        // Collateralization Ratio = collateral in vault * spot price * liquidation ratio / (dait debt)
        // or
        // r = (c * s * l) / d

        // wad - 18 decimal places
        // ray - 27 decimal places
        // rad - 45 decimal places
        // struct Vat.Ilk {
        //     uint256 Art;   // Total Normalised Debt     [wad]
        //     uint256 rate;  // Accumulated Rates         [ray]
        //     uint256 spot;  // Price with Safety Margin  [ray]
        //     uint256 line;  // Debt Ceiling              [rad]
        //     uint256 dust;  // Urn Debt Floor            [rad]
        // }
        // struct Vat.Urn {
        //     uint256 ink;   // Locked Collateral  [wad]
        //     uint256 art;   // Normalised Debt    [wad]
        // }
        // struct Spot.Ilk {
        //     PipLike pip;  // Price Feed
        //     uint256 mat;  // Liquidation ratio [ray]
        // }

        return _div(collateralValue(), debtValue());
    }

    /// @notice returns the amount of asset that should be repaid to
    /// bring vault to target ratio.
    /// @return amount fixed point scaled to asset decimals
    function delta() external view override returns (uint256) {
        uint256 debt = debtValue();

        // r = (c * s * l) / d
        uint256 debtTarget = _div(collateralValue(), ratioTarget);

        // from ray to ERC20.decimals
        uint256 scaleDownFactor = 27 - IERC20(asset).decimals();

        return _scaleDown(debt - debtTarget, scaleDownFactor);
    }

    /// @notice calculates collateral value in the vault, priced in base asset
    /// @dev formula is Vat.urn.ink * Vat.ilk.spot * Spot.ilk.mat
    /// @return collateralValue as fixed point ray (27 decimals)
    function collateralValue() public view returns (uint256) {
        // get Ilk (collateral type)
        // rate -> stablecoin debt multiplier (accumulated stability fees)
        // spot -> collateral price with safety margin, i.e. the maximum stablecoin allowed per unit of collateral
        (, , uint256 spot, , ) = IVat(vat).ilks(ilk);

        // get Urn (collateral deposit)
        // ink -> collateral balance
        (uint256 ink, ) = IVat(vat).urns(ilk, urnHandler);

        // Get Spot (price oracle)
        // mat -> the liquidation ratio
        (, uint256 mat) = ISpotter(spotter).ilks(ilk);

        return _mul(_mul(_wadToRay(ink), spot), mat);
    }

    /// @notice calculates total outstanding debt
    /// @dev formula is Vat.urn.art * Vat.ilk.rate
    /// @return debtValue as ray (27 decimals)
    function debtValue() public view returns (uint256) {
        // get Ilk (collateral type)
        // rate -> stablecoin debt multiplier (accumulated stability fees)
        // spot -> collateral price with safety margin, i.e. the maximum stablecoin allowed per unit of collateral
        (, uint256 rate, , , ) = IVat(vat).ilks(ilk);

        // get Urn (collateral deposit)
        // art -> outstanding stablecoin debt
        (, uint256 art) = IVat(vat).urns(ilk, urnHandler);

        return _mul(_wadToRay(art), rate);
    }

    /// @dev multiplies two fixed point integers in ray scale
    function _mul(uint256 x, uint256 y) internal pure returns (uint256) {
        return (x * y) / RAY;
    }

    /// @dev multiplies two fixed point integers in ray scale
    function _div(uint256 x, uint256 y) internal pure returns (uint256) {
        return (x * RAY) / y;
    }

    function _wadToRay(uint256 _wad) internal pure returns (uint256) {
        return _scaleUp(_wad, 27 - 18);
    }

    function _scaleUp(
        uint256 _ray,
        uint256 decimals
    ) internal pure returns (uint256) {
        return _ray * (10 ** (decimals));
    }

    function _scaleDown(
        uint256 x,
        uint256 decimals
    ) internal pure returns (uint256) {
        return x / (10 ** (decimals));
    }
}
