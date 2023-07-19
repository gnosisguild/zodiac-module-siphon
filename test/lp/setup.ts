import dotenv from "dotenv";
import { BigNumber, Contract } from "ethers";
import hre, { ethers } from "hardhat";

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
import {
  BoostedPoolHelperMock,
  LinearPoolHelper,
  StablePhantomPoolHelper,
  StablePoolHelper,
} from "../../typechain-types";

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
  const signer = await getWhaleSigner();
  const BigWhale = await signer.address;

  const dai = await fundWithERC20(DAI_ADDRESS, DAI_WHALE, BigWhale);
  const tether = await fundWithERC20(TETHER_ADDRESS, TETHER_WHALE, BigWhale);
  const usdc = await fundWithERC20(USDC_ADDRESS, USDC_WHALE, BigWhale);

  await dai.connect(signer).approve(VAULT_ADDRESS, MAX_UINT256);
  await tether.connect(signer).approve(VAULT_ADDRESS, MAX_UINT256);
  await usdc.connect(signer).approve(VAULT_ADDRESS, MAX_UINT256);
}

export async function fundWhaleWithBpt(
  gaugeAddress: string,
  gaugeTopHolders: string[],
): Promise<void> {
  const signer = await getWhaleSigner();
  const BigWhale = await signer.address;

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
  to: string,
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
  from: string,
): Promise<Contract> {
  const BigWhale = await (await getWhaleSigner()).address;

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
  const signer = await getWhaleSigner();
  const BigWhale = await signer.address;

  const tx = {
    from: BigWhale,
    to: account,
    value: ethers.utils.parseEther("1"),
  };

  await signer.sendTransaction(tx);
}

export type BalancerLibs = {
  linearPoolHelper: LinearPoolHelper;
  stablePoolHelper: StablePoolHelper;
  stablePhantomPoolHelper: StablePhantomPoolHelper;
  boostedPoolHelper: BoostedPoolHelperMock;
  vaultQueryHelper: Contract;
};

export async function deployBalancerLibs() {
  // const Errors = await hre.ethers.getContractFactory("Errors");
  // const errors = await Errors.deploy();

  // const Math = await hre.ethers.getContractFactory("Math");
  // const math = await Math.deploy();

  // const LogExpMath = await hre.ethers.getContractFactory("LogExpMath");
  // const logExpMath = await LogExpMath.deploy();

  // const FixedPoint = await hre.ethers.getContractFactory("FixedPoint");
  // const fixedPoint = await FixedPoint.deploy();

  // const LinearMath = await hre.ethers.getContractFactory("LinearMath");
  // const linearMath = await LinearMath.deploy();

  // const StableMath = await hre.ethers.getContractFactory("StableMath");
  // const stableMath = await StableMath.deploy();

  const Utils = await hre.ethers.getContractFactory("Utils");
  const utils = await Utils.deploy();

  const StablePoolHelper = await hre.ethers.getContractFactory(
    "StablePoolHelper",
    {
      libraries: { Utils: utils.address },
    },
  );
  const stablePoolHelper = await StablePoolHelper.deploy();

  const LinearPoolHelper = await hre.ethers.getContractFactory(
    "LinearPoolHelper",
    {
      libraries: { Utils: utils.address },
    },
  );
  const linearPoolHelper = await LinearPoolHelper.deploy();

  const StablePhantomPoolHelper = await hre.ethers.getContractFactory(
    "StablePhantomPoolHelper",
    {
      libraries: { Utils: utils.address },
    },
  );
  const stablePhantomPoolHelper = await StablePhantomPoolHelper.deploy();

  const BoostedPoolHelper = await hre.ethers.getContractFactory(
    "BoostedPoolHelper",
    {
      libraries: {
        Utils: utils.address,
        LinearPoolHelper: linearPoolHelper.address,
        StablePhantomPoolHelper: stablePhantomPoolHelper.address,
      },
    },
  );
  const boostedPoolHelper = await BoostedPoolHelper.deploy();

  const VaultQueryHelper = await hre.ethers.getContractFactory(
    "VaultQueryHelper",
  );
  const vaultQueryHelper = await VaultQueryHelper.deploy();

  return {
    utils,
    linearPoolHelper,
    stablePoolHelper,
    stablePhantomPoolHelper,
    boostedPoolHelper,
    vaultQueryHelper,
  };
}

export async function getWhaleSigner() {
  const [, whaleSigner] = await hre.ethers.getSigners();
  return whaleSigner;
}
