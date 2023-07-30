interface CurvePool {
    function calc_token_amount(
        uint256[2] memory amounts,
        bool deposit
    ) external view returns (uint256);

    function balances(int128 i) external view returns (uint256);

    function exchange(int128 i, int128 j, uint256 dx, uint256 minDy) external;

    function exchange_underlying(
        int128 i,
        int128 j,
        uint256 dx,
        uint256 minDy
    ) external;

    function get_dx_underlying(
        int128 i,
        int128 j,
        uint256 dy
    ) external view returns (uint256);

    function get_dy_underlying(
        int128 i,
        int128 j,
        uint256 dx
    ) external view returns (uint256);

    function remove_liquidity(
        uint256 _amount,
        uint256[2] memory min_amounts
    ) external;

    function remove_liquidity_imbalance(
        uint256[2] memory amounts,
        uint256 max_burn_amount
    ) external;

    function add_liquidity(
        uint256[2] memory amounts,
        uint256 min_mint_amount
    ) external;
}
