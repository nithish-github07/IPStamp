// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./IPContentRegistry.sol";

/**
 * @title IPLicense
 * @notice Issues and manages ERC-721 License NFTs linked to registered IP in IPContentRegistry.
 * Allows IP creators to set licensing terms and buyers to purchase licenses with ETH.
 */
contract IPLicense is ERC721, Ownable {
    IPContentRegistry public immutable registry;

    enum LicenseType {
        PERSONAL,
        COMMERCIAL,
        EXCLUSIVE
    }

    struct LicenseTerms {
        uint256 price;          // Price in wei to buy the license
        uint256 duration;       // Validity duration in seconds (0 = perpetual)
        uint256 maxUses;        // Max usage count allowed (0 = unlimited)
        LicenseType licenseType;
        bool active;            // Whether license is open for purchase
    }

    struct License {
        uint256 parentTokenId;  // IPContentRegistry NFT token ID
        address licensor;       // Original creator/licensor at time of issue
        uint256 startTime;      // Timestamp when license was minted
        uint256 endTime;        // Expiration timestamp (0 = never expires)
        uint256 maxUses;        // Max allowed uses (0 = unlimited)
        uint256 used;           // Total times used
        LicenseType licenseType;
        bool active;            // Active status (false if revoked)
    }

    uint256 private _nextLicenseId = 1;

    // parentTokenId => public listing terms set by IP owner
    mapping(uint256 => LicenseTerms) public listings;

    // licenseTokenId => License details
    mapping(uint256 => License) public licenses;

    // Events
    event LicenseTermsUpdated(
        uint256 indexed parentTokenId,
        uint256 price,
        uint256 duration,
        uint256 maxUses,
        LicenseType licenseType,
        bool active
    );

    event LicensePurchased(
        uint256 indexed licenseId,
        uint256 indexed parentTokenId,
        address indexed licensee,
        address licensor,
        uint256 pricePaid,
        uint256 endTime,
        LicenseType licenseType
    );

    event LicenseCreated(
        uint256 indexed licenseId,
        uint256 indexed parentTokenId,
        address indexed licensee,
        uint256 endTime,
        uint256 maxUses,
        LicenseType licenseType
    );

    event LicenseUsed(uint256 indexed licenseId, uint256 usedCount);
    event LicenseRevoked(uint256 indexed licenseId);

    constructor(address registryAddress)
        ERC721("IP License Rights", "IPLIC")
        Ownable(msg.sender)
    {
        require(registryAddress != address(0), "Invalid registry address");
        registry = IPContentRegistry(registryAddress);
    }

    /**
     * @notice Set or update licensing terms for an IP content NFT.
     * @dev Only the current owner of the parent IP token in IPContentRegistry can set terms.
     */
    function setListingTerms(
        uint256 parentTokenId,
        uint256 price,
        uint256 duration,
        uint256 maxUses,
        LicenseType licenseType,
        bool active
    ) external {
        require(registry.ownerOf(parentTokenId) == msg.sender, "Not parent token owner");

        listings[parentTokenId] = LicenseTerms({
            price: price,
            duration: duration,
            maxUses: maxUses,
            licenseType: licenseType,
            active: active
        });

        emit LicenseTermsUpdated(parentTokenId, price, duration, maxUses, licenseType, active);
    }

    /**
     * @notice Purchase a License NFT by paying the required ETH fee.
     * @dev Funds are transferred directly to the parent IP owner; excess ETH is refunded.
     */
    function buyLicense(uint256 parentTokenId) external payable returns (uint256 licenseId) {
        LicenseTerms memory terms = listings[parentTokenId];
        require(terms.active, "Licensing not active for this IP");
        require(msg.value >= terms.price, "Insufficient payment");

        address ipOwner = registry.ownerOf(parentTokenId);
        require(ipOwner != address(0), "Parent IP does not exist");

        licenseId = _nextLicenseId++;
        uint256 endTime = terms.duration == 0 ? 0 : block.timestamp + terms.duration;

        licenses[licenseId] = License({
            parentTokenId: parentTokenId,
            licensor: ipOwner,
            startTime: block.timestamp,
            endTime: endTime,
            maxUses: terms.maxUses,
            used: 0,
            licenseType: terms.licenseType,
            active: true
        });

        _safeMint(msg.sender, licenseId);

        // Pay licensor
        if (terms.price > 0) {
            (bool success, ) = payable(ipOwner).call{value: terms.price}("");
            require(success, "ETH transfer to licensor failed");
        }

        // Refund excess payment
        if (msg.value > terms.price) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: msg.value - terms.price}("");
            require(refundSuccess, "Refund of excess ETH failed");
        }

        emit LicensePurchased(
            licenseId,
            parentTokenId,
            msg.sender,
            ipOwner,
            terms.price,
            endTime,
            terms.licenseType
        );
    }

    /**
     * @notice Direct license issuance (gift/grant) without requiring payment.
     * @dev Only the owner of the parent IP token can issue a direct license.
     */
    function createLicense(
        uint256 parentTokenId,
        address licensee,
        uint256 durationSeconds,
        uint256 maxUses,
        LicenseType licenseType
    ) external returns (uint256 licenseId) {
        require(registry.ownerOf(parentTokenId) == msg.sender, "Not parent token owner");
        require(licensee != address(0), "Invalid licensee");

        licenseId = _nextLicenseId++;
        uint256 endTime = durationSeconds == 0 ? 0 : block.timestamp + durationSeconds;

        licenses[licenseId] = License({
            parentTokenId: parentTokenId,
            licensor: msg.sender,
            startTime: block.timestamp,
            endTime: endTime,
            maxUses: maxUses,
            used: 0,
            licenseType: licenseType,
            active: true
        });

        _safeMint(licensee, licenseId);

        emit LicenseCreated(
            licenseId,
            parentTokenId,
            licensee,
            endTime,
            maxUses,
            licenseType
        );
    }

    /**
     * @notice Check whether a given license is currently active and within valid time / usage limits.
     */
    function isLicenseValid(uint256 licenseId) public view returns (bool) {
        if (_ownerOf(licenseId) == address(0)) {
            return false;
        }

        License memory lic = licenses[licenseId];
        if (!lic.active) {
            return false;
        }
        if (lic.endTime != 0 && block.timestamp > lic.endTime) {
            return false;
        }
        if (lic.maxUses != 0 && lic.used >= lic.maxUses) {
            return false;
        }

        return true;
    }

    /**
     * @notice Use a license entitlement (e.g. download, commercial print, API access).
     * @dev Only the holder of the License NFT can use it.
     */
    function useLicense(uint256 licenseId) external {
        require(ownerOf(licenseId) == msg.sender, "Not license NFT owner");
        require(isLicenseValid(licenseId), "License is expired, exhausted, or inactive");

        License storage lic = licenses[licenseId];
        lic.used++;

        emit LicenseUsed(licenseId, lic.used);
    }

    /**
     * @notice Revoke a license.
     * @dev Can be revoked by the parent IP owner if terms are breached.
     */
    function revokeLicense(uint256 licenseId) external {
        require(_ownerOf(licenseId) != address(0), "License does not exist");
        License storage lic = licenses[licenseId];
        address ipOwner = registry.ownerOf(lic.parentTokenId);
        require(msg.sender == ipOwner || msg.sender == owner(), "Not authorized to revoke");

        lic.active = false;
        emit LicenseRevoked(licenseId);
    }

    /**
     * @notice Retrieve full license data by token ID.
     */
    function getLicense(uint256 licenseId) external view returns (License memory) {
        require(_ownerOf(licenseId) != address(0), "License does not exist");
        return licenses[licenseId];
    }
}
