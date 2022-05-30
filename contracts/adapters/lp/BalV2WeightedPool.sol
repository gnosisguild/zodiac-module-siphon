// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.6;

import "@prb/math/contracts/PRBMathUD60x18.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@gnosis.pm/zodiac/contracts/factory/FactoryFriendly.sol";
import "../../LiquidityPosition.sol";

enum PoolExitKind {
    EXACT_BPT_IN_FOR_ONE_TOKEN_OUT,
    EXACT_BPT_IN_FOR_TOKENS_OUT,
    BPT_IN_FOR_EXACT_TOKENS_OUT
}

interface VaultLike {
    function getPoolTokens(bytes32 poolId)
        external
        view
        returns (
            address[] memory tokens,
            uint256[] memory balances,
            uint256 lastChangeBlock
        );

    function exitPool(
        bytes32 poolId,
        address sender,
        address payable recipient,
        ExitPoolRequest memory request
    ) external;

    struct ExitPoolRequest {
        address[] assets;
        uint256[] minAmountsOut;
        bytes userData;
        bool toInternalBalance;
    }
}

abstract contract BalV2WeightedPool is LiquidityPosition, FactoryFriendly {
    using PRBMathUD60x18 for uint256;

    event SetAsset(address asset);
    event SetInvestor(address target);
    event SetVault(address vault);

    error NotEnoughLitquidity();

    address public multisig;

    address public investor;

    address public vault;
    bytes32 public poolId;
    address public pool;
    address public gauge;

    address public liquidAsset;

    // TODO having up and down is 3am code, will fix
    uint256 public slipUp;
    uint256 public slipDown;

    function setUp() public {
        // TODO will move defaults to a constructor
        // default slippage is 1%
        slipUp = 101 * 1e16;
        slipDown = 99 * 1e16;
    }

    function setInvestor(address _investor) external onlyOwner {
        investor = _investor;
        emit SetInvestor(_investor);
    }

    function setAsset(address asset) external onlyOwner {
        liquidAsset = asset;
        emit SetAsset(asset);
    }

    function setVault(address _vault, bytes32 _poolId) external onlyOwner {
        vault = _vault;
        poolId = _poolId;
        // TODO query the vault using poolId retrieve pool address
        emit SetVault(_vault);
    }

    function balance() external view returns (uint256) {
        ensureBlockLock();
        (uint256 unstakedAmoutOut, uint256 stakedAmoutOut) = balancesOut();
        return unstakedAmoutOut + stakedAmoutOut;
    }

    function withdrawalInstructions(uint256 amount)
        external
        view
        returns (
            address,
            uint256,
            bytes memory
        )
    {
        ensureBlockLock();
        uint256 amountOut = amount;
        uint256 requiredAmountIn = inFromOut(amountOut);
        (uint256 unstakedAmountIn, uint256 stakedAmountIn) = balancesIn();

        if (requiredAmountIn <= unstakedAmountIn) {
            return encodeExit(requiredAmountIn, amountOut);
        } else if (requiredAmountIn <= unstakedAmountIn + stakedAmountIn) {
            // TODO multisendEncode(encodeUnstake(), encodeExit())
            return encodeUnstake(requiredAmountIn - unstakedAmountIn);
        } else {
            revert NotEnoughLitquidity();
        }
    }

    function balancesIn()
        internal
        view
        returns (uint256 unstakedAmountIn, uint256 stakedAmountIn)
    {
        unstakedAmountIn = IERC20(pool).balanceOf(investor);
        stakedAmountIn = IERC20(gauge).balanceOf(investor);
    }

    function balancesOut()
        internal
        view
        returns (uint256 unstakedAmountOut, uint256 stakedAmountOut)
    {
        (uint256 unstakedAmountIn, uint256 stakedAmountIn) = balancesIn();

        unstakedAmountOut = outFromIn(unstakedAmountIn);
        stakedAmountOut = outFromIn(stakedAmountIn);
    }

    function outFromIn(uint256 amountIn)
        private
        view
        returns (uint256 amountOut)
    {
        uint256 existingIn = IERC20(pool).totalSupply();
        uint256 existingOut = findAssetInPool();

        uint256 ratio = amountIn.div(existingIn);

        amountOut = existingOut.mul(ratio);
    }

    function inFromOut(uint256 amountOut)
        private
        view
        returns (uint256 amountIn)
    {
        uint256 existingIn = IERC20(pool).totalSupply();
        uint256 existingOut = findAssetInPool();

        uint256 ratio = amountOut.div(existingOut);

        amountIn = existingIn.mul(ratio);
    }

    function encodeUnstake(uint256 amountIn)
        internal
        view
        returns (
            address to,
            uint256 value,
            bytes memory data
        )
    {
        to = gauge;
        value = 0;
        data = abi.encodeWithSignature("withdraw(uint256)", amountIn);
    }

    function encodeExit(uint256 amountIn, uint256 amountOut)
        internal
        view
        returns (
            address to,
            uint256 value,
            bytes memory data
        )
    {
        to = vault;
        value = 0;

        address[] memory tokens = getPoolTokens();
        uint256[] memory minAmountsOut = new uint256[](tokens.length);
        minAmountsOut[findAssetIndex(tokens)] = amountOut;

        data = abi.encodeWithSignature(
            "exitPool",
            poolId,
            investor,
            investor
            // (
            //     tokens: tokens,
            //     minAmountsOut: minAmountsOut,
            //     toInternalBalance: false,
            //     userData: abi.encode(PoolExitKind.EXACT_BPT_IN_FOR_TOKENS_OUT, amountIn)
            // )
        );
    }

    function findAssetInPool() public view returns (uint256) {
        (
            address[] memory tokens,
            uint256[] memory balances,
            uint256 lastChangedBlock
        ) = VaultLike(vault).getPoolTokens(poolId);

        return balances[findAssetIndex(tokens)];
    }

    function findAssetIndex(address[] memory tokens)
        private
        view
        returns (uint256)
    {
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] == liquidAsset) {
                return i;
            }
        }
        revert("TODO: Liquid Asset not in pool ");
    }

    function getPoolTokens() public view returns (address[] memory) {
        (address[] memory tokens, , ) = VaultLike(vault).getPoolTokens(poolId);

        return tokens;
    }

    function ensureBlockLock() private view {
        (, , uint256 lastChangedBlock) = VaultLike(vault).getPoolTokens(poolId);

        require(block.number > lastChangedBlock, "Pool Write 2 Fresh");
    }
}
