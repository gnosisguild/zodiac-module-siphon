import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumberish } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import hre from "hardhat";

import { fork, forkReset } from "../setup";
import {
  CToken__factory,
  ERC20__factory,
  SafeMock__factory,
} from "../../../typechain-types";

type ExecTransactionParams = {
  to: string;
  data: string;
  value: BigNumberish;
  operation: BigNumberish;
};

const AddressZero = "0x0000000000000000000000000000000000000000";
const AddressTwo = "0x0000000000000000000000000000000000000002";

const CDAI = "0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643";
const CUSDC = "0x39AA39c021dfbaE8faC545936693aC917d5E7563";

const GNOSIS_DAO = "0x849d52316331967b6ff1198e5e32a0eb168d039d";

const CURVE_POOL_LP = "0x845838DF265Dcd2c412A1Dc9e959c7d08537f8a2";
const CONVEX_REWARDS_POOL = "0xf34DFF761145FF0B05e917811d488B441F33a968";

describe("LendingPoolAdapter", async () => {
  before(async () => {
    await fork(17741542);
  });

  after(async () => {
    await forkReset();
  });

  async function setup() {
    const { dai, usdc } = await getCTokens();

    await highjackSafe(GNOSIS_DAO);
    // await executeLeaveStake(GNOSIS_DAO);
    await executeFlushERC20(GNOSIS_DAO, dai.address);
    await executeFlushERC20(GNOSIS_DAO, usdc.address);

    const Adapter = await hre.ethers.getContractFactory("CurveCompoundAdapter");
    const adapter = await Adapter.deploy(GNOSIS_DAO);

    console.log(`getLiquidLptAmount: ${await adapter.getLiquidLptAmount()}`);
    console.log(`effectiveLptBalance: ${await adapter.effectiveLptBalance()}`);
    console.log(`balance: ${await adapter.balance()}`);

    return adapter;
  }

  it("balances", async () => {
    const [signer] = await hre.ethers.getSigners();
    const adapter = await loadFixture(setup);
    const { dai, usdc, cdai, cusdc } = await getCTokens();

    const [bal1, bal2] = await adapter.lptBalances();

    console.log(`Unstaked   balance: ${bal1}`);
    console.log(`Staked balance: ${bal2}`);
  });

  it("remove liquidity", async () => {
    const [signer] = await hre.ethers.getSigners();
    const adapter = await loadFixture(setup);
    const { dai, usdc, cdai, cusdc } = await getCTokens();

    const lpToken = ERC20__factory.connect(CURVE_POOL_LP, hre.ethers.provider);
    const rewards = ERC20__factory.connect(
      CONVEX_REWARDS_POOL,
      hre.ethers.provider
    );

    const amount = parseUnits("4000", 18);

    console.log(`DAI       balance: ${await dai.balanceOf(GNOSIS_DAO)}`);
    console.log(`USDC      balance: ${await usdc.balanceOf(GNOSIS_DAO)}`);
    console.log(`Unstaked  balance: ${await lpToken.balanceOf(GNOSIS_DAO)}`);
    console.log(`Staked    balance: ${await rewards.balanceOf(GNOSIS_DAO)}`);

    const instructions = await adapter.withdrawalInstructions(amount);

    for (let i = 0; i < instructions.length; i++) {
      const { to, value, data, operation } = instructions[i];
      const receipt = await execute(
        GNOSIS_DAO,
        { to, value, data, operation },
        signer
      );
      await receipt.wait();
    }

    console.log(`DAI       balance: ${await dai.balanceOf(GNOSIS_DAO)}`);
    console.log(`USDC      balance: ${await usdc.balanceOf(GNOSIS_DAO)}`);
    console.log(`Unstaked  balance: ${await lpToken.balanceOf(GNOSIS_DAO)}`);
    console.log(`Staked    balance: ${await rewards.balanceOf(GNOSIS_DAO)}`);
  });
});

async function getCTokens() {
  const [signer] = await hre.ethers.getSigners();
  const cusdc = CToken__factory.connect(CUSDC, signer);
  const cdai = CToken__factory.connect(CDAI, signer);

  const usdc = ERC20__factory.connect(await cusdc.underlying(), signer);
  const dai = ERC20__factory.connect(await cdai.underlying(), signer);

  return { cusdc, cdai, usdc, dai };
}

async function highjackSafe(safeAddress: string) {
  const [signer] = await hre.ethers.getSigners();
  const newOwner = signer.address;
  const safe = SafeMock__factory.connect(safeAddress, hre.ethers.provider);

  const { data } = await safe.populateTransaction.addOwnerWithThreshold(
    newOwner,
    1
  );

  const impersonator = await hre.ethers.getImpersonatedSigner(safeAddress);

  await impersonator.sendTransaction({
    to: safeAddress,
    from: safeAddress,
    data,
    value: 0,
  });
}

async function executeFlushERC20(safeAddress: string, token: string) {
  const [signer] = await hre.ethers.getSigners();
  const erc20 = ERC20__factory.connect(token, hre.ethers.provider);

  const tx = await erc20.populateTransaction.transfer(
    AddressTwo,
    await erc20.balanceOf(safeAddress)
  );

  await execute(
    safeAddress,
    {
      to: tx.to as string,
      value: tx.value || 0,
      data: tx.data as string,
      operation: 0,
    },
    signer
  );
}

async function execute(
  safeAddress: string,
  { to, value, data, operation }: ExecTransactionParams,
  signer: SignerWithAddress
) {
  const safe = SafeMock__factory.connect(safeAddress, signer);

  const signature = await sign(
    safeAddress,
    { to, value, data, operation },
    await safe.nonce(),
    signer
  );

  const tx = await safe.populateTransaction.execTransaction(
    to as string,
    value || 0,
    data as string,
    operation,
    0,
    0,
    0,
    AddressZero,
    AddressZero,
    signature
  );

  return signer.sendTransaction(tx);
}

export function sign(
  safeAddress: string,
  { to, value, data, operation }: ExecTransactionParams,
  nonce: BigNumberish,
  signer: SignerWithAddress
): Promise<string> {
  const domain = {
    verifyingContract: safeAddress,
    chainId: 31337,
  };
  const types = {
    SafeTx: [
      { type: "address", name: "to" },
      { type: "uint256", name: "value" },
      { type: "bytes", name: "data" },
      { type: "uint8", name: "operation" },
      { type: "uint256", name: "safeTxGas" },
      { type: "uint256", name: "baseGas" },
      { type: "uint256", name: "gasPrice" },
      { type: "address", name: "gasToken" },
      { type: "address", name: "refundReceiver" },
      { type: "uint256", name: "nonce" },
    ],
  };
  const message = {
    to,
    value,
    data,
    operation,
    safeTxGas: 0,
    baseGas: 0,
    gasPrice: 0,
    gasToken: AddressZero,
    refundReceiver: AddressZero,
    nonce: nonce,
  };

  return signer._signTypedData(domain, types, message);
}
