import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import hre from "hardhat";

import { SafeMock__factory } from "../typechain-types";

import { fork, forkReset } from "./lp/setup";
import { execPopulatedTransaction, takeover } from "./safe";
import { parseUnits } from "ethers/lib/utils";
import {
  CONVEX_REWARDS,
  CURVE_POOL_DEPOSIT,
} from "./lp/curve-lending-pool/pool";

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
    const safe = await takeover(GNO_SAFE, signer.address);

    const LiquidityAdapter = await hre.ethers.getContractFactory(
      "ConvexCompoundAdapter"
    );
    const liquidityAdapter = await LiquidityAdapter.deploy(
      CURVE_POOL_DEPOSIT,
      CONVEX_REWARDS,
      0,
      1,
      GNO_SAFE,
      parseUnits("0.99", 18)
    );

    const DebtAdapter = await hre.ethers.getContractFactory(
      "MakerDaiVaultAdapter"
    );
    const debtAdapter = await DebtAdapter.deploy(
      "0xD758500ddEc05172aaA035911387C8E0e789CF6a",
      "0x0DA0C3e52C977Ed3cBc641fF02DD271c3ED55aFe",
      parseUnits("5.8617", 18),
      parseUnits("5.3821", 18),
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

  it("does nothing when debt position does not need rebalancing");

  it("does nothing when liquidity position does not have any funds");

  it("blocks the withdrawal when price starts too low");

  it(
    "blocks the withdrawal when price starts ok, but withdrawal makes it too low"
  );
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
