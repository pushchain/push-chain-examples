# Send Multichain Transactions

A runnable companion to the [Send Multichain Transactions docs page](https://push.org/docs/chain/build/send-multichain-transactions). Compose multiple universal transactions into a single ordered cascade — the user signs **once**, and Push Chain coordinates execution across Push Chain and supported external chains automatically.

> **Prerequisite:** read the [Send Universal Transaction](https://push.org/docs/chain/build/send-universal-transaction) docs first to understand routes 1, 2, and 3. Multichain transactions compose those routes into one signature.

> **Different from `batched-universal-transaction`?** Yes. [`batched-universal-transaction`](../batched-universal-transaction/) batches multiple calls into a **single** universal transaction (one route). Multichain transactions compose multiple universal transactions across **different routes / chains** under a single signature.

## Mental model

1. **Prepare** each transaction step with `pushChainClient.universal.prepareTransaction(...)`.
2. **Execute** the whole array with `pushChainClient.universal.executeTransactions([...])`.

`prepareTransaction` accepts the same arguments as `sendTransaction`. The SDK detects the route per hop from the shape of `tx.from` and `tx.to`.

## Quick Start

```bash
npm install
npm start
```

The script is interactive — pick one of three scenarios at the prompt:

| # | Scenario | Funding required |
|---|----------|------------------|
| 1 | Inspect a `PreparedUniversalTx` (no execution) | None |
| 2 | 2-hop cascade — Push Chain + BNB Testnet | Sepolia ETH + ≥10 PC on UEA |
| 3 | 3-hop cascade — Push Chain + BNB Testnet + Solana Devnet | Sepolia ETH + ≥25 PC on UEA (SVM outbound alone needs ~5.2 PC) |

Scenarios 2 and 3 print the exact addresses you need to fund and pause for you to top them up before continuing.

## Scenario details

### 1. Inspect a `PreparedUniversalTx`

Calls `prepareTransaction` for both a Route 1 and a Route 2 target. Prints the resolved `route`, `estimatedGas`, `nonce`, and `deadline`. No on-chain submission; useful for debugging cascade construction without spending gas.

### 2. Push Chain + BNB Testnet (2-hop)

Increments a counter contract on Push Chain (Route 1) and a counter contract on BNB Testnet (Route 2 via CEA). The script reads each counter before and after to confirm both hops landed.

### 3. Push Chain + BNB + Solana Devnet (3-hop)

Adds a third hop calling a Solana Anchor program. The Solana hop uses `encodeTxData({ idl, ... })` — same `{ to, value, data }` shape as the EVM hops; the SDK resolves accounts, PDAs, and the sender's CEA from the IDL automatically.

## Key APIs used

```typescript
import { PushChain } from '@pushchain/core';

// Prepare each hop independently — same args as sendTransaction.
const hop0 = await client.universal.prepareTransaction({ to: COUNTER_PUSH, value: 0n, data });
const hop1 = await client.universal.prepareTransaction({
  to: { address: COUNTER_BNB, chain: PushChain.CONSTANTS.CHAIN.BNB_TESTNET },
  value: 0n,
  data,
});

// One signature, SDK handles the rest.
const cascade = await client.universal.executeTransactions([hop0, hop1]);

// Live status updates per hop as they propagate across chains.
const result = await cascade.wait({
  progressHook: (e) => console.log(`[Hop ${e.hopIndex}] ${e.status} on ${e.chain}`),
});
```

## Key considerations

- **Single signature**: `executeTransactions` submits one Push Chain transaction; the SDK fans out from there.
- **No atomicity across hops**: if a downstream hop fails, earlier hops are already on-chain. Design contracts to handle partial execution.
- **Gas per hop**: each hop has its own estimated gas. The UEA on Push Chain pays gas + per-hop swap for each Route 2 outbound, so keep it funded.
- **Tracking**: `cascade.wait({ progressHook })` reports `hopIndex`, `status`, `chain`, `txHash`, `elapsed` per hop. For deeper monitoring of any individual tx see [Track Universal Transaction](https://push.org/docs/chain/build/track-universal-transaction).

## Network

- Push Chain Donut Testnet (chain id `42101`)
- RPC: `https://evm.donut.rpc.push.org/`
- Origin chain in scenarios 2/3: Ethereum Sepolia (`https://ethereum-sepolia-rpc.publicnode.com`)
- Network constant in code: `PushChain.CONSTANTS.PUSH_NETWORK.TESTNET`

## Dependencies

- `@pushchain/core` — `latest`
- `ethers` — for the Sepolia signer + RPC reads
- `@coral-xyz/anchor` — peer dep required by the SDK for SVM IDL handling

## Related examples

- [`send-universal-transaction`](../send-universal-transaction/) — single-tx send across Routes 1/2/3
- [`batched-universal-transaction`](../batched-universal-transaction/) — multiple calls in ONE universal tx (vs. multiple universal txs)
- [`cea-origin-transaction`](../cea-origin-transaction/) — Route 3 (CEA → Push) with funded CEAs
