import dotenv from "dotenv";
import hre from "hardhat";
import ethers from "ethers";
import { CToken__factory, ERC20__factory } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

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

export async function takeoverERC20(
  from: string,
  to: string,
  tokenAddress: string
) {
  const impersonator = await hre.ethers.getImpersonatedSigner(from);

  const token = ERC20__factory.connect(tokenAddress, impersonator);
  await token.transfer(to, await token.balanceOf(from));
}

export function getTokens(
  signer: SignerWithAddress | ethers.providers.JsonRpcProvider
) {
  const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const COMPOUND_USDC_ADDRESS = "0x39AA39c021dfbaE8faC545936693aC917d5E7563";

  const DAI_ADDRESS = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
  const COMPOUND_DAI_ADDRESS = "0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643";

  const cdai = CToken__factory.connect(COMPOUND_DAI_ADDRESS, signer);
  const cusdc = CToken__factory.connect(COMPOUND_USDC_ADDRESS, signer);

  const dai = ERC20__factory.connect(DAI_ADDRESS, signer);
  const usdc = ERC20__factory.connect(USDC_ADDRESS, signer);

  return { cdai, cusdc, dai, usdc };
}
