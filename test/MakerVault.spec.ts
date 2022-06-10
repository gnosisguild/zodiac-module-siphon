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

    const wad = BigNumber.from(10).pow(BigNumber.from(18));
    const ray = BigNumber.from(10).pow(BigNumber.from(27));
    const rad = BigNumber.from(10).pow(BigNumber.from(45));

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
    const [ink, art] = await vat.urns(ilk, urnHandler); // wad
    const [, rate, spot, ,] = await vat.ilks(ilk); // ray
    const [, mat] = await spotter.ilks(ilk); // ray
    const debt = art.mul(rate).div(ray); // wad
    const ratio = ink.mul(spot).mul(mat).div(debt).div(ray); // ray

    expect(true).to.equals(true);
    console.log("             urn: ", urn);
    console.log("      urnHandler: ", urnHandler);
    console.log("             ilk: ", ilk);
    console.log("       ink (wad): ", ink.toString());
    console.log("       art (wad): ", art.toString());
    console.log("      rate (ray): ", rate.toString());
    console.log("      spot (ray): ", spot.toString());
    console.log("       mat (ray): ", mat.toString());
    console.log("      debt (wad): ", debt.toString());
    console.log(
      "                  ",
      debt.div(wad).toNumber().toLocaleString(),
      "Dai"
    );
    console.log("     ratio (ray): ", ratio.toString());
    console.log(
      "                  ",
      (ratio.div(BigNumber.from(10).pow(23)).toNumber() / 100).toLocaleString(),
      "%"
    );
  });
});

// 47311694654521537764997645644504461692765400033933028
// 1213120375756962506794811426782165684429882052152128
