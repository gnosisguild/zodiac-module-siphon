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
        to = multisend;
        value = 0;
        data = hex"";
        for (uint256 i; i < txs.length; i++) {
            data = abi.encodePacked(
                data,
                abi.encodePacked(
                    uint8(txs[i].operation),
                    txs[i].to,
                    txs[i].value,
                    uint256(txs[i].data.length),
                    txs[i].operation
                )
            );
        }
        operation = Enum.Operation.Call;
    }
}
