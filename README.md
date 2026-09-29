# Intellectual Property Content Registry

A decentralized platform for registering digital content ownership evidence on-chain and licensing usage rights through smart contracts.

## Key Features
- **ERC-721 Content Ownership NFT:** Mint a unique NFT representing your registered intellectual property.
- **Explicit Ownership Verification:** Dedicated `verifyOwnership` feature for frontend and third-party contracts to validate content owners.
- **ERC-2981 Royalty Standard:** Embedded royalty information for secondary sales or licensing.
- **Privacy-First Client-Side Hashing:** Computes SHA-256 hash in the browser—files are never uploaded.
- **On-Chain Immutability:** Stores the digital fingerprint and blockchain timestamp to act as a definitive "Proof of Existence."
- **Licensing Architecture:** Time-bound and usage-bound licensing capabilities ready for integration.
- **Modern Tech Stack:** React + Vite frontend, Hardhat development environment.

## Run Locally

### 1. Install Dependencies
```bash
npm install
cd frontend && npm install && cd ..
```

### 2. Compile and Test Contracts
Ensure your code is error-free by running the automated unit tests (this explicitly tests the new `verifyOwnership` functionality).
```bash
npm run compile
npm test
```

### 3. Start a Local Blockchain
Terminal 1:
```bash
npm run node
```
*Keep this terminal open.*

### 4. Deploy Contracts
Terminal 2:
```bash
npm run deploy:local
```
Copy the printed `IPContentRegistry` address.

### 5. Configure Frontend
Create `frontend/.env`:
```env
VITE_CONTRACT_ADDRESS=PASTE_REGISTRY_ADDRESS
```

### 6. Start Frontend
Terminal 3:
```bash
npm run frontend
```
Open `http://localhost:5173` in your browser and connect MetaMask to the local Hardhat network (Chain ID: 31337).

## How to Test Ownership Verification
1. **Automated Testing:** The `verifyOwnership` logic is covered in our Hardhat test suite (`test/IPContentRegistry.js`). Running `npm test` automatically simulates verifying an owner and rejecting a non-owner.
2. **Manual Testing via Hardhat Console:**
   You can manually verify ownership by interacting with your deployed contract locally:
   ```bash
   npx hardhat console --network localhost
   > const contract = await ethers.getContractAt("IPContentRegistry", "YOUR_CONTRACT_ADDRESS");
   > await contract.verifyOwnership(1, "YOUR_WALLET_ADDRESS"); // Returns true or false
   ```

## Next Steps: IPFS Integration
The current UI intentionally keeps IPFS upload separate so the project can be connected to Pinata/Filecoin securely. The intended flow is:
1. Hash file client-side.
2. Upload/pin the file through a backend.
3. Receive the CID.
4. Store the CID and hash in `registerContent`.

## Scope Note
A blockchain timestamp is evidence of when a particular hash was registered; it is not, by itself, a legal copyright determination.
