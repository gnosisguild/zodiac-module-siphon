import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  // const { deployments, getNamedAccounts } = hre;
  // const { deployer } = await getNamedAccounts();
  // const { deploy } = deployments;
  // const txErrors = await deploy("Errors", {
  //   from: deployer,
  //   args: [],
  //   log: true,
  // });
  // const txMath = await deploy("Math", {
  //   from: deployer,
  //   args: [],
  //   libraries: {
  //     Errors: txErrors.address,
  //   },
  //   log: true,
  // });
  // const txLogExpMath = await deploy("LogExpMath", {
  //   from: deployer,
  //   args: [],
  //   libraries: {
  //     Errors: txErrors.address,
  //   },
  //   log: true,
  // });
  // const txFixedPoint = await deploy("FixedPoint", {
  //   from: deployer,
  //   args: [],
  //   libraries: {
  //     Errors: txErrors.address,
  //     Math: txMath.address,
  //     LogExpMath: txLogExpMath.address,
  //   },
  //   log: true,
  // });
  // await deploy("LinearMath", {
  //   from: deployer,
  //   args: [],
  //   libraries: {
  //     Errors: txErrors.address,
  //     Math: txMath.address,
  //     LogExpMath: txLogExpMath.address,
  //     FixedPoint: txFixedPoint.address,
  //   },
  //   log: true,
  // });
  // await deploy("StableMath", {
  //   from: deployer,
  //   args: [],
  //   libraries: {
  //     Errors: txErrors.address,
  //     Math: txMath.address,
  //     LogExpMath: txLogExpMath.address,
  //     FixedPoint: txFixedPoint.address,
  //   },
  //   log: true,
  // });
};

export default deploy;
