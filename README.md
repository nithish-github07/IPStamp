# IPStamp

> A decentralized blockchain platform for registering, verifying, and licensing Intellectual Property on Ethereum.

---

## Description

**IPStamp** is a full-stack Web3 application that empowers creators to permanently register their digital work on the Ethereum Sepolia blockchain as proof of ownership — and optionally monetize it through an on-chain licensing marketplace.

When you register a file, its SHA-256 fingerprint is written to an immutable smart contract (ERC-721 NFT), creating a tamper-proof, timestamped record that proves you were first. You can then set licensing terms (price, duration, license type) and let anyone on the marketplace buy a License NFT (another ERC-721 token) that grants them documented, verifiable rights to use your work.

No central authority controls the data — everything lives on-chain.

---

## How to Run Locally

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [MetaMask](https://metamask.io/) browser extension
- Sepolia testnet ETH (get some from a [faucet](https://sepoliafaucet.com/))
- A [Pinata](https://pinata.cloud/) account (for IPFS pinning)

### 1. Clone & Install Dependencies

```bash
git clone <your-repo-url>
cd Intellectual-Property-Registration-and-Licensing-Platform

# Install root (Hardhat) dependencies
npm install

# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Configure Environment Variables

**Root `.env`** (for Hardhat deployment):
```env
SEPOLIA_URL=https://ethereum-sepolia-rpc.publicnode.com
PRIVATE_KEY=your_metamask_wallet_private_key
```

**`backend/.env`**:
```env
PINATA_JWT=your_pinata_jwt_token
FRONTEND_ORIGIN=http://localhost:5173
PORT=4000
GATEWAY_URL=https://gateway.pinata.cloud/ipfs
```

**`frontend/.env`**:
```env
VITE_BACKEND_URL=http://localhost:4000
VITE_CONTRACT_ADDRESS=your_deployed_registry_contract_address
VITE_LICENSE_ADDRESS=your_deployed_license_contract_address
```

### 3. Deploy Smart Contracts (Only Once)

> **Important:** Only run this step once. Redeploying creates a brand-new contract and all previously registered IPs will not appear under the new address. Your old data remains on-chain but will be inaccessible from the new contract.

```bash
npx hardhat compile
npx hardhat run scripts/deploy.js --network sepolia
```

Copy the printed contract addresses into your `frontend/.env` as shown in step 2.

### 4. Start the App

Open **two separate terminals**:

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser and connect your MetaMask wallet on the **Sepolia Testnet**.

---

## Tech Stack

```
  Layer              Technology
  ─────────────────────────────────────────────────────
  Blockchain         Ethereum (Sepolia Testnet)
  Smart Contracts    Solidity ^0.8.24
  Contract Library   OpenZeppelin (ERC-721, ERC-2981)
  Contract Dev       Hardhat, ethers.js v6
  ─────────────────────────────────────────────────────
  Frontend           React 19, Vite
  Wallet Integration MetaMask  (window.ethereum / ethers.js)
  ─────────────────────────────────────────────────────
  Backend            Node.js, Express.js
  File Storage       IPFS via Pinata
  ─────────────────────────────────────────────────────
  Hashing            SHA-256 (Browser WebCrypto API)
  Network RPC        publicnode.com  (Sepolia JSON-RPC)
  ─────────────────────────────────────────────────────
```

---

## Application Flow
```
┌─────────────┐     Upload file      ┌─────────────┐    Pin to IPFS    ┌───────────────┐
│   Creator   │ ──────────────────►  │   Backend   │ ────────────────► │  Pinata/IPFS  │
│  (MetaMask) │                      │  (Express)  │ ◄──────────────── │               │
└─────────────┘                      └─────────────┘   Return CID      └───────────────┘
       │                                    │
       │  SHA-256 hash computed             │  CID returned to frontend
       │  in browser (WebCrypto)            │
       ▼                                    ▼
┌────────────────────────────────────────────────┐
│               Frontend (React + Vite)          │
│                                                │
│  1. Register tab  → registerContent(hash, CID) │
│  2. Portfolio tab → view your IPCO NFTs        │
│  3. Marketplace   → browse & buy licenses      │
│  4. My Licenses   → view your IPLIC NFTs       │
│  5. Verify tab    → verify any file on-chain   │
└─────────────────────────────┬──────────────────┘
                              │  ethers.js (wallet transaction)
                              ▼
┌─────────────────────────────────────────────────┐
│          Ethereum Sepolia Blockchain             │
│                                                 │
│  ┌───────────────────────┐                      │
│  │  IPContentRegistry    │  ERC-721 "IPCO"      │
│  │  - registerContent()  │  Mints ownership NFT │
│  │  - verifyByHash()     │  Timestamped record  │
│  │  - royaltyInfo()      │  ERC-2981 royalties  │
│  └───────────────────────┘                      │
│             │                                   │
│             ▼                                   │
│  ┌───────────────────────┐                      │
│  │     IPLicense         │  ERC-721 "IPLIC"     │
│  │  - setListingTerms()  │  Creator sets price  │
│  │  - buyLicense()       │  Buyer pays → NFT    │
│  │  - revokeLicense()    │  Creator can revoke  │
│  │  - useLicense()       │  Record usage on-chain│
│  └───────────────────────┘                      │
└─────────────────────────────────────────────────┘
```
---

## Features

- **IP Registration** — A file's SHA-256 fingerprint is minted as an ERC-721 NFT (IPCO), creating a permanent, timestamped proof of ownership on Sepolia.
- **Duplicate Detection** — Before submitting a transaction, the app checks if a file is already registered and alerts the creator immediately.
- **Licensing Marketplace** — Creators set a price, duration, and license type (Personal / Commercial / Exclusive). Buyers pay in ETH directly and receive a License NFT (IPLIC).
- **On-Chain Verification** — Anyone can upload a file to instantly verify its registration status, owner address, and timestamp without needing a wallet.
- **License Lifecycle Management** — Licensees can use their license rights on-chain (tracking usage count), and IP owners can revoke licenses if terms are breached.
- **IPFS File Storage** — The original file is pinned to IPFS via Pinata so it can always be retrieved using the CID stored in the NFT record.

---

## Future Enhancements

- **Multi-chain support** — Deploy on Polygon or Base for significantly lower gas fees while keeping the same contract logic.
- **Token-gated content** — License NFT holders automatically gain access to gated download links, APIs, or exclusive content without any off-chain verification step.
- **Creator analytics dashboard** — Track total licenses sold, cumulative revenue, and per-license usage statistics from a single view.
- **ERC-721 metadata standard** — Adopt the standard metadata JSON format so registered IP NFTs appear correctly in wallets and marketplaces like OpenSea.
