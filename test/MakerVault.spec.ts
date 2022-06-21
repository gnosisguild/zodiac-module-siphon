import { expect } from "chai";
import { BigNumber } from "ethers";
import hre, { deployments, waffle } from "hardhat";

const AddressZero = "0x0000000000000000000000000000000000000000";
const ray = BigNumber.from(10).pow(BigNumber.from(27));

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
      4586919454964052515806212538n, // ratio target
      4211626045012448219058431512n, // ratio trigger
      urn // vault
    );

    return {
      adapter,
      cdpManager,
      dai,
      dsProxy,
      spotter,
      urn,
      vat,
    };
  });

  it("Returns Correct Ratio", async () => {
    const { adapter } = await baseSetup();
    const ratio = await adapter.ratio();
    const expectedRatio = BigNumber.from(4169926777240047741642011399n);
    expect(ratio).to.equal(expectedRatio);
  });

  it("Returns Correct Delta", async () => {
    const { adapter } = await baseSetup();
    const delta = await adapter.delta();
    const expectedDelta = BigNumber.from(2479023057692998402742223n);
    expect(delta).to.equal(expectedDelta);
  });

  it("Correctly encodes payment instructions", async () => {
    const { adapter, dsProxy, dai } = await baseSetup();
    const [allow, transfer] = await adapter.paymentInstructions(
      2479023057692998402742223n
    );
    const expectedAllow = {
      to: dai.address,
      value: 0,
      data: "0x095ea7b3000000000000000000000000959922be3caee4b8cd9a407cc3ac1c251c2007b1000000000000000000000000000000000000000000020cf41bf720b4cd2e97cf",
      operation: 0,
    };
    const expectedTransfer = {
      to: dsProxy.address,
      value: 0,
      data: "0x1cff79cd0000000000000000000000009a9f2ccfde556a7e9ff0848998aa4a0cfd8863ae000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000844b666199000000000000000000000000b7f8bc63bbcad18155201308c8f3540b07f84f5e0000000000000000000000009a676e781a523b5d0c0e43731313a708cb607508000000000000000000000000000000000000000000000000000000000000007b000000000000000000000000000000000000000000020cf41bf720b4cd2e97cf00000000000000000000000000000000000000000000000000000000",
      operation: 0,
    };
    expect(allow[0]).to.equal(expectedAllow.to);
    expect(allow[1]).to.equal(expectedAllow.value);
    expect(allow[2]).to.equal(expectedAllow.data);
    expect(allow[3]).to.equal(expectedAllow.operation);
    expect(transfer[2]).to.equal(expectedTransfer.data);
    expect(transfer[1]).to.equal(expectedTransfer.value);
    expect(transfer[2]).to.equal(expectedTransfer.data);
    expect(transfer[3]).to.equal(expectedTransfer.operation);
  });
});
