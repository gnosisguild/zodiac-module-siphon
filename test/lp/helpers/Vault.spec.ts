import { expect } from "chai";
import { BigNumber } from "ethers";
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

describe("LP: Vault Helper", async () => {
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
    const { pool } = await baseSetup();

    const amountIn = BigNumber.from(String(1000 * 10 ** 6));

    const boostedPoolHelper = await getBoostedPoolHelper();
    const vaultHelper = await getVaultHelper();

    const amountOutQuery =
      await vaultHelper.callStatic.queryStableOutGivenStableIn(
        pool.address,
        USDC_ADDRESS,
        amountIn,
        TETHER_ADDRESS
      );

    const amountOutCalc = await boostedPoolHelper.calcStableOutGivenStableIn(
      pool.address,
      USDC_ADDRESS,
      amountIn,
      TETHER_ADDRESS
    );

    expect(amountOutQuery).to.equal(amountOutCalc);
  });

  it("it correctly calculates stableOut given bptIn", async () => {
    const { pool } = await baseSetup();

    const amountIn = (await pool.getVirtualSupply()).div(BigNumber.from(1000));

    const boostedPoolHelper = await getBoostedPoolHelper();
    const vaultHelper = await getVaultHelper();

    const amountOutQuery =
      await vaultHelper.callStatic.queryStableOutGivenBptIn(
        pool.address,
        amountIn,
        TETHER_ADDRESS
      );

    const amountOutCalc = await boostedPoolHelper.calcStableOutGivenBptIn(
      pool.address,
      amountIn,
      TETHER_ADDRESS
    );

    expect(amountOutQuery).to.equal(amountOutCalc);
  });

  it("it correctly calculates bptIn given stableOut", async () => {
    const { pool, tether } = await baseSetup();

    const decimals = await tether.decimals();

    const amountOut = BigNumber.from(String(1000 * 10 ** decimals));

    const boostedPoolHelper = await getBoostedPoolHelper();
    const vaultHelper = await getVaultHelper();

    const amountOutQuery =
      await vaultHelper.callStatic.queryBptInGivenStableOut(
        pool.address,
        TETHER_ADDRESS,
        amountOut
      );

    const amountOutCalc = await boostedPoolHelper.calcBptInGivenStableOut(
      pool.address,
      TETHER_ADDRESS,
      amountOut
    );

    expect(amountOutQuery).to.equal(amountOutCalc);
  });
});

async function getBoostedPoolHelper() {
  const deployment = await deployments.get("BoostedPoolHelper");
  return new hre.ethers.Contract(
    deployment.address,
    deployment.abi,
    hre.ethers.provider
  );
}

async function getVaultHelper() {
  const VaultHelper = await hre.ethers.getContractFactory("VaultHelperMock");
  const vaultHelper = await VaultHelper.deploy();
  return vaultHelper;
}
