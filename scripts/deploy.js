const hre = require("hardhat");

async function main() {
  const Registry = await hre.ethers.getContractFactory("IPContentRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();

  const License = await hre.ethers.getContractFactory("IPLicense");
  const license = await License.deploy(await registry.getAddress());
  await license.waitForDeployment();

  console.log("IPContentRegistry:", await registry.getAddress());
  console.log("IPLicense:", await license.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
