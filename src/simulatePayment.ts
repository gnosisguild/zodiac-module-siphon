import dotenv from "dotenv";
import { BigNumber } from "ethers";
import hre from "hardhat";

const ray = BigNumber.from(10).pow(BigNumber.from(27));

const simulatePayment = async (): Promise<void> => {
  // Load environment variables.
  dotenv.config();
  const { ALCHEMY_KEY } = process.env;
  // fork mainnet
  await hre.network.provider.request({
    method: "hardhat_reset",
    params: [
      {
        forking: {
          jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_KEY}`,
          blockNumber: 15000000,
        },
      },
    ],
  });

  const daiWhale = "0xc08a8a9f809107c5a7be6d90e315e4012c99f39a";
  const gnosisDAO = "0x0DA0C3e52C977Ed3cBc641fF02DD271c3ED55aFe";

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
  const tx = {
    to: gnosisDAO,
    value: hre.ethers.utils.parseEther("10"),
  };
  await whale.sendTransaction(tx);

  // instantiate all of the Maker jazz
  const urn = 27353;
  const cdpManager = await hre.ethers.getContractAt(
    "ICDPManager",
    "0x5ef30b9986345249bc32d8928B7ee64DE9435E39"
  );
  const spotter = await hre.ethers.getContractAt(
    "ISpotter",
    "0x65C79fcB50Ca1594B025960e539eD7A9a6D434A3"
  );
  const vatAddress = await cdpManager.vat();
  const vat = await hre.ethers.getContractAt("IVat", vatAddress);
  const urnHandler = await cdpManager.urns(urn);
  let ilk = await cdpManager.ilks(urn);
  let [ink, art] = await vat.urns(ilk, urnHandler); // wad
  let [, rate, spot, ,] = await vat.ilks(ilk); // ray
  let [, mat] = await spotter.ilks(ilk); // ray
  const debt = art.mul(rate).div(ray); // wad
  const ratio = ink.mul(spot).div(ray).mul(mat).div(art.mul(rate).div(ray)); // ray

  // deploy adapter
  const proxy = "0xD758500ddEc05172aaA035911387C8E0e789CF6a";
  const Adapter = await hre.ethers.getContractFactory("MakerVaultAdapter");
  const targetRatio = ratio.add(ratio.mul(10).div(100)); // 10% higher than current
  const triggerRatio = ratio.add(ratio.div(100)); // 1% higher than current
  const adapter = await Adapter.deploy(
    dai.address, // asset
    cdpManager.address, // cdpManager
    "0x9759A6Ac90977b93B58547b4A71c78317f391A28", // daiJoin
    proxy, // dsProxy
    "0x82ecd135dce65fbc6dbdd0e4237e0af93ffd5038", // dsProxyActions
    spotter.address, // spotter
    targetRatio, // ratio target
    triggerRatio, // ratio trigger
    urn // vault
  );

  // get delta and payment instructions
  const delta = await adapter.delta();
  const [approve, repay] = await adapter.paymentInstructions(delta);

  // impersonate the GnosisDAO since it is enabled as a module on the treasury management safe
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [gnosisDAO],
  });
  const dao = await hre.ethers.provider.getSigner(gnosisDAO);

  // use GnosisDAO as a module to execute payment instructions
  await safe
    .connect(dao)
    .execTransactionFromModule(
      approve.to,
      approve.value.toString(),
      approve.data,
      approve.operation
    );
  await safe
    .connect(dao)
    .execTransactionFromModule(
      repay.to,
      repay.value.toString(),
      repay.data,
      repay.operation
    );

  // get updated Maker jazz
  ilk = await cdpManager.ilks(urn);
  [ink, art] = await vat.urns(ilk, urnHandler); // wad
  [, rate, spot, ,] = await vat.ilks(ilk); // ray
  [, mat] = await spotter.ilks(ilk); // ray
  const newDebt = art.mul(rate).div(ray); // wad
  const newRatio = ink.mul(spot).div(ray).mul(mat).div(art.mul(rate).div(ray)); // ray

  // log all the things
  console.log("Vault ", urn);
  console.log("-----------");
  console.log("current ratio: ", ratio.toString());
  console.log("target ratio : ", targetRatio.toString());
  console.log("trigger ratio: ", triggerRatio.toString());
  console.log("current debt : ", debt.toString());
  console.log("debt delta   : ", delta.toString());
  console.log("new debt     : ", newDebt.toString());
  console.log("new ratio    : ", newRatio.toString());
  console.log("\n");

  console.log("Payment Instructions\n--------------------");
  console.log("approve.to: ", approve.to);
  console.log("approve.value: ", approve.value.toString());
  console.log("approve.data: ", approve.data);
  console.log("approve.operation: ", approve.operation);
  console.log("--------------------");
  console.log("repay.to: ", repay.to);
  console.log("repay.value: ", repay.value.toString());
  console.log("repay.data: ", repay.data);
  console.log("repay.operation: ", repay.operation);
  console.log("--------------------");
  console.log("\n");

  return;
};

simulatePayment();

export default simulatePayment;
