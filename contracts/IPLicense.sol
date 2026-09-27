// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IPContentRegistry.sol";

contract IPLicense is Ownable {
    IPContentRegistry public immutable registry;

    struct License {
        uint256 tokenId;
        address licensor;
        address licensee;
        uint256 startTime;
        uint256 endTime;
        uint256 maxUses;
        uint256 used;
        bool active;
    }

    uint256 private _nextLicenseId = 1;
    mapping(uint256 => License) public licenses;

    event LicenseCreated(uint256 indexed licenseId, uint256 indexed tokenId, address indexed licensee, uint256 endTime, uint256 maxUses);
    event LicenseUsed(uint256 indexed licenseId, uint256 used);
    event LicenseRevoked(uint256 indexed licenseId);

    constructor(address registryAddress) Ownable(msg.sender) {
        registry = IPContentRegistry(registryAddress);
    }

    function createLicense(uint256 tokenId, address licensee, uint256 durationSeconds, uint256 maxUses)
        external
        returns (uint256 licenseId)
    {
        require(registry.ownerOf(tokenId) == msg.sender, "Not token owner");
        require(licensee != address(0), "Invalid licensee");
        require(durationSeconds > 0 || maxUses > 0, "License must have a limit");

        uint256 endTime = durationSeconds == 0 ? 0 : block.timestamp + durationSeconds;
        licenseId = _nextLicenseId++;
        licenses[licenseId] = License(tokenId, msg.sender, licensee, block.timestamp, endTime, maxUses, 0, true);
        emit LicenseCreated(licenseId, tokenId, licensee, endTime, maxUses);
    }

    function useLicense(uint256 licenseId) external {
        License storage license = licenses[licenseId];
        require(license.active, "License inactive");
        require(msg.sender == license.licensee, "Not licensee");
        require(license.endTime == 0 || block.timestamp <= license.endTime, "License expired");
        require(license.maxUses == 0 || license.used < license.maxUses, "Usage limit reached");
        license.used++;
        emit LicenseUsed(licenseId, license.used);
    }

    function revokeLicense(uint256 licenseId) external {
        License storage license = licenses[licenseId];
        require(msg.sender == license.licensor, "Not licensor");
        license.active = false;
        emit LicenseRevoked(licenseId);
    }
}
