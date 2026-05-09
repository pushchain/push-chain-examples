# Send Universal Transaction to External Chains (Route 2)

A runnable, interactive companion for **Route 2** of the [Send Universal Transaction docs](https://push.org/docs/chain/build/send-universal-transaction). Route 2 routes a universal transaction to an **external chain** — you sign once on Push Chain, and the SDK coordinates execution on the target chain via your CEA (Chain Executor Account) there.

```
tx.to = { address, chain: <target chain> }   ← what makes it Route 2
```

| Route | `tx.from`   | `tx.to`              | Use |
|-------|-------------|----------------------|-----|
| 1     | omitted     | `'0x...'`            | external UOA → Push Chain |
| **2** | omitted     | **`{ address, chain }`** | **any origin → external chain** (this example) |
| 3     | `{ chain }` | `'0x...'`            | CEA on `from.chain` → Push Chain |

Routes 1 and 3 are demoed in [`../send-universal-transaction/`](../send-universal-transaction/). Composing multiple routes under one signature → [`../send-multichain-transactions/`](../send-multichain-transactions/).

## Quick Start

```bash
npm install
npm start
```

The script is interactive. Pick one of three scenarios at the prompt:

| # | Scenario | Funding required |
|---|----------|------------------|
| 1 | Discover your CEAs across all supported external chains | None |
| 2 | Route 2 — increment a counter on BNB Testnet via your CEA | PC on UEA (≥10 PC) |
| 3 | Route 2 — call a Solana program on Devnet via your CEA   | PC on UEA (≥10 PC) |

Scenarios 2 and 3 print the addresses to fund and pause for you to top them up before continuing.

## Persistent signer

CEAs derive deterministically from your Push Chain account, so re-runs must reuse the same key for funded CEAs to be reachable. Either:

- Copy `.env.sample` → `.env` and paste your private key, OR
- Leave `.env` empty and let the script generate a fresh key — it prints the value on first run so you can save it.

```bash
cp .env.sample .env
# (optional) edit .env: paste your PUSH_PRIVATE_KEY
npm start
```

The script loads `.env` automatically via `dotenv`.

## How progressHook is wired

`client.universal.sendTransaction(...)` returns a `UniversalTxResponse`. To receive low-level lifecycle events (the SDK's `SEND-TX-*` IDs covering route stages, outbound polling, and terminal status), register a callback on the response **before** calling `tx.wait()`:

```typescript
const tx = await client.universal.sendTransaction({
  to: { address: COUNTER_BNB, chain: PushChain.CONSTANTS.CHAIN.BNB_TESTNET },
  data: calldata,
});

// Register BEFORE wait() — registering after misses the outbound polling events.
tx.progressHook((event) => {
  console.log(`${event.id} — ${event.title} (${event.level})`);
});

const receipt = await tx.wait();
console.log('Push tx:    ', tx.hash);
console.log('External tx:', receipt.externalTxHash);
console.log('External:   ', receipt.externalExplorerUrl);
```

Route 2 emits the **`SEND-TX-2xx`** series (e.g., `SEND-TX-201` start, `209-xx` outbound polling, `299-01/02/03` terminal: success/failure/timeout).

## What the receipt carries for Route 2

After `tx.wait()` resolves, the receipt includes the external-chain leg:

| Field | Description |
|---|---|
| `status` | `1` if the Push Chain side settled, `0` if it reverted |
| `externalTxHash` | hash on the target chain (BNB / Solana / etc.) |
| `externalChain` | target chain identifier |
| `externalExplorerUrl` | full external-chain explorer URL |
| `externalStatus` | `'success' \| 'failed' \| 'timeout'` for the external leg |
| `externalError` | error message when `externalStatus !== 'success'` |

## Network

- Push Chain Donut Testnet (chain id `42101`)
- Push RPC: `https://evm.donut.rpc.push.org/`
- BNB Testnet RPC: `https://bsc-testnet-rpc.publicnode.com`
- Network constant in code: `PushChain.CONSTANTS.PUSH_NETWORK.TESTNET`

## Dependencies

- `@pushchain/core` — `latest`
- `ethers` — Push Chain signer + BNB read
- `@coral-xyz/anchor` — peer dep required by the SDK for SVM IDL handling

## Related examples

- [`../send-universal-transaction/`](../send-universal-transaction/) — Route 1 (UOA → Push Chain) walkthrough
- [`../send-multichain-transactions/`](../send-multichain-transactions/) — compose Routes 1/2/3 under one signature
- [`../utility-functions/`](../utility-functions/) — full SDK utility surface, including the `deriveExecutorAccount` helpers used here
