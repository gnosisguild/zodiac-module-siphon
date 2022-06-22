module.exports = {
  skipFiles: [
    "test/*",
    "test/TestAvatar.sol",
    "test/TestToken.sol",
    "test/TestContract.sol",
    "test/TestPluckParam.sol",
    "test/TestFactory.sol",
    "test/MultiSend.sol",
    "test/maker/DssProxy.sol",
    "test/maker/DssProxyActions.sol",
    "test/maker/Join.sol",
    "test/maker/mockCDPManager.sol",
    "test/maker/mockSpot.sol",
    "test/maker/mockVat.sol",
  ],
  mocha: {
    grep: "@skip-on-coverage", // Find everything with this tag
    invert: true, // Run the grep's inverse set.
  },
};
