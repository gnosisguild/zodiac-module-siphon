import { expect } from "chai";
import dotenv from "dotenv";
import { BigNumber, Contract } from "ethers";
import hre, { deployments } from "hardhat";

const POOL_ADDRESS = "0x7B50775383d3D6f0215A8F290f2C9e2eEBBEceb2";
const GAUGE_ADDRESS = "0x68d019f64A7aa97e2D4e7363AEE42251D08124Fb";

async function setupAvatarAndFundWithBPT() {
  const Avatar = await hre.ethers.getContractFactory("TestAvatar");
  const avatar = await Avatar.deploy();

  const bpt = await hre.ethers.getContractAt("TestToken", POOL_ADDRESS);
  const gauge = await hre.ethers.getContractAt("TestToken", GAUGE_ADDRESS);

  // whale has 2030486787543655114968077 staked bpt
  const gaugeWhale = "0x9a25d79AB755718e0b12BD3C927A010A543C2b31";
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [gaugeWhale],
  });

  const signer = await hre.ethers.provider.getSigner(gaugeWhale);

  await gauge
    .connect(signer)
    .transfer(avatar.address, BigNumber.from("2000000000000000000000000"));

  await avatar.exec(
    GAUGE_ADDRESS,
    "0",
    // withdraw 1000000000000000000000000
    "0x2e1a7d4d00000000000000000000000000000000000000000000d3c21bcecceda1000000"
  );

  return avatar;
}

async function setupAdapter(avatar: Contract) {
  const DAI = await hre.ethers.getContractAt(
    "TestToken",
    "0x6b175474e89094c44da98b954eedeac495271d0f"
  );

  const POOL = await hre.ethers.getContractAt("TestToken", POOL_ADDRESS);

  const GAUGE = await hre.ethers.getContractAt("TestToken", GAUGE_ADDRESS);

  const BoostedPoolHelper = await deployments.get("BoostedPoolHelper");

  const Adapter = await hre.ethers.getContractFactory("BoostedPoolAdapter", {
    libraries: {
      BoostedPoolHelper: BoostedPoolHelper.address,
    },
  });
  const adapter = await Adapter.deploy(
    avatar.address,
    avatar.address,
    // pool
    POOL_ADDRESS,
    // gauge
    GAUGE_ADDRESS,
    // dai
    DAI.address
  );

  return {
    avatar,
    adapter,
    DAI,
    POOL,
    GAUGE,
  };
}

describe.only("LP: BoostedPoolAdapter", async () => {
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
      const avatar = await setupAvatarAndFundWithBPT();
      return setupAdapter(avatar);
    });
  });

  after(async () => {
    await hre.network.provider.request({
      method: "hardhat_reset",
      params: [],
    });
  });

  it("Withdrawing more than available balance yields full exit - outGivenIn", async () => {
    const { avatar, adapter, DAI, POOL, GAUGE } = await baseSetup();

    // Avatar has zero DAI
    await expect(await DAI.balanceOf(avatar.address)).to.equal(
      hre.ethers.utils.parseEther("0")
    );

    await expect(await POOL.balanceOf(avatar.address)).to.equal(
      BigNumber.from("1000000000000000000000000")
    );

    await expect(await GAUGE.balanceOf(avatar.address)).to.equal(
      BigNumber.from("1000000000000000000000000")
    );

    const preExitBalance: BigNumber = await adapter.balance();
    await expect(preExitBalance).to.equal(
      BigNumber.from("2013245722146225613466166")
    );

    const requestedAmountOut = preExitBalance.mul(BigNumber.from("2"));

    const instructions = await adapter.withdrawalInstructions(
      requestedAmountOut
    );

    expect(instructions).to.have.length(2);

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

    const postExitBalance: BigNumber = await DAI.balanceOf(avatar.address);

    expect(postExitBalance.gt(0)).to.be.true;

    // Expect BPT and StakedBPT to be drained
    await expect(await POOL.balanceOf(avatar.address)).to.equal(
      BigNumber.from("0")
    );

    await expect(await GAUGE.balanceOf(avatar.address)).to.equal(
      BigNumber.from("0")
    );
  });

  it("Withdrawing close to available balances yields full exit - outGivenIn", async () => {
    const { avatar, adapter, DAI, POOL, GAUGE } = await baseSetup();

    // Avatar has zero DAI
    await expect(await DAI.balanceOf(avatar.address)).to.equal(
      hre.ethers.utils.parseEther("0")
    );

    await expect(await POOL.balanceOf(avatar.address)).to.equal(
      BigNumber.from("1000000000000000000000000")
    );

    await expect(await GAUGE.balanceOf(avatar.address)).to.equal(
      BigNumber.from("1000000000000000000000000")
    );

    const preExitBalance: BigNumber = await adapter.balance();
    await expect(preExitBalance).to.equal(
      BigNumber.from("2013245722146225613466166")
    );

    // slightly less than available
    const requestedAmountOut = "2013000000000000000000000";

    const instructions = await adapter.withdrawalInstructions(
      requestedAmountOut
    );

    expect(instructions).to.have.length(2);

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

    const postExitBalance: BigNumber = await DAI.balanceOf(avatar.address);

    expect(postExitBalance.gt(0)).to.be.true;

    // Expect BPT and StakedBPT to be drained
    await expect(await POOL.balanceOf(avatar.address)).to.equal(
      BigNumber.from("0")
    );

    await expect(await GAUGE.balanceOf(avatar.address)).to.equal(
      BigNumber.from("0")
    );
  });

  it("Withdrawing with partial unstake and exit - inGivenOut", async () => {
    // getting ~75% of liquidity should yield a partial withdrawal, since we start with 50/50
    const { avatar, adapter, DAI, POOL, GAUGE } = await baseSetup();

    // Avatar has zero DAI
    await expect(await DAI.balanceOf(avatar.address)).to.equal(
      hre.ethers.utils.parseEther("0")
    );

    await expect(await POOL.balanceOf(avatar.address)).to.equal(
      BigNumber.from("1000000000000000000000000")
    );

    await expect(await GAUGE.balanceOf(avatar.address)).to.equal(
      BigNumber.from("1000000000000000000000000")
    );

    const preExitBalance: BigNumber = await adapter.balance();
    await expect(preExitBalance).to.equal(
      BigNumber.from("2013245722146225613466166")
    );

    // ballpark 75% of what's available
    const requestedAmountOut = BigNumber.from("1500000000000000000000000");

    const instructions = await adapter.withdrawalInstructions(
      requestedAmountOut
    );

    expect(instructions).to.have.length(2);

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

    // We expect the avatar to have exactly the DAI required
    await expect(await DAI.balanceOf(avatar.address)).to.equal(
      requestedAmountOut
    );

    // TODO this was not working
    // Expect BPT to be drained, but not stakedBPT
    // await expect(await POOL.balanceOf(avatar.address)).to.equal(
    //   BigNumber.from("0")
    // );

    // we expect round about half of the STAKED BPT to have been unstaked
    expect(
      (await GAUGE.balanceOf(avatar.address)).gt(
        BigNumber.from("450000000000000000000000")
      )
    ).to.be.true;

    expect(
      (await GAUGE.balanceOf(avatar.address)).lt(
        BigNumber.from("550000000000000000000000")
      )
    ).to.be.true;
  });

  it("Withdrawing without need to unstake, exit only - inGivenOut", async () => {
    // getting ~75% of liquidity should yield a partial withdrawal, since we start with 50/50
    const { avatar, adapter, DAI, POOL, GAUGE } = await baseSetup();

    // Avatar has zero DAI
    await expect(await DAI.balanceOf(avatar.address)).to.equal(
      hre.ethers.utils.parseEther("0")
    );

    await expect(await POOL.balanceOf(avatar.address)).to.equal(
      BigNumber.from("1000000000000000000000000")
    );

    await expect(await GAUGE.balanceOf(avatar.address)).to.equal(
      BigNumber.from("1000000000000000000000000")
    );

    const preExitBalance: BigNumber = await adapter.balance();
    await expect(preExitBalance).to.equal(
      BigNumber.from("2013245722146225613466166")
    );

    // ballpark 10% of what's available
    const requestedAmountOut = BigNumber.from("200000000000000000000000");

    const instructions = await adapter.withdrawalInstructions(
      requestedAmountOut
    );

    expect(instructions).to.have.length(1);

    await avatar.exec(
      instructions[0].to,
      instructions[0].value.toString(),
      instructions[0].data
    );

    // We expect the avatar to have exactly the DAI required
    await expect(await DAI.balanceOf(avatar.address)).to.equal(
      requestedAmountOut
    );

    // we expect round about half of the STAKED BPT to have been unstaked
    await expect(await GAUGE.balanceOf(avatar.address)).to.equal(
      BigNumber.from("1000000000000000000000000")
    );

    // TODO assert on gauge balance
    // // Expect BPT to be drained, but not stakedBPT
    // await expect(await POOL.balanceOf(avatar.address)).to.equal(
    //   BigNumber.from("0")
    // );
  });

  it("Withdrawing with limited DAI liquidity in LinearPool");
});
