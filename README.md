# Intellectual Property Registration and Licensing Platform

A decentralized Web3 platform for registering digital content ownership evidence on-chain and licensing usage rights through smart contracts.

---

## Architecture Overview

The platform is powered by two interoperable smart contracts and a modern React dApp:

1. **`IPContentRegistry.sol` (ERC-721 + ERC-2981):**
   - Mints an Ownership NFT for every piece of content registered with a SHA-256 hash.
   - Preserves immutable registration timestamps and optional IPFS CIDs.
   - Enforces creator royalties using the ERC-2981 standard.

2. **`IPLicense.sol` (ERC-721 License NFTs):**
   - Mints tradeable, verifiable **License NFTs** (`IPLIC`) linked to the parent IP token.
   - Supports creator-configured licensing terms: ETH price, duration (perpetual or time-bound), max usage quotas, and license types (`Personal`, `Commercial`, `Exclusive`).
   - Includes a **payable `buyLicense` function** that mints the License NFT to the buyer and automatically routes the purchase fee directly to the original IP creator.
   - Tracks on-chain license validity (`isLicenseValid`), usage increments (`useLicense`), and revocation rights (`revokeLicense`).

---

## How to Run and Test (Sepolia Testnet)

Follow these steps to deploy and run the entire platform.

### 1. Configure the Environment
1. In the main project directory, configure your root `.env` (using `.env.example` as a template):
   ```env
   SEPOLIA_URL=https://ethereum-sepolia-rpc.publicnode.com
   PRIVATE_KEY=your_metamask_private_key_here
   REGISTRY_ADDRESS=
   LICENSE_ADDRESS=
   ```
2. Install dependencies and compile the smart contracts:
   ```bash
   npm install
   npx hardhat compile
   ```

### 2. Run the Automated Smart Contract Test Suite
Verify that all 16 unit tests for registration, royalties, and licensing pass:
```bash
npx hardhat test
```

### 3. Deploy to Sepolia
Run the unified deployment script to deploy both `IPContentRegistry` and `IPLicense`:
```bash
npx hardhat run scripts/deploy.js --network sepolia
```

The script will output the deployed contract addresses:
- `IPContentRegistry Address`
- `IPLicense Address`

Copy these addresses into your root `.env` and `frontend/.env`.

### 4. Configure and Launch the Frontend
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   npm install
   ```
2. Ensure `frontend/.env` is set:
   ```env
   VITE_CONTRACT_ADDRESS=your_deployed_registry_address
   VITE_LICENSE_ADDRESS=your_deployed_license_address
   ```
3. Start the Vite dev server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:5173](http://localhost:5173) in your browser and connect MetaMask on the **Sepolia** network.

---

## Application Flow

### 1. Register & Verify IP Content
- **Register Content:** Under the **Registration & Proof** tab, choose any file. The dApp locally computes its SHA-256 hash in the browser. Click **Register On-Chain** to mint your IP ownership NFT.
- **Verify Ownership:** In the verification panel, select the exact same file and click **Verify On Blockchain**. The dApp checks the smart contract and displays the owner address, token ID, timestamp, and IPFS link.

### 2. Configure Licensing Terms (Creators)
- Switch to the **Creator Terms** tab.
- Enter your registered IP Token ID (e.g. `1`).
- Set your license parameters:
  - **Price:** ETH fee (e.g. `0.01` ETH).
  - **Duration:** Validity in days (`0` for perpetual).
  - **Max Uses:** Usage cap (`0` for unlimited).
  - **License Type:** Personal, Commercial, or Exclusive.
- Check **Make License Active for Purchase** and click **Publish Licensing Terms**.

### 3. Purchase a License NFT (Buyers)
- Switch to the **Licensing Marketplace** tab.
- Enter the IP Token ID and click **Inspect Terms** to review terms and pricing.
- Click **Purchase License NFT** to submit the payable transaction. Upon confirmation, MetaMask transfers the payment to the creator and mints a License NFT to your wallet!

### 4. Verify & Use License Rights
- Switch to the **Verify & Use Licenses** tab.
- Enter the License NFT Token ID and click **Inspect License**.
- View on-chain validity status, expiration date, parent IP reference, and usage quota.
- Click **Use License Right** to log an on-chain usage event against your quota.

---

## CLI Management Scripts

You can also interact with the contracts directly using Hardhat scripts:

```bash
# Register content via CLI
npx hardhat run scripts/registerContent.js --network sepolia

# Verify ownership via content hash
npx hardhat run scripts/verifyOwnership.js <0x_hash> --network sepolia

# Inspect IP licensing terms
npx hardhat run scripts/manageLicense.js view <parentTokenId>

# Set licensing terms for an IP (price, durationDays, maxUses, type)
npx hardhat run scripts/manageLicense.js set <parentTokenId> 0.05 30 10 1

# Inspect a License NFT by ID
npx hardhat run scripts/manageLicense.js check-license <licenseTokenId>
```

---

## Roadmap & Team Member Tasks

- [x] **1. Licensing & Royalties (Completed):**
  - Expanded `contracts/IPLicense.sol` into an ERC-721 License NFT standard.
  - Implemented payable `buyLicense` function with automatic ETH payouts to creators and excess refunds.
  - Added configurable licensing terms (commercial, personal, time-bound, usage quotas).
  - Integrated complete UI tabs in `frontend/src/main.jsx` and styling in `frontend/src/style.css`.
  - Added unit test coverage with 100% passing tests in `test/IPLicense.js`.

- [ ] **2. IPFS and Backend Integration:**
  - Build Node.js backend to accept files, compute hashes, and pin to Pinata/IPFS.
  - Return `ipfsCid` to frontend to store alongside the content hash in `registerContent(hash, cid)`.

- [ ] **3. Advanced Frontend & Analytics:**
  - Creator Portfolio view (list all registered IPs owned by the connected wallet).
  - Licensee vault (list all acquired license NFTs with direct rights access).
