import hre from "hardhat";
import { writeFileSync, mkdirSync } from "node:fs";

async function main() {
  const Factory = await hre.ethers.getContractFactory("SecretRegistry");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const addr = await contract.getAddress();
  
  mkdirSync("deployments", { recursive: true });
  const path = `deployments/${hre.network.name}.json`;
  writeFileSync(path, JSON.stringify({ SecretRegistry: addr }, null, 2));
}

main().catch(() => process.exit(1));
