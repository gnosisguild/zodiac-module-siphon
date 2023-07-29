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

const CURVE_POOL = "0xA2B47E3D5c44877cca798226B7B8118F9BFb7A56";

export async function moveERC20(
  from: string,
  to: string,
  tokenAddress: string
) {
  const impersonator = await hre.ethers.getImpersonatedSigner(from);

  const token = ERC20__factory.connect(tokenAddress, impersonator);

  const receipt = await token.transfer(to, await token.balanceOf(from));

  await receipt.wait();
}

const SCALE = parseUnits("1", 18);

export async function injectDAI(amount: BigNumber) {
  const [signer] = await hre.ethers.getSigners();
  const { dai } = await getCTokens(signer);

  const pool = CurvePool__factory.connect(CURVE_POOL, signer);

  await (await dai.approve(pool.address, amount)).wait();
  await (await pool.exchange_underlying(0, 1, amount, 0)).wait();
}

export async function injectUSDC(amount: BigNumber) {
  const [signer] = await hre.ethers.getSigners();
  const { usdc } = await getCTokens(signer);

  const pool = CurvePool__factory.connect(CURVE_POOL, signer);

  await (await usdc.approve(pool.address, amount)).wait();
  await (await pool.exchange_underlying(1, 0, amount, 0)).wait();
}

export async function getPoolPercs() {
  const { percOut, percOther } = await getPoolShape();

  return [Math.round(percOut * 100), Math.round(percOther * 100)];
}

export async function getPoolShape() {
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

async function calcCTokenToUnderlying(cToken: CToken, amount: BigNumber) {
  return amount.mul(await cToken.exchangeRateStored()).div(SCALE);
}
