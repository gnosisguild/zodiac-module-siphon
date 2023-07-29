import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { BigNumber } from "ethers";
import hre from "hardhat";

import { fork, forkReset } from "../setup";
import {
  CToken,
  CurvePool__factory,
  ERC20__factory,
} from "../../../typechain-types";
import { formatUnits, parseUnits } from "ethers/lib/utils";
import { getCTokens } from "../constants";
import { expect } from "chai";

const GNO_SAFE = "0x849d52316331967b6ff1198e5e32a0eb168d039d";
const CURVE_POOL = "0xA2B47E3D5c44877cca798226B7B8118F9BFb7A56";

describe("ConvexCompoundPrice", async () => {
  before(async () => {
    await fork(17741542);
  });

  after(async () => {
    await forkReset();
  });

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

  it("50/50 pool reads correct price", async () => {
    const { adapter } = await loadFixture(setup);

    await injectDAI(parseUnits("1145000", 18));

    const [percOut, percOther] = await getPoolPercs();

    expect(percOut).to.equal(50);
    expect(percOther).to.equal(50);

    const price = await adapter.price();
    expect(price).to.equal(parseUnits("0.999600035", 18));
  });

  it("25/75 pool reads correct price", async () => {
    const { adapter } = await loadFixture(setup);

    await injectUSDC(parseUnits("420000", 6));

    const [percOut, percOther] = await getPoolPercs();

    expect(percOut).to.equal(25);
    expect(percOther).to.equal(75);

    const price = await adapter.price();
    expect(price).to.equal(parseUnits("0.999978378", 18));
  });

  it("72/25 pool reads correct price");

  it("5/95 pool reads correct price", async () => {
    const { adapter } = await loadFixture(setup);

    await injectUSDC(parseUnits("1700000", 6));

    const [percOut, percOther] = await getPoolPercs();
    expect(percOut).to.equal(5);
    expect(percOther).to.equal(95);

    const price = await adapter.price();
    expect(price).to.equal(parseUnits("1.008983752", 18));
  });

  it("95/5 pool reads correct price", async () => {
    const { adapter } = await loadFixture(setup);

    await injectDAI(parseUnits("4020000", 18));

    const [percOut, percOther] = await getPoolPercs();
    expect(percOut).to.equal(95);
    expect(percOther).to.equal(5);

    const price = await adapter.price();
    expect(price).to.equal(parseUnits("0.988548354", 18));
  });

  it("1/99 pool reads correct price", async () => {
    const { adapter } = await loadFixture(setup);

    await injectUSDC(parseUnits("2000000", 6));

    const [percOut, percOther] = await getPoolPercs();
    expect(percOut).to.equal(1);
    expect(percOther).to.equal(99);

    const price = await adapter.price();
    expect(price).to.equal(parseUnits("1.296422852", 18));
  });
  it("99/1 pool reads correct price", async () => {
    const { adapter } = await loadFixture(setup);

    await injectDAI(parseUnits("4280000", 18));

    const [percOut, percOther] = await getPoolPercs();
    expect(percOut).to.equal(99);
    expect(percOther).to.equal(1);

    const price = await adapter.price();
    expect(price).to.equal(parseUnits("0.813246027", 18));
  });
});

async function moveERC20(from: string, to: string, tokenAddress: string) {
  const impersonator = await hre.ethers.getImpersonatedSigner(from);

  const token = ERC20__factory.connect(tokenAddress, impersonator);

  const receipt = await token.transfer(to, await token.balanceOf(from));

  await receipt.wait();
}

const SCALE = parseUnits("1", 18);

async function injectDAI(amount: BigNumber) {
  const [signer] = await hre.ethers.getSigners();
  const { dai } = await getCTokens(signer);

  const pool = CurvePool__factory.connect(CURVE_POOL, signer);

  await (await dai.approve(pool.address, amount)).wait();
  await (await pool.exchange_underlying(0, 1, amount, 0)).wait();
}

async function injectUSDC(amount: BigNumber) {
  const [signer] = await hre.ethers.getSigners();
  const { usdc } = await getCTokens(signer);

  const pool = CurvePool__factory.connect(CURVE_POOL, signer);

  await (await usdc.approve(pool.address, amount)).wait();
  await (await pool.exchange_underlying(1, 0, amount, 0)).wait();
}

async function calcCTokenToUnderlying(cToken: CToken, amount: BigNumber) {
  return amount.mul(await cToken.exchangeRateStored()).div(SCALE);
}

async function getPoolPercs() {
  const { percOut, percOther } = await getPoolShape();

  return [Math.round(percOut * 100), Math.round(percOther * 100)];
}

async function getPoolShape() {
  const [signer] = await hre.ethers.getSigners();

  const pool = CurvePool__factory.connect(CURVE_POOL, hre.ethers.provider);

  const { cdai, cusdc } = getCTokens(signer);

  const reservesOut = await calcCTokenToUnderlying(
    cdai,
    await pool.balances(0)
  );
  const reservesOther = await calcCTokenToUnderlying(
    cusdc,
    await pool.balances(1)
  );

  const a = Number(formatUnits(reservesOut, 18));
  const b = Number(formatUnits(reservesOther.mul(10 ** 12), 18));

  return {
    reservesOut,
    reservesOther,
    percOut: a / (a + b),
    percOther: b / (a + b),
  };
}
