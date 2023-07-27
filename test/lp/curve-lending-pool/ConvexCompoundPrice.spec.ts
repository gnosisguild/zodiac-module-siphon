import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumberish } from "ethers";
import hre from "hardhat";

import { fork, forkReset } from "../setup";
import {
  CToken__factory,
  ConvexCompoundAdapter,
  ERC20__factory,
  MockRewardPool__factory,
} from "../../../typechain-types";
import {
  execPopulatedTransaction,
  execTransaction,
  highjack,
} from "../../safe";
import { expect } from "chai";
import { TransactionStructOutput } from "../../../typechain-types/contracts/IDebtPosition";
import { parseUnits } from "ethers/lib/utils";

const GNO_SAFE = "0x849d52316331967b6ff1198e5e32a0eb168d039d";
const CURVE_LP_TOKEN = "0x845838DF265Dcd2c412A1Dc9e959c7d08537f8a2";
const CONVEX_REWARDS_POOL = "0xf34DFF761145FF0B05e917811d488B441F33a968";

describe("ConvexCompoundPrice", async () => {
  before(async () => {
    await fork(17741542);
  });

  after(async () => {
    await forkReset();
  });

  async function setup() {
    const [signer] = await hre.ethers.getSigners();
    const { dai, usdc } = await getCTokens();

    await highjack(GNO_SAFE, signer.address);

    const Adapter = await hre.ethers.getContractFactory(
      "ConvexCompoundAdapter"
    );
    const adapter = await Adapter.deploy(GNO_SAFE, parseUnits("0.90", 18));

    await executeFlushERC20(GNO_SAFE, dai.address);
    await executeFlushERC20(GNO_SAFE, usdc.address);

    const rewards = MockRewardPool__factory.connect(
      CONVEX_REWARDS_POOL,
      hre.ethers.provider
    );
    const lpToken = ERC20__factory.connect(CURVE_LP_TOKEN, hre.ethers.provider);

    return { adapter, rewards, lpToken };
  }

  it("50/50 pool reads correct price");

  it("25/75 pool reads correct price");
  it("75/25 pool reads correct price");

  it("10/90 pool reads correct price");
  it("90/10 pool reads correct price");

  it("1/99 pool reads correct price");
  it("99/1 pool reads correct price");
});

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

async function executeFlushERC20(
  safeAddress: string,
  token: string,
  balance?: BigNumberish
) {
  const [signer] = await hre.ethers.getSigners();
  const erc20 = ERC20__factory.connect(token, hre.ethers.provider);

  const tx = await erc20.populateTransaction.transfer(
    "0x0000000000000000000000000000000000000002",
    balance ? balance : await erc20.balanceOf(safeAddress)
  );

  await execPopulatedTransaction(safeAddress, tx, signer);
}

async function executeLeaveStake(safeAddress: string, balance?: BigNumberish) {
  const [signer] = await hre.ethers.getSigners();

  const rewards = MockRewardPool__factory.connect(
    CONVEX_REWARDS_POOL,
    hre.ethers.provider
  );

  const tx = await rewards.populateTransaction.withdrawAndUnwrap(
    balance ? balance : await rewards.balanceOf(safeAddress),
    false
  );

  await execPopulatedTransaction(safeAddress, tx, signer);
}
