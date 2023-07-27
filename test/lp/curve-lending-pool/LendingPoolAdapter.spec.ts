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
import { formatUnits, parseUnits } from "ethers/lib/utils";

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

    const Adapter = await hre.ethers.getContractFactory(
      "ConvexCompoundAdapter"
    );
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

    // flush 80% of the pool position such that we are not majority holder
    await executeFlushERC20(
      GNO_SAFE,
      lpToken.address,
      (await lpToken.balanceOf(GNO_SAFE)).mul(80).div(100)
    );

    // ensure not a capped whale
    expect(await isLptBalanceCapped(adapter)).to.be.false;

    expect(await lpToken.balanceOf(GNO_SAFE)).greaterThan(0);
    expect(await rewards.balanceOf(GNO_SAFE)).to.equal(0);
    expect(await dai.balanceOf(GNO_SAFE)).to.equal(0);

    const balance = await adapter.balance();
    await executeInstructions(
      GNO_SAFE,
      await adapter.withdrawalInstructions(balance),
      signer
    );

    // no dust left in the adapter
    expect(await lpToken.balanceOf(GNO_SAFE)).to.equal(0);
    // still nothing at convex
    expect(await rewards.balanceOf(GNO_SAFE)).to.equal(0);

    const amountOut = balance;
    const actualAmountOut = await dai.balanceOf(GNO_SAFE);

    // one tenth of a basis point skew - expect it to be close to the requested amount
    const skew = amountOut.div(100000);
    expect(actualAmountOut).to.be.greaterThan(amountOut.sub(skew));
    expect(actualAmountOut).to.be.lessThan(amountOut.add(skew));
  });

  it("withdraws from staked only", async () => {
    const [signer] = await hre.ethers.getSigners();
    const { adapter, rewards, lpToken } = await loadFixture(setup);
    const { dai } = await getCTokens();

    // flush 80% of the pool position such that we are not a whale
    await executeLeaveStake(
      GNO_SAFE,
      (await rewards.balanceOf(GNO_SAFE)).mul(80).div(100)
    );
    // flush all LPT
    await executeFlushERC20(GNO_SAFE, lpToken.address);

    // ensure its not capped (balance bellow maxAmountIn)
    expect(await isLptBalanceCapped(adapter)).to.be.false;

    expect(await lpToken.balanceOf(GNO_SAFE)).to.equal(0);
    expect(await rewards.balanceOf(GNO_SAFE)).greaterThan(0);
    expect(await dai.balanceOf(GNO_SAFE)).to.equal(0);

    const balance = await adapter.balance();
    await executeInstructions(
      GNO_SAFE,
      await adapter.withdrawalInstructions(balance),
      signer
    );

    // no dust left in the adapter
    expect(await lpToken.balanceOf(GNO_SAFE)).to.equal(0);
    // full withdraw from convex
    expect(await rewards.balanceOf(GNO_SAFE)).to.equal(0);

    const amountOut = balance;
    const actualAmountOut = await dai.balanceOf(GNO_SAFE);

    // one tenth of a basis point skew - expect it to be close to the requested amount
    const skew = amountOut.div(100000);
    expect(
      actualAmountOut.gt(amountOut.sub(skew)) &&
        actualAmountOut.lt(amountOut.add(skew))
    ).to.be.true;
  });

  it("withdraws from staked and unstaked", async () => {
    const [signer] = await hre.ethers.getSigners();
    const { adapter, rewards, lpToken } = await loadFixture(setup);
    const { dai } = await getCTokens();

    await executeFlushERC20(GNO_SAFE, lpToken.address);

    // leave 20% of the staked rewards
    await executeLeaveStake(
      GNO_SAFE,
      (await rewards.balanceOf(GNO_SAFE)).mul(80).div(100)
    );
    // leave 10% of the lpToken freshly unstaked
    await executeFlushERC20(
      GNO_SAFE,
      lpToken.address,
      (await lpToken.balanceOf(GNO_SAFE)).mul(90).div(100)
    );

    // ensure its not capped (balance bellow maxAmountIn)
    expect(await isLptBalanceCapped(adapter)).to.be.false;

    expect(await lpToken.balanceOf(GNO_SAFE)).to.be.greaterThan(0);
    expect(await rewards.balanceOf(GNO_SAFE)).to.be.greaterThan(0);
    expect(await dai.balanceOf(GNO_SAFE)).to.equal(0);

    const balance = await adapter.balance();
    await executeInstructions(
      GNO_SAFE,
      await adapter.withdrawalInstructions(balance),
      signer
    );

    // no dust left in the adapter
    expect(await lpToken.balanceOf(GNO_SAFE)).to.equal(0);
    // full withdraw from convex
    expect(await rewards.balanceOf(GNO_SAFE)).to.equal(0);

    const amountOut = balance;
    const actualAmountOut = await dai.balanceOf(GNO_SAFE);

    // one tenth of a basis point skew - expect it to be close to the requested amount
    const skew = amountOut.div(100000);
    expect(actualAmountOut).to.be.greaterThan(amountOut.sub(skew));
    expect(actualAmountOut).to.be.lessThan(amountOut.add(skew));
  });

  it("does not withdraw more than effective LptBalance", async () => {
    const [signer] = await hre.ethers.getSigners();
    const { adapter, rewards, lpToken } = await loadFixture(setup);
    const { dai } = await getCTokens();

    await executeFlushERC20(GNO_SAFE, lpToken.address);

    // ensure that it is capped (balance bellow maxAmountIn)
    expect(await isLptBalanceCapped(adapter)).to.be.true;

    expect(await lpToken.balanceOf(GNO_SAFE)).to.be.equal(0);
    expect(await rewards.balanceOf(GNO_SAFE)).to.be.greaterThan(0);
    expect(await dai.balanceOf(GNO_SAFE)).to.equal(0);

    const balance = await adapter.balance();
    await executeInstructions(
      GNO_SAFE,
      await adapter.withdrawalInstructions(balance),
      signer
    );

    // no dust in the form of LPToken left in the safe
    expect(await lpToken.balanceOf(GNO_SAFE)).to.be.equal(0);
    // check that some convex stake still remains
    expect(await rewards.balanceOf(GNO_SAFE)).to.be.greaterThan(0);

    const amountOut = balance;
    const actualAmountOut = await dai.balanceOf(GNO_SAFE);

    // one tenth of a basis point skew - expect it to be close to the requested amount
    const skew = amountOut.div(100000);
    expect(actualAmountOut).to.be.greaterThan(amountOut.sub(skew));
    expect(actualAmountOut).to.be.lessThan(amountOut.add(skew));
  });

  it("Whale: small withdraw is close enough to requested", async () => {
    const [signer] = await hre.ethers.getSigners();
    const { adapter, rewards, lpToken } = await loadFixture(setup);
    const { dai } = await getCTokens();

    // ensure its not capped (balance bellow maxAmountIn)
    expect(await isLptBalanceCapped(adapter)).to.be.true;

    expect(await lpToken.balanceOf(GNO_SAFE)).to.be.equal(0);
    expect(await rewards.balanceOf(GNO_SAFE)).to.be.greaterThan(0);
    expect(await dai.balanceOf(GNO_SAFE)).to.equal(0);

    const amountOut = parseUnits("100", 18);
    await executeInstructions(
      GNO_SAFE,
      await adapter.withdrawalInstructions(amountOut),
      signer
    );

    const actualAmountOut = await dai.balanceOf(GNO_SAFE);

    const skew = amountOut.div(1000);
    expect(actualAmountOut).to.be.greaterThan(amountOut.sub(skew));
    expect(actualAmountOut).to.be.lessThan(amountOut.add(skew));
  });

  it("Fish: small withdraw is close enough to requested", async () => {
    const [signer] = await hre.ethers.getSigners();
    const { adapter, rewards, lpToken } = await loadFixture(setup);
    const { dai } = await getCTokens();

    // leave 99.9% of the staked rewards
    await executeLeaveStake(
      GNO_SAFE,
      (await rewards.balanceOf(GNO_SAFE)).mul(999).div(1000)
    );
    //flush all the LPTokens freshly freed
    await executeFlushERC20(GNO_SAFE, lpToken.address);

    // ensure its not capped (balance bellow maxAmountIn)
    expect(await isLptBalanceCapped(adapter)).to.be.false;

    const balance = await adapter.balance();
    expect(balance).to.be.lessThan(parseUnits("3000", 18));

    expect(await lpToken.balanceOf(GNO_SAFE)).to.be.equal(0);
    expect(await rewards.balanceOf(GNO_SAFE)).to.be.greaterThan(0);
    expect(await dai.balanceOf(GNO_SAFE)).to.equal(0);

    const amountOut = parseUnits("1000", 18);
    await executeInstructions(
      GNO_SAFE,
      await adapter.withdrawalInstructions(amountOut),
      signer
    );

    const actualAmountOut = await dai.balanceOf(GNO_SAFE);

    // one tenth of a basis point skew - expect it to be close to the requested amount
    const skew = amountOut.div(100000);
    expect(actualAmountOut).to.be.greaterThan(amountOut.sub(skew));
    expect(actualAmountOut).to.be.lessThan(amountOut.add(skew));
  });
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

async function isLptBalanceCapped(adapter: ConvexCompoundAdapter) {
  const [unstakedBalance, stakedBalance] = await adapter.lptBalances();
  const effectiveBalance = await adapter.effectiveLptBalance();

  return unstakedBalance.add(stakedBalance).gt(effectiveBalance);
}
