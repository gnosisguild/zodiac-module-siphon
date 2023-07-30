import { BigNumber, BigNumberish } from "ethers";
import hre from "hardhat";
import ethers from "ethers";

import {
  CToken,
  CToken__factory,
  CurvePool__factory,
  ERC20__factory,
  MockRewardPool__factory,
} from "../../../typechain-types";
import { formatUnits, parseUnits } from "ethers/lib/utils";
import { getCTokens } from "../constants";
import { execPopulatedTransaction } from "../../safe";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

export const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
export const COMPOUND_USDC_ADDRESS =
  "0x39AA39c021dfbaE8faC545936693aC917d5E7563";
export const DAI_ADDRESS = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
export const COMPOUND_DAI_ADDRESS =
  "0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643";

export const CONVEX_REWARDS = "0xf34DFF761145FF0B05e917811d488B441F33a968";
export const CURVE_POOL = "0xA2B47E3D5c44877cca798226B7B8118F9BFb7A56";
export const CURVE_POOL_TOKEN = "0x845838DF265Dcd2c412A1Dc9e959c7d08537f8a2";
export const CURVE_POOL_DEPOSIT = "0xeB21209ae4C2c9FF2a86ACA31E123764A3B6Bc06";

export function getTokens(
  signer: SignerWithAddress | ethers.providers.JsonRpcProvider
) {
  const cdai = CToken__factory.connect(COMPOUND_DAI_ADDRESS, signer);
  const cusdc = CToken__factory.connect(COMPOUND_USDC_ADDRESS, signer);

  const dai = ERC20__factory.connect(DAI_ADDRESS, signer);
  const usdc = ERC20__factory.connect(USDC_ADDRESS, signer);

  const lpToken = ERC20__factory.connect(CURVE_POOL_TOKEN, signer);

  return { cdai, cusdc, dai, usdc, lpToken };
}

export async function executeLeaveStake(
  safeAddress: string,
  balance?: BigNumberish
) {
  const [signer] = await hre.ethers.getSigners();

  const rewards = MockRewardPool__factory.connect(
    CONVEX_REWARDS,
    hre.ethers.provider
  );

  const tx = await rewards.populateTransaction.withdrawAndUnwrap(
    balance ? balance : await rewards.balanceOf(safeAddress),
    false
  );

  await execPopulatedTransaction(safeAddress, tx, signer);
}

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

export async function getPoolPercs() {
  const { percOut, percOther } = await getPoolShape();

  return [Math.round(percOut * 100), Math.round(percOther * 100)];
}

export async function getPoolShape() {
  const pool = CurvePool__factory.connect(CURVE_POOL, hre.ethers.provider);

  const { cdai, cusdc } = getCTokens(hre.ethers.provider);

  const reservesDAI = await calcCTokenToUnderlying(
    cdai,
    await pool.balances(0)
  );
  const reservesUSDC = await calcCTokenToUnderlying(
    cusdc,
    await pool.balances(1)
  );

  const a = Number(formatUnits(reservesDAI, 18));
  const b = Number(formatUnits(reservesUSDC.mul(10 ** 12), 18));

  return {
    reservesDAI,
    reservesUSDC,
    percOut: a / (a + b),
    percOther: b / (a + b),
  };
}

export async function addLiquidityUpTo(
  targetUnderlyingDAI: BigNumber,
  targetUnderlyingUSDC: BigNumber,
  whale: SignerWithAddress
) {
  const { cdai, cusdc } = getCTokens(whale);
  const { reservesDAI, reservesUSDC } = await getPoolShape();

  if (targetUnderlyingDAI.gt(reservesDAI)) {
    if ((await cdai.balanceOf(whale.address)).gt(0)) {
      throw Error("not empty");
    }
    const toMint = targetUnderlyingDAI.sub(reservesDAI);
    await injectDAI(toMint, whale);
  }

  if (targetUnderlyingUSDC.gt(reservesUSDC)) {
    if ((await cusdc.balanceOf(whale.address)).gt(0)) {
      throw Error("not empty");
    }
    const toMint = targetUnderlyingUSDC.sub(reservesUSDC);
    await injectUSDC(toMint, whale);
  }
}

export async function injectDAI(
  amountDAI: BigNumber,
  whale: SignerWithAddress
) {
  const { cdai, dai } = getCTokens(whale);
  const pool = CurvePool__factory.connect(CURVE_POOL, whale);

  const amounts = [BigNumber.from(0), BigNumber.from(0)];

  if ((await cdai.balanceOf(whale.address)).gt(0)) {
    throw Error("not empty");
  }

  await dai.approve(cdai.address, 0);
  await dai.approve(cdai.address, amountDAI);
  await cdai.mint(amountDAI);
  const amountMinted = await cdai.balanceOf(whale.address);
  if (amountMinted.eq(0)) {
    throw Error("mint cdai failed");
  }

  amounts[0] = amountMinted;
  await cdai.approve(pool.address, 0);
  await cdai.approve(pool.address, amountMinted);

  await pool.add_liquidity([amounts[0], amounts[1]], 0);
}

export async function injectUSDC(
  amountUSDC: BigNumber,
  whale: SignerWithAddress
) {
  const { cusdc, usdc } = getCTokens(whale);
  const pool = CurvePool__factory.connect(CURVE_POOL, whale);

  const amounts = [BigNumber.from(0), BigNumber.from(0)];

  if ((await cusdc.balanceOf(whale.address)).gt(0)) {
    throw Error("not empty");
  }

  await usdc.approve(cusdc.address, 0);
  await usdc.approve(cusdc.address, amountUSDC);
  await (await cusdc.mint(amountUSDC)).wait();

  const amountMinted = await cusdc.balanceOf(whale.address);
  if (amountMinted.eq(0)) {
    throw Error("mint cusdc failed");
  }
  amounts[1] = amountMinted;

  await cusdc.approve(pool.address, 0);
  await cusdc.approve(pool.address, amountMinted);

  await pool.add_liquidity([amounts[0], amounts[1]], 0);
}

export async function swapInDAI(amount: BigNumber, signer: SignerWithAddress) {
  const { dai } = await getCTokens(signer);

  const pool = CurvePool__factory.connect(CURVE_POOL, signer);

  await (await dai.approve(pool.address, amount)).wait();
  await (await pool.exchange_underlying(0, 1, amount, 0)).wait();
}

export async function swapInUSDC(amount: BigNumber, signer: SignerWithAddress) {
  const { usdc } = await getCTokens(signer);

  const pool = CurvePool__factory.connect(CURVE_POOL, signer);

  await (await usdc.approve(pool.address, amount)).wait();
  await (await pool.exchange_underlying(1, 0, amount, 0)).wait();
}

async function calcCTokenToUnderlying(cToken: CToken, amount: BigNumber) {
  return amount.mul(await cToken.exchangeRateStored()).div(SCALE);
}

async function calcUnderlyingToCToken(cToken: CToken, amount: BigNumber) {
  return amount.mul(SCALE).div(await cToken.exchangeRateStored());
}
