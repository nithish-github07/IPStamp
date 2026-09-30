import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ethers } from "ethers";
import "./style.css";

const ABI = [
  "function registerContent(bytes32 contentHash,string ipfsCid) returns (uint256)",
  "function verifyByHash(bytes32 contentHash) view returns (bool exists, uint256 tokenId, address owner, uint256 timestamp)",
  "event ContentRegistered(uint256 indexed tokenId,address indexed creator,bytes32 indexed contentHash,string ipfsCid,uint256 timestamp)"
];

function App() {
  const [file, setFile] = useState(null);
  const [hash, setHash] = useState("");
  const [status, setStatus] = useState("Connect a wallet and choose a file to begin.");
  const [account, setAccount] = useState("");
  
  // Verification states
  const [verifyFile, setVerifyFile] = useState(null);
  const [verifyHash, setVerifyHash] = useState("");
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifyStatus, setVerifyStatus] = useState("");

  async function connect() {
    if (!window.ethereum) return setStatus("Install MetaMask to connect a wallet.");
    const provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    setAccount(accounts[0]);
    setStatus("Wallet connected.");
  }

  async function hashFile(selected, setHashFn) {
    if (!selected) return;
    const buffer = await selected.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    const hex = "0x" + [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
    setHashFn(hex);
  }

  async function register() {
    try {
      if (!window.ethereum) throw new Error("MetaMask is required.");
      if (!hash) throw new Error("Choose a file first.");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = import.meta.env.VITE_CONTRACT_ADDRESS;
      if (!address) throw new Error("Set VITE_CONTRACT_ADDRESS in frontend/.env");
      const contract = new ethers.Contract(address, ABI, signer);
      setStatus("Submitting registration transaction...");
      const tx = await contract.registerContent(hash, "");
      await tx.wait();
      setStatus(`Registered on-chain. Transaction: ${tx.hash}`);
    } catch (error) {
      setStatus(error.shortMessage || error.message);
    }
  }

  async function verify() {
    try {
      if (!window.ethereum) throw new Error("MetaMask is required.");
      if (!verifyHash) throw new Error("Choose a file first.");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const address = import.meta.env.VITE_CONTRACT_ADDRESS;
      if (!address) throw new Error("Set VITE_CONTRACT_ADDRESS in frontend/.env");
      
      const contract = new ethers.Contract(address, ABI, provider);
      setVerifyStatus("Querying smart contract...");
      
      const [exists, tokenId, owner, timestamp] = await contract.verifyByHash(verifyHash);
      
      if (exists) {
        setVerifyResult({ owner, tokenId: tokenId.toString(), timestamp: Number(timestamp) });
        setVerifyStatus("");
      } else {
        setVerifyResult(null);
        setVerifyStatus("✗ Content not registered.");
      }
    } catch (error) {
      setVerifyStatus(error.shortMessage || error.message);
    }
  }

  return <main>
    <header><div><span className="eyebrow">BLOCKCHAIN IP</span><h1>Content Registry</h1><p>Timestamp your work and create verifiable ownership evidence.</p></div><button onClick={connect}>{account ? `${account.slice(0,6)}...${account.slice(-4)}` : "Connect Wallet"}</button></header>
    
    <div style={{display: 'flex', gap: '20px', flexWrap: 'wrap'}}>
      <section className="card" style={{flex: 1, minWidth: '300px'}}>
        <h2>Register Content</h2>
        <p className="muted">Hashes your file in the browser before sending the hash to the smart contract.</p>
        <label className="drop"><input type="file" onChange={e => { setFile(e.target.files[0]); hashFile(e.target.files[0], setHash); }} />{file ? file.name : "Choose a file"}</label>
        {hash && <div className="hash"><strong>SHA-256</strong><code>{hash}</code></div>}
        <button className="primary" onClick={register}>Register On-Chain</button>
        <p className="status">{status}</p>
      </section>

      <section className="card" style={{flex: 1, minWidth: '300px'}}>
        <h2>Verify Ownership</h2>
        <p className="muted">Upload a file to locally compute its hash and query the smart contract for ownership.</p>
        <label className="drop"><input type="file" onChange={e => { setVerifyFile(e.target.files[0]); hashFile(e.target.files[0], setVerifyHash); setVerifyResult(null); }} />{verifyFile ? verifyFile.name : "Choose a file"}</label>
        {verifyHash && <div className="hash"><strong>SHA-256</strong><code>{verifyHash}</code></div>}
        <button className="primary" onClick={verify}>Verify Ownership</button>
        <p className="status">{verifyStatus}</p>
        
        {verifyResult && (
          <div style={{marginTop: '20px', padding: '15px', background: '#f5fff5', border: '1px solid #c3e6c3', borderRadius: '8px', color: '#1a561a'}}>
            <h3 style={{margin: '0 0 10px 0'}}>✓ Content Registered</h3>
            <p><strong>Owner:</strong><br/>{verifyResult.owner}</p>
            <p><strong>Registered:</strong><br/>{new Date(verifyResult.timestamp * 1000).toLocaleString()}</p>
            <p><strong>NFT:</strong> #{verifyResult.tokenId}</p>
          </div>
        )}
      </section>
    </div>

    <section className="grid"><div className="mini"><b>Proof of existence</b><span>Content hash + blockchain timestamp</span></div><div className="mini"><b>Ownership NFT</b><span>ERC-721 token represents registered content</span></div><div className="mini"><b>Royalties</b><span>ERC-2981 royalty information</span></div></section>
  </main>
}

createRoot(document.getElementById("root")).render(<App />);
