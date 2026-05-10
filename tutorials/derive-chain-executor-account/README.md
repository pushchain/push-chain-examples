# Derive Chain Executor Account Tutorial

A focused tutorial for understanding **Chain Executor Accounts (CEAs)** — the deterministic address that your Push Chain wallet controls on every supported external chain. CEAs are the inverse of UEAs:

- A **UEA** is what an *external chain wallet* controls *on Push Chain*.
- A **CEA** is what a *Push Chain wallet* controls *on an external chain*.

👉 **Full Tutorial**: [Read the step-by-step guide on Push.org](https://push.org/docs/chain/tutorials/power-features/tutorial-derive-chain-executor-account/)

## 🌟 Overview

This is a **frontend-only tutorial** (no contracts to deploy) that walks through the discovery flow any cross-chain dApp needs before initiating Route 2 transactions. The app:

1. Connects a Push Chain wallet via `PushUniversalAccountButton`.
2. Reads the user's UEA on Push Chain.
3. For every supported external chain, derives the user's CEA via `PushChain.utils.account.deriveExecutorAccount(account, { chain })`.
4. Displays each CEA address with its deployment status.

For the SDK / backend equivalent (with actual Route 2 and Route 3 transaction attempts), see [`core-sdk-functions/send-universal-transaction-to-external-chains/`](../../core-sdk-functions/send-universal-transaction-to-external-chains/).

## 🚀 Quick Start

```bash
cd app
npm install
npm run dev
```

Open the dev server URL, connect your wallet, and your CEAs will appear. CEAs derive from your **UEA on Push Chain**, not your origin wallet — every Push account (whether you logged in via MetaMask, Phantom, email, or social) gets the same CEAs.

## 🎓 Tutorial Steps

### Step 1: Wrap your Push account as a `UniversalAccount`

The connected client exposes `pushChainClient.universal.account` — your UEA address on Push Chain. Wrap it into the SDK's universal-account shape, scoped to `PUSH_TESTNET`:

```typescript
const pushAccount = PushChain.utils.account.toUniversal(
  pushChainClient.universal.account,
  { chain: PushChain.CONSTANTS.CHAIN.PUSH_TESTNET }
);
```

### Step 2: List every supported external chain

`getSupportedChains` returns all chains supported on the current Push network — Push Chain itself plus every external chain the protocol can route to:

```typescript
const { chains } = PushChain.utils.chains.getSupportedChains(
  PushChain.CONSTANTS.PUSH_NETWORK.TESTNET
);
// → ['eip155:42101', 'eip155:11155111', 'eip155:421614',
//    'eip155:84532', 'eip155:97', 'solana:EtWTRABZaYq…']
```

### Step 3: Derive the CEA per chain

`deriveExecutorAccount(account)` returns the UEA on Push Chain. Pass `{ chain }` and the **same call** flips into "CEA on that external chain" mode. Loop over the supported list, skipping Push Chain itself:

```typescript
for (const chain of chains) {
  if (chain === PushChain.CONSTANTS.CHAIN.PUSH_TESTNET) continue;
  const cea = await PushChain.utils.account.deriveExecutorAccount(
    pushAccount,
    { chain }
  );
  // → { address: '0x...' (EVM) or 32-byte hex (Solana), deployed: boolean | null }
}
```

### Step 4: Render the addresses

EVM CEAs come back as `0x…` (20 bytes). SVM CEAs come back as 32-byte hex — convert them to base58 before showing them so they look like a normal Solana address:

```typescript
import { PublicKey } from "@solana/web3.js";

function formatChainAddress(chain: string, address: string): string {
  if (!chain.startsWith("solana:")) return address;
  return new PublicKey(hexToBytes(address)).toBase58();
}
```

### Step 5: Surface deployment status

`cea.deployed` is `true` once the CEA contract has been deployed on the external chain (which happens automatically the first time you target that chain via Route 2). For SVM chains the SDK can't always check deployment cheaply and may return `null` — treat that the same as `false` for display purposes:

```typescript
const isDeployed = cea.deployed === true;
```

### Step 6: Activate a CEA

CEAs activate automatically on first use. Send a Route 2 universal transaction targeting the external chain (or simply fund the CEA address there) to trigger deployment. See [`core-sdk-functions/send-universal-transaction-to-external-chains/`](../../core-sdk-functions/send-universal-transaction-to-external-chains/) for a runnable example that fires Route 2 across BNB Testnet and Solana Devnet.

## 🔧 Key APIs

```typescript
// All CEA derivation goes through the documented PushChain utility namespace.

// Step 1 — wrap the UEA as a UniversalAccount
const pushAccount = PushChain.utils.account.toUniversal(
  pushChainClient.universal.account,
  { chain: PushChain.CONSTANTS.CHAIN.PUSH_TESTNET }
);

// Step 2 — list every chain supported on the current network
const { chains } = PushChain.utils.chains.getSupportedChains(
  PushChain.CONSTANTS.PUSH_NETWORK.TESTNET
);

// Step 3 — for each external chain, derive the CEA
for (const chain of chains) {
  if (chain === PushChain.CONSTANTS.CHAIN.PUSH_TESTNET) continue;
  const cea = await PushChain.utils.account.deriveExecutorAccount(pushAccount, { chain });
  // → { address, deployed }
}
```

## 🌐 Supported Chains

The list comes from `PushChain.utils.chains.getSupportedChains(TESTNET)`. On Donut Testnet today:

- Push Chain Testnet (Donut) — `eip155:42101`
- Ethereum Sepolia — `eip155:11155111`
- Arbitrum Sepolia — `eip155:421614`
- Base Sepolia — `eip155:84532`
- BNB Testnet — `eip155:97`
- Solana Devnet — `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`

## 🌐 Network

- Push Chain Donut Testnet (chain id `42101`)
- RPC: `https://evm.donut.rpc.push.org/`
- Explorer: `https://donut.push.network/`
- Network constant in code: `PushChain.CONSTANTS.PUSH_NETWORK.TESTNET`

## 📁 Project structure

```
derive-chain-executor-account/
└── app/                    # React frontend (no contracts)
    ├── src/
    │   ├── App.tsx         # CEA discovery UI + Solana base58 conversion
    │   ├── main.tsx        # PushUniversalWalletProvider setup
    │   ├── App.css         # Matches the Derive UEA tutorial's visual style
    │   └── index.css
    ├── index.html
    ├── package.json
    └── vite.config.ts
```

## 🎯 What you'll learn

- The relationship between UEAs and CEAs
- How to discover all CEA addresses for a connected Push wallet using the documented SDK helper
- How to convert SVM addresses from hex to base58 for display
- How to surface CEA deployment state to users (so they know to activate them)

## 🔗 Resources

- [Live Tutorial Docs](https://push.org/docs/chain/tutorials/power-features/tutorial-derive-chain-executor-account/)
- [Utility Functions Reference](https://push.org/docs/chain/build/utility-functions)
- [Send Universal Transaction Reference](https://push.org/docs/chain/build/send-universal-transaction)
- [PushChain UI Kit](https://www.npmjs.com/package/@pushchain/ui-kit)

## 🚀 Next Steps

After this tutorial:

- [`derive-universal-executor-account`](../derive-universal-executor-account/) — the inverse direction (deriving UEAs from external chain wallets)
- [`core-sdk-functions/send-universal-transaction-to-external-chains/`](../../core-sdk-functions/send-universal-transaction-to-external-chains/) — fire Route 2 transactions to BNB and Solana, activating the CEAs you just derived
- [`core-sdk-functions/utility-functions/`](../../core-sdk-functions/utility-functions/) — full SDK utility surface, including all the helpers used here
