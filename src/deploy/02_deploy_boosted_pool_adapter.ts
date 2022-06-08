import { getAddress } from "ethers/lib/utils";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const SomeAddress = "0x0000000000000000000000000000000000000001";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;

  const allDeployments = await deployments.all();

  const libraries = {
    Errors: allDeployments.Errors.address,
    Math: allDeployments.Math.address,
    LogExpMath: allDeployments.LogExpMath.address,
    FixedPoint: allDeployments.FixedPoint.address,
    Utils: allDeployments.Utils.address,
    LinearPool: allDeployments.LinearPool.address,
    BoostedPool: allDeployments.BoostedPool.address,
  };

  await deploy("BoostedPoolAdapter", {
    from: deployer,
    args: [
      SomeAddress,
      getAddress("0x7B50775383d3D6f0215A8F290f2C9e2eEBBEceb2"),
      getAddress("0x6b175474e89094c44da98b954eedeac495271d0f"),
    ],
    libraries,
    log: true,
  });
};

export default deploy;
