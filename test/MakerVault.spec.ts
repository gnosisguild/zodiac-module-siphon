import { expect } from "chai";
import { BigNumber } from "ethers";
import { AbiCoder, getAddress } from "ethers/lib/utils";
import hre, { deployments, waffle } from "hardhat";

const AddressZero = "0x0000000000000000000000000000000000000000";

describe("MakerVault", async () => {
  //   const [user, anotherUser] = waffle.provider.getWallets();

  // const baseSetup = deployments.createFixture(async () => {
  //   await deployments.fixture();
  //   const CDPManagger = await hre.ethers.getContractFactory("ICDPManagger");
  //   const cdpManager = await CDPManagger.deploy();

  //   return {
  //     cdpManager,
  //   };
  // });

  it("Fetches variables", async () => {
    //   const { cdpManager } = await baseSetup();

    const cdpManager = await hre.ethers.getContractAt(
      "ICDPManager",
      "0xdcBf58c9640A7bd0e062f8092d70fb981Bb52032"
    );
    const vatAddress = await cdpManager.vat();
    const vat = await hre.ethers.getContractAt("IVat", vatAddress);
    const spotter = await hre.ethers.getContractAt(
      "ISpotter",
      "0xACe2A9106ec175bd56ec05C9E38FE1FDa8a1d758"
    );
    const urn = 210;
    const urnHandler = await cdpManager.urns(urn);
    const ilk = await cdpManager.ilks(urn);
    const [ink, art] = await vat.urns(ilk, urnHandler);
    const [, rate, spot, ,] = vat.ilks(ilk);
    // const [, mat] = spotter.ilks(ilk);
    // const debt = (ink * spot * mat) / (art * rate);

    expect(true).to.equals(true);
    console.log("      urn: ", urn);
    console.log("      urnHandler: ", urnHandler);
    console.log("      ilk: ", ilk);
    console.log("      ink: ", ink.toString());
    console.log("      art: ", art.toString());
    console.log("rate: ", rate);
    console.log("spot: ", spot);
    // console.log("mat: ", mat);
    // console.log("debt: ", debt);
  });
});
