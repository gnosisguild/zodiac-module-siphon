interface MockRewardPool {
    function balanceOf(address account) external view returns (uint256);

    function withdrawAndUnwrap(
        uint256 amount,
        bool claim
    ) external returns (bool);
}
