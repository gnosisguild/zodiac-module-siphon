// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

import "./LendingPoolAdapter.sol";

interface ICompoundToken {
    function exchangeRateStored() external view returns (uint256);
}

contract CurveCompoundAdapter is LendingPoolAdapter {
    constructor(address investor) LendingPoolAdapter(investor, getConfig()) {}

    function getConfig() private pure returns (Config memory) {
        return
            Config({
                lpToken: IERC20(0x845838DF265Dcd2c412A1Dc9e959c7d08537f8a2),
                pool: ICurvePool(0xA2B47E3D5c44877cca798226B7B8118F9BFb7A56),
                deposit: ICurveDeposit(
                    0xeB21209ae4C2c9FF2a86ACA31E123764A3B6Bc06
                ),
                rewards: IConvexRewards(
                    0xf34DFF761145FF0B05e917811d488B441F33a968
                ),
                // DAI
                lendingTokenOut: 0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643,
                underlyingTokenOut: IERC20(
                    0x6B175474E89094C44Da98b954EedeAC495271d0F
                ),
                indexOut: 0,
                scaleFactorOut: 1,
                // USDC
                lendingTokenOther: 0x39AA39c021dfbaE8faC545936693aC917d5E7563,
                underlyingTokenOther: IERC20(
                    0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
                ),
                indexOther: 1,
                scaleFactorOther: 10 ** 12
            });
    }

    function _calcUnderlyingTokenWrap(
        address cToken,
        uint256 amount
    ) public view override returns (uint256) {
        return (amount * scale) / ICompoundToken(cToken).exchangeRateStored();
    }

    function _calcLendingTokenUnwrap(
        address cToken,
        uint256 amount
    ) public view override returns (uint256) {
        return (amount * ICompoundToken(cToken).exchangeRateStored()) / scale;
    }
}
