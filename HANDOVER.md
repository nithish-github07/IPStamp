# HANDOVER: IPFS Pinning + Backend Integration (Member 3)

Read this file fully before making any change. Work in Planning mode and show me the plan before editing files.

## 1. Project context

Repo: `Intellectual-Property-Registration-and-Licensing-Platform` (Hardhat + Solidity + React/Vite dApp on Sepolia).

A platform where creators timestamp ownership of digital content (proof of prior creation) and license usage rights through smart contracts.

Existing, already merged to `main` (do NOT modify):
- `contracts/IPContentRegistry.sol`: ERC-721 + ERC-2981. Mints an ownership NFT per SHA-256 content hash, stores the registration timestamp and an optional IPFS CID. Called as `registerContent(hash, cid)`.
- `contracts/IPLicense.sol`: ERC-721 License NFTs (price, duration, max uses, license type, `buyLicense`, `isLicenseValid`, `useLicense`, `revokeLicense`).
- `frontend/` (React + Vite): UI in `frontend/src/main.jsx` with tabs for Registration & Proof, Creator Terms, Licensing Marketplace, Verify & Use Licenses. Styles in `frontend/src/style.css`.
- `scripts/` (deploy, registerContent, verifyOwnership, manageLicense), `test/` (16 passing unit tests), `hardhat.config.js`, `.env.example`.

Team split: Member 1 = ownership NFT, Member 2 = licensing/royalties (both done), **Member 3 = IPFS + integration (this task)**, Member 4 = frontend, Member 5 = testing/dispute demo/docs.

## 2. My task

From the README roadmap: "Build Node.js backend to accept files, compute hashes, and pin to Pinata/IPFS. Return `ipfsCid` to frontend to store alongside the content hash in `registerContent(hash, cid)`."

Target flow:

```
Browser: pick file -> compute SHA-256 (already implemented client-side)
   -> POST file + hash to backend /api/upload
Backend: recompute SHA-256, reject on mismatch -> pin to IPFS via Pinata -> return { cid, hash, url }
Browser: registerContent(hash, cid) via MetaMask -> tx confirmed
Verify panel: show owner, token ID, timestamp and a working IPFS link built from the stored CID
```

Design decisions already made:
- Hash is computed client-side (project requirement); the backend re-verifies it so the on-chain hash always matches the pinned file.
- The Pinata JWT lives only in `backend/.env`, never in frontend code.
- Pin first, then send the transaction. An unused pin after a rejected tx is acceptable.

## 3. Deliverables

1. New folder `backend/` at the repo root (own `package.json`, ESM, Node 18+):
   - `backend/server.js`
   - `backend/package.json`
   - `backend/.env.example` (no real values)
2. `frontend/src/ipfs.js` (helper that calls the backend).
3. Edit `frontend/src/main.jsx`:
   - Register handler: call `pinToIpfs(file, hash)` before `registerContent`, pass the returned `cid` as the second argument. Show an "Uploading to IPFS..." status, then the MetaMask step. Handle errors (backend down, hash mismatch, Pinata failure) with a visible message.
   - Verify result: if the contract returns a CID, render a link using `ipfsUrl(cid)`.
4. Update `README.md`: add a "Backend / IPFS" section (setup, env vars, how to run) and tick the roadmap item.
5. `.gitignore`: make sure `backend/.env` and `backend/node_modules` are ignored.

## 4. Code to create

### backend/package.json
```json
{
  "name": "ip-platform-backend",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "multer": "^1.4.5-lts.1"
  }
}
```

### backend/.env.example
```env
PINATA_JWT=
FRONTEND_ORIGIN=http://localhost:5173
PORT=4000
# optional
GATEWAY_URL=https://gateway.pinata.cloud/ipfs
```

### backend/server.js
```js
import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import crypto from "crypto";

const PORT = process.env.PORT || 4000;
const PINATA_JWT = process.env.PINATA_JWT;
const GATEWAY = process.env.GATEWAY_URL || "https://gateway.pinata.cloud/ipfs";
const MAX_MB = 25;

if (!PINATA_JWT) {
  console.error("Missing PINATA_JWT in backend/.env");
  process.exit(1);
}

const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB * 1024 * 1024 },
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// POST /api/upload  (multipart: file, hash)
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const actual = crypto.createHash("sha256").update(req.file.buffer).digest("hex");
    const claimed = (req.body.hash || "").toLowerCase().replace(/^0x/, "");
    if (claimed && claimed !== actual) {
      return res.status(400).json({ error: "Hash mismatch: file differs from the hashed content" });
    }

    const form = new FormData();
    form.append(
      "file",
      new Blob([req.file.buffer], { type: req.file.mimetype }),
      req.file.originalname
    );
    form.append(
      "pinataMetadata",
      JSON.stringify({ name: req.file.originalname, keyvalues: { sha256: actual } })
    );

    const pin = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: { Authorization: `Bearer ${PINATA_JWT}` },
      body: form,
    });

    if (!pin.ok) {
      const detail = await pin.text();
      console.error("Pinata error:", pin.status, detail);
      return res.status(502).json({ error: "IPFS pinning failed" });
    }

    const { IpfsHash } = await pin.json();
    res.json({ cid: IpfsHash, hash: "0x" + actual, url: `${GATEWAY}/${IpfsHash}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.use((err, _req, res, _next) => {
  res.status(400).json({ error: err.message });
});

app.listen(PORT, () => console.log(`IPFS backend running on http://localhost:${PORT}`));
```

### frontend/src/ipfs.js
```js
const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

export async function pinToIpfs(file, hash) {
  const form = new FormData();
  form.append("file", file);
  form.append("hash", hash);

  const res = await fetch(`${BACKEND}/api/upload`, { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "IPFS upload failed");
  return data;
}

export const ipfsUrl = (cid) => `https://gateway.pinata.cloud/ipfs/${cid}`;
```

Also add `VITE_BACKEND_URL=http://localhost:4000` to `frontend/.env.example` (create it if missing).

## 5. Things to verify in the repo before editing (I have not seen these files)

- The exact signature of `registerContent` in `IPContentRegistry.sol` and how the frontend currently calls it (the README says `registerContent(hash, cid)`).
- The hash format the frontend produces (hex string with or without `0x`, bytes32 or string) and what the contract expects. The backend returns `0x` + 64 hex chars and accepts either form. If the frontend format differs, adapt the frontend, not the contract.
- The name of the register and verify handlers in `main.jsx` and how it reads the CID back on verify (struct/getter name in the contract).
- Whether `frontend/.env` loads via `import.meta.env` (Vite requires the `VITE_` prefix).

Report what you find before editing.

Git: commit in small steps with clear messages on the current branch. Push only when I ask, using `git push` (the branch already tracks its remote).

## 6. Hard rules

- Do NOT modify anything in `contracts/`, `test/`, or `hardhat.config.js`.
- Do NOT open, print, or edit any `.env` file that contains secrets (root `.env` has a wallet private key). Only create `.env.example` files.
- Never commit secrets. Check `git status` before any commit and confirm no `.env` is staged.
- Ask for my approval before running terminal commands that install packages, deploy contracts, or touch the network.
- Keep changes minimal and match the existing code style of `main.jsx`. Do not refactor unrelated UI.
- A branch for the IPFS work already exists and is checked out locally. Run `git branch --show-current` and work on that branch only. Do NOT create a new branch, do NOT switch branches, and do NOT push to `main`.
- Do not run `git init`, `git push --force`, `git reset --hard`, or `git rebase` without asking me.
- This branch may already contain partial IPFS work. Before creating any file, run `git log --oneline -10` and `git diff main --stat`, and check whether `backend/` or `frontend/src/ipfs.js` already exist. If they do, extend them instead of overwriting, and tell me what you found.

## 7. Setup and run (for reference)

```bash
# root
npm install
npx hardhat compile
npx hardhat test            # must still pass 16 tests

# backend
cd backend && npm install && npm run dev      # http://localhost:4000/api/health

# frontend
cd frontend && npm install && npm run dev     # http://localhost:5173
```

Contract addresses (`VITE_CONTRACT_ADDRESS`, `VITE_LICENSE_ADDRESS`) and the Pinata JWT are supplied by me in the `.env` files. Ask me if something is missing.

## 8. Acceptance criteria

- [ ] `GET /api/health` returns `{ ok: true }`.
- [ ] `POST /api/upload` with a file and its correct hash returns a CID that resolves on the Pinata gateway.
- [ ] `POST /api/upload` with a wrong hash returns HTTP 400 and pins nothing.
- [ ] Registering a file in the UI pins it, then sends `registerContent(hash, cid)` and the transaction confirms on Sepolia.
- [ ] Verifying the same file shows owner, token ID, timestamp, and a clickable IPFS link that opens the original file.
- [ ] Verifying a different file still shows "Content not registered".
- [ ] Backend failure (server stopped) shows a clear error in the UI and does not send a transaction.
- [ ] `npx hardhat test` still passes.
- [ ] README updated; no secrets in the diff.

## 9. Out of scope

Creator portfolio and licensee vault views (roadmap item 3), Filecoin storage, dispute demo (Member 5), contract changes.

## 10. Notes for the report (Member 5)

- Files pinned to IPFS are publicly retrievable by CID. Anyone with the CID can read the content, so private or unreleased work should not be pinned. Mention this under legal and practical limitations.
- A blockchain timestamp plus a content hash is evidence of existence at a point in time, not legal proof of copyright ownership.
