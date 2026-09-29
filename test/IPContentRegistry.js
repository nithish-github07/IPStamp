const { expect } = require("chai");
const { ethers } = require("hardhat");

 describe("IPContentRegistry", function () {
  it("registers content and stores its timestamp/hash", async function () {
    const [creator] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("IPContentRegistry");
    const registry = await Factory.deploy();
    const hash = ethers.keccak256(ethers.toUtf8Bytes("hello ip"));

    await expect(registry.registerContent(hash, "bafy-demo-cid"))
      .to.emit(registry, "ContentRegistered");

    const record = await registry.records(1);
    expect(record.contentHash).to.equal(hash);
    expect(record.ipfsCid).to.equal("bafy-demo-cid");
    expect(record.creator).to.equal(creator.address);
    expect(record.timestamp).to.be.greaterThan(0);
  });

  it("calculates ERC-2981 royalty", async function () {
    const [creator] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("IPContentRegistry");
    const registry = await Factory.deploy();
    const hash = ethers.keccak256(ethers.toUtf8Bytes("royalty"));
    await registry.registerContent(hash, "cid");
    const result = await registry.royaltyInfo(1, 10000);
    expect(result[0]).to.equal(creator.address);
    expect(result[1]).to.equal(500);
  });

  it("verifies ownership of the registered content", async function () {
    const [creator, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("IPContentRegistry");
    const registry = await Factory.deploy();
    const hash = ethers.keccak256(ethers.toUtf8Bytes("ownership"));
    await registry.registerContent(hash, "bafy-ownership");
    
    // Check ownership verification
    const isOwner = await registry.verifyOwnership(1, creator.address);
    expect(isOwner).to.be.true;

    const isOtherOwner = await registry.verifyOwnership(1, other.address);
    expect(isOtherOwner).to.be.false;
  });
});
