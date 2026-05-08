# CEA Wallet Flow Tutorial

A focused tutorial for understanding **Chain Executor Accounts (CEAs)** — the deterministic address that your Push Chain wallet controls on every supported external chain. CEAs are the inverse of UEAs:

- A **UEA** is what an *external chain wallet* controls *on Push Chain*.
- A **CEA** is what a *Push Chain wallet* controls *on an external chain*.

## What this tutorial demonstrates

1. **Connect a Push wallet** using `PushUniversalAccountButton`.
2. **Fan out CEA discovery** across every supported external chain via `getAllCEAAddresses(ueaAddress)`.
3. **Show per-chain support flags** with `chainSupportsCEA(chain)` and `chainSupportsOutbound(chain)` so users see which chains are EVM-CEA vs. SVM-gateway based.
4. **Surface deployment state** — CEAs start undeployed and activate when first funded.

This is a **frontend-only tutorial** — there are no contracts to deploy. The focus is the discovery flow that any cross-chain dApp needs before initiating Route 3 or Route 4 transactions.

For the backend / SDK-side equivalent (with actual Route 3 and Route 4 transaction attempts), see [`core-sdk-functions/cea-origin-transaction/`](../../core-sdk-functions/cea-origin-transaction/).

## Quick start

```bash
cd app
npm install
npm run dev
```

Open the dev server URL, connect your wallet, and your CEAs will appear. CEAs derive from your **UEA on Push Chain**, not your origin wallet — every Push account (whether you logged in via MetaMask, Phantom, email, or social) gets the same CEAs.

## Key APIs

```typescript
// All CEA derivation goes through the documented PushChain utility namespace.
// No top-level @pushchain/core imports are needed.

// Step 1 — wrap the UEA as a UniversalAccount
const pushAccount = PushChain.utils.account.toUniversal(
  pushChainClient.universal.account,
  { chain: PushChain.CONSTANTS.CHAIN.PUSH_TESTNET }
);

// Step 2 — list every chain supported on the current network
const { chains } = PushChain.utils.chains.getSupportedChains(
  PushChain.CONSTANTS.PUSH_NETWORK.TESTNET
);

// Step 3 — for each external chain, derive the CEA via the documented helper.
// The `{ chain }` option flips the call from "UEA on Push" to "CEA on chain".
for (const chain of chains) {
  if (chain === PushChain.CONSTANTS.CHAIN.PUSH_TESTNET) continue;
  const cea = await PushChain.utils.account.deriveExecutorAccount(pushAccount, { chain });
  // → { address: '0x...', deployed: false }
}
```

## Network

- Push Chain Donut Testnet (chain id `42101`)
- RPC: `https://evm.donut.rpc.push.org/`
- Explorer: `https://donut.push.network/`
- Network constant in code: `PushChain.CONSTANTS.PUSH_NETWORK.TESTNET`

## Project structure

```
cea-wallet-flow/
└── app/                    # React frontend (no contracts)
    ├── src/
    │   ├── App.tsx         # CEA discovery UI
    │   ├── main.tsx        # PushUniversalWalletProvider setup
    │   ├── App.css
    │   └── index.css
    ├── index.html
    ├── package.json
    └── vite.config.ts
```

## What you'll learn

- The relationship between UEAs and CEAs
- How to discover all CEA addresses for a connected Push wallet
- Which chains support EVM-style CEAs vs. SVM gateway-based outbound
- How to surface CEA deployment state to users (so they know to fund / activate them)

## Next steps

After this tutorial:

- [`core-sdk-functions/cea-origin-transaction/`](../../core-sdk-functions/cea-origin-transaction/) — initiate Route 3 and Route 4 transactions from a Push wallet via CEAs (Node script)
- [`derive-universal-executor-account`](../derive-universal-executor-account/) — the inverse direction (deriving UEAs from external chain wallets)
- [`utility-functions`](../../core-sdk-functions/utility-functions/) — full SDK utility surface, including all the CEA helpers used here
