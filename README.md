# Intellectual Property Registration and Licensing Platform

A decentralized platform for registering digital content ownership evidence on-chain and licensing usage rights through smart contracts.

---

## 🚀 How to Run and Test (Sepolia Testnet)

Follow these steps to deploy and test the application from top to bottom.

### 1. Configure the Backend (Smart Contracts)
1. In the main project folder, open `.env.example` and rename it to `.env` (or create a new `.env` file).
2. Paste your Sepolia RPC URL and your MetaMask Private Key into the `.env`:
   ```env
   SEPOLIA_URL=https://ethereum-sepolia-rpc.publicnode.com
   PRIVATE_KEY=your_metamask_private_key_here
   ```
3. Install dependencies and compile:
   ```bash
   npm install
   npx hardhat compile
   ```
   *(Note: If it says "Nothing to compile", this is completely normal! It just means your contracts are already compiled and up to date).*

### 2. Deploy to Sepolia
Run the deployment script to deploy the smart contract to the live testnet:
```bash
npx hardhat run scripts/deploy.js --network sepolia
```
Wait for the transaction to finish and **copy the deployed IPContentRegistry address.**

### 3. Configure the Frontend
1. Navigate into the frontend folder: `cd frontend`
2. Create an environment file `frontend/.env` and paste your deployed contract address:
   ```env
   VITE_CONTRACT_ADDRESS=your_copied_contract_address_here
   ```
3. Install dependencies and start the app:
   ```bash
   npm install
   npm run dev
   ```
4. Open your browser to `http://localhost:5173`. Make sure your MetaMask is connected to the **Sepolia** network.

### 4. Test the Application Flow
- **Register Content:** Click "Choose a file" in the Register box. Select an image/file. It will instantly calculate the SHA-256 hash. Click "Register On-Chain" and confirm the MetaMask transaction.
- **Verify Ownership:** In the Verify box, choose that *exact same file*. Click "Verify Ownership". It will check the blockchain and print out your Owner Wallet Address, the Registration Timestamp, and the NFT ID!

---

## 🛠 Further Work (For Team Members)

We have successfully completed the core registration logic, the hashing flow, and the ownership verification system. Here is the roadmap for team members to continue:

### 1. Licensing & Royalties
- **What to do:** The `IPLicense.sol` contract needs to be expanded. Currently, the registry supports basic ERC-2981 royalty calculations, but we need a robust system for users to *buy* licenses (e.g., time-bound or commercial use).
- **Goal:** Implement payable functions where a user can send ETH to mint a "License NFT" that is linked to the original IPContentRegistry NFT.

### 2. IPFS and Backend Integration
- **What to do:** Currently, the hash is computed in the browser to ensure the file isn't leaked, which is great for privacy. However, for users who *want* to store their actual file publicly, we need an IPFS integration (like Pinata).
- **Goal:** Build a secure Node.js backend to accept the file, pin it to IPFS, return the `ipfsCid`, and pass that CID into the `registerContent(hash, cid)` smart contract function alongside the hash.

### 3. Frontend Development
- **What to do:** The current UI is a functional React/Vite starter template. It needs to be styled and expanded to support the new features.
- **Goal:** 
  - Add a "Dashboard" page showing all NFTs a user owns.
  - Build a "Marketplace" or "Licensing" page where users can browse registered IPs and purchase licenses.
  - Implement a loading state spinner while MetaMask transactions are pending.

### 4. Testing
- **What to do:** Expand the Hardhat test suite in `test/IPContentRegistry.js` and add frontend unit tests.
- **Goal:** 
  - Write tests for the `IPLicense.sol` contract logic.
  - Ensure coverage for edge cases (e.g., what happens if someone tries to license an NFT that doesn't exist, or register a hash that is already taken?).
  - Run `npx hardhat test` to ensure 100% passing rates before mainnet deployment.
