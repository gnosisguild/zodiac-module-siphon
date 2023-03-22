pragma solidity 0.8.10;

import "forge-std/Test.sol";
import {MakerVaultAdapter} from "contracts/adapters/dp/MakerVault.sol";
import {DssProxyActions} from "contracts/test/maker/DssProxyActions.sol";

abstract contract SetupMakerVaultAdapter is Test {
    // GLOBALS:
    address constant MAKER_CDP_MANAGER =
        0x5ef30b9986345249bc32d8928B7ee64DE9435E39;
    address constant MAKER_DAI_JOIN =
        0x9759A6Ac90977b93B58547b4A71c78317f391A28;
    address constant MAKER_SPOTTER = 0x65C79fcB50Ca1594B025960e539eD7A9a6D434A3;
    DssProxyActions constant DS_PROXY_ACTIONS =
        DssProxyActions(0x82ecD135Dce65Fbc6DbdD0e4237E0AF93FFD5038);

    function setupMakerDaoAdapter(
        address asset, //DAI
        address dsProxy,
        uint256 vault,
        address adapterOwner,
        uint256 ratioTarget,
        uint256 ratioTrigger
    ) public returns (MakerVaultAdapter) {
        return
            new MakerVaultAdapter(
                asset,
                MAKER_CDP_MANAGER,
                MAKER_DAI_JOIN,
                address(dsProxy),
                address(DS_PROXY_ACTIONS),
                adapterOwner, // owner of the maker vault adapter (can set ratios etc.)
                MAKER_SPOTTER,
                ratioTarget,
                ratioTrigger,
                vault
            );
    }
}
