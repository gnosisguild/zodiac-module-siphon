import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import { getAddress } from "ethers/lib/utils";
import hre, { deployments, getNamedAccounts } from "hardhat";

import {
  DAI_ADDRESS,
  poolAbi,
  STABLE_POOL_ADDRESS,
  TETHER_ADDRESS,
  USDC_ADDRESS,
  vaultAbi,
  VAULT_ADDRESS,
} from "../constants";
import { fork, forkReset, fundWhaleWithStables } from "../setup";

describe("LP: Balancer Stable Pool Helper", async () => {
  let baseSetup: any;

  before(async () => {
    await fork(15012865);

    baseSetup = deployments.createFixture(async ({ deployments }) => {
      await deployments.fixture();

      const { BigWhale } = await getNamedAccounts();
      const signer = await hre.ethers.provider.getSigner(BigWhale);

      await fundWhaleWithStables();

      const dai = await hre.ethers.getContractAt("ERC20", DAI_ADDRESS);
      const usdc = await hre.ethers.getContractAt("ERC20", USDC_ADDRESS);
      const tether = await hre.ethers.getContractAt("ERC20", TETHER_ADDRESS);

      const pool = new hre.ethers.Contract(
        STABLE_POOL_ADDRESS,
        poolAbi,
        signer
      );

      const vault = new hre.ethers.Contract(VAULT_ADDRESS, vaultAbi, signer);

      return { dai, usdc, tether, pool, vault, signer };
    });
  });

  after(async () => {
    await forkReset();
  });

  it("it correctly calculates tokenAmountOut given tokenAmountIn", async () => {
    /*
    enum ExitKind {
      EXACT_BPT_IN_FOR_ONE_TOKEN_OUT,
      EXACT_BPT_IN_FOR_TOKENS_OUT,
      BPT_IN_FOR_EXACT_TOKENS_OUT
    }

    Single Asset Exit
    userData ABI
    ['uint256', 'uint256', 'uint256']
    userData
    [EXACT_BPT_IN_FOR_ONE_TOKEN_OUT, bptAmountIn, exitTokenIndex]

    Proportional Exit
    userData ABI
    ['uint256', 'uint256']
    userData
    [EXACT_BPT_IN_FOR_TOKENS_OUT, bptAmountIn]

    Custom Exit
    userData ABI
    ['uint256', 'uint256[]', 'uint256']
    userData
    [BPT_IN_FOR_EXACT_TOKENS_OUT, amountsOut, maxBPTAmountIn]
    */

    const { pool, vault } = await baseSetup();

    const amountIn = hre.ethers.utils.parseUnits("100000", 6).toString();

    const amountOutFromQuery = await queryTokenAmountOutForTokenAmountIn(
      vault,
      pool,
      USDC_ADDRESS,
      amountIn,
      TETHER_ADDRESS
    );

    const stablePoolHelper = await getStablePoolHelper();
    const amountOutFromMath = await stablePoolHelper.calcTokenOutGivenTokenIn(
      pool.address,
      USDC_ADDRESS,
      amountIn,
      TETHER_ADDRESS
    );

    expect(amountOutFromQuery.toString()).to.equal(
      amountOutFromMath.toString()
    );
  });
});

// export async function queryTokenAmountOutForExactBptAmountIn(
//   vault: Contract,
//   pool: Contract,
//   bptAmountIn: string,
//   tokenOut: string
// ) {
//   const { BigWhale } = await getNamedAccounts();
//   const signer = hre.ethers.provider.getSigner(BigWhale);

//   const helpers = new hre.ethers.Contract(
//     "0x5aDDCCa35b7A0D07C74063c48700C8590E87864E",
//     helpersAbi,
//     signer
//   );

//   const poolId = await pool.getPoolId();
//   const { tokens } = await vault.getPoolTokens(poolId);
//   const tokenOutIndex = tokens.indexOf(tokenOut);

//   const amountsOut = [0, "1", 0];

//   return await helpers.queryExit(poolId, BigWhale, BigWhale, {
//     assets: tokens,
//     minAmountsOut: amountsOut,
//     userData: hre.ethers.utils.defaultAbiCoder.encode(
//       ["uint256", "uint256", "uint256"],
//       [0, bptAmountIn, tokenOutIndex]
//     ),
//     fromInternalBalance: false,
//   });
// }

export async function queryTokenAmountOutForTokenAmountIn(
  vault: Contract,
  pool: Contract,
  tokenIn: string,
  amountIn: string,
  tokenOut: string
) {
  const { BigWhale } = await getNamedAccounts();

  const poolId = await pool.getPoolId();
  const { tokens } = await vault.getPoolTokens(poolId);
  const tokenInIndex = tokens.indexOf(getAddress(tokenIn));
  const tokenOutIndex = tokens.indexOf(getAddress(tokenOut));

  const limits = await vault.queryBatchSwap(
    // GivenIn
    0,
    [
      {
        poolId,
        assetInIndex: tokenInIndex,
        assetOutIndex: tokenOutIndex,
        amount: amountIn,
        userData: "0x",
      },
    ],
    tokens,
    {
      sender: BigWhale,
      fromInternalBalance: false,
      recipient: BigWhale,
      toInternalBalance: false,
    }
  );

  return BigNumber.from("-1").mul(limits[tokenOutIndex]);
}

async function getStablePoolHelper() {
  const { BigWhale } = await getNamedAccounts();
  const signer = hre.ethers.provider.getSigner(BigWhale);

  const deployment = await deployments.get("StablePoolHelper");
  return new hre.ethers.Contract(deployment.address, deployment.abi, signer);
}
