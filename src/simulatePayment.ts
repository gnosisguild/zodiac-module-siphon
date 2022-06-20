import { BigNumber } from "ethers";
import hre from "hardhat";

const wad = BigNumber.from(10).pow(BigNumber.from(18));
const ray = BigNumber.from(10).pow(BigNumber.from(27));

const simulatePayment = async (): Promise<void> => {
  // steal some Dai from a whale and send it to our safe.
  const { getNamedAccounts } = hre;
  const { daiWhale, gnosisDAO } = await getNamedAccounts();
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [daiWhale],
  });
  const whale = await hre.ethers.provider.getSigner(daiWhale);
  const dai = await hre.ethers.getContractAt(
    "TestToken",
    "0x6b175474e89094c44da98b954eedeac495271d0f"
  );
  const safe = await hre.ethers.getContractAt(
    "TestAvatar",
    "0x849d52316331967b6ff1198e5e32a0eb168d039d"
  );
  const whaleBalance = await dai.balanceOf(daiWhale);
  await dai.connect(whale).transfer(safe.address, whaleBalance);

  // instantiate all of the Maker jazz
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

  console.log("Vault ", urn);
  console.log("-----------");
  console.log("current debt: ", debt.toString());
  console.log("current ratio: ", ratio.toString());
  console.log("\n");

  // deploy adapter
  const Adapter = await hre.ethers.getContractFactory("MakerVaultAdapter");
  const adapter = await Adapter.deploy(
    dai.address, // assetDebt
    cdpManager.address, // cdpManager
    "0x9759A6Ac90977b93B58547b4A71c78317f391A28", // daiJoin
    "0xD758500ddEc05172aaA035911387C8E0e789CF6a", // dsProxy
    "0x82ecd135dce65fbc6dbdd0e4237e0af93ffd5038", // dsProxyActions
    spotter.address, // spotter
    3000000000000000000000000000n, // ratio target
    2994000000000000000000000000n, // ratio trigger
    urn // vault
  );

  const [to, value, data] = await adapter.paymentInstructions(debt);

  console.log(
    "Payment Instructions\n--------------------",
    "to: ",
    to,
    "\nvalue: ",
    value.toString(),
    "\nfrom: ",
    data,
    "\n"
  );

  // impersonate the GnosisDAO
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [gnosisDAO],
  });
  const dao = await hre.ethers.provider.getSigner(gnosisDAO);

  console.log(
    "safe balance before: ",
    (await dai.balanceOf(safe.address)).toString()
  );

  await safe
    .connect(dao)
    .execTransactionFromModule(to, value.toString(), data, 0);

  console.log(
    "safe balance after: ",
    (await dai.balanceOf(safe.address)).toString()
  );

  return;
};

simulatePayment();

export default simulatePayment;
