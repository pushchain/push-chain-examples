# Track Universal Transaction

A runnable, interactive companion for the [Track Universal Transaction docs](https://push.org/docs/chain/build/track-universal-transaction). Pass any previously submitted transaction hash and the chain it originated on, and the SDK returns the latest resolved state — Push Chain execution details and external-chain leg when applicable.

`trackTransaction` is independent of `sendTransaction`. Use it to:

- Resume status after a page refresh
- Poll from a backend / job
- Track a transaction created in a different session
- Replay the lifecycle events of a past transaction

## Quick Start

```bash
npm install
npm start
```

Pick a scenario at the prompt:

| # | Scenario | Input required |
|---|----------|----------------|
| 1 | Track three sample transactions (Push / Sepolia / Solana) | None — uses the hashes from the docs playground |
| 2 | Track your own transaction | Hash + origin chain |

No funding is required — `trackTransaction` is a read-only operation. The script still initializes a client (via a throwaway random wallet) because `trackTransaction` is a method on the client.

## Key APIs used

```typescript
import { PushChain } from '@pushchain/core';

const response = await pushChainClient.universal.trackTransaction(txHash, {
  // Origin chain — where the tx was submitted. Defaults to Push Chain.
  chain: PushChain.CONSTANTS.CHAIN.ETHEREUM_SEPOLIA,

  // Per-step lifecycle callback. Same ProgressEvent shape as sendTransaction.
  progressHook: (p) => console.log(`${p.id} — ${p.title}`),

  // When false, returns immediately with current status. Default: true.
  waitForCompletion: true,

  advanced: {
    pollingIntervalMs: 2_000, // min 500
    timeout: 60_000,
    rpcUrls: { /* override per chain */ },
  },
});
```

## Returns

The returned `UniversalTxResponse` has the same shape as the response from `sendTransaction` — see [Send Universal Transaction → TxResponse](https://push.org/docs/chain/build/send-universal-transaction#returns-tx-response). Useful fields surfaced by the example:

- `hash` — the resolved transaction hash on Push Chain
- `from` — executor (UEA) address
- `chainNamespace` — CAIP-2 namespace where execution landed
- `route` — `'UOA_TO_PUSH'`, `'UOA_TO_CEA'`, or `'CEA_TO_PUSH'`
- `blockNumber` — block where the tx confirmed

The example also calls `client.explorer.getTransactionUrl(...)` to print a clickable explorer link.

## Scenario details

### 1. Track sample transactions

Walks through three real testnet hashes (the same ones used in the docs playground):

| Origin | Hash |
|---|---|
| Push Chain | `0x169929f61574baf62b84ce68b944e09faf566129d0175b2ee1e020c76ae7bd2f` |
| Ethereum Sepolia | `0x9b4743376689eb6f90f3aeb9eea58381b3bcc033e1de4709281fd58a77b85098` |
| Solana Devnet | `22SirqSwhcSjgyb3wdrW9Zis19dxcLHD5yy3BtRbRoLmykrv8eCzKnPaRGxrrZ7a4A7yKGRMGMehqKpTcdF2ByFR` |

For each, the script:
1. Calls `client.universal.trackTransaction(hash, { chain, progressHook, advanced: { timeout: 30_000 } })`
2. Streams the lifecycle events through the `progressHook` callback
3. Prints the resolved hash, sender, chain, route, and explorer URL

### 2. Track your own transaction

Prompts for the tx hash and origin chain (Push Chain default, Sepolia, Solana, or any `CHAIN` constant by name like `BNB_TESTNET`), then runs the same call with a 60 second timeout.

## Network

- Push Chain Donut Testnet (chain id `42101`)
- Push RPC: `https://evm.donut.rpc.push.org/`
- Network constant in code: `PushChain.CONSTANTS.PUSH_NETWORK.TESTNET`

## Dependencies

- `@pushchain/core` — `latest`
- `ethers` — for the throwaway signer used to initialize the client
- `@coral-xyz/anchor` — peer dep required by the SDK for SVM IDL handling

## Related examples

- [`../send-universal-transaction/`](../send-universal-transaction/) — submit a tx; the response object is what `trackTransaction` reconstructs
- [`../send-multichain-transactions/`](../send-multichain-transactions/) — multi-hop cascade with per-hop progress
- [`../sign-universal-message/`](../sign-universal-message/) — sign messages and EIP-712 typed data with a universal signer
