# Mint PUSD from an External Chain

Mint **PUSD** on Push Chain by depositing USDT from **Ethereum Sepolia**, in a single signature. This is **Path A** of PUSD's two integration patterns — the recommended path for any external-chain wallet (MetaMask, viem, ethers signer on Sepolia, Phantom on Solana, etc.).

- [PUSD docs](https://pusd.push.org/docs)
- [Push Chain Universal Transactions](https://push.org/docs/chain/build/send-universal-transaction)

## 🚀 Quick Start

```bash
cp .env.sample .env       # set SEPOLIA_PRIVATE_KEY (optional; generated if unset)
npm install
npm start
```

If `SEPOLIA_PRIVATE_KEY` is set, the script reuses that wallet on every run (so the same UEA on Push keeps accumulating PUSD). If unset, the script generates a fresh Sepolia wallet, prints the private key, and prompts you to fund it. Reuse the same key when running [`pusd-redeem`](../pusd-redeem) Scenario 2 — that lets the cross-chain redeem cascade pull from the UEA you just minted into.

## 📋 Overview

PUSD is a 6-decimal ERC-20 stablecoin pegged 1:1 to reserve stablecoins (USDC / USDT bridged from Ethereum, Base, Arbitrum, Solana, BNB) on Push Chain Donut Testnet (chain 42101). The PUSDManager contract holds `MINTER_ROLE` on PUSD and mints exactly `amount − surplusHaircut` PUSD to the recipient when you call `deposit(token, amount, recipient)`.

This example runs the canonical external-chain mint flow:

1. **Bridge** — the universal tx's `funds` parameter moves your Sepolia USDT into your Push Chain account.
2. **Approve** — multicall leg 1 calls `USDT.approve(PUSDManager, amount)`.
3. **Deposit** — multicall leg 2 calls `PUSDManager.deposit(USDT, amount, recipient)`, which mints PUSD.

All three steps ride in **one signature** because external-chain wallets get a relay-managed Push account that supports multicall.

### What You'll Learn

- How to bridge USDT into Push Chain via `funds` on a universal transaction.
- How to encode and pack a multicall (`approve + deposit`) into one universal tx.
- How to verify a mint by reading PUSD balance before and after.

## 🔄 Transaction Flow

```
Ethereum Sepolia (origin)            Push Chain (execution)
       │                                    │
       │  funds: {amount, USDT}             │
       │ ─────────────────────────────►     │  bridge → user's UEA holds USDT
       │                                    │
       │  data: [approve, deposit]          │
       │ ─────────────────────────────►     │  multicall:
       │                                    │   1. USDT.approve(PUSDManager)
       │                                    │   2. PUSDManager.deposit(...)
       │                                    │ → mints PUSD to recipient
```

## 💻 Code Highlights

The full multicall + bridge call:

```ts
const tx = await pushChainClient.universal.sendTransaction({
  to: ZERO_ADDRESS,                      // sentinel = multicall mode
  value: 0n,
  data: [
    { to: USDT_DONUT,    value: 0n, data: approveData },
    { to: PUSD_MANAGER,  value: 0n, data: depositData },
  ],
  funds: {
    amount,                              // 1 USDT (6 decimals)
    token: pushChainClient.moveable.token.USDT,
  },
});
await tx.wait();
```

Encoding the legs:

```ts
const approveData = PushChain.utils.helpers.encodeTxData({
  abi: APPROVE_ABI,
  functionName: 'approve',
  args: [PUSD_MANAGER, amount],
});

const depositData = PushChain.utils.helpers.encodeTxData({
  abi: DEPOSIT_ABI,
  functionName: 'deposit',
  args: [USDT_DONUT, amount, recipient],
});
```

## 🎯 Key Concepts

### Outer `to: ZERO_ADDRESS` is required

The universal transaction layer treats `to = 0x0` as the signal to interpret `data` as an array of `{to, value, data}` legs. Any non-zero `to` is treated as a single call.

### `funds` carries the bridge step

When the user holds the reserve token on the origin chain (USDT on Sepolia, here), `funds: { amount, token }` tells the relay to bridge those tokens into the user's Push account before the multicall runs. If the user already has USDT sitting on Donut, omit `funds`.

### Surplus haircut

`PUSDManager.deposit` mints `amount - floor(amount * surplusHaircutBps / 10000)` PUSD to the recipient. The default haircut on every reserve token is **0 bps** (you mint 1:1). The mechanism exists to deprecate risky tokens, not as a fee — surplus stays in the reserve.

## 📦 Dependencies

- `@pushchain/core` — `"latest"` (pinned to track the SDK)
- `viem` — wallet + public client on Sepolia and Donut

## 🔧 Setup Requirements

- **Sepolia ETH** for the origin transaction's gas. Faucet: <https://cloud.google.com/application/web3/faucet/ethereum/sepolia>.
- **USDT on Sepolia** at address `0x7169D38820dfd117C3FA1f22a697dBA58d90BA06` — this is the real test ERC-20 on Sepolia. Mint via the contract's `mint` function on [Sepolia Etherscan](https://sepolia.etherscan.io/address/0x7169D38820dfd117C3FA1f22a697dBA58d90BA06#writeContract).
  > ⚠️ Don't confuse this with `0xCA0C5E6F002A389E1580F0DB7cd06e4549B5F9d3` — that is the **Donut representation** of Sepolia USDT (where the relay bridges to and where the multicall approves + deposits). The Donut address only exists on Push Chain, not on Sepolia.
- Node.js v18+.

## 📊 Example Output

```
🌟 Mint PUSD from External Chain — Sepolia origin → PUSD on Push Chain

1. Create Universal Signer (Sepolia)
🔑 Got account: 0x1234…
🔑 Got universal signer

2. Initialize Push Chain Client
🚀 Got push chain client
📍 Recipient (Push UEA): 0xabcd…

3. Fund the Sepolia account to cover the origin transaction
…Please send Sepolia ETH to 0x1234…
…Please send at least 1 USDT (Sepolia) to 0x1234…

📊 Sepolia ETH  balance: 0.500000 ETH
📊 Sepolia USDT balance: 1 USDT

💰 PUSD balance BEFORE: 0 PUSD

4. Build the multicall (approve + deposit)
5. Send universal transaction (multicall + bridge)
📤 Transaction hash: 0x…
🔗 Push explorer:    https://donut.push.network/tx/0x…

💰 PUSD balance AFTER:  1 PUSD

🎉 Congrats! You minted PUSD from an external chain in one signature.
```

## 🔗 Related Examples

- **[pusd-mint-from-push-eoa](../pusd-mint-from-push-eoa)** — Path B: native Push EOA, two sequential signatures, no bridging.
- **[pusd-redeem](../pusd-redeem)** — Burn PUSD for a reserve token (single signature, no approve).
- **[pusd-read-state](../pusd-read-state)** — Read PUSD supply, fees, reserves, and verify the solvency invariant.
- **[send-universal-transaction-with-funds](../send-universal-transaction-with-funds)** — generic `funds` + contract call (the foundation pattern this example builds on).

## 🎓 Learn More

- [PUSD overview](https://pusd.push.org/docs)
- [Push Chain Universal Transactions](https://push.org/docs/chain/build/send-universal-transaction)
- [Moveable Tokens](https://push.org/docs/chain/concepts/moveable-tokens)
