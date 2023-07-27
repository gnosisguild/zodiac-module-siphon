// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

import "./MakerVault.sol";

contract MakerDaiVaultAdapter is MakerVaultAdapter {
    constructor(
        address _dsProxy,
        address _owner,
        uint256 _ratioTarget,
        uint256 _ratioTrigger,
        uint256 _vault
    ) {
        bytes memory initParams = abi.encode(
            _dsProxy,
            _owner,
            _ratioTarget,
            _ratioTrigger,
            _vault
        );
        setUp(initParams);
    }

    function setUp(bytes memory initParams) public override initializer {
        (
            address _dsProxy,
            address _owner,
            uint256 _ratioTarget,
            uint256 _ratioTrigger,
            uint256 _vault
        ) = abi.decode(
                initParams,
                (address, address, uint256, uint256, uint256)
            );

        _setUp(
            0x6B175474E89094C44Da98b954EedeAC495271d0F, // asset -> DAI,
            0x5ef30b9986345249bc32d8928B7ee64DE9435E39, // cdpManager
            0x9759A6Ac90977b93B58547b4A71c78317f391A28, // daiJoin,
            _dsProxy,
            0x82ecD135Dce65Fbc6DbdD0e4237E0AF93FFD5038, // dsProxyActions,
            _owner,
            0x65C79fcB50Ca1594B025960e539eD7A9a6D434A3, // spotter
            _ratioTarget,
            _ratioTrigger,
            _vault
        );
    }
}
