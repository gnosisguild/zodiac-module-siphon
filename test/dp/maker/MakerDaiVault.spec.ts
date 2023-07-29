import hre from "hardhat";
import { fork, forkReset } from "../../setup";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { parseUnits } from "ethers/lib/utils";

describe("MakerDaiVaultAdapter", async () => {
  before(async () => {
    await fork(17741542);
  });

  after(async () => {
    await forkReset();
  });

  async function setup() {
    const [signer] = await hre.ethers.getSigners();
    // const safe = await highjack(GNO_SAFE, signer.address);

    const Adapter = await hre.ethers.getContractFactory("MakerDaiVaultAdapter");

    const adapter = await Adapter.deploy(
      "0xD758500ddEc05172aaA035911387C8E0e789CF6a",
      "0x0DA0C3e52C977Ed3cBc641fF02DD271c3ED55aFe",
      parseUnits("5.8617", 18),
      parseUnits("5.3821", 18),
      27353
    );

    return { adapter };
  }

  it("does not need rebalancing when above ratioTrigger");

  it("gets payment instructions to bring ratio back to ratioTarget");

  it("depositing more than requested brings ratio above ratioTarget");

  it("depositing less than requested brings ratio bellow ratioTarget");
});
