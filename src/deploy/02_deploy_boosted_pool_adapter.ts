import { getAddress } from "ethers/lib/utils";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

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
    LinearPoolHelper: allDeployments.LinearPoolHelper.address,
    StablePhantomPoolHelper: allDeployments.StablePhantomPoolHelper.address,
    BoostedPoolHelper: allDeployments.BoostedPoolHelper.address,
  };

  await deploy("BoostedPoolAdapter", {
    from: deployer,
    args: [
      getAddress("0x849D52316331967b6fF1198e5E32A0eB168D039d"),
      getAddress("0x7B50775383d3D6f0215A8F290f2C9e2eEBBEceb2"),
      getAddress("0x68d019f64A7aa97e2D4e7363AEE42251D08124Fb"),
      getAddress("0x6b175474e89094c44da98b954eedeac495271d0f"),
    ],
    libraries,
    log: true,
  });
};

export default deploy;
