import { BigNumber, Contract } from "ethers";
import { getAddress } from "ethers/lib/utils";
import hre, { deployments, ethers, getNamedAccounts } from "hardhat";

import {
  BOOSTED_GAUGE_ADDRESS,
  BOOSTED_POOL_ADDRESS,
  gaugeAbi,
  vaultAbi,
  VAULT_ADDRESS,
} from "../constants";
import { fundWithERC20 } from "../setup";

const USDC = {
  main: getAddress("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"),
  wrapped: getAddress("0xd093fa4fb80d09bb30817fdcd442d4d02ed3e5de"),
  linearPool: getAddress("0x9210f1204b5a24742eba12f710636d76240df3d0"),
};

const DAI = {
  main: getAddress("0x6b175474e89094c44da98b954eedeac495271d0f"),
  wrapped: getAddress("0x02d60b84491589974263d922d9cc7a3152618ef6"),
  linearPool: getAddress("0x804cdb9116a10bb78768d3252355a1b18067bf8f"),
};

const TETHER = {
  main: getAddress("0xdac17f958d2ee523a2206206994597c13d831ec7"),
  wrapped: getAddress("0xf8fd466f12e236f4c96f7cce6c79eadb819abf58"),
  linearPool: getAddress("0x2bbf681cc4eb09218bee85ea2a5d3d13fa40fc0c"),
};

async function setupAdapter(avatar: Contract) {
  const { BigWhale } = await getNamedAccounts();
  const BoostedPoolHelper = await deployments.get("BoostedPoolHelper");

  const Adapter = await hre.ethers.getContractFactory("BoostedPoolAdapter", {
    libraries: {
      BoostedPoolHelper: BoostedPoolHelper.address,
    },
  });
  const adapter = await Adapter.deploy(
    BigWhale,
    avatar.address,
    // pool
    BOOSTED_POOL_ADDRESS,
    // gauge
    BOOSTED_GAUGE_ADDRESS,
    // dai
    DAI.main
  );

  return adapter;
}

export async function setupFundWhale(
  boostedGaugeTopHolders: string[]
): Promise<void> {
  const { BigWhale } = await getNamedAccounts();
  const signer = hre.ethers.provider.getSigner(BigWhale);

  const gauge = new hre.ethers.Contract(
    BOOSTED_GAUGE_ADDRESS,
    gaugeAbi,
    signer
  );

  for (let i = 0; i < boostedGaugeTopHolders.length; i++) {
    await fundWithERC20(
      BOOSTED_GAUGE_ADDRESS,
      boostedGaugeTopHolders[i],
      BigWhale
    );
  }

  const balance: BigNumber = await gauge.balanceOf(BigWhale);
  await gauge["withdraw(uint256)"](
    balance.sub(BigNumber.from("1000000000000000000000000"))
  );
}

export async function setupFundAvatar(
  avatar: Contract,
  gaugeAmount: BigNumber,
  bptAmount: BigNumber
): Promise<void> {
  const { BigWhale } = await getNamedAccounts();
  const signer = hre.ethers.provider.getSigner(BigWhale);

  const gauge = await hre.ethers.getContractAt("ERC20", BOOSTED_GAUGE_ADDRESS);
  const bpt = await hre.ethers.getContractAt("ERC20", BOOSTED_POOL_ADDRESS);

  await gauge.connect(signer).transfer(avatar.address, gaugeAmount);
  await bpt.connect(signer).transfer(avatar.address, bptAmount);
}

export async function setup() {
  const Avatar = await hre.ethers.getContractFactory("TestAvatar");
  const avatar = await Avatar.deploy();
  const adapter = await setupAdapter(avatar);

  const pool = await hre.ethers.getContractAt("ERC20", BOOSTED_POOL_ADDRESS);
  const gauge = await hre.ethers.getContractAt("ERC20", BOOSTED_GAUGE_ADDRESS);
  const dai = await hre.ethers.getContractAt("ERC20", DAI.main);
  const tether = await hre.ethers.getContractAt("ERC20", TETHER.main);
  const usdc = await hre.ethers.getContractAt("ERC20", USDC.main);
  const boostedPoolHelper = await getBoostedPoolHelper();

  return {
    avatar,
    adapter,
    pool,
    gauge,
    dai,
    tether,
    usdc,
    boostedPoolHelper,
  };
}

export async function investInPool(
  tokenIn: string,
  amountIn: BigNumber
): Promise<void> {
  const { BigWhale } = await getNamedAccounts();
  const signer = hre.ethers.provider.getSigner(BigWhale);
  const boostedPoolHelper = await getBoostedPoolHelper();

  const vault = new ethers.Contract(VAULT_ADDRESS, vaultAbi, signer);

  const stable = await hre.ethers.getContractAt("ERC20", tokenIn);

  const boostedPool = new ethers.Contract(
    BOOSTED_POOL_ADDRESS,
    linearPoolAbi,
    signer
  );
  const boostedPoolId = await boostedPool.getPoolId();

  const linearPoolAddress = await boostedPoolHelper.findLinearPool(
    BOOSTED_POOL_ADDRESS,
    tokenIn
  );

  const linearPool = new ethers.Contract(
    linearPoolAddress,
    linearPoolAbi,
    signer
  );
  const linearPoolId = await linearPool.getPoolId();

  const tx = await vault.batchSwap(
    0,
    [
      {
        poolId: linearPoolId,
        assetInIndex: 2,
        assetOutIndex: 1,
        amount: amountIn,
        userData: "0x",
      },
      {
        poolId: boostedPoolId,
        assetInIndex: 1,
        assetOutIndex: 0,
        amount: 0,
        userData: "0x",
      },
    ],
    [
      //0
      boostedPool.address,
      //1
      linearPool.address,
      //2
      stable.address,
    ],
    {
      sender: BigWhale,
      fromInternalBalance: false,
      recipient: BigWhale,
      toInternalBalance: false,
    },
    ["-1", 0, amountIn],
    BigNumber.from("999999999999999999")
  );

  await tx.wait();
}

async function getBoostedPoolHelper() {
  const deployment = await deployments.get("BoostedPoolHelper");
  return new ethers.Contract(
    deployment.address,
    deployment.abi,
    hre.ethers.provider
  );
}

const linearPoolAbi = [
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function getBptIndex() view returns (uint256)",
  "function getMainIndex() view returns (uint256)",
  "function getMainToken() view returns (address)",
  "function getOwner() view returns (address)",
  "function getPoolId() view returns (bytes32)",
  "function getRate() view returns (uint256)",
  "function getScalingFactors() view returns (uint256[])",
  "function getSwapFeePercentage() view returns (uint256)",
  "function getTargets() view returns (uint256 lowerTarget, uint256 upperTarget)",
  "function getVault() view returns (address)",
  "function getVirtualSupply() view returns (uint256)",
  "function getWrappedIndex() view returns (uint256)",
  "function getWrappedToken() view returns (address)",
  "function getWrappedTokenRate() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function transfer(address recipient, uint256 amount) returns (bool)",
  "function transferFrom(address sender, address recipient, uint256 amount) returns (bool)",
];
