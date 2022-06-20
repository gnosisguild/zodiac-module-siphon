import "@nomiclabs/hardhat-ethers";
import { BigNumber } from "ethers";
import hre from "hardhat";
const simulatePayment = async (): Promise<void> => {
  // send some DAI to the safe
  const { getNamedAccounts } = hre;
  const { daiWhale } = await getNamedAccounts();
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [daiWhale],
  });
  const signer = await ethers.getSigner(daiWhale);
  console.log("Signer: ", signer.address);

  const dai = await hre.ethers.getContractAt(
    "TestToken",
    "0x6b175474e89094c44da98b954eedeac495271d0f"
  );
  const safe = await hre.ethers.getContractAt(
    "TestAvatar",
    "0x849d52316331967b6ff1198e5e32a0eb168d039d"
  );
  let whaleBalance = await dai.balanceOf(daiWhale);
  console.log("whale Balance: ", whaleBalance.toString());
  let safeBalance = await dai.balanceOf(safe.address);
  console.log("Safe Balance: ", safeBalance.toString());
  console.log("transferring to safe...");
  await dai.connect(signer).transfer(safe.address, 100);
  whaleBalance = await dai.balanceOf(daiWhale);
  console.log("whale Balance: ", whaleBalance.toString());
  safeBalance = await dai.balanceOf(safe.address);
  console.log("Safe Balance: ", safeBalance.toString());

  const wad = BigNumber.from(10).pow(BigNumber.from(18));
  const ray = BigNumber.from(10).pow(BigNumber.from(27));
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
  const [, rate, spot, , dust] = await vat.ilks(ilk); // ray
  const [pip, mat] = await spotter.ilks(ilk); // ray
  const debt = art.mul(rate).div(ray); // wad
  const ratio = ink.mul(spot).div(ray).mul(mat).div(art.mul(rate).div(ray)); // ray

  return;
};

simulatePayment();

export default simulatePayment;
