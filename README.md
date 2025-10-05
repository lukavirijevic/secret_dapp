# SecretRegistry DApp - Shamir M-of-N (Ethereum Sepolia)

Decentralizovana aplikacija za bezbedno deljenje tajni korišćenjem Shamir M-of-N šeme.
- On-chain - čuvanje metapodataka i potvrde učesnika, dok se stvarni delovi tajne dele i čuvaju 
- Off-chain - šifrovani javnim ključem svakog učesnika

----------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**Funkcionalnosti**

- Register: vlasnik upisuje secretId (iz label-a), prag M, listu učesnika N, i secretHash.

- Confirm receipt: svaki učesnik on-chain potvrđuje prijem svog (off-chain) šifrovanog dela.

- Can Reconstruct: vraća true kada potvrde ≥ M (ispunjen prag).

- Close secret: vlasnik zatvara zapis (dalje potvrde nisu moguće).

----------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**Arhitektura**

```
contracts/
--SecretRegistry.sol          
frontend/                     
--src/App.jsx                 
--src/App.css                
--src/deployments/sepolia.json
offchain/
--participants.json           
--make_shares_encrypt.ts      
--out/<secretId>/bundle.json 
scripts/
--deploy.ts                  
test/
--SecretRegistry.ts
```

----------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**Instalacija i pokretanje**

U rootu projekta: 

```
npm install
npx hardhat compile
npx hardhat test
```

----------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**Frontend (Vite + React)**

```
cd frontend
npm install
npm run dev
```

U UI:

1. **Connect MetaMask** (izaberi nalog).

2. **Registracija** (sekcija 1):

- Secret label (npr. backup#2025-10 → UI prikazuje secretId)

- Učesnici (EVM adrese, zarezom)

- Prag M (1..N)

- Register Secret

3. **Potvrda** (sekcija 2):

- Nalepi isti secretId

- Svaki učesnik (sa svojom adresom) → Confirm receipt

- Can reconstruct? → DA kad potvrde ≥ M

----------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**Off-chain alat (Shamir + ECIES)**

Popunite offchain/participants.json:

```
[
  { "address": "0x...", "pubkey": "0x04...(130 heks)" },
  { "address": "0x...", "pubkey": "0x04...(130 heks)" }
]
```


U offchain/make_shares_encrypt.ts podesite:

```
const label = "secret#demo";           
const secretPlaintext = "OVDE TAJNA"; 
const salt = "neki-string";           
const M = 2;
```

Pokreni:
```
npm run offchain:gen
```

Rezultat:
```
offchain/out/<secretId>/bundle.json
```

----------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**Testovi**

```
npx hardhat test
```

Test pokriva:

- registerSecret → emit SecretRegistered

- confirmReceipt → samo učesnik, emit ReceiptConfirmed

- canReconstruct → true kad potvrde ≥ M

- closeSecret → samo owner, emit SecretClosed, posle čega potvrda revertuje


```
