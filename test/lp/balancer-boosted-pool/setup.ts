import dotenv from "dotenv";
import { BigNumber, Contract } from "ethers";
import { getAddress } from "ethers/lib/utils";
import hre, { deployments, ethers, getNamedAccounts } from "hardhat";

export async function fork(blockNumber: number): Promise<void> {
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
          blockNumber,
        },
      },
    ],
  });
}

export async function forkReset(): Promise<void> {
  await hre.network.provider.request({
    method: "hardhat_reset",
    params: [],
  });
}

const USDC = {
  main: getAddress("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"),
  wrapped: getAddress("0xd093fa4fb80d09bb30817fdcd442d4d02ed3e5de"),
  linearPool: getAddress("0x9210f1204b5a24742eba12f710636d76240df3d0"),
};
const USDC_WHALE = "0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503";

const DAI = {
  main: getAddress("0x6b175474e89094c44da98b954eedeac495271d0f"),
  wrapped: getAddress("0x02d60b84491589974263d922d9cc7a3152618ef6"),
  linearPool: getAddress("0x804cdb9116a10bb78768d3252355a1b18067bf8f"),
};
const DAI_WHALE = "0x075e72a5edf65f0a5f44699c7654c1a76941ddc8";

const TETHER = {
  main: getAddress("0xdac17f958d2ee523a2206206994597c13d831ec7"),
  wrapped: getAddress("0xf8fd466f12e236f4c96f7cce6c79eadb819abf58"),
  linearPool: getAddress("0x2bbf681cc4eb09218bee85ea2a5d3d13fa40fc0c"),
};
const TETHER_WHALE = "0x5041ed759dd4afc3a72b8192c143f72f4724081a";

const POOL_ADDRESS = "0x7B50775383d3D6f0215A8F290f2C9e2eEBBEceb2";
const GAUGE_ADDRESS = "0x68d019f64A7aa97e2D4e7363AEE42251D08124Fb";
const VAULT_ADDRESS = "0xba12222222228d8ba445958a75a0704d566bf2c8";

async function setupAdapter(avatar: Contract) {
  const { BigWhale } = await getNamedAccounts();
  const BoostedPoolHelper = await deployments.get("BoostedPoolHelper");

  const Adapter = await hre.ethers.getContractFactory("BoostedPoolAdapter", {
    libraries: {
      BoostedPoolHelper: BoostedPoolHelper.address,
    },
  });
  const adapter = await Adapter.deploy(
    BigWhale,
    avatar.address,
    // pool
    POOL_ADDRESS,
    // gauge
    GAUGE_ADDRESS,
    // dai
    DAI.main
  );

  return adapter;
}

export async function setupFundWhaleWithBPT(): Promise<void> {
  const { BigWhale } = await getNamedAccounts();
  const bptWhaleSigner = hre.ethers.provider.getSigner(BigWhale);

  const gauge = new hre.ethers.Contract(
    GAUGE_ADDRESS,
    gaugeAbi,
    bptWhaleSigner
  );

  const GAUGE_TOP_HOLDERS = [
    "0x10bf1dcb5ab7860bab1c3320163c6dddf8dcc0e4",
    "0x15c87428ac97afeff3b9fef104b0865ce84f40f8",
    "0x462a63d4405a6462b157341a78fd1babfd3f8065",
    "0x762647e9343049a24102095e7894f9c0eb2fa1a6",
    "0xeb85cffccd22aeafa94efb96ad7422f111f3f7dc",
    "0x9a25d79ab755718e0b12bd3c927a010a543c2b31",
    "0xb1ff8bf9c3a55877b5ee38e769e7a78cd000848e",
    "0x64ca35bef43e3358d91001e3fb98ad04fbaef864",
    "0xf5fc9c48f051799e42bdc63222f8575c1e515006",
    "0x44e5f536429363dd2a20ce31e3666c300233d151",
    "0x8d5a603ee20b437a872f55f2380ffc907ad241cd",
  ];

  for (let i = 0; i < GAUGE_TOP_HOLDERS.length; i++) {
    const account = GAUGE_TOP_HOLDERS[i];
    await fundWithEth(account);

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [account],
    });
    const signer = await hre.ethers.provider.getSigner(account);
    const balance = await gauge.balanceOf(account);
    await gauge.connect(signer).transfer(BigWhale, balance);
  }

  const balance: BigNumber = await gauge.balanceOf(BigWhale);
  await gauge["withdraw(uint256)"](
    balance.sub(BigNumber.from("1000000000000000000000000"))
  );
}

export async function setupFundWhaleWithStables(): Promise<void> {
  const { BigWhale } = await getNamedAccounts();
  const bigWhaleSigner = await hre.ethers.provider.getSigner(BigWhale);

  const STABLES = [
    { stable: DAI, whale: DAI_WHALE },
    { stable: USDC, whale: USDC_WHALE },
    { stable: TETHER, whale: TETHER_WHALE },
  ];
  for (let i = 0; i < STABLES.length; i++) {
    const { stable, whale } = STABLES[i];
    fundWithEth(whale);

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [whale],
    });
    const signer = await hre.ethers.provider.getSigner(whale);
    const token = await hre.ethers.getContractAt("ERC20", stable.main);
    const balance = await token.balanceOf(whale);

    await token.connect(signer).transfer(BigWhale, balance);

    await token
      .connect(bigWhaleSigner)
      .approve(
        VAULT_ADDRESS,
        "115792089237316195423570985008687907853269984665640564039457584007913129639935"
      );
  }
}

async function fundWithEth(account: string) {
  const { BigWhale } = await getNamedAccounts();
  const signer = hre.ethers.provider.getSigner(BigWhale);

  const tx = {
    from: BigWhale,
    to: account,
    value: ethers.utils.parseEther("1"),
  };

  await signer.sendTransaction(tx);
}

export async function setupFundAvatar(
  avatar: Contract,
  gaugeAmount: BigNumber,
  bptAmount: BigNumber
): Promise<void> {
  const { BigWhale } = await getNamedAccounts();
  const signer = hre.ethers.provider.getSigner(BigWhale);

  const gauge = await hre.ethers.getContractAt("ERC20", GAUGE_ADDRESS);
  const bpt = await hre.ethers.getContractAt("ERC20", POOL_ADDRESS);

  await gauge.connect(signer).transfer(avatar.address, gaugeAmount);
  await bpt.connect(signer).transfer(avatar.address, bptAmount);
}

export async function setup() {
  const Avatar = await hre.ethers.getContractFactory("TestAvatar");
  const avatar = await Avatar.deploy();
  const adapter = await setupAdapter(avatar);

  const pool = await hre.ethers.getContractAt("ERC20", POOL_ADDRESS);
  const gauge = await hre.ethers.getContractAt("ERC20", GAUGE_ADDRESS);
  const dai = await hre.ethers.getContractAt("ERC20", DAI.main);
  const tether = await hre.ethers.getContractAt("ERC20", TETHER.main);
  const usdc = await hre.ethers.getContractAt("ERC20", USDC.main);
  const boostedPoolHelper = await getBoostedPoolHelper();

  return {
    avatar,
    adapter,
    pool,
    gauge,
    dai,
    tether,
    usdc,
    boostedPoolHelper,
  };
}

export async function investInPool(
  tokenIn: string,
  amountIn: BigNumber
): Promise<void> {
  const { BigWhale } = await getNamedAccounts();
  const signer = hre.ethers.provider.getSigner(BigWhale);
  const boostedPoolHelper = await getBoostedPoolHelper();

  const vault = new ethers.Contract(VAULT_ADDRESS, vaultAbi, signer);

  const stable = await hre.ethers.getContractAt("ERC20", tokenIn);

  const boostedPool = new ethers.Contract(POOL_ADDRESS, linearPoolAbi, signer);
  const boostedPoolId = await boostedPool.getPoolId();

  const linearPoolAddress = await boostedPoolHelper.findLinearPool(
    POOL_ADDRESS,
    tokenIn
  );

  const linearPool = new ethers.Contract(
    linearPoolAddress,
    linearPoolAbi,
    signer
  );
  const linearPoolId = await linearPool.getPoolId();

  const tx = await vault.batchSwap(
    0,
    [
      {
        poolId: linearPoolId,
        assetInIndex: 2,
        assetOutIndex: 1,
        amount: amountIn,
        userData: "0x",
      },
      {
        poolId: boostedPoolId,
        assetInIndex: 1,
        assetOutIndex: 0,
        amount: 0,
        userData: "0x",
      },
    ],
    [
      //0
      boostedPool.address,
      //1
      linearPool.address,
      //2
      stable.address,
    ],
    {
      sender: BigWhale,
      fromInternalBalance: false,
      recipient: BigWhale,
      toInternalBalance: false,
    },
    ["-1", 0, amountIn],
    BigNumber.from("999999999999999999")
  );

  await tx.wait();
}

async function getBoostedPoolHelper() {
  const deployment = await deployments.get("BoostedPoolHelper");
  return new ethers.Contract(
    deployment.address,
    deployment.abi,
    hre.ethers.provider
  );
}

const vaultAbi = [
  "function WETH() view returns (address)",
  "function batchSwap(uint8 kind, tuple(bytes32 poolId, uint256 assetInIndex, uint256 assetOutIndex, uint256 amount, bytes userData)[] swaps, address[] assets, tuple(address sender, bool fromInternalBalance, address recipient, bool toInternalBalance) funds, int256[] limits, uint256 deadline) payable returns (int256[] assetDeltas)",
  "function exitPool(bytes32 poolId, address sender, address recipient, tuple(address[] assets, uint256[] minAmountsOut, bytes userData, bool toInternalBalance) request)",
  "function flashLoan(address recipient, address[] tokens, uint256[] amounts, bytes userData)",
  "function getInternalBalance(address user, address[] tokens) view returns (uint256[] balances)",
  "function getPausedState() view returns (bool paused, uint256 pauseWindowEndTime, uint256 bufferPeriodEndTime)",
  "function getPool(bytes32 poolId) view returns (address, uint8)",
  "function getPoolTokenInfo(bytes32 poolId, address token) view returns (uint256 cash, uint256 managed, uint256 lastChangeBlock, address assetManager)",
  "function getPoolTokens(bytes32 poolId) view returns (address[] tokens, uint256[] balances, uint256 lastChangeBlock)",
  "function getProtocolFeesCollector() view returns (address)",
  "function queryBatchSwap(uint8 kind, tuple(bytes32 poolId, uint256 assetInIndex, uint256 assetOutIndex, uint256 amount, bytes userData)[] swaps, address[] assets, tuple(address sender, bool fromInternalBalance, address recipient, bool toInternalBalance) funds) view returns (int256[])",
  "function swap(tuple(bytes32 poolId, uint8 kind, address assetIn, address assetOut, uint256 amount, bytes userData) singleSwap, tuple(address sender, bool fromInternalBalance, address recipient, bool toInternalBalance) funds, uint256 limit, uint256 deadline) payable returns (uint256 amountCalculated)",
];

const gaugeAbi = [
  "function deposit(uint256 _value)",
  "function deposit(uint256 _value, address _addr)",
  "function deposit(uint256 _value, address _addr, bool _claim_rewards)",
  "function withdraw(uint256 _value)",
  "function withdraw(uint256 _value, bool _claim_rewards)",
  "function claim_rewards()",
  "function claim_rewards(address _addr)",
  "function claim_rewards(address _addr, address _receiver)",
  "function transferFrom(address _from, address _to, uint256 _value) returns (bool)",
  "function transfer(address _to, uint256 _value) returns (bool)",
  "function approve(address _spender, uint256 _value) returns (bool)",
  "function permit(address _owner, address _spender, uint256 _value, uint256 _deadline, uint8 _v, bytes32 _r, bytes32 _s) returns (bool)",
  "function decimals() view returns (uint256)",
  "function balanceOf(address arg0) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
];

const linearPoolAbi = [
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function getBptIndex() view returns (uint256)",
  "function getMainIndex() view returns (uint256)",
  "function getMainToken() view returns (address)",
  "function getOwner() view returns (address)",
  "function getPoolId() view returns (bytes32)",
  "function getRate() view returns (uint256)",
  "function getScalingFactors() view returns (uint256[])",
  "function getSwapFeePercentage() view returns (uint256)",
  "function getTargets() view returns (uint256 lowerTarget, uint256 upperTarget)",
  "function getVault() view returns (address)",
  "function getVirtualSupply() view returns (uint256)",
  "function getWrappedIndex() view returns (uint256)",
  "function getWrappedToken() view returns (address)",
  "function getWrappedTokenRate() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function transfer(address recipient, uint256 amount) returns (bool)",
  "function transferFrom(address sender, address recipient, uint256 amount) returns (bool)",
];
