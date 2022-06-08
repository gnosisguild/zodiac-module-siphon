import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

// const ThirdAddress = "0x0000000000000000000000000000000000000003";

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
    LinearMathMath: allDeployments.LinearMath.address,
    StableMath: allDeployments.StableMath.address,
  };

  const txUtils = await deploy("Utils", {
    from: deployer,
    args: [],
    libraries,
    log: true,
  });

  const txLinearPool = await deploy("LinearPool", {
    from: deployer,
    args: [],
    libraries: {
      ...libraries,
      Utils: txUtils.address,
    },
    log: true,
  });

  const txStablePhantomPool = await deploy("StablePhantomPool", {
    from: deployer,
    args: [],
    libraries: {
      ...libraries,
      Utils: txUtils.address,
    },
    log: true,
  });

  await deploy("BoostedPool", {
    from: deployer,
    args: [],
    libraries: {
      ...libraries,
      Utils: txUtils.address,
      LinearPool: txLinearPool.address,
      StablePhantomPool: txStablePhantomPool.address,
    },
    log: true,
  });
};

export default deploy;
