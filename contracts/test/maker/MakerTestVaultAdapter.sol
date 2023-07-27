// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

import "../../adapters/dp/MakerVault.sol";

contract MakerTestVaultAdapter is MakerVaultAdapter {
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

        _setUp(
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
    }
}
