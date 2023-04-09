import { ethers } from "ethers";
import { DefenderRelaySigner, DefenderRelayProvider } from "defender-relay-client/lib/ethers";

// Definition for Siphon functions we need
const ABI = [{"inputs": [{"internalType": "bytes","name": "performData","type": "bytes"}],"name": "performUpkeep","outputs": [],"stateMutability": "nonpayable","type": "function"},{"inputs": [{"internalType": "bytes","name": "checkData","type": "bytes"}],"name": "checkUpkeep","outputs": [{"internalType": "bool","name": "upkeepNeeded","type": "bool"},{"internalType": "bytes","name": "performData","type": "bytes"}],"stateMutability": "nonpayable","type": "function"}]
// address of siphon deployment
const Address = '';
// bytes of the tube identifier
const tube = '';

// Work on job if it's needed using a Defender relay signer
async function workIfNeeded(signer, address) {
  const contract = new ethers.Contract(address, ABI, signer);
  if (await contract.checkUpkeep(tube)) {
    console.log(`Job is workable`);
    const tx = await contract.performUpkeep(tube);
    console.log(`Job worked: ${tx.hash}`);
  } else {
    console.log(`Job is not workable`);
  }
}

// Entrypoint for the Autotask
exports.handler = async function(credentials) {
  const provider = new DefenderRelayProvider(credentials);;
  const signer = new DefenderRelaySigner(credentials, provider, { speed: 'fastest' });
  await workIfNeeded(signer, Address);
}

// Unit testing
exports.main = workIfNeeded;

// To run locally (this code will not be executed in Autotasks)
if (require.main === module) {
  require('dotenv').config();
  const { API_KEY: apiKey, API_SECRET: apiSecret } = process.env;
  exports.handler({ apiKey, apiSecret })
    .then(() => process.exit(0))
    .catch(error => { console.error(error); process.exit(1); });
}
