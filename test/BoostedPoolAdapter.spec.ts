import { expect } from "chai";
import dotenv from "dotenv";
import { BigNumber, Contract } from "ethers";
import hre, { deployments } from "hardhat";

async function setupAvatarWithStakedBpt() {
  const Avatar = await hre.ethers.getContractFactory("TestAvatar");
  const avatar = await Avatar.deploy();

  const gauge = await hre.ethers.getContractAt(
    "TestToken",
    "0x68d019f64A7aa97e2D4e7363AEE42251D08124Fb"
  );

  const gaugeWhale = "0x9a25d79AB755718e0b12BD3C927A010A543C2b31";
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [gaugeWhale],
  });

  const balance = await gauge.balanceOf(gaugeWhale);
  const signer = await hre.ethers.provider.getSigner(gaugeWhale);
  await gauge.connect(signer).transfer(avatar.address, balance);

  return avatar;
}

async function setupAdapter(avatar: Contract) {
  const DAI = await hre.ethers.getContractAt(
    "TestToken",
    "0x6b175474e89094c44da98b954eedeac495271d0f"
  );

  const BoostedPoolHelper = await deployments.get("BoostedPoolHelper");

  const Adapter = await hre.ethers.getContractFactory("BoostedPoolAdapter", {
    libraries: {
      BoostedPoolHelper: BoostedPoolHelper.address,
    },
  });
  const adapter = await Adapter.deploy(
    avatar.address,
    // pool
    "0x7B50775383d3D6f0215A8F290f2C9e2eEBBEceb2",
    // gauge
    "0x68d019f64A7aa97e2D4e7363AEE42251D08124Fb",
    // dai
    DAI.address
  );

  return {
    avatar,
    adapter,
    DAI,
  };
}

describe("LP: BoostedPoolAdapter", async () => {
  let baseSetup: any;

  before(async () => {
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
            blockNumber: 15004759,
          },
        },
      ],
    });

    baseSetup = deployments.createFixture(async ({ deployments }) => {
      await deployments.fixture();
      const avatar = await setupAvatarWithStakedBpt();
      return setupAdapter(avatar);
    });
  });

  after(async () => {
    await hre.network.provider.request({
      method: "hardhat_reset",
      params: [],
    });
  });

  it("Unstakes staked Boosted Pool Token, and BatchSwaps it exiting into DAI - inGivenOut", async () => {
    const { avatar, adapter, DAI } = await baseSetup();

    // Avatar has zero DAI
    await expect(await DAI.balanceOf(avatar.address)).to.equal(
      hre.ethers.utils.parseEther("0")
    );

    const rawBPTBalance = "2030486787543655114968077";
    const rawAAmountOut = "1000000000000000000000";

    const preExitBalance = await adapter.balance();
    expect(preExitBalance).to.equal(BigNumber.from(rawBPTBalance));

    const requestedAmountOut = rawAAmountOut;

    const instructions = await adapter.withdrawalInstructions(
      requestedAmountOut
    );

    await avatar.exec(
      instructions[0].to,
      instructions[0].value.toString(),
      instructions[0].data
    );

    await avatar.exec(
      instructions[1].to,
      instructions[1].value.toString(),
      instructions[1].data
    );

    // Avatar has exactly amount requested - inGivenOut
    const postExitBalance = await DAI.balanceOf(avatar.address);

    expect(postExitBalance).to.equal(requestedAmountOut);
  });

  it("Withdrawing more than available balances yields full exit - outGivenIn");

  it("Withdrawing close to available balances yields full exit - outGivenIn");

  it("Withdrawing with partial unstake and exit - inGivenOut");

  it("Withdrawing without need to unstake, exit only - inGivenOut");

  it("Withdrawing with limited DAI liquidity in LinearPool");
});
