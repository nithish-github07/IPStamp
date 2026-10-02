# IPFS Integration & Verification Guide
**Role:** Member 3 – IPFS Pinning + Backend Integration  
**Target Contracts:** `IPContentRegistry.sol` (`registerContent(hash, cid)`), `IPLicense.sol`  
**Branch:** `feature/ipfs-integration`  

---

## 1. Overview & Architecture

Member 3 implements the decentralized content storage bridge connecting the client-side dApp with the Sepolia blockchain contracts:

```
[Browser: User selects file]
       │
       ▼
[Client: Computes SHA-256 hash locally]
       │
       ▼ POST multipart (file + hash)
[Backend /api/upload: Express + Multer]
       │
       ├─► Recompute SHA-256 (reject HTTP 400 on mismatch)
       │
       └─► Pin to IPFS via Pinata (using private server-side PINATA_JWT)
       │
       ▼ Returns { cid, hash, url }
[Frontend: MetaMask Prompt]
       │
       ▼ Calls IPContentRegistry.registerContent(hash, cid)
[Sepolia Blockchain: Mints Ownership NFT with immutable hash & IPFS CID]
       │
       ▼
[Verify Panel: Displays owner, timestamp, token ID, & clickable IPFS Gateway Link]
```

---

## 2. Acceptance Criteria Verification Matrix

| Acceptance Criterion | Status | Verification Evidence & Mechanism |
|---|:---:|---|
| **`GET /api/health` returns `{ ok: true }`** | **PASSED** | Automated probe verified HTTP 200 `{ ok: true }`. |
| **`POST /api/upload` (mismatched hash)** | **PASSED** | Returns HTTP 400 with `"Hash mismatch: file differs from the hashed content"` and does not pin. |
| **`POST /api/upload` (missing file)** | **PASSED** | Returns HTTP 400 with `"No file uploaded"`. |
| **`POST /api/upload` (correct file + hash)** | **READY** | Pins file to Pinata via `https://api.pinata.cloud/pinning/pinFileToIPFS` and returns `{ cid, hash, url }`. |
| **Pin first, then send transaction** | **PASSED** | Implemented in `registerContent()` in `main.jsx`: `pinToIpfs()` completes before MetaMask prompts. |
| **Clickable IPFS Link on Verification** | **PASSED** | Verified on-chain record renders an active hyperlink `<a href={ipfsUrl(verifyResult.ipfsCid)}>` with external link indicator `↗`. |
| **Verification of unregistered file** | **PASSED** | `verifyByHash` checks on-chain mapping; displays `"Content not registered on Sepolia"`. |
| **Backend outage error handling** | **PASSED** | If backend is offline or throws, UI catches error, displays notification, and aborts MetaMask prompt. |
| **`npx hardhat test` passing** | **PASSED** | **16/16 unit tests passed**; smart contracts, tests, and hardhat config remain untouched. |
| **Zero secrets in Git diff** | **PASSED** | `backend/.env` and `backend/node_modules/` ignored in `.gitignore`; no secrets staged. |

---

## 3. Step-by-Step Live Testing Guide (Sepolia + Pinata)

Follow these steps to perform an end-to-end test with live testnet ETH and Pinata:

### Step 1: Configure Backend Environment
1. In the `backend/` directory, create a `.env` file using `backend/.env.example` as a template:
   ```env
   PINATA_JWT=your_actual_pinata_jwt_here
   FRONTEND_ORIGIN=http://localhost:5173
   PORT=4000
   GATEWAY_URL=https://gateway.pinata.cloud/ipfs
   ```
2. Start the backend service:
   ```bash
   cd backend
   npm run dev
   ```
3. Confirm backend is running at [http://localhost:4000/api/health](http://localhost:4000/api/health) (returns `{"ok":true}`).

### Step 2: Configure Frontend Environment
1. In the `frontend/` directory, configure `frontend/.env`:
   ```env
   VITE_BACKEND_URL=http://localhost:4000
   VITE_CONTRACT_ADDRESS=0x519411C1886B8f51bf4aF3b3B9A243A2Ac155BDC
   VITE_LICENSE_ADDRESS=0xe9C5284C86ad41390FE2bBa511cE7e90D2a4CC30
   ```
2. Install frontend dependencies and start Vite:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
3. Open [http://localhost:5173](http://localhost:5173) in your browser.

### Step 3: Test Registration & Pinning Flow
1. Connect your MetaMask wallet (switch to **Sepolia Testnet**).
2. Under **Register IP Content**, select a test file (image, PDF, audio, or document).
3. Observe the client-side SHA-256 hash displayed in the digest box.
4. Click **Register On Sepolia**:
   - Status updates to: `1/4: Uploading and pinning file to IPFS via Pinata...`
   - The backend validates the hash, pins to Pinata, and populates the CID.
   - Status updates to: `2/4: Pinned to IPFS (<CID>...). Confirm registration in your MetaMask wallet...`
   - Approve the transaction in MetaMask.
   - Status updates to: `3/4: Transaction broadcast... Waiting for Sepolia block confirmation...`
   - Block confirms $\rightarrow$ `✓ Successfully registered on Sepolia! Block #...`

### Step 4: Test Verification & Gateway Resolution
1. Under **Verify Ownership Evidence**, choose the identical file.
2. The UI queries the Sepolia registry and renders the verifiable record:
   - **Registered Owner**: your connected wallet address.
   - **Token ID**: the minted ownership NFT ID.
   - **Timestamp**: block timestamp formatted as human-readable date.
   - **IPFS Evidence**: a clickable hyperlink `https://gateway.pinata.cloud/ipfs/<CID> ↗`.
3. Click the link to verify that the file loads directly from the IPFS gateway.

### Step 5: Test Failure & Outage Scenarios
1. **Wrong File Verification**: Choose a different or modified file. Click verify $\rightarrow$ confirms `"Content not registered on Sepolia"`.
2. **Backend Stopped**: Temporarily stop the backend (`Ctrl+C` in the backend terminal). Try registering a file $\rightarrow$ UI displays `"Error: Failed to fetch"` or connection error and no MetaMask transaction is triggered.

---

## 4. Security & Design Decisions

1. **Client-Side Hashing + Backend Verification:**
   The user computes the SHA-256 digest in their browser (`crypto.subtle.digest`). The backend re-hashes the uploaded file buffer with Node's native `crypto.createHash('sha256')` before sending to Pinata. This guarantees that the hash stored on-chain always corresponds to the pinned content.
2. **Strict Credential Isolation:**
   The `PINATA_JWT` lives only in `backend/.env`. It is never bundled into frontend assets or exposed via Vite environment variables.
3. **Prefix Normalization:**
   The `ipfsUrl` helper automatically sanitizes CIDs by removing any `ipfs://` prefixes, ensuring that gateway URLs are always valid HTTP addresses.
4. **Memory Storage & Payload Cap:**
   Multer uses in-memory storage (`multer.memoryStorage()`) with a 25 MB limit (`MAX_MB = 25`), preventing disk bloat while protecting against denial-of-service payload attacks.

---

## 5. Notes for Final Presentation & Report (Member 5)

Incorporate the following points in the final project report, slides, and dispute resolution demonstration:

1. **Public IPFS Retrieval:**
   - Any file pinned to IPFS is publicly accessible to anyone who possesses its CID.
   - *Limitation:* Proprietary, private, or pre-release content should not be pinned to a public gateway without prior client-side encryption.
2. **Prior Art Evidence vs. Legal Copyright:**
   - Recording a cryptographic SHA-256 content digest paired with an immutable block timestamp establishes mathematical proof of prior existence at that specific instant.
   - *Limitation:* While it provides strong, tamper-proof evidence for dispute resolution and prior art claims, it is complementary to and does not replace statutory copyright or trademark registration.
3. **Dispute Resolution Flow:**
   - In competing ownership disputes, the blockchain provides an impartial, decentralized arbiter: whoever holds the earlier timestamp for the identical SHA-256 hash holds cryptographic priority of creation.
