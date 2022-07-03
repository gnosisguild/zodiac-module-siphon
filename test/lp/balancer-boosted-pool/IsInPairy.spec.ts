import { expect } from "chai";
import { BigNumber } from "ethers";
import hre, { deployments, getNamedAccounts } from "hardhat";

import {
  fork,
  forkReset,
  setup,
  setupFundWhaleWithBPT,
  setupFundAvatar,
  setupFundWhaleWithStables,
  investInPool,
} from "./setup";

describe("LP: Balancer Boosted Pool", async () => {
  describe("isInParity", async () => {
    let baseSetup: any;

    before(async () => {
      await fork(15055495);

      baseSetup = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();

        const {
          avatar,
          adapter,
          pool,
          gauge,
          dai,
          tether,
          usdc,
          boostedPoolHelper,
        } = await setup();

        await setupFundWhaleWithBPT();
        await setupFundWhaleWithStables();

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
          tether,
          usdc,
          boostedPoolHelper,
        };
      });
    });

    after(async () => {
      await forkReset();
    });

    it("respects different tolerances for a balanced pool", async () => {
      const { adapter } = await baseSetup();

      const { BigWhale } = await getNamedAccounts();

      const signer = hre.ethers.provider.getSigner(BigWhale);
      // the default value is 20 bips 0.2%
      await adapter.connect(signer).setParityTolerance(20);
      expect(await adapter.isInParity()).to.equal(true);

      // if we go down to 10 bips 0.1%, it should fail
      await adapter.connect(signer).setParityTolerance(10);
      expect(await adapter.isInParity()).to.equal(false);
    });

    it("is not in parity for an unbalanced pool", async () => {
      const { adapter, pool, dai, usdc, boostedPoolHelper } = await baseSetup();

      // pool initially in parity
      expect(await adapter.isInParity()).to.equal(true);

      const priceBefore = priceToReadable(
        await boostedPoolHelper.calcPrice(
          pool.address,
          dai.address,
          usdc.address
        )
      );

      expect(priceBefore).to.equal("0.9999");

      // Inject 200 million in DAI which is enough to move the price to 0.9800
      await investInPool(
        dai.address,
        BigNumber.from("200000000000000000000000000")
      );

      const priceAfter = priceToReadable(
        await boostedPoolHelper.calcPrice(
          pool.address,
          dai.address,
          usdc.address
        )
      );

      expect(priceAfter).to.equal("0.9800");

      // dai trades at 0.98 so not in parity anymore
      expect(await adapter.isInParity()).to.equal(false);
    });
  });
});

function priceToReadable(price: BigNumber): string {
  return (countBasisPoints(price) / 10000).toFixed(4);
}

function countBasisPoints(bn: BigNumber): number {
  return bn.div(BigNumber.from("100000000000000")).toNumber();
}
