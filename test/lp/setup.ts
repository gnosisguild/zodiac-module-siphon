import dotenv from "dotenv";
import { BigNumber, Contract } from "ethers";
import hre, { ethers, getNamedAccounts } from "hardhat";

import {
  DAI_ADDRESS,
  DAI_WHALE,
  gaugeAbi,
  MAX_UINT256,
  TETHER_ADDRESS,
  TETHER_WHALE,
  USDC_ADDRESS,
  USDC_WHALE,
  VAULT_ADDRESS,
} from "./constants";

export async function fork(blockNumber: number): Promise<void> {
  // Load environment variables.
  dotenv.config();
  const { ALCHEMY_KEY } = process.env;
  // fork mainnet
  await hre.network.provider.request({
    method: "hardhat_reset",
    params: [
      {
        forking: {
          jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_KEY}`,
          blockNumber,
        },
      },
    ],
  });
}

export async function forkReset(): Promise<void> {
  await hre.network.provider.request({
    method: "hardhat_reset",
    params: [],
  });
}

export async function fundWhaleWithStables(): Promise<void> {
  const { BigWhale } = await getNamedAccounts();
  const signer = hre.ethers.provider.getSigner(BigWhale);

  const dai = await fundWithERC20(DAI_ADDRESS, DAI_WHALE, BigWhale);
  const tether = await fundWithERC20(TETHER_ADDRESS, TETHER_WHALE, BigWhale);
  const usdc = await fundWithERC20(USDC_ADDRESS, USDC_WHALE, BigWhale);

  await dai.connect(signer).approve(VAULT_ADDRESS, MAX_UINT256);
  await tether.connect(signer).approve(VAULT_ADDRESS, MAX_UINT256);
  await usdc.connect(signer).approve(VAULT_ADDRESS, MAX_UINT256);
}

export async function fundWhaleWithBpt(
  gaugeAddress: string,
  gaugeTopHolders: string[]
): Promise<void> {
  const { BigWhale } = await getNamedAccounts();
  const signer = hre.ethers.provider.getSigner(BigWhale);

  for (let i = 0; i < gaugeTopHolders.length; i++) {
    await fundWhale(gaugeAddress, gaugeTopHolders[i]);
  }

  const gauge = new hre.ethers.Contract(gaugeAddress, gaugeAbi, signer);
  const balance: BigNumber = await gauge.balanceOf(BigWhale);
  await gauge["withdraw(uint256)"](balance);
}

export async function fundWithERC20(
  tokenAddress: string,
  from: string,
  to: string
): Promise<Contract> {
  const token = await hre.ethers.getContractAt("ERC20", tokenAddress);

  await fundWithEth(from);

  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [from],
  });
  const signer = await hre.ethers.provider.getSigner(from);
  const balance = await token.balanceOf(from);
  await token.connect(signer).transfer(to, balance);
  return token;
}

async function fundWhale(
  tokenAddress: string,
  from: string
): Promise<Contract> {
  const { BigWhale } = await getNamedAccounts();

  const token = await hre.ethers.getContractAt("ERC20", tokenAddress);

  await fundWithEth(from);

  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [from],
  });
  const signer = await hre.ethers.provider.getSigner(from);
  const balance = await token.balanceOf(from);
  await token.connect(signer).transfer(BigWhale, balance);
  return token;
}

async function fundWithEth(account: string) {
  const { BigWhale } = await getNamedAccounts();
  const signer = hre.ethers.provider.getSigner(BigWhale);

  const tx = {
    from: BigWhale,
    to: account,
    value: ethers.utils.parseEther("1"),
  };

  await signer.sendTransaction(tx);
}
