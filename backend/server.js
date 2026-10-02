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
