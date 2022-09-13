require("@nomicfoundation/hardhat-toolbox");

const {
  INFURA_PROJECT_ID,
  PRIVATE_KEY,
} = process.env;

module.exports = {
  solidity: "0.8.17",
  networks: {
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${INFURA_PROJECT_ID}`,
      accounts: [PRIVATE_KEY]
    }
  }
};
