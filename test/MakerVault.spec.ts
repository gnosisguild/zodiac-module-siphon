import { expect } from "chai";
import { BigNumber } from "ethers";
import { AbiCoder, getAddress } from "ethers/lib/utils";
import hre, { deployments, waffle } from "hardhat";

const AddressZero = "0x0000000000000000000000000000000000000000";

describe("DP: Maker", async () => {
  const [user, anotherUser] = waffle.provider.getWallets();

  const baseSetup = deployments.createFixture(async () => {
    await deployments.fixture();
    const CDPManager = await hre.ethers.getContractFactory("MockCDPManager");
    const cdpManager = await CDPManager.deploy();
    const VAT = await hre.ethers.getContractFactory("MockVat");
    const vat = await VAT.deploy();
    const Spot = await hre.ethers.getContractFactory("MockSpot");
    const spot = await Spot.deploy();
    const Adapter = await hre.ethers.getContractFactory("MakerVaultAdapter");
    const urn = 123;
    const adapter = await Adapter.deploy(
      user.address, // owner
      AddressZero, // collateral asset
      AddressZero, // debt asset
      cdpManager.address,
      spot.address,
      3000000000000000000000000000n, // ratio target
      2994000000000000000000000000n, // ratio trigger
      urn
    );

    return {
      adapter,
      cdpManager,
      spot,
      urn,
      vat,
    };
  });

  it("Returns Correct Ratio", async () => {
    const { adapter } = await baseSetup();
    const ratio = await adapter.ratio();
    const expectedRatio = BigNumber.from(2993008736889531044339425710n);
    expect(ratio).to.equal(expectedRatio);
  });
});
