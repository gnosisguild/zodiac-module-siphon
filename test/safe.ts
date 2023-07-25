import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumberish, PopulatedTransaction } from "ethers";
import hre from "hardhat";

import { SafeMock__factory } from "../typechain-types";

type ExecTransactionParams = {
  to: string;
  data: string;
  value: BigNumberish;
  operation: BigNumberish;
};

const AddressZero = "0x0000000000000000000000000000000000000000";

export async function highjack(safeAddress: string, newOwner: string) {
  const safe = SafeMock__factory.connect(safeAddress, hre.ethers.provider);

  const { data } = await safe.populateTransaction.addOwnerWithThreshold(
    newOwner,
    1
  );

  const impersonator = await hre.ethers.getImpersonatedSigner(safeAddress);

  await impersonator.sendTransaction({
    to: safeAddress,
    from: safeAddress,
    data,
    value: 0,
  });

  return safe;
}

export async function execPopulatedTransaction(
  safeAddress: string,
  tx: PopulatedTransaction,
  signer: SignerWithAddress
) {
  return execTransaction(
    safeAddress,
    {
      to: tx.to as string,
      value: tx.value || 0,
      data: tx.data as string,
      operation: 0,
    },
    signer
  );
}

async function execTransaction(
  safeAddress: string,
  { to, value, data, operation }: ExecTransactionParams,
  signer: SignerWithAddress
) {
  const safe = SafeMock__factory.connect(safeAddress, signer);

  const signature = await sign(
    safeAddress,
    { to, value, data, operation },
    await safe.nonce(),
    signer
  );

  const tx = await safe.populateTransaction.execTransaction(
    to as string,
    value || 0,
    data as string,
    operation,
    0,
    0,
    0,
    AddressZero,
    AddressZero,
    signature
  );

  return signer.sendTransaction(tx);
}

export function sign(
  safeAddress: string,
  { to, value, data, operation }: ExecTransactionParams,
  nonce: BigNumberish,
  signer: SignerWithAddress
): Promise<string> {
  const domain = {
    verifyingContract: safeAddress,
    chainId: 31337,
  };
  const types = {
    SafeTx: [
      { type: "address", name: "to" },
      { type: "uint256", name: "value" },
      { type: "bytes", name: "data" },
      { type: "uint8", name: "operation" },
      { type: "uint256", name: "safeTxGas" },
      { type: "uint256", name: "baseGas" },
      { type: "uint256", name: "gasPrice" },
      { type: "address", name: "gasToken" },
      { type: "address", name: "refundReceiver" },
      { type: "uint256", name: "nonce" },
    ],
  };
  const message = {
    to,
    value,
    data,
    operation,
    safeTxGas: 0,
    baseGas: 0,
    gasPrice: 0,
    gasToken: AddressZero,
    refundReceiver: AddressZero,
    nonce: nonce,
  };

  return signer._signTypedData(domain, types, message);
}
