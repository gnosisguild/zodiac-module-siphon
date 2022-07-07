// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

import "@gnosis.pm/zodiac/contracts/factory/FactoryFriendly.sol";

import "./AbstractPoolAdapter.sol";

import "../../../helpers/balancer/StablePool.sol";

contract StablePoolAdapter is AbstractPoolAdapter {
    using FixedPoint for uint256;

    address private constant HELPERS =
        0x5aDDCCa35b7A0D07C74063c48700C8590E87864E;

    constructor(
        address _owner,
        address _investor,
        address _pool,
        address _gauge,
        address _tokenOut
    ) {
        bytes memory initParams = abi.encode(
            _owner,
            _investor,
            _pool,
            _gauge,
            _tokenOut
        );
        setUp(initParams);
    }

    function isInParity() public view override returns (bool) {
        (address[] memory tokens, , ) = IVault(vault).getPoolTokens(
            IPool(pool).getPoolId()
        );

        uint256 delta = 0;
        for (uint256 i = 1; i < tokens.length; i++) {
            // should we use calcPriceIndirect?
            uint256 price = StablePoolHelper.calcPrice(
                pool,
                tokens[0],
                tokens[i]
            );
            uint256 nextDelta = price > FixedPoint.ONE
                ? price - FixedPoint.ONE
                : FixedPoint.ONE - price;

            delta = Math.max(delta, nextDelta);
        }
        return delta < parityTolerance;
    }

    function balanceNominal(uint256 bptAmount)
        public
        view
        override
        returns (uint256)
    {
        // TODO
        return 0;
    }

    function balanceEffective(uint256 bptAmount)
        public
        view
        override
        returns (uint256)
    {
        // TODO
        return 0;
    }

    function encodeExit(
        uint8 kind,
        uint256 amountIn,
        uint256 amountOut
    ) internal view override returns (Transaction memory) {
        // TODO
        return
            Transaction({
                to: vault,
                value: 0,
                data: hex"",
                operation: Enum.Operation.Call
            });
    }

    function calculateExit(uint256 requestedAmountOut)
        internal
        view
        override
        returns (
            uint8 kind,
            uint256 amountIn,
            uint256 amountOut
        )
    {
        // TODO
        kind = 0;
        amountIn = 0;
        amountOut = 0;
    }

    // Computing from BoostedPool Bpt
    // To -> LinearPool Bpt
    // To -> LinearPool MainToken
    function calcTokenOutGivenBptIn(uint256 amountIn) public returns (uint256) {
        (
            bytes32 poolId,
            address[] memory tokens,
            uint256 tokenOutIndex
        ) = query();

        (, uint256[] memory amountsOut) = IBalancerHelpers(HELPERS).queryExit(
            poolId,
            investor,
            investor,
            IVault.ExitPoolRequest({
                assets: tokens,
                minAmountsOut: new uint256[](0),
                userData: abi.encode(
                    IVault.ExitKind.EXACT_BPT_IN_FOR_ONE_TOKEN_OUT,
                    amountIn,
                    tokenOutIndex
                ),
                toInternalBalance: false
            })
        );

        return amountsOut[tokenOutIndex];
    }

    function calcBptInGivenTokenOut(uint256 amountOut)
        public
        returns (uint256)
    {
        (
            bytes32 poolId,
            address[] memory tokens,
            uint256 tokenOutIndex
        ) = query();

        uint256[] memory amountsOut = new uint256[](tokens.length);
        amountsOut[tokenOutIndex] = amountOut;

        // Custom Exit
        // userData ABI
        // ['uint256', 'uint256[]', 'uint256']
        // userData
        // [BPT_IN_FOR_EXACT_TOKENS_OUT, amountsOut, maxBPTAmountIn]
        (uint256 bptAmountIn, ) = IBalancerHelpers(HELPERS).queryExit(
            poolId,
            investor,
            investor,
            IVault.ExitPoolRequest({
                assets: tokens,
                minAmountsOut: amountsOut,
                userData: abi.encode(
                    IVault.ExitKind.BPT_IN_FOR_EXACT_TOKENS_OUT,
                    amountsOut,
                    uint256(2**256 - 1)
                ),
                toInternalBalance: false
            })
        );

        return bptAmountIn;
    }

    function query()
        private
        view
        returns (
            bytes32 poolId,
            address[] memory tokens,
            uint256 tokenOutIndex
        )
    {
        poolId = IPool(pool).getPoolId();
        (tokens, , ) = IVault(IPool(pool).getVault()).getPoolTokens(poolId);
        tokenOutIndex = Utils.indexOf(tokens, tokenOut);
    }
}
