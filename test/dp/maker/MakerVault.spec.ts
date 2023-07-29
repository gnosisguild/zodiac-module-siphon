import { expect } from "chai";
import { BigNumber } from "ethers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import hre from "hardhat";

const AddressOne = "0x0000000000000000000000000000000000000001";
const ratioTarget = 4586919454964052515806212538n;
const ratioTrigger = 4211626045012448219058431512n;
const expectedRatio = BigNumber.from(4169926777240047741642011327n);
const expectedDelta = BigNumber.from(2479023057692998402742223n);

describe("MakerVaultAdapter", async () => {
  async function baseSetup() {
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
    const [user] = await hre.ethers.getSigners();
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
      dai.address, // asset
      cdpManager.address, // cdpManager
      daiJoin.address, // daiJoin
      dsProxy.address, // dsProxy
      dsProxyActions.address, // dsProxyActions
      user.address,
      spotter.address, // spotter
      ratioTarget, // ratio target
      ratioTrigger, // ratio trigger
      urn // vault
    );

    return {
      adapter,
      cdpManager,
      dai,
      daiJoin,
      dsProxy,
      dsProxyActions,
      spotter,
      urn,
      vat,
      user,
    };
  }

  describe("constructor", async () => {
    it("sets variables correctly", async () => {
      const {
        adapter,
        dai,
        cdpManager,
        daiJoin,
        dsProxy,
        dsProxyActions,
        spotter,
        urn,
        user,
      } = await loadFixture(baseSetup);
      expect(await adapter.asset()).to.equal(dai.address);
      expect(await adapter.cdpManager()).to.equal(cdpManager.address);
      expect(await adapter.daiJoin()).to.equal(daiJoin.address);
      expect(await adapter.dsProxy()).to.equal(dsProxy.address);
      expect(await adapter.dsProxyActions()).to.equal(dsProxyActions.address);
      expect(await adapter.owner()).to.equal(user.address);
      expect(await adapter.spotter()).to.equal(spotter.address);
      expect(await adapter.ratioTarget()).to.equal(ratioTarget);
      expect(await adapter.ratioTrigger()).to.equal(ratioTrigger);
      expect(await adapter.vault()).to.equal(urn);
    });
  });

  describe("setRatioTarget()", async () => {
    it("Can only be called by owner", async () => {
      const { adapter } = await loadFixture(baseSetup);

      await adapter.transferOwnership(AddressOne);
      expect(adapter.setRatioTarget(42)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });
    it("Sets ratioTarget", async () => {
      const { adapter } = await loadFixture(baseSetup);
      await adapter.setRatioTarget(42);
      const ratioTarget = await adapter.ratioTarget();
      expect(ratioTarget).to.equal(42);
    });
  });

  describe("setRatioTrigger()", async () => {
    it("Can only be called by owner", async () => {
      const { adapter } = await loadFixture(baseSetup);

      await adapter.transferOwnership(AddressOne);
      expect(adapter.setRatioTrigger(42)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });
    it("Sets ratioTrigger", async () => {
      const { adapter } = await loadFixture(baseSetup);
      await adapter.setRatioTrigger(42);
      const ratioTrigger = await adapter.ratioTrigger();
      expect(ratioTrigger).to.equal(42);
    });
  });

  describe("ratio()", async () => {
    it("Returns Correct Ratio", async () => {
      const { adapter } = await loadFixture(baseSetup);
      const ratio = await adapter.ratio();
      expect(ratio).to.equal(expectedRatio);
    });
  });

  describe("delta()", async () => {
    it("Returns Correct Delta", async () => {
      const { adapter } = await loadFixture(baseSetup);
      const delta = await adapter.delta();
      expect(delta).to.equal(expectedDelta);
    });
  });

  describe("paymentInstructions()", async () => {
    it.skip("Correctly encodes payment instructions", async () => {
      const { adapter, dsProxy, dai } = await loadFixture(baseSetup);
      const [allow, transfer] = await adapter.paymentInstructions(
        expectedDelta
      );
      const expectedAllow = {
        to: dai.address,
        value: 0,
        data: "0x095ea7b30000000000000000000000009a9f2ccfde556a7e9ff0848998aa4a0cfd8863ae000000000000000000000000000000000000000000020cf41bf720b4cd2e97cf",
        operation: 0,
      };
      const expectedTransfer = {
        to: dsProxy.address,
        value: 0,
        data: "0x1cff79cd00000000000000000000000068b1d87f95878fe05b998f19b66f4baba5de1aed000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000844b666199000000000000000000000000a51c1fc2f0d1a1b8494ed1fe312d7c3a78ed91c00000000000000000000000000b306bf915c4d645ff596e518faf3f9669b97016000000000000000000000000000000000000000000000000000000000000007b000000000000000000000000000000000000000000020cf41bf720b4cd2e97cf00000000000000000000000000000000000000000000000000000000",
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
});
