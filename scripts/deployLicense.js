const hre = require("hardhat");

async function main() {
  const registryAddress = process.env.REGISTRY_ADDRESS || "0x519411C1886B8f51bf4aF3b3B9A243A2Ac155BDC";
  console.log(`Deploying IPLicense on network: ${hre.network.name}`);
  console.log(`Connecting to IPContentRegistry at: ${registryAddress}`);

  const License = await hre.ethers.getContractFactory("IPLicense");
  const license = await License.deploy(registryAddress);
  
  console.log(`Deployment transaction submitted: ${license.deploymentTransaction().hash}`);
  console.log("Waiting for confirmation on Sepolia...");
  await license.waitForDeployment();

  const licenseAddress = await license.getAddress();
  console.log(`\n✓ IPLicense deployed successfully!`);
  console.log(`Contract Address: ${licenseAddress}`);
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
