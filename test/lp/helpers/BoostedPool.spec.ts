import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import hre, { deployments, getNamedAccounts } from "hardhat";

import {
  BOOSTED_POOL_ADDRESS,
  DAI_ADDRESS,
  poolAbi,
  TETHER_ADDRESS,
  USDC_ADDRESS,
  vaultAbi,
  VAULT_ADDRESS,
} from "../constants";
import { fork, forkReset, fundWhaleWithStables } from "../setup";

describe("LP: Balancer Boosted Pool Helper", async () => {
  let baseSetup: any;

  before(async () => {
    await fork(15582929);

    baseSetup = deployments.createFixture(async ({ deployments }) => {
      await deployments.fixture();

      const { BigWhale } = await getNamedAccounts();
      const signer = await hre.ethers.provider.getSigner(BigWhale);

      await fundWhaleWithStables();

      const dai = await hre.ethers.getContractAt("ERC20", DAI_ADDRESS);
      const usdc = await hre.ethers.getContractAt("ERC20", USDC_ADDRESS);
      const tether = await hre.ethers.getContractAt("ERC20", TETHER_ADDRESS);

      const pool = new hre.ethers.Contract(
        BOOSTED_POOL_ADDRESS,
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

  it("it correctly calculates stableOut given stableIn", async () => {
    const { pool, vault } = await baseSetup();

    const amountIn = BigNumber.from(String(1000 * 10 ** 6));
    const amountOut = await queryStableOutGivenStableIn(
      vault,
      pool,
      USDC_ADDRESS,
      amountIn,
      TETHER_ADDRESS
    );

    const boostedPoolHelper = await getBoostedPoolHelper();
    const utils = await getUtilsDeployment();

    const priceReconstructed = await utils.price(
      USDC_ADDRESS,
      amountIn,
      TETHER_ADDRESS,
      amountOut
    );

    const price = await boostedPoolHelper.calcPrice(
      BOOSTED_POOL_ADDRESS,
      USDC_ADDRESS,
      TETHER_ADDRESS
    );

    expect(priceReconstructed).to.equal(price);
  });
});

export async function queryStableOutGivenStableIn(
  vault: Contract,
  pool: Contract,
  tokenIn: string,
  amountIn: BigNumber,
  tokenOut: string
): Promise<BigNumber> {
  const { BigWhale } = await getNamedAccounts();

  const boostedPoolHelper = await getBoostedPoolHelper();

  const linearPoolInAddress = await boostedPoolHelper.findLinearPool(
    BOOSTED_POOL_ADDRESS,
    tokenIn
  );

  const linearPoolOutAddress = await boostedPoolHelper.findLinearPool(
    BOOSTED_POOL_ADDRESS,
    tokenOut
  );

  const poolIn = new hre.ethers.Contract(
    linearPoolInAddress,
    poolAbi,
    hre.ethers.provider
  );
  const poolOut = new hre.ethers.Contract(
    linearPoolOutAddress,
    poolAbi,
    hre.ethers.provider
  );

  const poolInId = await poolIn.getPoolId();
  const poolId = await pool.getPoolId();
  const poolOutId = await poolOut.getPoolId();

  const tokenInIndex = 0;
  const linearInIndex = 1;
  const linearOutIndex = 2;
  const tokenOutIndex = 3;

  const assets = [tokenIn, linearPoolInAddress, linearPoolOutAddress, tokenOut];

  const steps = [
    {
      poolId: poolInId,
      assetInIndex: tokenInIndex,
      assetOutIndex: linearInIndex,
      amount: amountIn,
      userData: "0x",
    },
    {
      poolId,
      assetInIndex: linearInIndex,
      assetOutIndex: linearOutIndex,
      amount: 0,
      userData: "0x",
    },
    {
      poolId: poolOutId,
      assetInIndex: linearOutIndex,
      assetOutIndex: tokenOutIndex,
      amount: 0,
      userData: "0x",
    },
  ];

  const limits = await vault.queryBatchSwap(
    // GivenIn
    0,
    steps,
    assets,
    {
      sender: BigWhale,
      fromInternalBalance: false,
      recipient: BigWhale,
      toInternalBalance: false,
    }
  );

  return BigNumber.from("-1").mul(limits[tokenOutIndex]);
}

async function getBoostedPoolHelper() {
  const deployment = await deployments.get("BoostedPoolHelper");
  return new hre.ethers.Contract(
    deployment.address,
    deployment.abi,
    hre.ethers.provider
  );
}

async function getUtilsDeployment() {
  const deployment = await deployments.get("Utils");
  return new hre.ethers.Contract(
    deployment.address,
    deployment.abi,
    hre.ethers.provider
  );
}
