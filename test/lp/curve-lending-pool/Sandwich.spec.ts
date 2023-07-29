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

    it("move price from 0.80 cents", async () => {});

    it("move price from 0.90 cents", async () => {});

    it("move price from 0.99 cents", async () => {});

    it("move price from 1.01 cents", async () => {});

    it("move price from 1.10 cents", async () => {});

    it("move price from 1.20 cents", async () => {});
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
});
