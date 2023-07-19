import { expect } from "chai";
import { BigNumber } from "ethers";
import hre from "hardhat";

import {
  BOOSTED_POOL_ADDRESS,
  DAI_ADDRESS,
  poolAbi,
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
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("LP: Balancer Boosted Pool Helper", async () => {
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

    const Helper = await hre.ethers.getContractFactory(
      "BoostedPoolHelperMock",
      {
        libraries: {
          BoostedPoolHelper: libraries.boostedPoolHelper.address,
        },
      },
    );
    const boostedPoolHelper = await Helper.deploy();

    const dai = await hre.ethers.getContractAt("ERC20", DAI_ADDRESS);
    const usdc = await hre.ethers.getContractAt("ERC20", USDC_ADDRESS);
    const tether = await hre.ethers.getContractAt("ERC20", TETHER_ADDRESS);

    const pool = new hre.ethers.Contract(BOOSTED_POOL_ADDRESS, poolAbi, signer);

    const vault = new hre.ethers.Contract(VAULT_ADDRESS, vaultAbi, signer);

    return { dai, usdc, tether, pool, boostedPoolHelper, vault, signer };
  }

  it("it correctly calculates stableOut given stableIn", async () => {
    const { pool, boostedPoolHelper } = await loadFixture(baseSetup);

    const amountIn = BigNumber.from(String(1000 * 10 ** 6));
    const amountOutCalc = await boostedPoolHelper.calcStableOutGivenStableIn(
      pool.address,
      USDC_ADDRESS,
      amountIn,
      TETHER_ADDRESS,
    );

    const amountOutQuery =
      await boostedPoolHelper.callStatic.queryStableOutGivenStableIn(
        pool.address,
        USDC_ADDRESS,
        amountIn,
        TETHER_ADDRESS,
      );

    expect(amountOutCalc).to.equal(amountOutQuery);
  });

  it("it correctly calculates stableOut given stableIn", async () => {
    const { pool, boostedPoolHelper } = await loadFixture(baseSetup);

    const amountIn = BigNumber.from(String(1000 * 10 ** 6));

    const amountOutQuery =
      await boostedPoolHelper.callStatic.queryStableOutGivenStableIn(
        pool.address,
        USDC_ADDRESS,
        amountIn,
        TETHER_ADDRESS,
      );

    const amountOutCalc = await boostedPoolHelper.calcStableOutGivenStableIn(
      pool.address,
      USDC_ADDRESS,
      amountIn,
      TETHER_ADDRESS,
    );

    expect(amountOutQuery).to.equal(amountOutCalc);
  });

  it("it correctly calculates stableOut given bptIn", async () => {
    const { pool, boostedPoolHelper } = await loadFixture(baseSetup);

    const amountIn = (await pool.getVirtualSupply()).div(BigNumber.from(1000));

    const amountOutQuery =
      await boostedPoolHelper.callStatic.queryStableOutGivenBptIn(
        pool.address,
        amountIn,
        TETHER_ADDRESS,
      );

    const amountOutCalc = await boostedPoolHelper.calcStableOutGivenBptIn(
      pool.address,
      amountIn,
      TETHER_ADDRESS,
    );

    expect(amountOutQuery).to.equal(amountOutCalc);
  });

  it("it correctly calculates bptIn given stableOut", async () => {
    const { pool, tether, boostedPoolHelper } = await loadFixture(baseSetup);

    const decimals = await tether.decimals();

    const amountOut = BigNumber.from(String(1000 * 10 ** decimals));

    const amountOutQuery =
      await boostedPoolHelper.callStatic.queryBptInGivenStableOut(
        pool.address,
        TETHER_ADDRESS,
        amountOut,
      );

    const amountOutCalc = await boostedPoolHelper.calcBptInGivenStableOut(
      pool.address,
      TETHER_ADDRESS,
      amountOut,
    );

    expect(amountOutQuery).to.equal(amountOutCalc);
  });
});
