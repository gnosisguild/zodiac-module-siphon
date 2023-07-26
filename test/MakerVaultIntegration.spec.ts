import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import hre from "hardhat";

import { SafeMock__factory } from "../typechain-types";

import { fork, forkReset } from "./lp/setup";
import { execPopulatedTransaction, highjack } from "./safe";
import { formatUnits } from "ethers/lib/utils";

const GNO_SAFE = "0x849d52316331967b6ff1198e5e32a0eb168d039d";

describe.skip("MakerVault", async () => {
  before(async () => {
    await fork(17773156);
  });

  after(async () => {
    await forkReset();
  });

  async function setup() {
    const [signer] = await hre.ethers.getSigners();
    const safe = await highjack(GNO_SAFE, signer.address);

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

    return { debtAdapter };
  }

  it("siphons funds from liquidity position to debt position", async () => {
    const { debtAdapter } = await loadFixture(setup);

    // console.log(formatUnits(deltaBefore, 18));
    // console.log(formatUnits(await debtAdapter.ratio(), 27));
    console.log(formatUnits(await debtAdapter.ratio(), 27));
    console.log(formatUnits(await debtAdapter._ratio_old(), 27));

    console.log(formatUnits(await debtAdapter.delta(), 18));
    console.log(formatUnits(await debtAdapter._delta_old(), 18));
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
