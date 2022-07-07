import { expect } from "chai";
import { BigNumber } from "ethers";
import hre, { deployments, getNamedAccounts } from "hardhat";

import { STABLE_GAUGE_ADDRESS, STABLE_GAUGE_TOP_HOLDERS } from "../constants";
import {
  fork,
  forkReset,
  fundWhaleWithBpt,
  fundWhaleWithStables,
} from "../setup";

import { setup } from "./setup";

describe("LP: Balancer Stable Pool Adapter", async () => {
  describe("Join/Exit Math", async () => {
    let baseSetup: any;

    before(async () => {
      await fork(15095273);

      baseSetup = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();

        await fundWhaleWithStables();
        await fundWhaleWithBpt(STABLE_GAUGE_ADDRESS, STABLE_GAUGE_TOP_HOLDERS);

        const {
          avatar,
          adapter,
          pool,
          gauge,
          vault,
          dai,
          tether,
          usdc,
          whaleSigner,
        } = await setup();

        return {
          avatar,
          adapter,
          pool,
          gauge,
          vault,
          dai,
          tether,
          usdc,
          whaleSigner,
        };
      });
    });

    after(async () => {
      await forkReset();
    });

    it("it correctly calculates tokenAmountOut given bptAmountIn", async () => {
      const { adapter } = await baseSetup();
      const { BigWhale } = await getNamedAccounts();

      const amountIn = hre.ethers.utils.parseUnits("10", 18).toString();

      const { data } = await adapter.populateTransaction.calcTokenOutGivenBptIn(
        amountIn
      );

      const result = await hre.ethers.provider.call({
        to: adapter.address,
        from: BigWhale,
        data,
      });

      expect(BigNumber.from(result).toString()).to.equal(
        "10066701952644306522"
      );
    });

    it("it correctly calculates bptAmountIn given tokenAmountOut", async () => {
      const { adapter, avatar, whaleSigner, pool, usdc, dai, tether } =
        await baseSetup();

      const amountOut = "100000000";

      const bptAmountToFund = hre.ethers.utils.parseUnits("1000", 18);
      await pool.connect(whaleSigner).transfer(avatar.address, bptAmountToFund);
      await usdc.connect(whaleSigner).transfer(avatar.address, amountOut);
      await dai.connect(whaleSigner).transfer(avatar.address, amountOut);
      await tether.connect(whaleSigner).transfer(avatar.address, amountOut);

      const { data } = await adapter.populateTransaction.calcBptInGivenTokenOut(
        amountOut
      );

      const result = await hre.ethers.provider.call({
        to: adapter.address,
        from: avatar.address,
        data,
      });

      expect(BigNumber.from(result).toString()).to.equal("113275324");
    });
  });
});
