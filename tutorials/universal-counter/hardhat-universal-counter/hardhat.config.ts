import "dotenv/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";

const ACCOUNTS = process.env.PRIVATE_KEY
  ? [`${process.env.PRIVATE_KEY}`]
  : [];

export default {
  defaultNetwork: "hardhat",

  gasReporter: {
    enabled: false,
  },

  networks: {
    // ✅ Local testing network (IMPORTANT)
    hardhat: {
      chainId: 31337,
    },

    // 🌐 :contentReference[oaicite:0]{index=0}
    pushTestnet: {
      chainId: 42101,
      url: "https://evm.donut.rpc.push.org/",
      accounts: ACCOUNTS,
    },
  },

  etherscan: {
    apiKey: {
      pushTestnet: "NO_API_KEY_REQUIRED",
    },
    customChains: [
      {
        network: "pushTestnet",
        chainId: 42101,
        urls: {
          apiURL: "https://donut.push.network/api",
          browserURL: "https://donut.push.network",
        },
      },
    ],
  },

  sourcify: {
    enabled: false,
  },

  solidity: {
    version: "0.8.28",
    settings: {
      evmVersion: "paris",
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};