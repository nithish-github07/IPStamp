// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract IPContentRegistry is ERC721, IERC2981, Ownable {
    uint256 private _nextTokenId = 1;
    uint96 public royaltyBps = 500;

    struct ContentRecord {
        bytes32 contentHash;
        string ipfsCid;
        uint256 timestamp;
        address creator;
    }

    mapping(uint256 => ContentRecord) public records;

    event ContentRegistered(
        uint256 indexed tokenId,
        address indexed creator,
        bytes32 indexed contentHash,
        string ipfsCid,
        uint256 timestamp
    );

    constructor() ERC721("IP Content Ownership", "IPCO") Ownable(msg.sender) {}

    function registerContent(bytes32 contentHash, string calldata ipfsCid)
        external
        returns (uint256 tokenId)
    {
        require(contentHash != bytes32(0), "Invalid content hash");
        tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);
        records[tokenId] = ContentRecord(contentHash, ipfsCid, block.timestamp, msg.sender);
        emit ContentRegistered(tokenId, msg.sender, contentHash, ipfsCid, block.timestamp);
    }

    function setRoyaltyBps(uint96 newRoyaltyBps) external onlyOwner {
        require(newRoyaltyBps <= 1000, "Royalty too high");
        royaltyBps = newRoyaltyBps;
    }

    function verifyOwnership(uint256 tokenId, address user) external view returns (bool) {
        return ownerOf(tokenId) == user;
    }

    function royaltyInfo(uint256 tokenId, uint256 salePrice)
        external
        view
        override
        returns (address receiver, uint256 royaltyAmount)
    {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        receiver = ownerOf(tokenId);
        royaltyAmount = (salePrice * royaltyBps) / 10_000;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, IERC165)
        returns (bool)
    {
        return interfaceId == type(IERC2981).interfaceId || super.supportsInterface(interfaceId);
    }
}
