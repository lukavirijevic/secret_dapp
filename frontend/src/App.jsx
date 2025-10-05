import { useEffect, useMemo, useState } from "react";
import { ethers, SigningKey } from "ethers"; 
import SecretRegistryArtifact from "./artifacts/SecretRegistry.json";
import deployed from "./deployments/sepolia.json";
import "./App.css";

const CONTRACT_ADDRESS = deployed.SecretRegistry;

export default function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState("");
  const [contract, setContract] = useState(null);
  const [pending, setPending] = useState(false);

  const [secretLabel, setSecretLabel] = useState("secret#1");
  const [participantsCsv, setParticipantsCsv] = useState("");
  const [thresholdM, setThresholdM] = useState(1);
  const [secretIdHex, setSecretIdHex] = useState("");

  const [status, setStatus] = useState(null);

  const [myPubkey, setMyPubkey] = useState("");

  const secretIdFromLabel = useMemo(() => {
    try { return ethers.keccak256(ethers.toUtf8Bytes(secretLabel)); } catch { return ""; }
  }, [secretLabel]);

  useEffect(() => {
    if (!window.ethereum) return;
    setProvider(new ethers.BrowserProvider(window.ethereum));
  }, []);

  async function connect() {
    if (!provider) return alert("Instaliraj MetaMask.");
    await provider.send("eth_requestAccounts", []);
    const s = await provider.getSigner();
    setSigner(s);
    const acc = await s.getAddress();
    setAccount(acc);

    const net = await provider.getNetwork();
    if (net.chainId !== 11155111n) {
      alert("Prebaci MetaMask na Sepolia mrežu.");
      return;
    }
    const c = new ethers.Contract(CONTRACT_ADDRESS, SecretRegistryArtifact.abi, s);
    setContract(c);
  }

  async function loadStatus(sid) {
    if (!contract || !sid) { setStatus(null); return; }
    try {
      const res = await contract.getSecret(sid);
      const owner = res[0];
      const m = Number(res[1]);
      const active = res[3];
      const participants = res[5];
      const confirmations = Number(res[6]);

      const youParticipant = account ? await contract.isParticipant(sid, account) : false;
      const youConfirmed  = account ? await contract.hasConfirmed(sid, account) : false;

      setStatus({ owner, thresholdM: m, active, participants, confirmations, youParticipant, youConfirmed });
    } catch {
      setStatus(null);
    }
  }

  useEffect(() => { if (secretIdHex) loadStatus(secretIdHex); }, [contract, account, secretIdHex]);

  async function registerSecret() {
    if (!contract) return alert("Prvo Connect.");
    const list = participantsCsv.split(",").map(x => x.trim()).filter(Boolean);
    if (list.length === 0) return alert("Unesi bar jednu adresu učesnika (zarezom).");
    if (thresholdM < 1 || thresholdM > list.length) return alert(`M mora biti 1..${list.length}`);

    const sid = secretIdFromLabel;
    if (!sid) return alert("secretLabel nije validan.");
    const secretHash = ethers.keccak256(ethers.toUtf8Bytes(secretLabel));

    try {
      setPending(true);
      const tx = await contract.registerSecret(sid, Number(thresholdM), list, secretHash);
      await tx.wait();
      setSecretIdHex(sid);
      await loadStatus(sid);
      toast("Registrovano");
    } catch (e) {
      console.error(e); toast("Greška pri registraciji");
    } finally {
      setPending(false);
    }
  }

  async function confirmReceipt() {
    if (!contract) return toast("Prvo Connect.");
    if (!secretIdHex) return toast("Upiši secretId (0x...)");
    try {
      setPending(true);
      const tx = await contract.confirmReceipt(secretIdHex);
      await tx.wait();
      await loadStatus(secretIdHex);
      toast("Potvrđeno");
    } catch (e) {
      console.error(e); toast("Greška pri potvrdi");
    } finally {
      setPending(false);
    }
  }

  async function checkCanReconstruct() {
    if (!contract) return toast("Prvo Connect.");
    if (!secretIdHex) return toast("Upiši secretId (0x...)");
    try {
      const ok = await contract.canReconstruct(secretIdHex);
      toast(ok ? "DA, M je dostignut" : "NE, M nije dostignut");
    } catch (e) {
      console.error(e); toast("Greška pri proveri");
    }
  }

  async function exportPubkey() {
    if (!signer) return toast("Prvo Connect.");
    const message = "Export encryption pubkey for SecretRegistry";
    const signature = await signer.signMessage(message);
    const digest = ethers.keccak256(ethers.toUtf8Bytes(message));
    const pubkey = SigningKey.recoverPublicKey(digest, signature); 
    setMyPubkey(pubkey);
    await navigator.clipboard.writeText(pubkey);
    toast("Javni ključ kopiran");
  }

  const confirmDisabled =
    pending || !status || !status.active || !status.youParticipant || status.youConfirmed;

  function copy(text) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => toast("Kopirano"));
  }

  function toast(msg) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add("show"), 10);
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 200);
    }, 1800);
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>SecretRegistry</h1>
          <p className="subtitle">Shamir M-of-N</p>
        </div>
        {!account ? (
          <button className="btn btn-primary" onClick={connect}>
            Connect MetaMask
          </button>
        ) : (
          <div className="account">
            <div className="mono">{account}</div>
            <div className="mono dim"> {CONTRACT_ADDRESS}</div>
          </div>
        )}
      </header>

      <section className="card" style={{ marginBottom: 12 }}>
        <h2 className="card-title">Moj enkripcioni javni ključ</h2>
        <div className="row">
          <button className="btn btn-outline" onClick={exportPubkey}>
            Generate & copy pubkey
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => myPubkey && navigator.clipboard.writeText(myPubkey)}
            disabled={!myPubkey}
          >
            Copy
          </button>
        </div>
        {myPubkey && (
          <div className="helper">
            Pubkey: <code className="mono">{myPubkey}</code>
          </div>
        )}
      </section>

      <div className="grid">
        <section className="card">
          <h2 className="card-title">1) Registracija tajne</h2>

          <label className="label">Secret label</label>
          <div className="row">
            <input
              className="input"
              value={secretLabel}
              onChange={(e) => setSecretLabel(e.target.value)}
              placeholder="npr. backup#2025-10"
            />
            <button className="btn btn-ghost" onClick={() => copy(secretLabel)}>Copy</button>
          </div>

          <div className="helper">
            secretId = <code className="mono">{secretIdFromLabel}</code>
            <button className="btn btn-link" onClick={() => copy(secretIdFromLabel)}>copy</button>
          </div>

          <label className="label">Učesnici (adrese, zarezom)</label>
          <textarea
            className="input textarea"
            rows={2}
            placeholder="0xabc..., 0xdef..., 0x123..."
            value={participantsCsv}
            onChange={(e) => setParticipantsCsv(e.target.value)}
          />

          <div className="row">
            <div className="stack">
              <label className="label">Prag M</label>
              <input
                type="number"
                min={1}
                className="input small"
                value={thresholdM}
                onChange={(e) => setThresholdM(e.target.valueAsNumber || 1)}
              />
            </div>
          </div>

          <div className="register-actions">
            <button
              className="btn btn-primary"
              onClick={registerSecret}
              disabled={!contract || pending}
            >
              {pending ? "Čekam..." : "Register Secret"}
            </button>
          </div>
        </section>

        <section className="card">
          <h2 className="card-title">2) Potvrda i provera</h2>

          <label className="label">secretId (0x...)</label>
          <div className="row">
            <input
              className="input"
              value={secretIdHex}
              onChange={(e) => setSecretIdHex(e.target.value)}
              placeholder="0x..."
            />
            <button className="btn btn-ghost" onClick={() => copy(secretIdHex)} disabled={!secretIdHex}>
              Copy
            </button>
          </div>

          <div className="row row-actions">
            <button className="btn" onClick={confirmReceipt} disabled={confirmDisabled}>
              {status?.youConfirmed ? "Već potvrđeno" : pending ? "Čekam..." : "Confirm receipt"}
            </button>
            <button className="btn btn-outline" onClick={checkCanReconstruct} disabled={!contract || pending}>
              Can reconstruct?
            </button>
          </div>

          {status && (
            <div className="status">
              <div className="pill">Owner: <span className="mono">{status.owner}</span></div>
              <div className={`pill ${status.active ? "ok" : "warn"}`}>
                Active: {status.active ? "DA" : "NE"}
              </div>
              <div className="pill">M: {status.thresholdM}</div>
              <div className="pill">N: {status.participants.length}</div>
              <div className="pill">Confirmations: {status.confirmations}</div>
              <div className="pill">
                Ti si učesnik: {status.youParticipant ? "DA" : "NE"} •&nbsp;
                Potvrdio: {status.youConfirmed ? "DA" : "NE"}
              </div>
            </div>
          )}
        </section>
      </div>

    </div>
  );
}
