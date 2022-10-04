import { expect } from "chai";
import { BigNumber } from "ethers";
import { getAddress } from "ethers/lib/utils";
import hre, { deployments, getNamedAccounts } from "hardhat";

import {
  BOOSTED_GAUGE_TOP_HOLDERS,
  DAI_ADDRESS,
  TETHER_ADDRESS,
  USDC_ADDRESS,
} from "../constants";
import { fork, forkReset, fundWhaleWithStables } from "../setup";

import { setup, setupFundWhale, setupFundAvatar, investInPool } from "./setup";

describe("LP: Balancer Boosted Pool", async () => {
  describe("isInParity", async () => {
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
          tether,
          usdc,
          boostedPoolHelper,
        } = await setup();

        await setupFundWhale(BOOSTED_GAUGE_TOP_HOLDERS);
        await fundWhaleWithStables();

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
      expect(await adapter.callStatic.isInParity()).to.equal(true);
    });

    it("is not in parity for an unbalanced pool", async () => {
      const { adapter, pool, dai, boostedPoolHelper } = await baseSetup();

      const { BigWhale } = await getNamedAccounts();
      const signer = hre.ethers.provider.getSigner(BigWhale);

      // pool initially in parity
      expect(await adapter.callStatic.isInParity()).to.equal(true);

      const before = await boostedPoolHelper.callStatic.calcPrices(
        pool.address
      );
      const pricesBefore = pricesToReadable(before);

      // const nominalsBefore = await boostedPoolHelper.nominals(pool.address);
      // console.log("Before", nominalsBefore.toString());

      expect(pricesBefore.dai).to.equal("0.999900");
      expect(pricesBefore.usdc).to.equal("0.999900");
      expect(pricesBefore.tether).to.equal("1.000000");

      // Inject 200 million in DAI which is enough to move the price

      await investInPool(
        dai.address,
        BigNumber.from("200000000000000000000000000")
      );

      const after = await boostedPoolHelper.callStatic.calcPrices(pool.address);
      const pricesAfter = pricesToReadable(after);

      expect(pricesAfter.dai).to.equal("0.996100");
      expect(pricesAfter.usdc).to.equal("0.999800");
      expect(pricesAfter.tether).to.equal("1.000000");

      await adapter.connect(signer).setParityTolerance(15);

      expect(await adapter.callStatic.isInParity()).to.equal(false);

      await adapter.connect(signer).setParityTolerance(40);

      expect(await adapter.callStatic.isInParity()).to.equal(true);
    });
  });
});

function pricesToReadable([tokens, prices]: [string[], BigNumber[]]) {
  return {
    dai: priceToReadable(
      prices[tokens.findIndex((token) => getAddress(token) === DAI_ADDRESS)]
    ),
    usdc: priceToReadable(
      prices[tokens.findIndex((token) => getAddress(token) === USDC_ADDRESS)]
    ),
    tether: priceToReadable(
      prices[tokens.findIndex((token) => getAddress(token) === TETHER_ADDRESS)]
    ),
  };
}

function priceToReadable(price: BigNumber): string {
  return (countBasisPoints(price) / 10000).toFixed(6);
}

function countBasisPoints(bn: BigNumber): number {
  return bn.div(BigNumber.from("100000000000000")).toNumber();
}
