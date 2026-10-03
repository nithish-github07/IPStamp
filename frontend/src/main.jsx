import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { ethers } from "ethers";
import "./style.css";
import { pinToIpfs, ipfsUrl } from "./ipfs.js";

const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111 in hex
const SEPOLIA_RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";

const DEFAULT_REGISTRY_ADDRESS = "0x519411C1886B8f51bf4aF3b3B9A243A2Ac155BDC";
const DEFAULT_LICENSE_ADDRESS = "0xe9C5284C86ad41390FE2bBa511cE7e90D2a4CC30";

const REGISTRY_ABI = [
  "function registerContent(bytes32 contentHash, string ipfsCid) returns (uint256)",
  "function verifyByHash(bytes32 contentHash) view returns (bool exists, uint256 tokenId, address owner, uint256 timestamp)",
  "function records(uint256) view returns (bytes32 contentHash, string ipfsCid, uint256 timestamp, address creator)",
  "function royaltyInfo(uint256 tokenId, uint256 salePrice) view returns (address receiver, uint256 royaltyAmount)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function hashToTokenId(bytes32) view returns (uint256)",
  "event ContentRegistered(uint256 indexed tokenId, address indexed creator, bytes32 indexed contentHash, string ipfsCid, uint256 timestamp)"
];

const LICENSE_ABI = [
  "function setListingTerms(uint256 parentTokenId, uint256 price, uint256 duration, uint256 maxUses, uint8 licenseType, bool active)",
  "function buyLicense(uint256 parentTokenId) payable returns (uint256)",
  "function listings(uint256) view returns (uint256 price, uint256 duration, uint256 maxUses, uint8 licenseType, bool active)",
  "function isLicenseValid(uint256 licenseId) view returns (bool)",
  "function getLicense(uint256 licenseId) view returns (tuple(uint256 parentTokenId, address licensor, uint256 startTime, uint256 endTime, uint256 maxUses, uint256 used, uint8 licenseType, bool active))",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function useLicense(uint256 licenseId)",
  "function revokeLicense(uint256 licenseId)",
  "event LicensePurchased(uint256 indexed licenseId, uint256 indexed parentTokenId, address indexed licensee, address licensor, uint256 pricePaid, uint256 endTime, uint8 licenseType)",
  "event LicenseTermsUpdated(uint256 indexed parentTokenId, uint256 price, uint256 duration, uint256 maxUses, uint8 licenseType, bool active)"
];

const LICENSE_TYPES = ["Personal", "Commercial", "Exclusive"];

// Dedicated direct Sepolia JSON-RPC provider for read calls
function getSepoliaReadProvider() {
  return new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
}

function App() {
  const [tab, setTab] = useState("register");
  const [account, setAccount] = useState("");
  const [isSepolia, setIsSepolia] = useState(false);

  // Register state
  const [file, setFile] = useState(null);
  const [hash, setHash] = useState("");
  const [cid, setCid] = useState("");
  const [registerStatus, setRegisterStatus] = useState("");
  const [isAlreadyRegistered, setIsAlreadyRegistered] = useState(null);

  // Verify state
  const [verifyFile, setVerifyFile] = useState(null);
  const [verifyHash, setVerifyHash] = useState("");
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifyStatus, setVerifyStatus] = useState("");

  // Marketplace state
  const [marketTokenId, setMarketTokenId] = useState("");
  const [marketTerms, setMarketTerms] = useState(null);
  const [marketStatus, setMarketStatus] = useState("");

  // Creator Licensing Terms state
  const [termsTokenId, setTermsTokenId] = useState("");
  const [termsPrice, setTermsPrice] = useState("0.01");
  const [termsDurationDays, setTermsDurationDays] = useState("30");
  const [termsMaxUses, setTermsMaxUses] = useState("10");
  const [termsType, setTermsType] = useState(1); // 1 = Commercial
  const [termsActive, setTermsActive] = useState(true);
  const [termsStatus, setTermsStatus] = useState("");

  // My License / Usage state
  const [inspectLicenseId, setInspectLicenseId] = useState("");
  const [licenseData, setLicenseData] = useState(null);
  const [licenseOwner, setLicenseOwner] = useState("");
  const [licenseValid, setLicenseValid] = useState(false);
  const [licenseStatus, setLicenseStatus] = useState("");

  const registryAddress = import.meta.env.VITE_CONTRACT_ADDRESS || DEFAULT_REGISTRY_ADDRESS;
  const licenseAddress = import.meta.env.VITE_LICENSE_ADDRESS || DEFAULT_LICENSE_ADDRESS;

  async function checkNetwork(provider) {
    try {
      const network = await provider.getNetwork();
      const onSepolia = network.chainId === 11155111n;
      setIsSepolia(onSepolia);
      return onSepolia;
    } catch {
      return false;
    }
  }

  async function ensureSepoliaNetwork() {
    if (!window.ethereum) return false;
    try {
      const currentChainId = await window.ethereum.request({ method: "eth_chainId" });
      if (currentChainId.toLowerCase() === SEPOLIA_CHAIN_ID.toLowerCase()) {
        setIsSepolia(true);
        return true;
      }
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: SEPOLIA_CHAIN_ID }],
        });
        setIsSepolia(true);
        return true;
      } catch (switchError) {
        if (switchError.code === 4902 || switchError.data?.originalError?.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: SEPOLIA_CHAIN_ID,
                chainName: "Sepolia Testnet",
                nativeCurrency: { name: "Sepolia ETH", symbol: "SEP", decimals: 18 },
                rpcUrls: [SEPOLIA_RPC_URL],
                blockExplorerUrls: ["https://sepolia.etherscan.io"],
              },
            ],
          });
          setIsSepolia(true);
          return true;
        }
        throw switchError;
      }
    } catch (err) {
      console.error("Failed to switch network:", err);
      return false;
    }
  }

  useEffect(() => {
    if (!window.ethereum) return;

    const provider = new ethers.BrowserProvider(window.ethereum);
    provider.listAccounts().then((accounts) => {
      if (accounts.length > 0) {
        setAccount(accounts[0].address);
      }
    });
    checkNetwork(provider);

    const handleChainChanged = () => {
      window.location.reload();
    };

    const handleAccountsChanged = (accounts) => {
      setAccount(accounts.length > 0 ? accounts[0] : "");
    };

    window.ethereum.on("chainChanged", handleChainChanged);
    window.ethereum.on("accountsChanged", handleAccountsChanged);

    return () => {
      if (window.ethereum.removeListener) {
        window.ethereum.removeListener("chainChanged", handleChainChanged);
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      }
    };
  }, []);

  async function connectWallet() {
    if (!window.ethereum) {
      alert("Please install MetaMask to interact with this application.");
      return;
    }
    try {
      await ensureSepoliaNetwork();
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      setAccount(accounts[0]);
      await checkNetwork(provider);
    } catch (err) {
      console.error(err);
    }
  }

  // Hash file and immediately check Sepolia status
  async function handleRegisterFileSelected(selectedFile) {
    if (!selectedFile) return;
    setFile(selectedFile);
    setIsAlreadyRegistered(null);
    setRegisterStatus("");

    const buffer = await selectedFile.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    const hex = "0x" + [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    setHash(hex);

    // Check if this hash is already on Sepolia
    try {
      const readProvider = getSepoliaReadProvider();
      const contract = new ethers.Contract(registryAddress, REGISTRY_ABI, readProvider);
      const [exists, tokenId, owner, timestamp] = await contract.verifyByHash(hex);
      if (exists) {
        setIsAlreadyRegistered({
          tokenId: tokenId.toString(),
          owner,
          timestamp: Number(timestamp)
        });
      }
    } catch (err) {
      console.warn("Could not pre-check registration status:", err);
    }
  }

  async function handleVerifyFileSelected(selectedFile) {
    if (!selectedFile) return;
    setVerifyFile(selectedFile);
    setVerifyResult(null);
    setVerifyStatus("");

    const buffer = await selectedFile.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    const hex = "0x" + [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    setVerifyHash(hex);

    // Automatically verify
    executeVerification(hex);
  }

  async function registerContent() {
    try {
      if (!account) await connectWallet();
      const onSepolia = await ensureSepoliaNetwork();
      if (!onSepolia) throw new Error("Please switch MetaMask to Sepolia Testnet.");

      if (!file || !hash) throw new Error("Please select a file to register.");
      if (isAlreadyRegistered) {
        throw new Error(`This content is already registered on Sepolia as NFT #${isAlreadyRegistered.tokenId}!`);
      }

      setRegisterStatus("1/4: Uploading and pinning file to IPFS via Pinata...");
      const ipfsData = await pinToIpfs(file, hash);
      const finalCid = ipfsData.cid || cid || "";
      setCid(finalCid);

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(registryAddress, REGISTRY_ABI, signer);

      setRegisterStatus(`2/4: Pinned to IPFS (${finalCid.slice(0, 12)}...). Confirm registration in your MetaMask wallet...`);
      const tx = await contract.registerContent(hash, finalCid);

      setRegisterStatus(`3/4: Transaction broadcast (Hash: ${tx.hash.slice(0, 14)}...). Waiting for Sepolia block confirmation...`);
      const receipt = await tx.wait();

      setRegisterStatus(`✓ Successfully registered on Sepolia! Block #${receipt.blockNumber} (Tx: ${tx.hash})`);

      // Update state so verify card is immediately in sync
      setIsAlreadyRegistered({
        tokenId: "Just Registered",
        owner: account,
        timestamp: Math.floor(Date.now() / 1000)
      });
      setVerifyFile(file);
      setVerifyHash(hash);
      executeVerification(hash);
    } catch (err) {
      setRegisterStatus(`Error: ${err.shortMessage || err.message}`);
    }
  }

  async function executeVerification(targetHash) {
    try {
      const hashToQuery = targetHash || verifyHash;
      if (!hashToQuery) throw new Error("Please select a file to verify.");

      // Always query Sepolia directly via reliable JSON-RPC
      const readProvider = getSepoliaReadProvider();
      const contract = new ethers.Contract(registryAddress, REGISTRY_ABI, readProvider);

      setVerifyStatus("Querying Sepolia blockchain registry...");
      const [exists, tokenId, owner, timestamp] = await contract.verifyByHash(hashToQuery);

      if (exists) {
        let ipfsCid = "";
        try {
          const rec = await contract.records(tokenId);
          ipfsCid = rec.ipfsCid;
        } catch (_) {}

        setVerifyResult({
          owner,
          tokenId: tokenId.toString(),
          timestamp: Number(timestamp),
          ipfsCid
        });
        setVerifyStatus("");
      } else {
        setVerifyResult(null);
        setVerifyStatus("✗ Content not registered on Sepolia.");
      }
    } catch (err) {
      setVerifyStatus(`Error: ${err.shortMessage || err.message}`);
    }
  }

  // Fetch listing terms for an IP
  async function queryMarketTerms() {
    try {
      if (!marketTokenId) throw new Error("Enter an IP Token ID.");

      const readProvider = getSepoliaReadProvider();
      const licenseContract = new ethers.Contract(licenseAddress, LICENSE_ABI, readProvider);

      setMarketStatus("Fetching licensing terms from Sepolia...");
      const terms = await licenseContract.listings(marketTokenId);
      setMarketTerms({
        price: ethers.formatEther(terms.price),
        rawPrice: terms.price,
        duration: Number(terms.duration),
        maxUses: Number(terms.maxUses),
        licenseType: Number(terms.licenseType),
        active: terms.active
      });
      setMarketStatus("");
    } catch (err) {
      setMarketTerms(null);
      setMarketStatus(`Error: ${err.shortMessage || err.message}`);
    }
  }

  // Buy License with ETH
  async function buyLicenseNft() {
    try {
      if (!account) await connectWallet();
      const onSepolia = await ensureSepoliaNetwork();
      if (!onSepolia) throw new Error("Please switch MetaMask to Sepolia Testnet.");

      if (!marketTokenId || !marketTerms) throw new Error("Search for a valid IP Token first.");
      if (!marketTerms.active) throw new Error("Licensing is currently not active for this IP.");

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const licenseContract = new ethers.Contract(licenseAddress, LICENSE_ABI, signer);

      setMarketStatus(`Initiating license purchase for ${marketTerms.price} Sepolia ETH... Confirm in MetaMask.`);
      const tx = await licenseContract.buyLicense(marketTokenId, {
        value: marketTerms.rawPrice
      });
      setMarketStatus("Transaction submitted to Sepolia. Awaiting block confirmation...");
      const receipt = await tx.wait();
      setMarketStatus(`✓ License NFT purchased on Sepolia! Block #${receipt.blockNumber} (Tx: ${receipt.hash})`);
    } catch (err) {
      setMarketStatus(`Error: ${err.shortMessage || err.message}`);
    }
  }

  // Set licensing terms (Creator)
  async function configureTerms() {
    try {
      if (!account) await connectWallet();
      const onSepolia = await ensureSepoliaNetwork();
      if (!onSepolia) throw new Error("Please switch MetaMask to Sepolia Testnet.");

      if (!termsTokenId) throw new Error("Specify the Parent Token ID.");

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const licenseContract = new ethers.Contract(licenseAddress, LICENSE_ABI, signer);

      const priceWei = ethers.parseEther(termsPrice || "0");
      const durationSec = parseInt(termsDurationDays || "0", 10) * 86400;
      const uses = parseInt(termsMaxUses || "0", 10);

      setTermsStatus("Confirm terms update in your MetaMask wallet...");
      const tx = await licenseContract.setListingTerms(
        termsTokenId,
        priceWei,
        durationSec,
        uses,
        parseInt(termsType, 10),
        termsActive
      );
      setTermsStatus("Awaiting block confirmation on Sepolia...");
      await tx.wait();
      setTermsStatus(`✓ Terms updated on-chain! Tx: ${tx.hash}`);
    } catch (err) {
      setTermsStatus(`Error: ${err.shortMessage || err.message}`);
    }
  }

  // Query License NFT data
  async function inspectLicense() {
    try {
      if (!inspectLicenseId) throw new Error("Specify a License Token ID.");

      const readProvider = getSepoliaReadProvider();
      const licenseContract = new ethers.Contract(licenseAddress, LICENSE_ABI, readProvider);

      setLicenseStatus("Reading License NFT data from Sepolia...");
      const owner = await licenseContract.ownerOf(inspectLicenseId);
      const isValid = await licenseContract.isLicenseValid(inspectLicenseId);
      const data = await licenseContract.getLicense(inspectLicenseId);

      setLicenseOwner(owner);
      setLicenseValid(isValid);
      setLicenseData({
        parentTokenId: data.parentTokenId.toString(),
        licensor: data.licensor,
        startTime: Number(data.startTime),
        endTime: Number(data.endTime),
        maxUses: Number(data.maxUses),
        used: Number(data.used),
        licenseType: Number(data.licenseType),
        active: data.active
      });
      setLicenseStatus("");
    } catch (err) {
      setLicenseData(null);
      setLicenseStatus(`Error: ${err.shortMessage || err.message}`);
    }
  }

  // Use License NFT
  async function triggerUseLicense() {
    try {
      if (!account) await connectWallet();
      const onSepolia = await ensureSepoliaNetwork();
      if (!onSepolia) throw new Error("Please switch MetaMask to Sepolia Testnet.");

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const licenseContract = new ethers.Contract(licenseAddress, LICENSE_ABI, signer);

      setLicenseStatus("Confirm usage transaction in MetaMask...");
      const tx = await licenseContract.useLicense(inspectLicenseId);
      setLicenseStatus("Waiting for confirmation on Sepolia...");
      await tx.wait();
      setLicenseStatus(`✓ License usage recorded! Tx: ${tx.hash}`);
      inspectLicense();
    } catch (err) {
      setLicenseStatus(`Error: ${err.shortMessage || err.message}`);
    }
  }

  // Revoke License (Licensor only)
  async function triggerRevokeLicense() {
    try {
      if (!account) await connectWallet();
      const onSepolia = await ensureSepoliaNetwork();
      if (!onSepolia) throw new Error("Please switch MetaMask to Sepolia Testnet.");

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const licenseContract = new ethers.Contract(licenseAddress, LICENSE_ABI, signer);

      setLicenseStatus("Confirm revocation in MetaMask...");
      const tx = await licenseContract.revokeLicense(inspectLicenseId);
      setLicenseStatus("Waiting for confirmation on Sepolia...");
      await tx.wait();
      setLicenseStatus(`✓ License revoked. Tx: ${tx.hash}`);
      inspectLicense();
    } catch (err) {
      setLicenseStatus(`Error: ${err.shortMessage || err.message}`);
    }
  }

  return (
    <main>
      <header>
        <div className="brand">
          <span className="eyebrow">Decentralized IP Platform</span>
          <h1>Intellectual Property & Licensing</h1>
          <p>Register verifiable ownership and license usage rights on Ethereum Sepolia.</p>
        </div>
        <div className="header-actions">
          {account && (
            isSepolia ? (
              <div className="network-pill correct">Sepolia Testnet</div>
            ) : (
              <button className="network-pill wrong" onClick={ensureSepoliaNetwork}>
                Switch to Sepolia
              </button>
            )
          )}
          <button className="wallet" onClick={connectWallet}>
            {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "Connect Wallet"}
          </button>
        </div>
      </header>

      {/* Warning banner if wrong network */}
      {account && !isSepolia && (
        <div className="network-banner">
          <span>You are connected to the wrong network. Switch MetaMask to <b>Sepolia Testnet</b> to interact with the deployed contracts.</span>
          <button onClick={ensureSepoliaNetwork}>Switch Network</button>
        </div>
      )}

      {/* Navigation Tabs */}
      <nav className="nav-tabs">
        <button
          className={`nav-tab ${tab === "register" ? "active" : ""}`}
          onClick={() => setTab("register")}
        >
          Registration & Proof
        </button>
        <button
          className={`nav-tab ${tab === "marketplace" ? "active" : ""}`}
          onClick={() => setTab("marketplace")}
        >
          Licensing Marketplace
        </button>
        <button
          className={`nav-tab ${tab === "creator" ? "active" : ""}`}
          onClick={() => setTab("creator")}
        >
          Creator Terms
        </button>
        <button
          className={`nav-tab ${tab === "my-licenses" ? "active" : ""}`}
          onClick={() => setTab("my-licenses")}
        >
          Verify & Use Licenses
        </button>
      </nav>

      {/* Tab 1: Registration & Proof */}
      {tab === "register" && (
        <div className="grid-2">
          <section className="card">
            <h2>Register IP Content</h2>
            <p className="muted">
              Hashes your file locally in the browser and records cryptographic ownership on Sepolia.
            </p>
            <label className="drop">
              <input
                type="file"
                onChange={(e) => handleRegisterFileSelected(e.target.files[0])}
              />
              {file ? file.name : "Click or drop file to hash"}
            </label>
            {hash && (
              <div className="hash-box">
                <label>SHA-256 Digest</label>
                <code>{hash}</code>
              </div>
            )}

            {isAlreadyRegistered && (
              <div className="result-card" style={{ marginBottom: "20px" }}>
                <h3 style={{ color: "#ffffff" }}>ℹ Already Registered on Sepolia</h3>
                <div className="result-row">
                  <span>NFT Token ID</span>
                  <strong>#{isAlreadyRegistered.tokenId}</strong>
                </div>
                <div className="result-row">
                  <span>Owner</span>
                  <strong>{isAlreadyRegistered.owner}</strong>
                </div>
                <div className="result-row">
                  <span>Registered</span>
                  <strong>{new Date(isAlreadyRegistered.timestamp * 1000).toLocaleString()}</strong>
                </div>
              </div>
            )}

            <div className="form-group">
              <label>Optional IPFS CID / URI</label>
              <input
                type="text"
                placeholder="ipfs://bafy..."
                value={cid}
                onChange={(e) => setCid(e.target.value)}
              />
            </div>
            <button
              className="primary"
              onClick={registerContent}
              disabled={Boolean(isAlreadyRegistered)}
            >
              {isAlreadyRegistered ? "Already Registered On-Chain" : "Register On Sepolia"}
            </button>
            {registerStatus && <div className="status-msg">{registerStatus}</div>}
          </section>

          <section className="card">
            <h2>Verify Ownership Evidence</h2>
            <p className="muted">
              Select any file to calculate its SHA-256 hash and immediately verify registered ownership on Sepolia.
            </p>
            <label className="drop">
              <input
                type="file"
                onChange={(e) => handleVerifyFileSelected(e.target.files[0])}
              />
              {verifyFile ? verifyFile.name : "Choose file to verify"}
            </label>
            {verifyHash && (
              <div className="hash-box">
                <label>File Hash</label>
                <code>{verifyHash}</code>
              </div>
            )}
            <button className="primary" onClick={() => executeVerification(verifyHash)}>
              Verify On Blockchain
            </button>
            {verifyStatus && <div className="status-msg">{verifyStatus}</div>}

            {verifyResult && (
              <div className="result-card">
                <h3>✓ Verifiable On-Chain Record</h3>
                <div className="result-row">
                  <span>Registered Owner</span>
                  <strong>{verifyResult.owner}</strong>
                </div>
                <div className="result-row">
                  <span>Token ID</span>
                  <strong>#{verifyResult.tokenId}</strong>
                </div>
                <div className="result-row">
                  <span>Timestamp</span>
                  <strong>{new Date(verifyResult.timestamp * 1000).toLocaleString()}</strong>
                </div>
                {verifyResult.ipfsCid && (
                  <div className="result-row">
                    <span>IPFS Evidence</span>
                    <a
                      href={ipfsUrl(verifyResult.ipfsCid)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: "#38bdf8",
                        textDecoration: "underline",
                        wordBreak: "break-all",
                        fontWeight: 600
                      }}
                    >
                      {verifyResult.ipfsCid} ↗
                    </a>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Tab 2: Licensing Marketplace */}
      {tab === "marketplace" && (
        <section className="card" style={{ maxWidth: "680px", margin: "0 auto" }}>
          <h2>Buy License NFT</h2>
          <p className="muted">
            Acquire rights (personal, commercial, or exclusive) by purchasing an official License NFT on Sepolia.
          </p>
          <div className="form-group">
            <label>IP Token ID to License</label>
            <div style={{ display: "flex", gap: "10px" }}>
              <input
                type="number"
                placeholder="e.g. 1"
                value={marketTokenId}
                onChange={(e) => setMarketTokenId(e.target.value)}
              />
              <button className="secondary" onClick={queryMarketTerms}>
                Inspect Terms
              </button>
            </div>
          </div>

          {marketTerms && (
            <div className="result-card">
              <h3>Licensing Terms for IP #{marketTokenId}</h3>
              <div className="result-row">
                <span>Status</span>
                <span className={`badge ${marketTerms.active ? "active" : "inactive"}`}>
                  {marketTerms.active ? "Open for Purchase" : "Inactive"}
                </span>
              </div>
              <div className="result-row">
                <span>Price</span>
                <strong>{marketTerms.price} Sepolia ETH</strong>
              </div>
              <div className="result-row">
                <span>License Type</span>
                <strong>{LICENSE_TYPES[marketTerms.licenseType] || "Standard"}</strong>
              </div>
              <div className="result-row">
                <span>Duration</span>
                <strong>{marketTerms.duration === 0 ? "Perpetual" : `${marketTerms.duration / 86400} days`}</strong>
              </div>
              <div className="result-row">
                <span>Usage Limit</span>
                <strong>{marketTerms.maxUses === 0 ? "Unlimited" : `${marketTerms.maxUses} uses`}</strong>
              </div>

              <div style={{ marginTop: "16px" }}>
                <button
                  className="primary"
                  onClick={buyLicenseNft}
                  disabled={!marketTerms.active}
                >
                  Purchase License NFT ({marketTerms.price} ETH)
                </button>
              </div>
            </div>
          )}
          {marketStatus && <div className="status-msg">{marketStatus}</div>}
        </section>
      )}

      {/* Tab 3: Creator Terms */}
      {tab === "creator" && (
        <section className="card" style={{ maxWidth: "680px", margin: "0 auto" }}>
          <h2>Set Licensing Terms</h2>
          <p className="muted">
            Configure prices and parameters for users wishing to buy rights to your registered IP NFT on Sepolia.
          </p>
          <div className="form-group">
            <label>Your Registered Parent IP Token ID</label>
            <input
              type="number"
              placeholder="e.g. 1"
              value={termsTokenId}
              onChange={(e) => setTermsTokenId(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>License Price (Sepolia ETH)</label>
            <input
              type="text"
              placeholder="0.05"
              value={termsPrice}
              onChange={(e) => setTermsPrice(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Duration in Days (0 = Perpetual)</label>
            <input
              type="number"
              placeholder="30"
              value={termsDurationDays}
              onChange={(e) => setTermsDurationDays(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Max Uses (0 = Unlimited)</label>
            <input
              type="number"
              placeholder="100"
              value={termsMaxUses}
              onChange={(e) => setTermsMaxUses(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>License Type</label>
            <select
              value={termsType}
              onChange={(e) => setTermsType(e.target.value)}
            >
              <option value={0}>Personal</option>
              <option value={1}>Commercial</option>
              <option value={2}>Exclusive</option>
            </select>
          </div>
          <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <input
              type="checkbox"
              id="activeTerms"
              checked={termsActive}
              onChange={(e) => setTermsActive(e.target.checked)}
            />
            <label htmlFor="activeTerms" style={{ margin: 0, cursor: "pointer" }}>
              Make License Active for Purchase
            </label>
          </div>

          <button className="primary" onClick={configureTerms}>
            Publish Licensing Terms
          </button>
          {termsStatus && <div className="status-msg">{termsStatus}</div>}
        </section>
      )}

      {/* Tab 4: Verify & Use Licenses */}
      {tab === "my-licenses" && (
        <section className="card" style={{ maxWidth: "680px", margin: "0 auto" }}>
          <h2>Verify & Use License NFT</h2>
          <p className="muted">
            Inspect the on-chain validity of a License NFT on Sepolia and trigger usage entitlements.
          </p>
          <div className="form-group">
            <label>License NFT Token ID</label>
            <div style={{ display: "flex", gap: "10px" }}>
              <input
                type="number"
                placeholder="e.g. 1"
                value={inspectLicenseId}
                onChange={(e) => setInspectLicenseId(e.target.value)}
              />
              <button className="secondary" onClick={inspectLicense}>
                Inspect License
              </button>
            </div>
          </div>

          {licenseData && (
            <div className="result-card">
              <h3>License NFT #{inspectLicenseId}</h3>
              <div className="result-row">
                <span>License Validity</span>
                <span className={`badge ${licenseValid ? "active" : "inactive"}`}>
                  {licenseValid ? "Valid & Active" : "Invalid / Expired / Exhausted"}
                </span>
              </div>
              <div className="result-row">
                <span>Parent IP Token</span>
                <strong>#{licenseData.parentTokenId}</strong>
              </div>
              <div className="result-row">
                <span>Licensee (Owner)</span>
                <strong>{licenseOwner}</strong>
              </div>
              <div className="result-row">
                <span>Licensor (Creator)</span>
                <strong>{licenseData.licensor}</strong>
              </div>
              <div className="result-row">
                <span>Type</span>
                <strong>{LICENSE_TYPES[licenseData.licenseType] || "Personal"}</strong>
              </div>
              <div className="result-row">
                <span>Usage</span>
                <strong>
                  {licenseData.used} / {licenseData.maxUses === 0 ? "Unlimited" : licenseData.maxUses}
                </strong>
              </div>
              <div className="result-row">
                <span>Expiration</span>
                <strong>
                  {licenseData.endTime === 0
                    ? "Never (Perpetual)"
                    : new Date(licenseData.endTime * 1000).toLocaleString()}
                </strong>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                <button
                  className="primary"
                  onClick={triggerUseLicense}
                  disabled={!licenseValid || account.toLowerCase() !== licenseOwner.toLowerCase()}
                >
                  Use License Right
                </button>
                <button
                  className="secondary"
                  onClick={triggerRevokeLicense}
                  disabled={!licenseData.active}
                >
                  Revoke
                </button>
              </div>
            </div>
          )}
          {licenseStatus && <div className="status-msg">{licenseStatus}</div>}
        </section>
      )}

      {/* Feature summary footer */}
      <footer className="feature-grid">
        <div className="feature-box">
          <b>Proof of Existence</b>
          <span>SHA-256 content hashing with immutable timestamping</span>
        </div>
        <div className="feature-box">
          <b>ERC-721 IP Registry</b>
          <span>Cryptographic NFTs represent registered original works</span>
        </div>
        <div className="feature-box">
          <b>ERC-721 License NFTs</b>
          <span>Payable, time-bound & commercial usage rights minted on-chain</span>
        </div>
        <div className="feature-box">
          <b>ERC-2981 Royalties</b>
          <span>Configurable creator royalty standards and direct payout flows</span>
        </div>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
