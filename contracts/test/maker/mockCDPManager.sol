// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

contract MockCDPManager {
    address public urnHandler =
        address(0x903E781dC578EEe94519447a77BFCF4cE1bD107D);
    address public vat = address(0x35D1b3F3D7966A1DFe207aa4514C12a259A0492B);
    bytes32 public ilk =
        bytes32(
            0x5753544554482d41000000000000000000000000000000000000000000000000
        );

    function ilks(uint256) external view returns (bytes32) {
        return ilk;
    }

    function urns(uint256) external view returns (address) {
        return urnHandler;
    }
}
