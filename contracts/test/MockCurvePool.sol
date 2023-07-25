interface CurvePool {
    function calc_token_amount(
        uint256[2] memory amounts,
        bool deposit
    ) external view returns (uint256);
}
