// SPDX-License-Identifier: LGPL-3.0-only
import "../helpers/balancer/BoostedPool.sol";

pragma solidity ^0.8.6;

contract BoostedPoolHelperMock {
    function calcPrices(address pool)
        public
        returns (address[] memory, uint256[] memory)
    {
        return BoostedPoolHelper.calcPrices(pool);
    }

    function nominals(address pool)
        public
        view
        returns (address[] memory, uint256[] memory)
    {
        (
            address[] memory linearPools,
            uint256[] memory linearBalances
        ) = BoostedPoolHelper.findLinearPools(pool);
        uint256[] memory result = new uint256[](linearPools.length);
        for (uint256 i = 0; i < linearPools.length; i++) {
            result[i] = LinearPoolHelper.nominalValue(
                linearPools[i],
                linearBalances[i]
            );
        }

        return (linearPools, result);
    }

    function calcInOut(
        address pool,
        address stable1,
        address stable2
    ) public returns (uint256) {
        uint256 amountIn = 1000 * 10**ERC20(stable1).decimals();
        uint256 amountOut = BoostedPoolHelper.queryStableOutGivenStableIn(
            pool,
            stable1,
            amountIn,
            stable2
        );

        return Utils.inferAndUpscale(amountOut, stable2);
    }
}
