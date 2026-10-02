const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("IPLicense Contract", function () {
  let registry;
  let licenseContract;
  let creator, buyer, licensee, otherUser;
  let parentTokenId;

  beforeEach(async function () {
    [creator, buyer, licensee, otherUser] = await ethers.getSigners();

    // Deploy IPContentRegistry
    const RegistryFactory = await ethers.getContractFactory("IPContentRegistry");
    registry = await RegistryFactory.deploy();

    // Deploy IPLicense
    const LicenseFactory = await ethers.getContractFactory("IPLicense");
    licenseContract = await LicenseFactory.deploy(await registry.getAddress());

    // Register IP content under creator
    const contentHash = ethers.keccak256(ethers.toUtf8Bytes("Sample IP Asset"));
    const tx = await registry.connect(creator).registerContent(contentHash, "ipfs://bafy-test-asset");
    await tx.wait();
    parentTokenId = 1;
  });

  describe("Listing Terms Configuration", function () {
    it("allows the parent IP owner to configure listing terms", async function () {
      const price = ethers.parseEther("0.05");
      const duration = 30 * 24 * 60 * 60; // 30 days
      const maxUses = 100;
      const licenseType = 1; // COMMERCIAL

      await expect(
        licenseContract.connect(creator).setListingTerms(
          parentTokenId,
          price,
          duration,
          maxUses,
          licenseType,
          true
        )
      )
        .to.emit(licenseContract, "LicenseTermsUpdated")
        .withArgs(parentTokenId, price, duration, maxUses, licenseType, true);

      const listing = await licenseContract.listings(parentTokenId);
      expect(listing.price).to.equal(price);
      expect(listing.duration).to.equal(duration);
      expect(listing.maxUses).to.equal(maxUses);
      expect(listing.licenseType).to.equal(licenseType);
      expect(listing.active).to.be.true;
    });

    it("prevents non-owners of parent IP from setting terms", async function () {
      const price = ethers.parseEther("0.05");
      await expect(
        licenseContract.connect(otherUser).setListingTerms(parentTokenId, price, 0, 0, 0, true)
      ).to.be.revertedWith("Not parent token owner");
    });
  });

  describe("Payable License Purchasing (buyLicense)", function () {
    const price = ethers.parseEther("0.1");
    const duration = 7 * 24 * 60 * 60; // 7 days
    const maxUses = 10;
    const licenseType = 1; // COMMERCIAL

    beforeEach(async function () {
      await licenseContract.connect(creator).setListingTerms(
        parentTokenId,
        price,
        duration,
        maxUses,
        licenseType,
        true
      );
    });

    it("mints a License NFT to buyer and transfers ETH to the IP creator", async function () {
      const creatorBalBefore = await ethers.provider.getBalance(creator.address);

      const tx = await licenseContract.connect(buyer).buyLicense(parentTokenId, {
        value: price,
      });

      await expect(tx).to.emit(licenseContract, "LicensePurchased");

      // Verify License NFT was minted to buyer
      const licenseNftOwner = await licenseContract.ownerOf(1);
      expect(licenseNftOwner).to.equal(buyer.address);

      // Verify ETH transferred to creator
      const creatorBalAfter = await ethers.provider.getBalance(creator.address);
      expect(creatorBalAfter - creatorBalBefore).to.equal(price);

      // Verify stored license details
      const lic = await licenseContract.getLicense(1);
      expect(lic.parentTokenId).to.equal(parentTokenId);
      expect(lic.licensor).to.equal(creator.address);
      expect(lic.maxUses).to.equal(maxUses);
      expect(lic.licenseType).to.equal(licenseType);
      expect(lic.active).to.be.true;
    });

    it("refunds excess ETH sent by the buyer", async function () {
      const sentValue = ethers.parseEther("0.2"); // 0.1 ETH extra
      const buyerBalBefore = await ethers.provider.getBalance(buyer.address);

      const tx = await licenseContract.connect(buyer).buyLicense(parentTokenId, {
        value: sentValue,
      });
      const receipt = await tx.wait();
      const gasSpent = receipt.gasUsed * receipt.gasPrice;

      const buyerBalAfter = await ethers.provider.getBalance(buyer.address);
      // Net loss for buyer should only be price + gas
      expect(buyerBalBefore - buyerBalAfter).to.be.closeTo(price + gasSpent, ethers.parseEther("0.0001"));
    });

    it("reverts if payment is insufficient", async function () {
      await expect(
        licenseContract.connect(buyer).buyLicense(parentTokenId, {
          value: ethers.parseEther("0.05"),
        })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("reverts if licensing is not active", async function () {
      // Deactivate listing
      await licenseContract.connect(creator).setListingTerms(parentTokenId, price, duration, maxUses, licenseType, false);

      await expect(
        licenseContract.connect(buyer).buyLicense(parentTokenId, { value: price })
      ).to.be.revertedWith("Licensing not active for this IP");
    });
  });

  describe("Direct License Grant (createLicense)", function () {
    it("allows the IP owner to directly issue a License NFT", async function () {
      const duration = 86400; // 1 day
      const maxUses = 5;

      const tx = await licenseContract.connect(creator).createLicense(
        parentTokenId,
        licensee.address,
        duration,
        maxUses,
        0 // PERSONAL
      );

      await expect(tx).to.emit(licenseContract, "LicenseCreated");

      // Verify NFT minted directly to licensee
      expect(await licenseContract.ownerOf(1)).to.equal(licensee.address);
    });

    it("prevents non-owners from issuing direct licenses", async function () {
      await expect(
        licenseContract.connect(otherUser).createLicense(parentTokenId, licensee.address, 3600, 1, 0)
      ).to.be.revertedWith("Not parent token owner");
    });
  });

  describe("License Usage & Validity Tracking", function () {
    beforeEach(async function () {
      // Grant a 3-use license with 1000s duration
      await licenseContract.connect(creator).createLicense(parentTokenId, licensee.address, 1000, 3, 0);
    });

    it("validates and tracks usage increments by the license holder", async function () {
      expect(await licenseContract.isLicenseValid(1)).to.be.true;

      await expect(licenseContract.connect(licensee).useLicense(1))
        .to.emit(licenseContract, "LicenseUsed")
        .withArgs(1, 1);

      let lic = await licenseContract.getLicense(1);
      expect(lic.used).to.equal(1);

      // Use remaining 2 times
      await licenseContract.connect(licensee).useLicense(1);
      await licenseContract.connect(licensee).useLicense(1);

      lic = await licenseContract.getLicense(1);
      expect(lic.used).to.equal(3);

      // Exceeded limit: isLicenseValid returns false and useLicense reverts
      expect(await licenseContract.isLicenseValid(1)).to.be.false;
      await expect(licenseContract.connect(licensee).useLicense(1)).to.be.revertedWith(
        "License is expired, exhausted, or inactive"
      );
    });

    it("rejects usage attempts by non-holders of the License NFT", async function () {
      await expect(licenseContract.connect(otherUser).useLicense(1)).to.be.revertedWith(
        "Not license NFT owner"
      );
    });

    it("marks license invalid when expired", async function () {
      // Fast forward time past expiration
      await ethers.provider.send("evm_increaseTime", [1001]);
      await ethers.provider.send("evm_mine");

      expect(await licenseContract.isLicenseValid(1)).to.be.false;
      await expect(licenseContract.connect(licensee).useLicense(1)).to.be.revertedWith(
        "License is expired, exhausted, or inactive"
      );
    });
  });

  describe("Revocation", function () {
    beforeEach(async function () {
      await licenseContract.connect(creator).createLicense(parentTokenId, licensee.address, 10000, 10, 1);
    });

    it("allows the IP owner to revoke the license", async function () {
      await expect(licenseContract.connect(creator).revokeLicense(1))
        .to.emit(licenseContract, "LicenseRevoked")
        .withArgs(1);

      expect(await licenseContract.isLicenseValid(1)).to.be.false;
      const lic = await licenseContract.getLicense(1);
      expect(lic.active).to.be.false;
    });

    it("prevents unauthorized users from revoking licenses", async function () {
      await expect(licenseContract.connect(otherUser).revokeLicense(1)).to.be.revertedWith(
        "Not authorized to revoke"
      );
    });
  });
});
