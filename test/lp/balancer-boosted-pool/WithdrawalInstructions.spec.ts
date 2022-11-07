import { expect } from "chai";
import { BigNumber } from "ethers";
import hre, { deployments, getNamedAccounts } from "hardhat";

import { BOOSTED_GAUGE_TOP_HOLDERS, DAI_ADDRESS } from "../constants";
import { fork, forkReset } from "../setup";

import { setup, setupFundWhale, setupFundAvatar } from "./setup";

describe("LP: Balancer Boosted Pool", async () => {
  describe("withdrawalInstructions", async () => {
    let baseSetup: any;

    before(async () => {
      await fork(15582929);

      baseSetup = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();

        const {
          avatar,
          adapter,
          pool,
          gauge,
          dai,
          boostedPoolHelper,
          stablePhantomPoolHelper,
        } = await setup();

        await setupFundWhale(BOOSTED_GAUGE_TOP_HOLDERS);

        await setupFundAvatar(
          avatar,
          BigNumber.from("1000000000000000000000000"),
          BigNumber.from("1000000000000000000000000")
        );

        return {
          avatar,
          adapter,
          pool,
          gauge,
          dai,
          boostedPoolHelper,
          stablePhantomPoolHelper,
        };
      });
    });

    after(async () => {
      await forkReset();
    });

    it.only("Withdrawing with no unstake - inGivenOut", async () => {
      const { avatar, adapter, dai } = await baseSetup();

      const adapterLiquidity = BigNumber.from("2029247134262182408154990");

      // Avatar has zero DAI
      await expect(await dai.balanceOf(avatar.address)).to.equal(0);

      await expect(await adapter.callStatic.balance()).to.equal(
        adapterLiquidity
      );

      // 10% of what's available
      const requestedAmountOut = adapterLiquidity.div(100).mul(10);

      const instructions = await adapter.callStatic.withdrawalInstructions(
        requestedAmountOut
      );

      // No unstaking needed
      expect(instructions).to.have.length(1);

      await avatar.exec(
        instructions[0].to,
        instructions[0].value.toString(),
        instructions[0].data
      );

      // We expect the avatar to have exactly the DAI required
      await expect(await dai.balanceOf(avatar.address)).to.equal(
        requestedAmountOut
      );
    });
  });
});
