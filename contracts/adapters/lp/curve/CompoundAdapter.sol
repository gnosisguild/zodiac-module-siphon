// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

import "./_LendingPoolAdapter.sol";

interface ICompoundToken {
    function exchangeRateStored() external view returns (uint256);
}

contract ConvexCompoundAdapter is LendingPoolAdapter {
    constructor(
        address _deposit,
        address _rewards,
        uint256 _indexOut,
        uint256 _indexOther,
        address _investor,
        uint256 _minAcceptablePrice
    )
        LendingPoolAdapter(
            _deposit,
            _rewards,
            _indexOut,
            _indexOther,
            _investor,
            _minAcceptablePrice
        )
    {}

    // underlyingToLending
    function _calcUnderlyingToLending(
        address cToken,
        uint256 amount
    ) public view override returns (uint256) {
        return _div(amount, ICompoundToken(cToken).exchangeRateStored());
    }

    // lendingToUnderlying
    function _calcLendingToUnderlying(
        address cToken,
        uint256 amount
    ) public view override returns (uint256) {
        return _mul(amount, ICompoundToken(cToken).exchangeRateStored());
    }
}
