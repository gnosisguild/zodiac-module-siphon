import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumberish } from "ethers";
import hre from "hardhat";

import { fork, forkReset } from "../setup";
import {
  CToken__factory,
  CurveCompoundAdapter,
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

const GNO_SAFE = "0x849d52316331967b6ff1198e5e32a0eb168d039d";
const CURVE_LP_TOKEN = "0x845838DF265Dcd2c412A1Dc9e959c7d08537f8a2";
const CONVEX_REWARDS_POOL = "0xf34DFF761145FF0B05e917811d488B441F33a968";

describe("LendingPoolAdapter", async () => {
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

    const Adapter = await hre.ethers.getContractFactory("CurveCompoundAdapter");
    const adapter = await Adapter.deploy(GNO_SAFE);

    await executeFlushERC20(GNO_SAFE, dai.address);
    await executeFlushERC20(GNO_SAFE, usdc.address);

    const rewards = MockRewardPool__factory.connect(
      CONVEX_REWARDS_POOL,
      hre.ethers.provider
    );
    const lpToken = ERC20__factory.connect(CURVE_LP_TOKEN, hre.ethers.provider);

    return { adapter, rewards, lpToken };
  }

  it("withdraws from unstaked only", async () => {
    const [signer] = await hre.ethers.getSigners();
    const { adapter, rewards, lpToken } = await loadFixture(setup);
    const { dai } = await getCTokens();

    await executeLeaveStake(GNO_SAFE);

    const balance = await lpToken.balanceOf(GNO_SAFE);

    // flush 50% of the pool position such that we are not majority holder
    await executeFlushERC20(
      GNO_SAFE,
      lpToken.address,
      balance.mul(50).div(100)
    );

    expect(await dai.balanceOf(GNO_SAFE)).to.equal(0);
    expect(await rewards.balanceOf(GNO_SAFE)).to.equal(0);
    expect(await isLptBalanceCapped(adapter)).to.be.false;

    const balancesBefore = await adapter.lptBalances();
    const expectedAmountOut = await adapter.balance();

    const instructions = await adapter.withdrawalInstructions(
      expectedAmountOut
    );

    await executeInstructions(GNO_SAFE, instructions, signer);

    const balancesAfter = await adapter.lptBalances();
    const actualAmountOut = await dai.balanceOf(GNO_SAFE);

    // // balance unstaked before
    const balanceUnstakedBefore = balancesBefore[0];
    const balanceUnstakedAfter = balancesAfter[0];
    expect(balanceUnstakedBefore.gt(balanceUnstakedAfter)).to.be.true;

    const balanceStakedBefore = balancesBefore[1];
    const balanceStakedAfter = balancesAfter[1];
    expect(balanceStakedBefore).to.equal(0);
    expect(balanceStakedAfter).to.equal(0);

    const oneBasisPoint = expectedAmountOut.div(10000);
    expect(
      actualAmountOut.gt(expectedAmountOut.sub(oneBasisPoint)) &&
        actualAmountOut.lt(expectedAmountOut.add(oneBasisPoint))
    ).to.be.true;
  });

  it("withdraws from staked only", async () => {
    const [signer] = await hre.ethers.getSigners();
    const { adapter, rewards, lpToken } = await loadFixture(setup);
    const { dai } = await getCTokens();

    const balance = await rewards.balanceOf(GNO_SAFE);

    // flush 50% of the pool position such that we are not majority holder
    await executeLeaveStake(GNO_SAFE, balance.mul(50).div(100));
    await executeFlushERC20(GNO_SAFE, lpToken.address);

    expect(await dai.balanceOf(GNO_SAFE)).to.equal(0);
    expect(await rewards.balanceOf(GNO_SAFE)).to.be.greaterThan(0);
    expect(await isLptBalanceCapped(adapter)).to.be.false;

    const balancesBefore = await adapter.lptBalances();
    const expectedAmountOut = await adapter.balance();

    const instructions = await adapter.withdrawalInstructions(
      expectedAmountOut
    );

    await executeInstructions(GNO_SAFE, instructions, signer);

    const balancesAfter = await adapter.lptBalances();
    const actualAmountOut = await dai.balanceOf(GNO_SAFE);

    // // balance unstaked before
    const balanceUnstakedBefore = balancesBefore[0];
    const balanceUnstakedAfter = balancesAfter[0];
    expect(balanceUnstakedBefore).to.equal(0);
    expect(balanceUnstakedAfter).to.equal(0);

    const balanceStakedBefore = balancesBefore[1];
    const balanceStakedAfter = balancesAfter[1];
    expect(balanceStakedBefore).to.be.greaterThan(balanceStakedAfter);

    const oneBasisPoint = expectedAmountOut.div(10000);
    expect(
      actualAmountOut.gt(expectedAmountOut.sub(oneBasisPoint)) &&
        actualAmountOut.lt(expectedAmountOut.add(oneBasisPoint))
    ).to.be.true;
  });

  it("withdraws from staked and unstaked");

  it("does not withdraw more than effective LptBalance");

  it("Whale: small withdraw is adequately rounded");

  it("Whale: big withdraw is adequately rounded");

  it("Fish: small withdraw is adequately rounded");
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

async function getCTokens() {
  const CDAI = "0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643";
  const CUSDC = "0x39AA39c021dfbaE8faC545936693aC917d5E7563";

  const [signer] = await hre.ethers.getSigners();
  const cusdc = CToken__factory.connect(CUSDC, signer);
  const cdai = CToken__factory.connect(CDAI, signer);

  const usdc = ERC20__factory.connect(await cusdc.underlying(), signer);
  const dai = ERC20__factory.connect(await cdai.underlying(), signer);

  return { cusdc, cdai, usdc, dai };
}

async function isLptBalanceCapped(adapter: CurveCompoundAdapter) {
  const [unstakedBalance, stakedBalance] = await adapter.lptBalances();
  const effectiveBalance = await adapter.effectiveLptBalance();

  return unstakedBalance.add(stakedBalance).gt(effectiveBalance);
}
