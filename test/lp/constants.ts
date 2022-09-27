import { getAddress } from "ethers/lib/utils";

export const USDC_ADDRESS = getAddress(
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
);
export const USDC_WHALE = "0x55fe002aeff02f77364de339a1292923a15844b8";

export const DAI_ADDRESS = getAddress(
  "0x6B175474E89094C44Da98b954EedeAC495271d0F"
);
export const DAI_WHALE = "0x075e72a5edf65f0a5f44699c7654c1a76941ddc8";
export const DAI_LINEAR_POOL = getAddress(
  "0x804cdb9116a10bb78768d3252355a1b18067bf8f"
);

export const TETHER_ADDRESS = getAddress(
  "0xdAC17F958D2ee523a2206206994597C13D831ec7"
);
export const TETHER_WHALE = "0x5041ed759dd4afc3a72b8192c143f72f4724081a";

export const STABLE_POOL_ADDRESS = "0x06Df3b2bbB68adc8B0e302443692037ED9f91b42";
export const STABLE_GAUGE_ADDRESS =
  "0x34f33CDaED8ba0E1CEECE80e5f4a73bcf234cfac";

export const STABLE_GAUGE_TOP_HOLDERS = [
  "0xdB463e46b4e7167B46FF77820170B1d92260B096",
  "0x12c012ac4b947a072a1f6abb478d094094931215",
  "0xb3376fc0a571a4f103b8e93a3be39394519a0760",
];

export const BOOSTED_POOL_ADDRESS =
  "0x7B50775383d3D6f0215A8F290f2C9e2eEBBEceb2";
export const BOOSTED_GAUGE_ADDRESS =
  "0x68d019f64A7aa97e2D4e7363AEE42251D08124Fb";

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
  "function approve(address _spender, uint256 _value) returns (bool)",
  "function permit(address _owner, address _spender, uint256 _value, uint256 _deadline, uint8 _v, bytes32 _r, bytes32 _s) returns (bool)",
];

export const helpersAbi = [
  "constructor(address _vault)",
  "function queryExit(bytes32 poolId, address sender, address recipient, tuple(address[] assets, uint256[] minAmountsOut, bytes userData, bool toInternalBalance) request) view returns (uint256 bptIn, uint256[] amountsOut)",
  "function queryJoin(bytes32 poolId, address sender, address recipient, tuple(address[] assets, uint256[] maxAmountsIn, bytes userData, bool fromInternalBalance) request) view returns (uint256 bptOut, uint256[] amountsIn)",
  "function vault() view returns (address)",
];

export const linearPoolAbi = [
  "constructor(address vault, string name, string symbol, address mainToken, address wrappedToken, uint256 upperTarget, uint256 swapFeePercentage, uint256 pauseWindowDuration, uint256 bufferPeriodDuration, address owner)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
  "event PausedStateChanged(bool paused)",
  "event SwapFeePercentageChanged(uint256 swapFeePercentage)",
  "event TargetsSet(address indexed token, uint256 lowerTarget, uint256 upperTarget)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "function DOMAIN_SEPARATOR() view returns (bytes32)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function decreaseAllowance(address spender, uint256 amount) returns (bool)",
  "function getActionId(bytes4 selector) view returns (bytes32)",
  "function getAuthorizer() view returns (address)",
  "function getBptIndex() view returns (uint256)",
  "function getMainIndex() view returns (uint256)",
  "function getMainToken() view returns (address)",
  "function getOwner() view returns (address)",
  "function getPausedState() view returns (bool paused, uint256 pauseWindowEndTime, uint256 bufferPeriodEndTime)",
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
  "function increaseAllowance(address spender, uint256 addedValue) returns (bool)",
  "function initialize()",
  "function name() view returns (string)",
  "function nonces(address owner) view returns (uint256)",
  "function onExitPool(bytes32 poolId, address sender, address recipient, uint256[] balances, uint256 lastChangeBlock, uint256 protocolSwapFeePercentage, bytes userData) returns (uint256[], uint256[])",
  "function onJoinPool(bytes32 poolId, address sender, address recipient, uint256[] balances, uint256 lastChangeBlock, uint256 protocolSwapFeePercentage, bytes userData) returns (uint256[], uint256[])",
  "function onSwap(tuple(uint8 kind, address tokenIn, address tokenOut, uint256 amount, bytes32 poolId, uint256 lastChangeBlock, address from, address to, bytes userData) request, uint256[] balances, uint256 indexIn, uint256 indexOut) view returns (uint256)",
  "function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)",
  "function queryExit(bytes32 poolId, address sender, address recipient, uint256[] balances, uint256 lastChangeBlock, uint256 protocolSwapFeePercentage, bytes userData) returns (uint256 bptIn, uint256[] amountsOut)",
  "function queryJoin(bytes32 poolId, address sender, address recipient, uint256[] balances, uint256 lastChangeBlock, uint256 protocolSwapFeePercentage, bytes userData) returns (uint256 bptOut, uint256[] amountsIn)",
  "function setAssetManagerPoolConfig(address token, bytes poolConfig)",
  "function setPaused(bool paused)",
  "function setSwapFeePercentage(uint256 swapFeePercentage)",
  "function setTargets(uint256 newLowerTarget, uint256 newUpperTarget)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function transfer(address recipient, uint256 amount) returns (bool)",
  "function transferFrom(address sender, address recipient, uint256 amount) returns (bool)",
];
