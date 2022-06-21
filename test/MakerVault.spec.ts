import { expect } from "chai";
import { BigNumber } from "ethers";
import hre, { deployments, waffle } from "hardhat";

const AddressZero = "0x0000000000000000000000000000000000000000";

describe("DP: Maker", async () => {
  const baseSetup = deployments.createFixture(async () => {
    await deployments.fixture();
    const urn = 123;
    const VAT = await hre.ethers.getContractFactory("MockVat");
    const vat = await VAT.deploy();
    const CDPManager = await hre.ethers.getContractFactory("MockCDPManager");
    const cdpManager = await CDPManager.deploy(vat.address);
    const Spotter = await hre.ethers.getContractFactory("MockSpot");
    const spotter = await Spotter.deploy();
    const Dai = await hre.ethers.getContractFactory("TestToken");
    const dai = await Dai.deploy(18);
    const DaiJoin = await hre.ethers.getContractFactory("DaiJoin");
    const daiJoin = await DaiJoin.deploy(vat.address, dai.address);
    const Avatar = await hre.ethers.getContractFactory("TestAvatar");
    const avatar = await Avatar.deploy();
    const DSProxy = await hre.ethers.getContractFactory("DSProxy");
    const dsProxy = await DSProxy.deploy(avatar.address);
    const DsProxyActions = await hre.ethers.getContractFactory(
      "DssProxyActions"
    );
    const dsProxyActions = await DsProxyActions.deploy();
    const Adapter = await hre.ethers.getContractFactory("MakerVaultAdapter");
    const adapter = await Adapter.deploy(
      dai.address, // assetDebt
      cdpManager.address, // cdpManager
      daiJoin.address, // daiJoin
      dsProxy.address, // dsProxy
      dsProxyActions.address, // dsProxyActions
      spotter.address, // spotter
      3000000000000000000000000000n, // ratio target
      2994000000000000000000000000n, // ratio trigger
      urn // vault
    );

    await adapter.setAssetDebt(AddressZero);

    return {
      adapter,
      cdpManager,
      dsProxy,
      spotter,
      urn,
      vat,
    };
  });

  it("Returns Correct Ratio", async () => {
    const { adapter } = await baseSetup();
    const ratio = await adapter.ratio();
    const expectedRatio = BigNumber.from(3235057286664591397522280128n);
    expect(ratio).to.equal(expectedRatio);
  });

  it("Returns Correct Delta", async () => {
    const { adapter } = await baseSetup();
    const delta = await adapter.delta();
    const expectedDelta = BigNumber.from(850381492464913306532836n);
    console.log(delta.toString());
    expect(delta).to.equal(expectedDelta);
  });

  it("Correctly encodes payment instructions", async () => {
    const { adapter, dsProxy } = await baseSetup();
    const instructions = await adapter.paymentInstructions(
      850381492464913306532836n
    );
    console.log(dsProxy.address);
    console.log(instructions);
    const expectedData =
      "0x1cff79cd0000000000000000000000008a791620dd6260079bf849dc5567adc3f2fdc318000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000844b666199000000000000000000000000cf7ed3acca5a467e9e704c703e8d87f634fb0fc90000000000000000000000000165878a594ca255338adfa4d48449f69242eb8f000000000000000000000000000000000000000000000000000000000000007b00000000000000000000000000000000000000000000b41345e87a980d0ebbe400000000000000000000000000000000000000000000000000000000";
    expect(instructions.data).to.equal(expectedData);
  });
});
