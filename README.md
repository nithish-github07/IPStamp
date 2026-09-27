# Intellectual Property Content Registry

A starter implementation for registering digital content ownership evidence on-chain and licensing usage rights through smart contracts.

## Included
- ERC-721 content ownership NFT
- ERC-2981 royalty information
- Client-side SHA-256 content hashing
- On-chain timestamp and content hash storage
- Time-bound / usage-bound licensing contract
- React + Vite frontend
- Hardhat deployment and tests

## Run locally

### 1. Install dependencies
```bash
npm install
cd frontend && npm install && cd ..
```

### 2. Compile and test
```bash
npm run compile
npm test
```

### 3. Start a local blockchain
Terminal 1:
```bash
npm run node
```

### 4. Deploy contracts
Terminal 2:
```bash
npm run deploy:local
```
Copy the printed `IPContentRegistry` address.

### 5. Configure frontend
Create `frontend/.env`:
```env
VITE_CONTRACT_ADDRESS=PASTE_REGISTRY_ADDRESS
```

### 6. Start frontend
```bash
npm run frontend
```
Open the Vite URL in your browser and connect MetaMask to the local Hardhat network.

## Polygon Amoy
Copy `.env.example` to `.env`, set `POLYGON_AMOY_RPC_URL` and `PRIVATE_KEY`, then run:
```bash
npm run deploy:polygon
```

## IPFS next step
The current UI intentionally keeps IPFS upload separate so the project can be connected to Pinata/Filecoin without exposing an API key in the browser. The intended flow is:
1. Hash file client-side.
2. Upload/pin the file through a backend or secure serverless endpoint.
3. Receive the CID.
4. Store the CID and hash in `registerContent`.

## Scope note
A blockchain timestamp is evidence of when a particular hash was registered; it is not, by itself, a legal copyright determination.
