pragma solidity ^0.8.10;

import "forge-std/Test.sol";
import {IVault, IStablePool} from "contracts/helpers/balancer/Interop.sol";
import {IERC20} from "contracts/adapters/lp/balancer/StablePoolAdapter.sol";
import {StablePoolHelper} from "contracts/helpers/balancer/StablePool.sol";
import {Utils} from "contracts/helpers/balancer/Utils.sol";
import {TestAvatar} from "contracts/test/TestAvatar.sol";

enum JoinKind {
    INIT,
    EXACT_TOKENS_IN_FOR_BPT_OUT,
    TOKEN_IN_FOR_EXACT_BPT_OUT
}

abstract contract PoolJoinerHelper is Test {
    function joinPool(
        TestAvatar avatar,
        IStablePool pool,
        IERC20 token,
        uint256 tokenAmount
    ) internal {
        address currentEnabledModule = avatar.module();
        avatar.setModule(address(this));
        StablePoolHelper.PoolTokens memory tokens;
        (tokens.addresses, tokens.balances, ) = IVault(pool.getVault())
            .getPoolTokens(pool.getPoolId());

        deal(address(token), address(avatar), tokenAmount, true);

        avatar.execTransactionFromModule(
            payable(address(token)),
            0,
            abi.encodeWithSignature(
                "approve(address,uint256)",
                pool.getVault(),
                type(uint256).max
            ),
            0 //Transaction.Operation.Call
        );

        IVault.JoinPoolRequest memory request = joinPoolRequest(
            IVault(pool.getVault()),
            pool,
            address(token),
            tokenAmount
        );

        avatar.execTransactionFromModule(
            payable(pool.getVault()),
            0,
            abi.encodeWithSelector(
                IVault.joinPool.selector,
                pool.getPoolId(),
                address(avatar),
                address(avatar),
                request
            ),
            0 //Transaction.Operation.Call
        );
        avatar.setModule(currentEnabledModule);
    }

    function joinPoolRequest(
        IVault vault,
        IStablePool pool,
        address tokenIn,
        uint256 amountIn
    ) private view returns (IVault.JoinPoolRequest memory request) {
        StablePoolHelper.PoolTokens memory tokens;
        (tokens.addresses, tokens.balances, ) = vault.getPoolTokens(
            pool.getPoolId()
        );
        uint256 tokenInIndex = Utils.indexOf(tokens.addresses, tokenIn);

        uint256[] memory amountsIn = new uint256[](tokens.addresses.length);
        amountsIn[tokenInIndex] = amountIn;

        request = IVault.JoinPoolRequest({
            assets: tokens.addresses,
            maxAmountsIn: amountsIn,
            userData: abi.encode(
                JoinKind.EXACT_TOKENS_IN_FOR_BPT_OUT,
                amountsIn,
                0
            ),
            fromInternalBalance: false
        });

        // vault.joinPool(pool.getPoolId(), avatar, avatar, request);
    }
}
