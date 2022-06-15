// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

import "@gnosis.pm/safe-contracts/contracts/common/Enum.sol";

struct Transaction {
    address to;
    uint256 value;
    bytes data;
    Enum.Operation operation;
}
