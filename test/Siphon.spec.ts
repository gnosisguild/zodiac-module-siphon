import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import hre from "hardhat";

import { SafeMock__factory } from "../typechain-types";

import { fork, forkReset } from "./lp/setup";
import { execPopulatedTransaction, highjack } from "./safe";
import { parseUnits } from "ethers/lib/utils";

const GNO_SAFE = "0x849d52316331967b6ff1198e5e32a0eb168d039d";

describe("Siphon", async () => {
  before(async () => {
    await fork(17741542);
  });

  after(async () => {
    await forkReset();
  });

  async function setup() {
    const [signer] = await hre.ethers.getSigners();
    const safe = await highjack(GNO_SAFE, signer.address);

    const LiquidityAdapter = await hre.ethers.getContractFactory(
      "ConvexCompoundAdapter"
    );
    const liquidityAdapter = await LiquidityAdapter.deploy(
      GNO_SAFE,
      parseUnits("0.99", 18)
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
      BigNumber.from("5861789575712043409055978289"),
      BigNumber.from("5382188610426512584678670975"),
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

    return { siphon, debtAdapter, liquidityAdapter };
  }

  it("siphons funds from liquidity position to debt position", async () => {
    const { debtAdapter, liquidityAdapter, siphon } = await loadFixture(setup);

    const deltaBefore = await debtAdapter.delta();
    const ratioBefore = await debtAdapter.ratio();
    const balanceBefore = await liquidityAdapter.balance();

    await siphon.siphon("compound-tube");

    const deltaAfter = await debtAdapter.delta();
    const ratioAfter = await debtAdapter.ratio();
    const balanceAfter = await liquidityAdapter.balance();

    expect(deltaBefore.gt(deltaAfter)).to.be.true;
    expect(ratioBefore.lt(ratioAfter)).to.be.true;
    expect(balanceBefore.gt(balanceAfter)).to.be.true;
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
