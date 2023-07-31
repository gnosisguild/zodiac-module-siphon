import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import hre from "hardhat";

import { ConvexCompoundAdapter, SafeMock__factory } from "../typechain-types";

import { fork, forkReset } from "./lp/setup";
import { execPopulatedTransaction, takeover } from "./safe";
import { parseUnits } from "ethers/lib/utils";
import { getTokens, takeoverERC20 } from "./setup";
import {
  CONVEX_REWARDS,
  CURVE_POOL_DEPOSIT,
  addLiquidityUpTo,
  getPoolReserves,
  swapInDAI,
  swapInUSDC,
  swapOutDAI,
  swapOutUSDC,
} from "./lp/curve-lending-pool/pool";

const GNO_SAFE = "0x849d52316331967b6ff1198e5e32a0eb168d039d";

/*
 * Sandwich facts:
 * - Before we exit, if someone pulls DAI out of the pool we are worse off
 * - Before we exit, if someone pushes DAI onto the pool we are better off
 *
 *
 * more DAI price() down : price() < 1
 * less DAI price() up :  price() > 1
 *
 * Thus, if USDC depeg, price will be > 1
 * And if DAI depeg, price will be < 1
 *
 * Attackers can thus push the price up profitably (remove DAI and/or insert USDC)
 * Pushing the price down is not profitable (insert DAI or remove USDC or both)
 *
 * If we require price < 1 we don't allow trading when USDC depegs
 * But we do allow trading when USDC depegs
 */

const oneDAI = parseUnits("1", 18);
const oneUSDC = parseUnits("1", 6);

describe("Sandwich", async () => {
  before(async () => {
    await fork(17741542);
  });

  after(async () => {
    await forkReset();
  });

  async function setup() {
    const [signer, , stableCoinWhale] = await hre.ethers.getSigners();
    const safe = await takeover(GNO_SAFE, signer.address);

    const { dai, usdc } = getTokens(hre.ethers.provider);

    await takeoverERC20(
      "0x075e72a5eDf65F0A5f44699c7654C1a76941Ddc8",
      stableCoinWhale.address,
      dai.address
    );

    await takeoverERC20(
      "0x51eDF02152EBfb338e03E30d65C15fBf06cc9ECC",
      stableCoinWhale.address,
      usdc.address
    );

    const LiquidityAdapter = await hre.ethers.getContractFactory(
      "ConvexCompoundAdapter"
    );
    const liquidityAdapter = await LiquidityAdapter.deploy(
      CURVE_POOL_DEPOSIT,
      CONVEX_REWARDS,
      0,
      1,
      GNO_SAFE,
      parseUnits("1", 18)
    );

    const DebtAdapter = await hre.ethers.getContractFactory(
      "MakerVaultAdapter"
    );
    const debtAdapter = await DebtAdapter.deploy(
      "0x6b175474e89094c44da98b954eedeac495271d0f",
      "0x5ef30b9986345249bc32d8928B7ee64DE9435E39",
      "0x9759A6Ac90977b93B58547b4A71c78317f391A28",
      "0xD758500ddEc05172aaA035911387C8E0e789CF6a",
      "0x82ecd135dce65fbc6dbdd0e4237e0af93ffd5038",
      "0x0DA0C3e52C977Ed3cBc641fF02DD271c3ED55aFe",
      "0x65C79fcB50Ca1594B025960e539eD7A9a6D434A3",
      parseUnits("5.4", 27),
      parseUnits("5.38", 27),
      27353
    );

    const Siphon = await hre.ethers.getContractFactory("Siphon");
    const siphon = await Siphon.deploy(GNO_SAFE, GNO_SAFE);

    await execPopulatedTransaction(
      GNO_SAFE,
      await siphon.populateTransaction.connectTube(
        "compound-tube",
        debtAdapter.address,
        liquidityAdapter.address
      ),
      signer
    );

    await enableModule(safe.address, siphon.address, signer);

    return { siphon, debtAdapter, liquidityAdapter, stableCoinWhale };
  }

  async function movePoolTo110(
    liquidityAdapter: ConvexCompoundAdapter,
    stableCoinWhale: SignerWithAddress
  ) {
    /*
     * 1.1 price means a capital ratio of:
     * 1.66  % DAI
     * 98.34 % USDC
     */
    await swapOutDAI(parseUnits("1000000", 18), stableCoinWhale);
    await addLiquidityUpTo(
      parseUnits("1660000", 18),
      parseUnits("98340000", 6),
      stableCoinWhale
    );

    // price ~1.10
    expect(await liquidityAdapter.price()).to.equal(
      parseUnits("1.099888089", 18)
    );

    const { reservesDAI, reservesUSDC } = await getPoolReserves();

    expect(reservesDAI.div(oneDAI)).to.equal(1657745);
    expect(reservesUSDC.div(oneUSDC)).to.equal(98337731);
  }

  async function movePoolTo090(
    liquidityAdapter: ConvexCompoundAdapter,
    stableCoinWhale: SignerWithAddress
  ) {
    /*
     * 1.1 price means a capital ratio of:
     * 1.66  % DAI
     * 98.34 % USDC
     */

    await swapInDAI(oneDAI.mul(5000000), stableCoinWhale);
    await addLiquidityUpTo(
      oneDAI.mul(98414000),
      oneUSDC.mul(1586000),
      stableCoinWhale
    );

    // price ~0.90
    expect(await liquidityAdapter.price()).to.equal(
      parseUnits("0.900765578", 18)
    );
  }

  it("usdc depeg - withdrawal is not possible", async () => {
    const { siphon, debtAdapter, liquidityAdapter, stableCoinWhale } =
      await loadFixture(setup);

    await movePoolTo110(liquidityAdapter, stableCoinWhale);

    // required capital 290K dai
    expect((await debtAdapter.delta()).div(oneDAI)).to.equal(290752);

    expect(await debtAdapter.needsRebalancing()).to.equal(true);
    await expect(siphon.siphon("compound-tube")).to.be.revertedWithCustomError(
      siphon,
      "WithdrawalBlocked"
    );
  });

  it("usdc depeg - moving the pool back to balance is loss for attacker", async () => {
    const { siphon, debtAdapter, liquidityAdapter, stableCoinWhale } =
      await loadFixture(setup);

    const { dai } = getTokens(hre.ethers.provider);

    await movePoolTo110(liquidityAdapter, stableCoinWhale);

    const attacker = stableCoinWhale;
    const startDAI = await dai.balanceOf(attacker.address);

    // required capital 290K dai
    expect((await debtAdapter.delta()).div(oneDAI)).to.equal(290752);

    // open sandwich - move the pool such that withdraw is possible
    const amountOutUSDC = oneUSDC.mul(50000000); // 50M
    await swapOutUSDC(amountOutUSDC, attacker);

    expect(await debtAdapter.needsRebalancing()).to.equal(true);
    await siphon.siphon("compound-tube");
    expect(await debtAdapter.needsRebalancing()).to.equal(false);

    // close the sandwich
    await swapInUSDC(amountOutUSDC, attacker);
    const endDAI = await dai.balanceOf(attacker.address);

    expect(startDAI).to.be.greaterThan(endDAI);

    // attacker suffered loss of 67K
    expect(startDAI.sub(endDAI).div(oneDAI)).to.equal(67470);
  });

  it("usdc depeg - withdraw is possible", async () => {
    const { siphon, debtAdapter, liquidityAdapter, stableCoinWhale } =
      await loadFixture(setup);

    await movePoolTo090(liquidityAdapter, stableCoinWhale);

    const { dai } = getTokens(hre.ethers.provider);

    // required capital 290K dai
    expect((await debtAdapter.delta()).div(oneDAI)).to.equal(290752);

    expect(await debtAdapter.needsRebalancing()).to.equal(true);
    await expect(siphon.siphon("compound-tube")).to.not.be.reverted;
    expect(await debtAdapter.needsRebalancing()).to.equal(false);
  });

  it("usdc depeg - moving the pool back to balance is profit for attacker", async () => {
    const { siphon, debtAdapter, liquidityAdapter, stableCoinWhale } =
      await loadFixture(setup);

    const { usdc } = getTokens(stableCoinWhale);

    await movePoolTo090(liquidityAdapter, stableCoinWhale);

    const attacker = stableCoinWhale;
    const startUSDC = await usdc.balanceOf(attacker.address);

    // required capital 290K dai
    expect((await debtAdapter.delta()).div(oneDAI)).to.equal(290752);

    // open sandwich - move the pool such that withdraw is possible
    const amountOutDAI = oneDAI.mul(50000000); // 50M
    await swapOutDAI(amountOutDAI, attacker);
    //expect(await liquidityAdapter.price()).to.equal(parseUnits("0.99", 18));

    expect(await debtAdapter.needsRebalancing()).to.equal(true);
    await siphon.siphon("compound-tube");
    expect(await debtAdapter.needsRebalancing()).to.equal(false);

    // close the sandwich
    await swapInDAI(amountOutDAI, attacker);
    const endUSDC = await usdc.balanceOf(attacker.address);
    expect(startUSDC).to.be.lessThan(endUSDC);
  });
});

async function enableModule(
  safeAddress: string,
  module: string,
  signer: SignerWithAddress
) {
  const safe = SafeMock__factory.connect(safeAddress, hre.ethers.provider);

  const tx = await safe.populateTransaction.enableModule(module);

  await execPopulatedTransaction(safeAddress, tx, signer);
}
