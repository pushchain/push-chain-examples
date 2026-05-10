# PUSD Paywall — Frontend

A minimal React frontend for [`PusdPaywall`](../contracts/src/PusdPaywall.sol). The user connects from any chain, sees their PUSD balance and access status, and pays 1 PUSD in a single signature to extend their access by 30 days.

## 🚀 Quick Start

```bash
cp .env.sample .env             # then fill in VITE_PAYWALL_ADDRESS
npm install
npm run dev
```

Open the printed Vite URL. Click the wallet button, connect, and click "Pay 1 PUSD".

## What this demonstrates

The "Pay" button sends a **multicall universal transaction** — one signature, two on-chain effects:

1. `PUSD.approve(paywall, FEE)` — let the contract pull 1 PUSD.
2. `paywall.pay()` — the contract pulls PUSD via `transferFrom` and extends the caller's access.

Cross-chain users land in the contract under their **UEA** on Push Chain. `expiresAt[msg.sender]` therefore tracks per-user access correctly without any chain-specific logic in the contract.

```ts
const tx = await pushChainClient.universal.sendTransaction({
  to: ZERO_ADDRESS,                    // sentinel = multicall mode
  value: 0n,
  data: [
    { to: PUSD_ADDRESS,    value: 0n, data: approveData },
    { to: PAYWALL_ADDRESS, value: 0n, data: payData     },
  ],
});
```

## Project structure

```
app/
├── README.md                       # this file
├── package.json
├── index.html
├── vite.config.ts
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── eslint.config.js
├── .env.sample                     # → copy to .env, set VITE_PAYWALL_ADDRESS
└── src/
    ├── main.tsx
    ├── App.tsx                     # mint/balance/access UI + pay() handler
    ├── index.css
    ├── vite-env.d.ts
    └── providers/
        └── PushChainProviders.tsx  # Push Universal Wallet provider config
```

## Dependencies

- `@pushchain/ui-kit` — `"latest"` (wallet provider, hooks, button)
- `ethers` — read-only Donut RPC for balance / `expiresAt` queries
- React 19, Vite 7, TypeScript 5

## What if a user doesn't have PUSD yet?

Show them [`pusd-mint-from-external-chain`](../../../core-sdk-functions/pusd-mint-from-external-chain) — they can deposit USDT/USDC from any supported chain to get PUSD on Push. A more advanced version of this tutorial would chain `mint + approve + pay` into a single multicall (3 legs) so the user pays the paywall directly with their Sepolia USDT under one signature. Left as an extension exercise.

## Add the contract address

After running `forge create` (see [`../contracts/README.md`](../contracts/README.md)), put the printed address into `.env`:

```
VITE_PAYWALL_ADDRESS=0x...
```

The dev server hot-reloads — refresh the page to pick it up. While unset, the app shows a yellow setup banner.
