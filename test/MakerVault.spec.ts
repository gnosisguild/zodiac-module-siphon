import { expect } from "chai";
import { BigNumber } from "ethers";
import { AbiCoder, getAddress } from "ethers/lib/utils";
import hre, { deployments, waffle } from "hardhat";

const AddressZero = "0x0000000000000000000000000000000000000000";

describe("MakerVault", async () => {
  //   const [user, anotherUser] = waffle.provider.getWallets();

  // const baseSetup = deployments.createFixture(async () => {
  //   await deployments.fixture();
  //   const CDPManager = await hre.ethers.getContractFactory("ICDPManager");
  //   const cdpManager = await CDPManager.deploy();

  //   return {
  //     cdpManager,
  //   };
  // });

  it("Fetches variables", async () => {
    //   const { cdpManager } = await baseSetup();

    const cdpManager = await hre.ethers.getContractAt(
      "ICDPManager",
      "0x5ef30b9986345249bc32d8928B7ee64DE9435E39"
    );
    const vatAddress = await cdpManager.vat();
    const vat = await hre.ethers.getContractAt("IVat", vatAddress);
    const spotter = await hre.ethers.getContractAt(
      "ISpotter",
      "0x65C79fcB50Ca1594B025960e539eD7A9a6D434A3"
    );
    const urn = 27353;
    const urnHandler = await cdpManager.urns(urn);
    const ilk = await cdpManager.ilks(urn);
    const [ink, art] = await vat.urns(ilk, urnHandler); // returns wad
    const [, rate, spot, ,] = await vat.ilks(ilk); // returns ray
    const [, mat] = await spotter.ilks(ilk); // raturns ray
    const debt = art.mul(rate);
    const ratio = ink.mul(spot).mul(mat).div(debt);

    expect(true).to.equals(true);
    console.log("      urn: ", urn);
    console.log("      urnHandler: ", urnHandler);
    console.log("      ilk: ", ilk);
    console.log("      ink: ", ink.toString());
    console.log("      art: ", art.toString());
    console.log("      rate: ", rate.toString());
    console.log("      spot: ", spot.toString());
    console.log("      mat: ", mat.toString());
    console.log("      debt: ", debt.div(10 ^ 9).toString());
    console.log("      ratio: ", ratio.toString());
  });
});
