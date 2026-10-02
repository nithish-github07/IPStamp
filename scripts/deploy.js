const hre = require("hardhat");

async function main() {
  console.log("Deploying contracts to network:", hre.network.name);

  const Registry = await hre.ethers.getContractFactory("IPContentRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();

  const License = await hre.ethers.getContractFactory("IPLicense");
  const license = await License.deploy(registryAddress);
  await license.waitForDeployment();
  const licenseAddress = await license.getAddress();

  console.log("\n Deployment Successful!");
  console.log("-----------------------------------------");
  console.log("IPContentRegistry Address :", registryAddress);
  console.log("IPLicense Address         :", licenseAddress);
  console.log("-----------------------------------------");
  console.log("\nNext Steps:");
  console.log("1. Update your root .env:");
  console.log(`   REGISTRY_ADDRESS=${registryAddress}`);
  console.log(`   LICENSE_ADDRESS=${licenseAddress}`);
  console.log("2. Update your frontend/.env:");
  console.log(`   VITE_CONTRACT_ADDRESS=${registryAddress}`);
  console.log(`   VITE_LICENSE_ADDRESS=${licenseAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
