# Universal PUSD Payments

A paired contract + frontend tutorial that demonstrates a **real-product PUSD use case**: a paywall that accepts PUSD as payment from users on any chain, in a single signature.

This tutorial pulls together:

- The on-chain Solidity integration pattern from the [push-pusd skill](https://pusd.push.org/docs) — a contract that holds PUSD and uses `transferFrom` to charge users.
- The multicall pattern on Push Chain's universal transaction layer — `approve(PUSD)` and `paywall.pay()` ride in one signature.
- The cross-chain identity model — `msg.sender` resolves to the user's UEA, so the same contract works for callers on Sepolia, Solana, BNB, Base, native Push, etc.

## 🌟 What it does

1. User connects with [`PushUniversalAccountButton`](https://www.npmjs.com/package/@pushchain/ui-kit). Any chain, any wallet.
2. Frontend reads:
   - `PUSD.balanceOf(user)` — does the user have ≥ 1 PUSD?
   - `paywall.expiresAt(user)` — when does access expire?
3. User clicks **Pay 1 PUSD**. The frontend sends one universal transaction with two legs:
   - `PUSD.approve(paywall, FEE)`
   - `paywall.pay()`
4. The paywall pulls 1 PUSD via `transferFrom` and extends the caller's access by 30 days.

## 🎯 What you'll learn

- How to **integrate PUSD into a Solidity contract** — `IPUSD.transferFrom` is all it takes.
- How to **bundle approve + call** in a single signature using the universal transaction layer's multicall mode (outer `to` = `0x0`, `data` is an array of legs).
- How **cross-chain user attribution** works through UEAs — no chain ID checks needed inside the contract.
- How to **deploy** with Foundry on Donut Testnet and **wire the address** into a Vite + React frontend.

## 📁 Project structure

```
universal-pusd-payments/
├── README.md              # this file
├── contracts/             # Foundry project — PusdPaywall.sol
│   ├── README.md          # deploy instructions
│   ├── foundry.toml
│   └── src/
│       └── PusdPaywall.sol
└── app/                   # Vite + React + @pushchain/ui-kit
    ├── README.md
    ├── package.json
    ├── index.html
    ├── .env.sample        # set VITE_PAYWALL_ADDRESS after deploy
    └── src/
        ├── main.tsx
        ├── App.tsx        # paywall UI + multicall pay flow
        ├── providers/
        │   └── PushChainProviders.tsx
        └── ...
```

## 🚀 Quick Start

### 1. Deploy the contract

```bash
cd contracts
forge create src/PusdPaywall.sol:PusdPaywall \
    --rpc-url push_testnet \
    --private-key $PUSH_PRIVATE_KEY \
    --constructor-args $YOUR_TREASURY_ADDRESS \
    --broadcast
```

Copy the printed contract address.

### 2. Configure and run the frontend

```bash
cd ../app
cp .env.sample .env
# put the contract address into .env as VITE_PAYWALL_ADDRESS=0x...
npm install
npm run dev
```

Open the URL Vite prints. Click the wallet button, connect (any chain works), then click **Pay 1 PUSD**.

## 💡 Prerequisites

- **Push native EOA** with PC for gas. Get from [https://faucet.push.org/](https://faucet.push.org/).
- **At least 1 PUSD** in the account that will pay the paywall. Mint some via [`pusd-mint-from-external-chain`](../../core-sdk-functions/pusd-mint-from-external-chain) (deposit USDT from Sepolia) or [`pusd-mint-from-push-eoa`](../../core-sdk-functions/pusd-mint-from-push-eoa) (native Push path).
- **Foundry** for the contract: `forge --version`.
- **Node.js v18+** for the frontend.

## 🔗 Related

- [PUSD overview](https://pusd.push.org/docs)
- [`pusd-mint-from-external-chain`](../../core-sdk-functions/pusd-mint-from-external-chain) — how the user gets PUSD in the first place
- [`pusd-redeem`](../../core-sdk-functions/pusd-redeem) — burn PUSD back to a reserve token
- [`pusd-read-state`](../../core-sdk-functions/pusd-read-state) — verify reserves / fees on Donut
- [`batch-universal-transactions`](../batch-universal-transactions) — generic multicall tutorial
- [`universal-erc-20-mint`](../universal-erc-20-mint) — sister tutorial that mints a custom ERC-20 the same way

## 📈 Where to take this next

- **One-click mint + pay.** Prepend `USDT.approve(MANAGER) + PUSDManager.deposit(USDT, FEE, user)` to the multicall so a user with USDT (Donut) but no PUSD can mint and pay in one signature. Add `funds: { amount, token }` and the same flow works for users with USDT on Sepolia / Base / Solana.
- **Tiered access.** Different `FEE` values for different access durations.
- **PUSD+ payments.** Accept PUSD+ instead, leaning on the vault's NAV-based accounting so users earn yield while subscribed.
- **Off-chain receipt feed.** Subscribe to `AccessGranted` events from a backend and surface receipts to the user via email or webhook.
