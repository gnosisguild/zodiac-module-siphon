import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import hre from "hardhat";

import { fork, forkReset } from "../setup";
import { parseUnits } from "ethers/lib/utils";
import { getCTokens } from "../constants";
import {
  CONVEX_REWARDS,
  CURVE_POOL_DEPOSIT,
  addLiquidityUpTo,
  executeLeaveStake,
  getPoolPercs,
  swapInDAI,
  swapInUSDC,
} from "./pool";
import { ConvexCompoundAdapter } from "../../../typechain-types";
import { execTransaction, takeover } from "../../safe";
import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { TransactionStructOutput } from "../../../typechain-types/contracts/IDebtPosition";
import { expect } from "chai";
import { getTokens, takeoverERC20 } from "../../setup";

const GNO_SAFE = "0x849d52316331967b6ff1198e5e32a0eb168d039d";

describe("ConvexCompoundAdapter", async () => {
  before(async () => {
    await fork(17741542);
  });

  after(async () => {
    await forkReset();
  });

  describe("Manipulation", async () => {
    async function setup() {
      const [signer] = await hre.ethers.getSigners();
      const { dai, usdc } = await getCTokens(signer);

      await takeover(GNO_SAFE, signer.address);

      const usdcWhale = "0x51eDF02152EBfb338e03E30d65C15fBf06cc9ECC";
      const daiWhale = "0x075e72a5eDf65F0A5f44699c7654C1a76941Ddc8";

      await takeoverERC20(daiWhale, signer.address, dai.address);
      await takeoverERC20(usdcWhale, signer.address, usdc.address);
      await executeLeaveStake(GNO_SAFE);

      const Adapter = await hre.ethers.getContractFactory(
        "ConvexCompoundAdapter"
      );
      const adapter = await Adapter.deploy(
        CURVE_POOL_DEPOSIT,
        CONVEX_REWARDS,
        0,
        1,
        GNO_SAFE,
        parseUnits("1", 18)
      );

      return { adapter, owner: signer };
    }

    it("100K exit - pool at 0.9998, manipulate up to 1.01 cents, causes loss", async () => {
      let config = await loadFixture(setup);

      const price = await config.adapter.price();
      expect(price).to.equal(parseUnits("0.999810293", 18));

      const normalExit = await doExit(
        config.adapter,
        // withdraw 100K DAI
        parseUnits("100000", 18),
        config.owner
      );

      // reset values
      config = await loadFixture(setup);

      // this moves the price against us
      await swapInUSDC(parseUnits("1710000", 6), config.owner);

      const sandwichExit = await doExit(
        config.adapter,
        // withdraw 100K DAI
        parseUnits("100000", 18),
        config.owner
      );

      expect(price).to.lessThan(parseUnits("1.01", 18));

      const ratio = sandwichExit.lptAmountIn
        .mul(parseUnits("1", 18))
        .div(normalExit.lptAmountIn);

      // Sandwiched for 1.17%
      expect(ratio).to.equal(parseUnits("1.017452653198046937", 18));
    });

    it("100K exit - start at 0.9998, injecting DAI creates more favourable price", async () => {
      let config = await loadFixture(setup);

      const price = await config.adapter.price();
      expect(price).to.equal(parseUnits("0.999810293", 18));

      const normalExit = await doExit(
        config.adapter,
        // withdraw 100K DAI
        parseUnits("100000", 18),
        config.owner
      );

      // reset values
      config = await loadFixture(setup);

      // this moves the price against us
      await swapInDAI(parseUnits("1710000", 18), config.owner);

      const sandwichExit = await doExit(
        config.adapter,
        // withdraw 100K DAI
        parseUnits("100000", 18),
        config.owner
      );

      expect(price).to.lessThan(parseUnits("1.01", 18));

      const ratio = sandwichExit.lptAmountIn
        .mul(parseUnits("1", 18))
        .div(normalExit.lptAmountIn);

      // End up spending less 0.05% of BPT
      expect(ratio).to.equal(parseUnits("0.999545958589397701", 18));
    });

    it("100K exit - on large balanced pool, move to 1.01 cents, causes loss", async () => {
      let config = await loadFixture(setup);

      // move pool to have exactly 20M reserves of each
      await addLiquidityUpTo(
        parseUnits("20000000", 18),
        parseUnits("20000000", 6),
        config.owner
      );

      // pool is 50/50
      expect(await getPoolPercs()).to.deep.equal([50, 50]);

      expect(await config.adapter.price()).to.equal(
        parseUnits("0.999599989", 18)
      );

      const normalExit = await doExit(
        config.adapter,
        // withdraw 100K DAI
        parseUnits("100000", 18),
        config.owner
      );

      // redo things but now with manipulation
      config = await loadFixture(setup);
      await addLiquidityUpTo(
        parseUnits("20000000", 18),
        parseUnits("20000000", 6),
        config.owner
      );

      // this moves the price against us
      await swapInUSDC(parseUnits("17700000", 6), config.owner);

      const sandwichExit = await doExit(
        config.adapter,
        // withdraw 100K DAI
        parseUnits("100000", 18),
        config.owner
      );

      const price = await config.adapter.price();
      expect(price).to.equal(parseUnits("1.008554129", 18));
      expect(price).to.lessThan(parseUnits("1.01", 18));

      const ratio = sandwichExit.lptAmountIn
        .mul(parseUnits("1", 18))
        .div(normalExit.lptAmountIn);

      // Sandwiched for 1.14%
      expect(ratio).to.equal(parseUnits("1.014589146037198154", 18));
    });

    it("1M exit - on large balanced pool, move up to 1.01 cents, causes loss", async () => {
      let config = await loadFixture(setup);

      // move pool to have exactly 20M reserves of each
      await addLiquidityUpTo(
        parseUnits("20000000", 18),
        parseUnits("20000000", 6),
        config.owner
      );

      expect(await config.adapter.price()).to.equal(
        parseUnits("0.999599989", 18)
      );

      const normalExit = await doExit(
        config.adapter,
        // withdraw 100K DAI
        parseUnits("100000", 18),
        config.owner
      );

      // redo things but now with manipulation
      config = await loadFixture(setup);
      await addLiquidityUpTo(
        parseUnits("20000000", 18),
        parseUnits("20000000", 6),
        config.owner
      );

      // this moves the price against us
      await swapInUSDC(parseUnits("17000000", 6), config.owner);

      const sandwichExit = await doExit(
        config.adapter,
        // withdraw 1M DAI
        parseUnits("1000000", 18),
        config.owner
      );

      const price = await config.adapter.price();
      expect(price).to.equal(parseUnits("1.009997638", 18));
      expect(price).to.lessThan(parseUnits("1.01", 18));

      const ratio = sandwichExit.lptAmountIn
        .mul(parseUnits("1", 18))
        .div(normalExit.lptAmountIn);

      // Sandwiched for 0.8%
      expect(ratio).to.equal(BigNumber.from("10084301224762131646"));
    });
  });
});

async function doExit(
  adapter: ConvexCompoundAdapter,
  amountOut: BigNumber,
  signer: SignerWithAddress
) {
  let tokens = await getTokens(hre.ethers.provider);

  const beforeBalanceDAI = await tokens.dai.balanceOf(GNO_SAFE);
  const beforeBalanceLPT = await tokens.lpToken.balanceOf(GNO_SAFE);

  await executeInstructions(
    GNO_SAFE,
    await adapter.withdrawalInstructions(amountOut),
    signer
  );

  const afterBalanceDAI = await tokens.dai.balanceOf(GNO_SAFE);
  const afterBalanceLPT = await tokens.lpToken.balanceOf(GNO_SAFE);

  return {
    daiAmountOut: afterBalanceDAI.sub(beforeBalanceDAI),
    lptAmountIn: beforeBalanceLPT.sub(afterBalanceLPT),
  };
}

async function executeInstructions(
  safeAddress: string,
  instructions: TransactionStructOutput[],
  signer: SignerWithAddress
) {
  for (let i = 0; i < instructions.length; i++) {
    const receipt = await execTransaction(safeAddress, instructions[i], signer);
    await receipt.wait();
  }
}
