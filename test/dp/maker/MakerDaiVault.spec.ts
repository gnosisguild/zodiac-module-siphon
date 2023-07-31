import hre from "hardhat";
import { fork, forkReset, getTokens, takeoverERC20 } from "../../setup";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { parseUnits } from "ethers/lib/utils";
import { expect } from "chai";
import { execTransaction, takeover } from "../../safe";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { TransactionStructOutput } from "../../../typechain-types/contracts/IDebtPosition";

const GNO_SAFE = "0x849d52316331967b6ff1198e5e32a0eb168d039d";

describe.only("MakerDaiVaultAdapter", async () => {
  before(async () => {
    await fork(17741542);
  });

  after(async () => {
    await forkReset();
  });

  async function setup() {
    const [signer] = await hre.ethers.getSigners();

    const { dai } = getTokens(signer);

    const daiWhale = "0x075e72a5eDf65F0A5f44699c7654C1a76941Ddc8";

    await takeover(GNO_SAFE, signer.address);
    await takeoverERC20(daiWhale, GNO_SAFE, dai.address);

    const Adapter = await hre.ethers.getContractFactory("MakerDaiVaultAdapter");
    const adapter = await Adapter.deploy(
      "0xD758500ddEc05172aaA035911387C8E0e789CF6a",
      signer.address,
      parseUnits("5.8617", 18),
      parseUnits("5.3821", 18),
      27353
    );

    return { adapter };
  }

  it("does not need rebalancing when above ratioTrigger", async () => {
    const { adapter } = await loadFixture(setup);
    const [signer] = await hre.ethers.getSigners();

    const ratio = await adapter.ratio();
    expect(ratio).to.equal(parseUnits("5.328899614283675826", 18));

    await adapter.connect(signer).setRatioTrigger(parseUnits("5", 18));
    await adapter.connect(signer).setRatioTarget(parseUnits("6", 18));

    expect(await adapter.needsRebalancing()).to.be.false;

    await adapter.setRatioTrigger(parseUnits("5.5", 18));

    expect(await adapter.needsRebalancing()).to.be.true;
  });

  it("depositing requested amount brings ratio to exactly target", async () => {
    const { adapter } = await loadFixture(setup);
    const [signer] = await hre.ethers.getSigners();

    expect(await adapter.ratio()).to.be.lessThan(await adapter.ratioTrigger());

    const delta = await adapter.delta();

    await executeInstructions(
      GNO_SAFE,
      await adapter.paymentInstructions(delta),
      signer
    );

    expect(await adapter.ratio()).to.equal(await adapter.ratioTarget());

    expect(await adapter.needsRebalancing()).to.be.false;
  });

  it("depositing more than requested brings ratio above ratioTarget", async () => {
    const { adapter } = await loadFixture(setup);
    const [signer] = await hre.ethers.getSigners();

    expect(await adapter.ratio()).to.be.lessThan(await adapter.ratioTrigger());

    const delta = await adapter.delta();

    await executeInstructions(
      GNO_SAFE,
      await adapter.paymentInstructions(delta.mul(1000).div(999)),
      signer
    );

    expect(await adapter.ratio()).to.be.greaterThan(
      await adapter.ratioTarget()
    );

    expect(await adapter.needsRebalancing()).to.be.false;
  });

  it("depositing less than requested brings ratio bellow ratioTarget", async () => {
    const { adapter } = await loadFixture(setup);
    const [signer] = await hre.ethers.getSigners();

    expect(await adapter.ratio()).to.be.lessThan(await adapter.ratioTrigger());

    const delta = await adapter.delta();

    await executeInstructions(
      GNO_SAFE,
      await adapter.paymentInstructions(delta.mul(999).div(1000)),
      signer
    );

    expect(await adapter.ratio()).to.be.lessThan(await adapter.ratioTarget());
  });
});

async function executeInstructions(
  safeAddress: string,
  instructions: TransactionStructOutput[],
  signer: SignerWithAddress
) {
  for (let i = 0; i < instructions.length; i++) {
    const receipt = await execTransaction(safeAddress, instructions[i], signer);
    await receipt.wait();
  }
}
