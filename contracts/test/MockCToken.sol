interface CToken {
    function totalSupply() external view returns (uint256);

    function transfer(address to, uint256 value) external returns (bool);

    function balanceOf(address) external view returns (uint256);

    function mint(uint256 amount) external returns (uint256);

    function redeem(uint256 mintAmount) external returns (uint256);

    function redeemUnderlying(uint256 mintAmount) external returns (uint256);

    function exchangeRateStored() external view returns (uint256);

    function exchangeRateCurrent() external returns (uint256);

    function underlying() external view returns (address);

    function approve(address to, uint256 amount) external;
}
