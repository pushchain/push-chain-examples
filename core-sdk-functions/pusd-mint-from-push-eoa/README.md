# Mint PUSD from a Native Push EOA

Mint **PUSD** on Push Chain from a native Push externally-owned account — Push Wallet, or any private key signing directly against the Donut RPC. This is **Path B** of PUSD's two integration patterns.

- [PUSD docs](https://pusd.push.org/docs)

## 🚀 Quick Start

```bash
cp .env.sample .env       # set PUSH_PRIVATE_KEY (optional; generated if unset)
npm install
npm start
```

## 📋 Overview

A native Push EOA is a regular EVM externally-owned account on Donut — there's no relay-managed multicall in front of it. So minting PUSD takes **two separate signed transactions**:

1. `USDT.approve(PUSDManager, amount)` — let the manager pull your USDT.
2. `PUSDManager.deposit(USDT, amount, recipient)` — mints PUSD 1:1 to the recipient.

Path B assumes the reserve token is **already on Donut**. If you hold USDT on Sepolia or another origin chain, use [Path A — pusd-mint-from-external-chain](../pusd-mint-from-external-chain) instead. Path A bridges via `funds` and packs both legs into one multicall under one signature.

### What You'll Learn

- The two-signature mint flow for native Push EOAs.
- How Path B differs from Path A (no multicall, no bridging).
- How to verify a mint by reading PUSD balance before and after.

## 🔄 Transaction Flow

```
Push EOA (signer)
   │
   │ Tx 1 (signature 1 of 2): USDT.approve(PUSDManager, amount)
   │ ─────────────────────────────────────────────────────────► confirmed
   │
   │ Tx 2 (signature 2 of 2): PUSDManager.deposit(USDT, amount, recipient)
   │ ─────────────────────────────────────────────────────────► PUSD minted
```

## 💻 Code Highlights

```ts
// Tx 1: approve
const approveData = PushChain.utils.helpers.encodeTxData({
  abi: APPROVE_ABI,
  functionName: 'approve',
  args: [PUSD_MANAGER, amount],
});
await (await pushChainClient.universal.sendTransaction({
  to: USDT_DONUT,
  value: 0n,
  data: approveData,
})).wait();

// Tx 2: deposit
const depositData = PushChain.utils.helpers.encodeTxData({
  abi: DEPOSIT_ABI,
  functionName: 'deposit',
  args: [USDT_DONUT, amount, recipient],
});
await (await pushChainClient.universal.sendTransaction({
  to: PUSD_MANAGER,
  value: 0n,
  data: depositData,
})).wait();
```

## 🎯 Key Concepts

### Path B = native Push EOA, no multicall

Native Push EOAs are plain EVM accounts. The universal transaction layer relays each call as a single ordinary tx — there's no relay-side multicall. Mint therefore requires two signatures.

### Why no bridging on Path B?

`funds` triggers a bridge from the origin chain into the user's Push account. A native Push EOA's "origin" is already Push, so there's nothing to bridge — the script just transacts directly against the Donut RPC.

### Surplus haircut

`PUSDManager.deposit` mints `amount - floor(amount * surplusHaircutBps / 10000)` PUSD. Default haircut is **0 bps** (1:1 mint). The mechanism exists to deprecate risky tokens, not as a fee — surplus stays in the reserve.

## 📦 Dependencies

- `@pushchain/core` — `"latest"` (pinned to track the SDK)
- `ethers` — wallet, provider, contract reads
- `dotenv` — load `PUSH_PRIVATE_KEY` from `.env`

## 🔧 Setup Requirements

- A Push native EOA with:
  - **PC** for gas — get from [https://faucet.push.org/](https://faucet.push.org/).
  - **USDT on Donut** (≥ the deposit amount). The easiest way to get USDT.eth, USDT.sol, USDT.bsc, USDT.base, USDT.arb (or the matching USDC origins) onto Donut is the official Push Bridge UI: **<https://bridge.push.org/>** — connect your origin-chain wallet, pick the token, send. It lands on Donut at this same EOA address.
    - Alternatively (programmatic path): run [pusd-mint-from-external-chain](../pusd-mint-from-external-chain) with the same private key — it bridges Sepolia USDT in via a universal transaction.
    - Or: have someone transfer USDT (Donut representation, `0xCA0C5E6F002A389E1580F0DB7cd06e4549B5F9d3`) directly to this address.
- Node.js v18+.

## 📊 Example Output

```
🌟 Mint PUSD from Native Push EOA — two sequential signatures

1. Build Push native signer
🔑 Using PUSH_PRIVATE_KEY from environment.
📍 Push EOA: 0x1234…
🚀 Got push chain client

2. Pre-flight balance check
📊 PC  balance: 1.5 PC (need some for gas)
📊 USDT balance: 50 USDT (need ≥ 1 to mint 1 PUSD)

💰 PUSD balance BEFORE: 0 PUSD

3. Tx 1 of 2 — approve(PUSDManager, amount)
📤 approve hash: 0x…
✅ approve confirmed

4. Tx 2 of 2 — deposit(USDT, amount, recipient)
📤 deposit hash: 0x…
✅ deposit confirmed

💰 PUSD balance AFTER:  1 PUSD
```

## 🔗 Related Examples

- **[pusd-mint-from-external-chain](../pusd-mint-from-external-chain)** — Path A: external-chain origin, multicall + bridging in one signature.
- **[pusd-redeem](../pusd-redeem)** — Burn PUSD for a reserve token (single signature on either path).
- **[pusd-read-state](../pusd-read-state)** — Inspect PUSD supply, fees, reserves.

## 🎓 Learn More

- [PUSD overview](https://pusd.push.org/docs)
- [Push Chain RPC](https://push.org/docs/chain/build/reading-blockchain-state)
