import { BigNumber, Contract } from "ethers";
import hre, { ethers } from "hardhat";

import {
  DAI_ADDRESS,
  MAX_UINT256,
  poolAbi,
  STABLE_GAUGE_ADDRESS,
  STABLE_POOL_ADDRESS,
  TETHER_ADDRESS,
  USDC_ADDRESS,
  vaultAbi,
  VAULT_ADDRESS,
} from "../constants";
import { deployBalancerLibs, getWhaleSigner } from "../setup";

export async function setup() {
  const Avatar = await hre.ethers.getContractFactory("TestAvatar");
  const avatar = await Avatar.deploy();
  const adapter = await setupAdapter(avatar);

  const dai = await hre.ethers.getContractAt("ERC20", DAI_ADDRESS);
  const usdc = await hre.ethers.getContractAt("ERC20", USDC_ADDRESS);
  const tether = await hre.ethers.getContractAt("ERC20", TETHER_ADDRESS);

  const vault = new hre.ethers.Contract(
    VAULT_ADDRESS,
    vaultAbi,
    hre.ethers.provider
  );

  return {
    avatar,
    adapter,
    vault,
    dai,
    tether,
    usdc,
  };
}

export async function setupAdapter(avatar: Contract) {
  const signer = await getWhaleSigner();
  const BigWhale = signer.address;

  const libraries = await deployBalancerLibs();

  const Adapter = await hre.ethers.getContractFactory("StablePoolAdapter", {
    libraries: {
      Utils: libraries.utils.address,
      StablePoolHelper: libraries.stablePoolHelper.address,
    },
  });
  const adapter = await Adapter.deploy(
    BigWhale,
    avatar.address,
    // pool
    STABLE_POOL_ADDRESS,
    // gauge
    STABLE_GAUGE_ADDRESS,
    // dai
    DAI_ADDRESS
  );

  return adapter;
}

export async function fundAvatar(
  avatar: Contract,
  gauge: Contract,
  pool: Contract,
  gaugeAmount: BigNumber,
  bptAmount: BigNumber
): Promise<void> {
  const signer = await getWhaleSigner();

  await pool.connect(signer).transfer(avatar.address, bptAmount);
  await pool.connect(signer).approve(gauge.address, MAX_UINT256);
  await gauge.connect(signer)["deposit(uint256)"](gaugeAmount);
  await gauge.connect(signer).transfer(avatar.address, gaugeAmount);
}

export async function joinPool(
  tokenIn: string,
  amountIn: BigNumber
): Promise<void> {
  const signer = await getWhaleSigner();
  const BigWhale = signer.address;

  const vault = new ethers.Contract(VAULT_ADDRESS, vaultAbi, signer);

  const pool = new ethers.Contract(STABLE_POOL_ADDRESS, poolAbi, signer);
  const poolId = await pool.getPoolId();

  const { tokens } = await vault.getPoolTokens(poolId);
  const tokenInIndex = tokens.indexOf(tokenIn);
  if (tokenInIndex == -1) throw new Error("Couldn't find index in setup");

  const amountsIn = new Array(tokens.length).fill(0);
  amountsIn[tokenInIndex] = amountIn;

  const tx = await vault.connect(signer).joinPool(poolId, BigWhale, BigWhale, {
    assets: tokens,
    maxAmountsIn: amountsIn,
    userData: ethers.utils.defaultAbiCoder.encode(
      ["uint256", "uint256[]", "uint256"],
      [1, amountsIn, "0"]
    ),
    fromInternalBalance: false,
  });

  await tx.wait();
}

export async function exitPool(
  tokenIn: string,
  amountIn: BigNumber
): Promise<void> {
  const signer = await getWhaleSigner();
  const BigWhale = signer.address;

  const vault = new ethers.Contract(VAULT_ADDRESS, vaultAbi, signer);

  const pool = new ethers.Contract(STABLE_POOL_ADDRESS, poolAbi, signer);
  const poolId = await pool.getPoolId();

  const bptBalance = await pool.balanceOf(BigWhale);

  const { tokens } = await vault.getPoolTokens(poolId);

  const amountsOut = [0, "1", 0];

  const tx = await vault.connect(signer).exitPool(poolId, BigWhale, BigWhale, {
    assets: tokens,
    minAmountsOut: amountsOut,
    userData: ethers.utils.defaultAbiCoder.encode(
      ["uint256", "uint256", "uint256"],
      [0, bptBalance, 1]
    ),
    fromInternalBalance: false,
  });

  await tx.wait();
}

export async function printBalance() {
  const signer = await getWhaleSigner();
  const BigWhale = signer.address;
  const pool = await hre.ethers.getContractAt("ERC20", STABLE_POOL_ADDRESS);

  console.log(`Big Whale ${BigWhale} has pool`);
  console.log((await pool.balanceOf(BigWhale)).toString());
}
