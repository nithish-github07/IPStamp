const hre = require("hardhat");

async function main() {
  // Address of the deployed IPContentRegistry contract
  const contractAddress = process.env.REGISTRY_ADDRESS;
  if (!contractAddress) {
    console.error("Please set REGISTRY_ADDRESS in .env");
    process.exit(1);
  }

  // The hash of the file/content to verify (e.g. 0x123... or a string to hash)
  // For demo purposes, we can accept it via command line or use a dummy hash
  let contentHash = process.argv[2];
  if (!contentHash) {
    console.error("Usage: npx hardhat run scripts/verifyOwnership.js <0x_hash>");
    process.exit(1);
  }

  const Registry = await hre.ethers.getContractFactory("IPContentRegistry");
  const registry = Registry.attach(contractAddress);

  console.log(`Checking if content hash ${contentHash} exists...`);
  
  try {
    const [exists, tokenId, owner, timestamp] = await registry.verifyByHash(contentHash);

    if (exists) {
      const date = new Date(Number(timestamp) * 1000).toLocaleDateString("en-US", {
        year: 'numeric', month: 'long', day: 'numeric'
      });

      console.log(`\n✓ Content registered\n`);
      console.log(`Owner:\n${owner}\n`);
      console.log(`Registered:\n${date}\n`);
      
      const network = hre.network.name;
      console.log(`Blockchain:\n${network.charAt(0).toUpperCase() + network.slice(1)}\n`);
      console.log(`NFT:\n#${tokenId}\n`);
    } else {
      console.log("\n✗ Content not registered.\n");
    }
  } catch (error) {
    console.error("Error querying contract:", error.message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
