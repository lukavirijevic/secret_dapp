import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import secrets from "secrets.js-grempe";
import { encrypt } from "eciesjs";
import { keccak256, toUtf8Bytes } from "ethers";
import { Buffer } from "node:buffer";
import { TextEncoder } from "node:util";
import { getBytes } from "ethers"; 

const label = "secret#demo";                 
const secretPlaintext = "postavljam loz=nku za probu iz kriptografije";    
const salt = "neki.string123";              

const M = 2;                                 
const participantsPath = "offchain/participants.json"; 

function calcSecretId(lbl: string) {
  return keccak256(toUtf8Bytes(lbl));
}

function calcSecretHash(secret: string, s: string) {
  return keccak256(toUtf8Bytes("hash:" + secret + ":" + s));
}

type Participant = { address: string; pubkey: string };

function ensureNo0x(hex: string) {
  return hex.startsWith("0x") ? hex.slice(2) : hex;
}

async function main() {
  const participants: Participant[] = JSON.parse(readFileSync(participantsPath, "utf8"));
  const N = participants.length;
  if (N < M) throw new Error(`N (${N}) mora biti >= M (${M})`);
  if (N === 0) throw new Error("Lista učesnika je prazna.");

  const secretId = calcSecretId(label);
  const secretHash = calcSecretHash(secretPlaintext, salt);

  const secretHex = Buffer.from(secretPlaintext, "utf8").toString("hex");
  const shares = secrets.share(secretHex, N, M); 

  const encrypted: Record<string, string> = {};
  for (let i = 0; i < N; i++) {
    const p = participants[i];

    const pubkeyBytes = getBytes(p.pubkey); 

    const plain = new TextEncoder().encode(shares[i]); 

    const cipher = encrypt(pubkeyBytes, plain) as Uint8Array;

    const base64 = Buffer
      .from(cipher.buffer, cipher.byteOffset, cipher.byteLength)
      .toString("base64");

    encrypted[p.address] = base64;
  }

  const outDir = `offchain/out/${secretId}`;
  mkdirSync(outDir, { recursive: true });
  const bundle = {
    label,
    secretId,
    secretHash,
    salt, 
    M,
    N,
    participants: participants.map(p => p.address),
    encryptedSharesBase64: encrypted
  };
  writeFileSync(`${outDir}/bundle.json`, JSON.stringify(bundle, null, 2));

  console.log("Bundle:", `${outDir}/bundle.json`);
  console.log("U UI-ju koristi label =", label, " i iste adrese (redosled nije bitan).");
  console.log("Prag M =", M, ", N =", N);
}

main().catch(e => { console.error(e); process.exit(1); });
