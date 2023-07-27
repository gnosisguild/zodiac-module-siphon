import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import hre from "hardhat";

import { SafeMock__factory } from "../typechain-types";

import { fork, forkReset } from "./lp/setup";
import { execPopulatedTransaction, highjack } from "./safe";

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
    const liquidityAdapter = await LiquidityAdapter.deploy(GNO_SAFE);

    const DebtAdapter = await hre.ethers.getContractFactory(
      "MakerDaiVaultAdapter"
    );
    const debtAdapter = await DebtAdapter.deploy(
      "0xD758500ddEc05172aaA035911387C8E0e789CF6a",
      "0x0DA0C3e52C977Ed3cBc641fF02DD271c3ED55aFe",
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

// async function getCTokens() {
//   const CDAI = "0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643";
//   const CUSDC = "0x39AA39c021dfbaE8faC545936693aC917d5E7563";

//   const [signer] = await hre.ethers.getSigners();
//   const cusdc = CToken__factory.connect(CUSDC, signer);
//   const cdai = CToken__factory.connect(CDAI, signer);

//   const usdc = ERC20__factory.connect(await cusdc.underlying(), signer);
//   const dai = ERC20__factory.connect(await cdai.underlying(), signer);

//   return { cusdc, cdai, usdc, dai };
// }

async function enableModule(
  safeAddress: string,
  module: string,
  signer: SignerWithAddress
) {
  const safe = SafeMock__factory.connect(safeAddress, hre.ethers.provider);

  const tx = await safe.populateTransaction.enableModule(module);

  await execPopulatedTransaction(safeAddress, tx, signer);
}
