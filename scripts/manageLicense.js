const hre = require("hardhat");

async function main() {
  const licenseAddress = process.env.LICENSE_ADDRESS;
  if (!licenseAddress) {
    console.error("Please set LICENSE_ADDRESS in .env");
    process.exit(1);
  }

  const [signer] = await hre.ethers.getSigners();
  const License = await hre.ethers.getContractFactory("IPLicense");
  const licenseContract = License.attach(licenseAddress);

  const command = process.argv[2]; // 'view' or 'set' or 'check-license'
  const parentTokenId = process.argv[3] || "1";

  if (command === "set") {
    // Usage: npx hardhat run scripts/manageLicense.js set <parentTokenId> <priceInEth> <durationInDays> <maxUses> <licenseType>
    const priceEth = process.argv[4] || "0.01";
    const durationDays = parseInt(process.argv[5] || "30", 10);
    const maxUses = parseInt(process.argv[6] || "10", 10);
    const licenseType = parseInt(process.argv[7] || "1", 10); // 0=Personal, 1=Commercial, 2=Exclusive

    const priceWei = hre.ethers.parseEther(priceEth);
    const durationSeconds = durationDays * 24 * 60 * 60;

    console.log(`Setting licensing terms for Token #${parentTokenId}...`);
    console.log(`- Price: ${priceEth} ETH`);
    console.log(`- Duration: ${durationDays} days`);
    console.log(`- Max Uses: ${maxUses}`);
    console.log(`- Type: ${licenseType === 1 ? "Commercial" : licenseType === 0 ? "Personal" : "Exclusive"}`);

    const tx = await licenseContract.setListingTerms(
      parentTokenId,
      priceWei,
      durationSeconds,
      maxUses,
      licenseType,
      true
    );
    await tx.wait();
    console.log(`✓ Licensing terms active! Tx: ${tx.hash}`);
  } else if (command === "check-license") {
    // Usage: npx hardhat run scripts/manageLicense.js check-license <licenseTokenId>
    const licenseId = process.argv[3] || "1";
    console.log(`Checking License NFT #${licenseId}...`);

    const owner = await licenseContract.ownerOf(licenseId);
    const isValid = await licenseContract.isLicenseValid(licenseId);
    const data = await licenseContract.getLicense(licenseId);

    console.log("\n--- License Details ---");
    console.log(`License NFT ID : #${licenseId}`);
    console.log(`Owner          : ${owner}`);
    console.log(`Parent IP ID   : #${data.parentTokenId}`);
    console.log(`Licensor       : ${data.licensor}`);
    console.log(`Status         : ${isValid ? "✓ Active / Valid" : "✗ Inactive / Expired / Exhausted"}`);
    console.log(`Used Count     : ${data.used} / ${data.maxUses === 0n ? "Unlimited" : data.maxUses}`);
    console.log(`Expires        : ${data.endTime === 0n ? "Perpetual" : new Date(Number(data.endTime) * 1000).toLocaleString()}`);
  } else {
    // Default: view listing terms
    console.log(`Fetching listing terms for Parent Token #${parentTokenId}...`);
    const terms = await licenseContract.listings(parentTokenId);
    console.log("\n--- Listing Terms ---");
    console.log(`Parent Token ID : #${parentTokenId}`);
    console.log(`Active          : ${terms.active ? "Yes" : "No"}`);
    console.log(`Price           : ${hre.ethers.formatEther(terms.price)} ETH`);
    console.log(`Duration (days) : ${Number(terms.duration) / 86400}`);
    console.log(`Max Uses        : ${terms.maxUses.toString()}`);
    console.log(`License Type    : ${terms.licenseType === 1 ? "Commercial" : terms.licenseType === 0 ? "Personal" : "Exclusive"}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
