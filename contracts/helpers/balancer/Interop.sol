// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

interface IPool {
    function getVault() external view returns (address);

    function getPoolId() external view returns (bytes32);

    function getSwapFeePercentage() external view returns (uint256);

    function getScalingFactors() external view returns (uint256[] memory);
}

interface IStablePool is IPool {
    function getAmplificationParameter()
        external
        view
        returns (
            uint256 value,
            bool isUpdating,
            uint256 precision
        );
}

interface IStablePhantomPool is IStablePool {
    function getBptIndex() external view returns (uint256);

    function getVirtualSupply() external view returns (uint256);
}

interface ILinearPool is IPool {
    function getRate() external view returns (uint256);

    function getWrappedTokenRate() external view returns (uint256);

    function getMainToken() external view returns (address);

    function getWrappedToken() external view returns (address);

    function getBptIndex() external view returns (uint256);

    function getMainIndex() external view returns (uint256);

    function getWrappedIndex() external view returns (uint256);

    function getTargets() external view returns (uint256, uint256);

    function getVirtualSupply() external view returns (uint256);
}

interface IVault {
    function getPoolTokens(bytes32 poolId)
        external
        view
        returns (
            address[] memory tokens,
            uint256[] memory balances,
            uint256 lastChangeBlock
        );
}
