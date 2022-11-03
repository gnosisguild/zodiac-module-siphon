// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

import "./Transaction.sol";

abstract contract MultisendEncoder {
    address internal multisend;

    function encodeMultisend(Transaction[] memory txs)
        public
        view
        returns (
            address to,
            uint256 value,
            bytes memory data,
            Enum.Operation operation
        )
    {
        require(
            txs.length > 0,
            "No transactions provided for multisend encode"
        );

        if (txs.length > 1) {
            to = multisend;
            value = 0;
            data = hex"";
            for (uint256 i; i < txs.length; i++) {
                data = abi.encodePacked(
                    data,
                    abi.encodePacked(
                        uint8(txs[i].operation), /// operation as a uint8.
                        txs[i].to, /// to as an address.
                        txs[i].value, /// value as an uint256.
                        uint256(txs[i].data.length), /// data length as an uint256.
                        txs[i].data /// data as bytes.
                    )
                );
            }
            operation = Enum.Operation.DelegateCall;
        } else {
            to = txs[0].to;
            value = txs[0].value;
            data = txs[0].data;
            operation = txs[0].operation;
        }
    }
}
