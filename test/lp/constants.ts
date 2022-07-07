import { getAddress } from "ethers/lib/utils";

export const USDC_ADDRESS = getAddress(
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
);
export const USDC_WHALE = "0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503";

export const DAI_ADDRESS = getAddress(
  "0x6B175474E89094C44Da98b954EedeAC495271d0F"
);
export const DAI_WHALE = "0x075e72a5edf65f0a5f44699c7654c1a76941ddc8";

export const TETHER_ADDRESS = getAddress(
  "0xdAC17F958D2ee523a2206206994597C13D831ec7"
);
export const TETHER_WHALE = "0x5041ed759dd4afc3a72b8192c143f72f4724081a";

export const STABLE_POOL_ADDRESS = "0x06Df3b2bbB68adc8B0e302443692037ED9f91b42";
export const STABLE_GAUGE_ADDRESS =
  "0x34f33CDaED8ba0E1CEECE80e5f4a73bcf234cfac";

export const STABLE_GAUGE_TOP_HOLDERS = [
  "0xdB463e46b4e7167B46FF77820170B1d92260B096",
  "0x9e90d6fe95ee0bb754261ee3fc3d8a9c11e97a8e",
  "0x9a25d79ab755718e0b12bd3c927a010a543c2b31",
  "0x0c963efc759c0a7908e4365444677c142fb5c62e",
];

export const BOOSTED_POOL_ADDRESS =
  "0x7B50775383d3D6f0215A8F290f2C9e2eEBBEceb2";
export const BOOSTED_GAUGE_ADDRESS =
  "0x68d019f64A7aa97e2D4e7363AEE42251D08124Fb";

export const BOOSTED_GAUGE_TOP_HOLDERS = [
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

export const VAULT_ADDRESS = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";
export const HELPERS_ADDRESS = "0x5aDDCCa35b7A0D07C74063c48700C8590E87864E";

export const MAX_UINT256 =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";

export const vaultAbi = [
  "constructor(address authorizer, address weth, uint256 pauseWindowDuration, uint256 bufferPeriodDuration)",
  "event AuthorizerChanged(address indexed newAuthorizer)",
  "event ExternalBalanceTransfer(address indexed token, address indexed sender, address recipient, uint256 amount)",
  "event FlashLoan(address indexed recipient, address indexed token, uint256 amount, uint256 feeAmount)",
  "event InternalBalanceChanged(address indexed user, address indexed token, int256 delta)",
  "event PausedStateChanged(bool paused)",
  "event PoolBalanceChanged(bytes32 indexed poolId, address indexed liquidityProvider, address[] tokens, int256[] deltas, uint256[] protocolFeeAmounts)",
  "event PoolBalanceManaged(bytes32 indexed poolId, address indexed assetManager, address indexed token, int256 cashDelta, int256 managedDelta)",
  "event PoolRegistered(bytes32 indexed poolId, address indexed poolAddress, uint8 specialization)",
  "event RelayerApprovalChanged(address indexed relayer, address indexed sender, bool approved)",
  "event Swap(bytes32 indexed poolId, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut)",
  "event TokensDeregistered(bytes32 indexed poolId, address[] tokens)",
  "event TokensRegistered(bytes32 indexed poolId, address[] tokens, address[] assetManagers)",
  "function WETH() view returns (address)",
  "function batchSwap(uint8 kind, tuple(bytes32 poolId, uint256 assetInIndex, uint256 assetOutIndex, uint256 amount, bytes userData)[] swaps, address[] assets, tuple(address sender, bool fromInternalBalance, address recipient, bool toInternalBalance) funds, int256[] limits, uint256 deadline) payable returns (int256[] assetDeltas)",
  "function deregisterTokens(bytes32 poolId, address[] tokens)",
  "function exitPool(bytes32 poolId, address sender, address recipient, tuple(address[] assets, uint256[] minAmountsOut, bytes userData, bool toInternalBalance) request)",
  "function flashLoan(address recipient, address[] tokens, uint256[] amounts, bytes userData)",
  "function getActionId(bytes4 selector) view returns (bytes32)",
  "function getAuthorizer() view returns (address)",
  "function getDomainSeparator() view returns (bytes32)",
  "function getInternalBalance(address user, address[] tokens) view returns (uint256[] balances)",
  "function getNextNonce(address user) view returns (uint256)",
  "function getPausedState() view returns (bool paused, uint256 pauseWindowEndTime, uint256 bufferPeriodEndTime)",
  "function getPool(bytes32 poolId) view returns (address, uint8)",
  "function getPoolTokenInfo(bytes32 poolId, address token) view returns (uint256 cash, uint256 managed, uint256 lastChangeBlock, address assetManager)",
  "function getPoolTokens(bytes32 poolId) view returns (address[] tokens, uint256[] balances, uint256 lastChangeBlock)",
  "function getProtocolFeesCollector() view returns (address)",
  "function hasApprovedRelayer(address user, address relayer) view returns (bool)",
  "function joinPool(bytes32 poolId, address sender, address recipient, tuple(address[] assets, uint256[] maxAmountsIn, bytes userData, bool fromInternalBalance) request) payable",
  "function managePoolBalance(tuple(uint8 kind, bytes32 poolId, address token, uint256 amount)[] ops)",
  "function manageUserBalance(tuple(uint8 kind, address asset, uint256 amount, address sender, address recipient)[] ops) payable",
  "function queryBatchSwap(uint8 kind, tuple(bytes32 poolId, uint256 assetInIndex, uint256 assetOutIndex, uint256 amount, bytes userData)[] swaps, address[] assets, tuple(address sender, bool fromInternalBalance, address recipient, bool toInternalBalance) funds) view returns (int256[])",
  "function registerPool(uint8 specialization) returns (bytes32)",
  "function registerTokens(bytes32 poolId, address[] tokens, address[] assetManagers)",
  "function setAuthorizer(address newAuthorizer)",
  "function setPaused(bool paused)",
  "function setRelayerApproval(address sender, address relayer, bool approved)",
  "function swap(tuple(bytes32 poolId, uint8 kind, address assetIn, address assetOut, uint256 amount, bytes userData) singleSwap, tuple(address sender, bool fromInternalBalance, address recipient, bool toInternalBalance) funds, uint256 limit, uint256 deadline) payable returns (uint256 amountCalculated)",
];

export const gaugeAbi = [
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

export const poolAbi = [
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function getPoolId() view returns (bytes32)",
  "function totalSupply() view returns (uint256)",
  "function transfer(address recipient, uint256 amount) returns (bool)",
  "function transferFrom(address sender, address recipient, uint256 amount) returns (bool)",
];

export const helpersAbi = [
  "constructor(address _vault)",
  "function queryExit(bytes32 poolId, address sender, address recipient, tuple(address[] assets, uint256[] minAmountsOut, bytes userData, bool toInternalBalance) request) view returns (uint256 bptIn, uint256[] amountsOut)",
  "function queryJoin(bytes32 poolId, address sender, address recipient, tuple(address[] assets, uint256[] maxAmountsIn, bytes userData, bool fromInternalBalance) request) view returns (uint256 bptOut, uint256[] amountsIn)",
  "function vault() view returns (address)",
];
