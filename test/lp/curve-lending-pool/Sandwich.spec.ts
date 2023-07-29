import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import hre from "hardhat";

import { fork, forkReset } from "../setup";
import { parseUnits } from "ethers/lib/utils";
import { getCTokens } from "../constants";
import { expect } from "chai";
import { getPoolPercs, injectDAI, moveERC20 } from "./pool";

const GNO_SAFE = "0x849d52316331967b6ff1198e5e32a0eb168d039d";

describe.only("ConvexCompoundPrice", async () => {
  before(async () => {
    await fork(17741542);
  });

  after(async () => {
    await forkReset();
  });

  describe("sandwich", async () => {
    async function setup() {
      const [signer] = await hre.ethers.getSigners();
      const { dai, usdc } = await getCTokens(signer);

      const usdcWhale = "0x51eDF02152EBfb338e03E30d65C15fBf06cc9ECC";
      const daiWhale = "0x075e72a5eDf65F0A5f44699c7654C1a76941Ddc8";

      await moveERC20(daiWhale, signer.address, dai.address);
      await moveERC20(usdcWhale, signer.address, usdc.address);

      const Adapter = await hre.ethers.getContractFactory(
        "ConvexCompoundAdapter"
      );
      const adapter = await Adapter.deploy(
        "0xeB21209ae4C2c9FF2a86ACA31E123764A3B6Bc06",
        "0xf34DFF761145FF0B05e917811d488B441F33a968",
        0,
        1,
        GNO_SAFE,
        parseUnits("1", 18)
      );

      return { adapter };
    }

    it("move price from 0.80 cents", async () => {
      const { adapter } = await loadFixture(setup);

      await injectDAI(parseUnits("4280000", 18));

      const [percOut, percOther] = await getPoolPercs();
      expect(percOut).to.equal(99);
      expect(percOther).to.equal(1);

      const price = await adapter.price();
      expect(price).to.equal(parseUnits("0.813246027", 18));
    });

    it("move price from 0.90 cents", async () => {});

    it("move price from 0.99 cents", async () => {});

    it("move price from 1.01 cents", async () => {});

    it("move price from 1.10 cents", async () => {});

    it("move price from 1.20 cents", async () => {});
  });
});
