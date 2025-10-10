import { HardhatUserConfig } from "hardhat/config"; 
import "@nomicfoundation/hardhat-toolbox"; 
import * as dotenv from "dotenv"; 
dotenv.config(); 

const config: HardhatUserConfig = { 
  solidity: "0.8.20", 
  networks: { 
    sepolia: { 
      url: process.env.SEPOLIA_RPC_URL || "", 
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [], 
      chainId: 11155111, 
      timeout: 120000, 
    } 
  } 
}; 
export default config;
/*require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: "0.8.20",
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11155111,
      timeout: 120000,
    },
  },
};*/
