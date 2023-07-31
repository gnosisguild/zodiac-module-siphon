// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../../IDebtPosition.sol";

uint256 constant RAY = 10 ** 27;
uint256 constant WAD = 10 ** 18;

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

contract MakerVaultAdapter is OwnableUpgradeable, IDebtPosition {
    uint256 private constant MIN_RATIO = 1 * WAD;
    uint256 private constant MAX_RATIO = 100 * WAD;

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
    address public immutable override asset;

    /**
     * @notice the CDP manager contract
     * @dev The DssCdpManager (aka manager) was created to enable a formalized process
     *  for Vaults to be transferred between owners, much like assets are transferred.
     *  It is recommended that all interactions with Vaults be done through the CDP Manager.
     *
     *  This is a global contract that manages all Vaults (must identify vault when using).
     */
    address public immutable cdpManager;

    /**
     * @notice the Dai Join contract
     * @dev allows users to withdraw their Dai from the system into a standard ERC20 token.
     *  This is a global contract (must identify vault when using).
     */
    address public immutable daiJoin;

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
    address public immutable dsProxy;

    /**
     * @notice the DSProxyActions contract
     * @dev The DSProxyActions contract is a collection of functions that can be called
     *  via DSProxy.execute() to interact with the Maker system.
     *  The Proxy Actions contract is a generalized wrapper for the Maker Protocol. It's
     *  basically a set of proxy functions for MCD (using dss-cdp-manager). The contract’s
     *  purpose is to be used via a personal ds-proxy and can be compared to the original
     *  Sag-Proxy as it offers the ability to execute a sequence of actions atomically.
     */
    address public immutable dsProxyActions;

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
    address public immutable spotter;

    /**
     * @notice the Urn Handler contract is the CDP??
     */
    address public immutable urnHandler;

    /**
     * @notice the core Vault engine
     * @dev The vat is the central contract in the Dai system.
     *  It is responsible for tracking the Dai supply, debt, and collateral.
     */
    address public immutable vat;

    /**
     * @notice the collateral type
     */
    bytes32 public immutable ilk;

    /**
     * @notice the target collateralization ratio
     * @dev the target collateralization ratio is the ratio of collateral to debt
     *  that we want to maintain. If the collateralization ratio is below the target
     *  ratio, we will need to add more collateral to the Vault. Represented as wad.
     */
    uint256 public ratioTarget;

    /**
     * @notice the trigger threshold for the collateralization ratio
     * @dev represented as wad - 18 decimal places.
     */
    uint256 public ratioTrigger;

    /**
     * @notice the Vault ID
     */
    uint256 public immutable vault;

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
        bytes32 _ilk = ICDPManager(_cdpManager).ilks(_vault);
        address _urnHandler = ICDPManager(_cdpManager).urns(_vault);
        address _vat = ICDPManager(_cdpManager).vat();

        asset = _asset;
        cdpManager = _cdpManager;
        daiJoin = _daiJoin;
        dsProxy = _dsProxy;
        dsProxyActions = _dsProxyActions;
        spotter = _spotter;

        ratioTarget = _ratioTarget;
        ratioTrigger = _ratioTrigger;
        vault = _vault;

        ilk = _ilk;
        urnHandler = _urnHandler;
        vat = _vat;
        _transferOwnership(_owner);

        emit AdapterSetup(
            _cdpManager,
            _daiJoin,
            _dsProxy,
            _dsProxyActions,
            _spotter,
            _urnHandler,
            _vat,
            _ilk,
            _ratioTarget,
            _ratioTrigger,
            _vault
        );
    }

    /// @dev Sets the target collateralization ratio for the vault.
    /// @param _ratio Target collateralization ratio for the vault.
    /// @notice Can only be called by owner.
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
    /// @return ratio as fixed point wad (18 decimals)
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

        return _div_wad(collateralValue(), debtValue());
    }

    /// @notice returns the amount of asset that should be repaid to
    /// bring vault to target ratio.
    /// @return amount fixed point wad (18 decimals)
    function delta() external view override returns (uint256) {
        // r = (c * s * l) / d
        uint256 debtTarget = _div_wad(collateralValue(), ratioTarget);

        return debtValue() - debtTarget;
    }

    /// @dev Returns whether the current debt positions needs rebelance.
    function needsRebalancing() public view override returns (bool) {
        require(
            ratioTrigger != 0 && ratioTarget != 0 && ratioTrigger < ratioTarget,
            "DebtPosition: Incorrect Configuration"
        );

        return ratio() < ratioTrigger;
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

    /// @notice calculates collateral value in the vault, priced in base asset
    /// @dev formula is Vat.urn.ink * Vat.ilk.spot * Spot.ilk.mat
    /// @return collateralValue represented as fixed point wad (18 decimals)
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

        // multiply a wad and ray yields a wad
        // equivalent to: _scaleDown(_mul_ray(_mul_ray(_scaleUp(ink), spot), mat))
        return _mul_ray(_mul_ray(ink, spot), mat);
    }

    /// @notice calculates total outstanding debt
    /// @dev formula is Vat.urn.art * Vat.ilk.rate
    /// @return debtValue represented as wad (18 decimals)
    function debtValue() public view returns (uint256) {
        // get Ilk (collateral type)
        // rate -> stablecoin debt multiplier (accumulated stability fees)
        // spot -> collateral price with safety margin, i.e. the maximum stablecoin allowed per unit of collateral
        (, uint256 rate, , , ) = IVat(vat).ilks(ilk);

        // get Urn (collateral deposit)
        // art -> outstanding stablecoin debt
        (, uint256 art) = IVat(vat).urns(ilk, urnHandler);

        // multiply a wad and ray yields a wad
        // equivalent to: _scaleDown(_mul_ray(_scaleUp(art), rate))
        return _mul_ray(art, rate);
    }

    /// @dev multiplies two fixed point integers in ray scale
    function _mul_ray(uint256 x, uint256 y) private pure returns (uint256) {
        return (x * y) / RAY;
    }

    /// @dev divides two fixed point integers in wad scale
    function _div_wad(uint256 x, uint256 y) private pure returns (uint256) {
        return (x * WAD) / y;
    }
}
