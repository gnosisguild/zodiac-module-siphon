import { expect } from "chai";
import { BigNumber } from "ethers";
import { getAddress } from "ethers/lib/utils";
import hre, { deployments, getNamedAccounts } from "hardhat";

import { DAI_ADDRESS, TETHER_ADDRESS, USDC_ADDRESS } from "../constants";
import { fork, forkReset, fundWhaleWithStables } from "../setup";

import { setup, setupFundWhale, setupFundAvatar, investInPool } from "./setup";

export const BOOSTED_GAUGE_TOP_HOLDERS = [
  "0x995a09ed0b24ee13fbfcfbe60cad2fb6281b479f",
  "0xb1ff8bf9c3a55877b5ee38e769e7a78cd000848e",
  "0x44e5f536429363dd2a20ce31e3666c300233d151",
  "0x81fa0f35b54790f78e76c74d05bd6d95632c030b",
  "0x3a3ee61f7c6e1994a2001762250a5e17b2061b6d",
  "0x8d8f55c99971b9e69967a406419ed815ee63d3cd",
  "0x98bea99727b297f5eca448d1640075f349c08547",
];

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
      expect(await adapter.isInParity()).to.equal(true);
    });

    it("is not in parity for an unbalanced pool", async () => {
      const { adapter, pool, dai, boostedPoolHelper } = await baseSetup();

      const { BigWhale } = await getNamedAccounts();
      const signer = hre.ethers.provider.getSigner(BigWhale);

      // pool initially in parity
      expect(await adapter.isInParity()).to.equal(true);

      const before = await boostedPoolHelper.calcPrices(pool.address);
      const pricesBefore = pricesToReadable(before);

      // const nominalsBefore = await boostedPoolHelper.nominals(pool.address);
      // console.log("Before", nominalsBefore.toString());

      expect(pricesBefore.dai).to.equal("0.999900");
      expect(pricesBefore.usdc).to.equal("1.000000");
      expect(pricesBefore.tether).to.equal("0.999900");

      // Inject 200 million in DAI which is enough to move the price

      await investInPool(
        dai.address,
        BigNumber.from("200000000000000000000000000")
      );

      // const nominalsAfter = await boostedPoolHelper.nominals(pool.address);
      // console.log("AFTER", nominalsAfter.toString());

      const after = await boostedPoolHelper.calcPrices(pool.address);
      const pricesAfter = pricesToReadable(after);

      expect(pricesAfter.dai).to.equal("1.000000");
      expect(pricesAfter.usdc).to.equal("0.996300");
      expect(pricesAfter.tether).to.equal("0.996100");

      await adapter.connect(signer).setParityTolerance(15);

      expect(await adapter.isInParity()).to.equal(false);

      await adapter.connect(signer).setParityTolerance(40);

      expect(await adapter.isInParity()).to.equal(true);
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
