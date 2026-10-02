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

export const ipfsUrl = (cid) => {
  const cleanCid = (cid || "").replace(/^ipfs:\/\//, "");
  return `https://gateway.pinata.cloud/ipfs/${cleanCid}`;
};

