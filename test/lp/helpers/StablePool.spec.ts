import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import { getAddress } from "ethers/lib/utils";
import hre from "hardhat";

import { joinPool } from "../balancer-stable-pool/setup";
import {
  DAI_ADDRESS,
  helpersAbi,
  MAX_UINT256,
  poolAbi,
  STABLE_POOL_ADDRESS,
  TETHER_ADDRESS,
  USDC_ADDRESS,
  vaultAbi,
  VAULT_ADDRESS,
} from "../constants";
import {
  deployBalancerLibs,
  fork,
  forkReset,
  fundWhaleWithStables,
  getWhaleSigner,
} from "../setup";
import { StablePoolHelper__factory } from "../../../typechain-types";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

const EXACT_BPT_IN_FOR_ONE_TOKEN_OUT = 0;
const BPT_IN_FOR_EXACT_TOKENS_OUT = 2;

describe("LP: Balancer Stable Pool Helper", async () => {
  before(async () => {
    await fork(15582929);
  });

  after(async () => {
    await forkReset();
  });

  async function baseSetup() {
    const signer = await getWhaleSigner();

    const libraries = await deployBalancerLibs();
    await fundWhaleWithStables();

    const dai = await hre.ethers.getContractAt("ERC20", DAI_ADDRESS);
    const usdc = await hre.ethers.getContractAt("ERC20", USDC_ADDRESS);
    const tether = await hre.ethers.getContractAt("ERC20", TETHER_ADDRESS);

    const pool = new hre.ethers.Contract(STABLE_POOL_ADDRESS, poolAbi, signer);

    const vault = new hre.ethers.Contract(VAULT_ADDRESS, vaultAbi, signer);

    return {
      dai,
      usdc,
      tether,
      pool,
      vault,
      signer,
      stablePoolHelper: StablePoolHelper__factory.connect(
        libraries.stablePoolHelper.address,
        signer
      ),
    };
  }

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

    const { pool, vault, stablePoolHelper } = await loadFixture(baseSetup);

    const amountIn = hre.ethers.utils.parseUnits("100000", 6).toString();

    const amountOutFromQuery = await queryTokenOutGivenTokenIn(
      vault,
      pool,
      USDC_ADDRESS,
      amountIn,
      TETHER_ADDRESS
    );

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

  it("it correctly calculates tokenAmountOut given bptAmountIn", async () => {
    const { pool, vault, stablePoolHelper } = await loadFixture(baseSetup);

    const bptTotalSupply: BigNumber = await pool.totalSupply();
    const amountIn = bptTotalSupply.div(BigNumber.from("1000"));

    // NOTE unfortunately we can't calculate protocol due fees.
    // This affects calcOutGiveBptIn
    // Due Fees accumulate whenever swaps happen and are consolidated when
    // a join/exit happens
    // In this test we check that before we execute a join, the math is close
    // enough to the actual query, and after a join is equal

    let amountOutFromQuery = await queryTokenOutGivenBptIn(
      vault,
      pool,
      amountIn,
      TETHER_ADDRESS
    );

    let amountOutFromMath = await stablePoolHelper.calcTokenOutGivenBptIn(
      pool.address,
      amountIn,
      TETHER_ADDRESS
    );

    const outFromQueryTolerance = amountOutFromQuery.add(
      amountOutFromQuery.div(10000)
    );

    // there might be due fees accumulated and consolidated, so it should be
    // only close enough
    expect(
      amountOutFromMath.lt(outFromQueryTolerance) &&
        amountOutFromMath.gte(amountOutFromQuery)
    ).to.be.true;

    // join the pool, consolidate fees
    await joinPool(USDC_ADDRESS, hre.ethers.utils.parseUnits("1000", 6));

    amountOutFromQuery = await queryTokenOutGivenBptIn(
      vault,
      pool,
      amountIn,
      TETHER_ADDRESS
    );

    amountOutFromMath = await stablePoolHelper.calcTokenOutGivenBptIn(
      pool.address,
      amountIn,
      TETHER_ADDRESS
    );

    // after consolidation math and query are exactly the same
    expect(amountOutFromQuery.toString()).to.equal(
      amountOutFromMath.toString()
    );
  });

  it("it correctly calculates bptAmountOut given tokenAmountIn", async () => {
    const { pool, vault, stablePoolHelper } = await loadFixture(baseSetup);

    const amountOut = "100000000000";

    await joinPool(USDC_ADDRESS, hre.ethers.utils.parseUnits("100000", 6));

    const amountOutFromQuery = await queryBptInGivenTokenOut(
      vault,
      pool,
      USDC_ADDRESS,
      amountOut
    );

    const amountOutFromMath = await stablePoolHelper.calcBptInGivenTokenOut(
      pool.address,
      USDC_ADDRESS,
      amountOut
    );

    const outFromQueryTolerance = amountOutFromQuery.sub(
      amountOutFromQuery.div(1000000)
    );

    expect(
      amountOutFromMath.lte(amountOutFromQuery) &&
        amountOutFromMath.gte(outFromQueryTolerance)
    ).to.be.true;
  });
});

async function queryTokenOutGivenBptIn(
  vault: Contract,
  pool: Contract,
  bptAmountIn: string | BigNumber,
  tokenOut: string
): Promise<BigNumber> {
  const signer = await getWhaleSigner();
  const BigWhale = await signer.address;

  const helpers = new hre.ethers.Contract(
    "0x5aDDCCa35b7A0D07C74063c48700C8590E87864E",
    helpersAbi,
    signer
  );

  const poolId = await pool.getPoolId();
  const { tokens } = await vault.getPoolTokens(poolId);
  const tokenOutIndex = tokens.indexOf(tokenOut);

  const { amountsOut } = await helpers.queryExit(poolId, BigWhale, BigWhale, {
    assets: tokens,
    minAmountsOut: [0, 0, 0],
    userData: hre.ethers.utils.defaultAbiCoder.encode(
      ["uint256", "uint256", "uint256"],
      [EXACT_BPT_IN_FOR_ONE_TOKEN_OUT, bptAmountIn, tokenOutIndex]
    ),
    fromInternalBalance: false,
  });

  return amountsOut[tokenOutIndex];
}

async function queryBptInGivenTokenOut(
  vault: Contract,
  pool: Contract,
  tokenOut: string,
  amountOut: string | BigNumber
): Promise<BigNumber> {
  const signer = await getWhaleSigner();
  const BigWhale = await signer.address;

  const helpers = new hre.ethers.Contract(
    "0x5aDDCCa35b7A0D07C74063c48700C8590E87864E",
    helpersAbi,
    signer
  );

  const poolId = await pool.getPoolId();
  const { tokens } = await vault.getPoolTokens(poolId);
  const tokenOutIndex = tokens.indexOf(tokenOut);

  const amountsOut = new Array(3).fill(0);
  amountsOut[tokenOutIndex] = amountOut;

  const { bptIn } = await helpers.queryExit(poolId, BigWhale, BigWhale, {
    assets: tokens,
    minAmountsOut: amountsOut,
    userData: hre.ethers.utils.defaultAbiCoder.encode(
      ["uint256", "uint256[]", "uint256"],
      [BPT_IN_FOR_EXACT_TOKENS_OUT, amountsOut, MAX_UINT256]
    ),
    fromInternalBalance: false,
  });

  return bptIn;
}

async function queryTokenOutGivenTokenIn(
  vault: Contract,
  pool: Contract,
  tokenIn: string,
  amountIn: string,
  tokenOut: string
): Promise<BigNumber> {
  const signer = await getWhaleSigner();
  const BigWhale = await signer.address;

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
