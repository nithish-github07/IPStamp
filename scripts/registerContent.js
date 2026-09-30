const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const contractAddress = process.env.REGISTRY_ADDRESS;
  if (!contractAddress) {
    console.error("Please set REGISTRY_ADDRESS in .env");
    process.exit(1);
  }

  // Get the string to "register" from command line, default to "my-test-file"
  const fileString = process.argv[2] || "my-test-file";
  
  // Calculate the hash of the string (Simulating hashing a file)
  const contentHash = ethers.keccak256(ethers.toUtf8Bytes(fileString));
  const dummyCid = "ipfs://bafybeidummy..."; // Simulating IPFS upload

  console.log(`\nSimulating file: "${fileString}"`);
  console.log(`Calculated Hash: ${contentHash}`);

  const Registry = await hre.ethers.getContractFactory("IPContentRegistry");
  const registry = Registry.attach(contractAddress);

  console.log(`\nRegistering content on blockchain...`);
  
  try {
    const tx = await registry.registerContent(contentHash, dummyCid);
    console.log(`Transaction sent: ${tx.hash}`);
    await tx.wait();
    console.log(`✓ Registration successful!\n`);
    console.log(`To verify, run:\nnpx hardhat run scripts/verifyOwnership.js ${contentHash}`);
  } catch (error) {
    console.error("Registration failed:", error.message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
