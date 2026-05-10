# Push Chain Examples

A comprehensive collection of runnable examples, SDK function demos, and tutorial apps for building on **Push Chain** — a universal blockchain that lets dApps unify users from any chain (Ethereum, Solana, BNB, …) under a single execution layer.

This repository covers three layers:

- **[`apps/`](./apps)** — full-stack reference apps you can run end-to-end.
- **[`core-sdk-functions/`](./core-sdk-functions)** — focused, single-purpose examples for the `@pushchain/core` SDK.
- **[`tutorials/`](./tutorials)** — step-by-step paired contract + frontend projects, each linked to a published tutorial on push.org/docs.

## Network conventions

All examples target the **Donut Testnet** unless otherwise noted:

| Field | Value |
|---|---|
| Chain id | `42101` |
| Push RPC | `https://evm.donut.rpc.push.org/` |
| Explorer | `https://donut.push.network/` |
| Network constant in code | `PushChain.CONSTANTS.PUSH_NETWORK.TESTNET` |

The Push Chain SDK packages are pinned to `"latest"` across this repo, so every example tracks the most recent published version of `@pushchain/core` and `@pushchain/ui-kit`.

---

## Apps

Full-stack apps that demonstrate end-to-end Push Chain integrations.

| App | What it does |
|---|---|
| **[bridge](./apps/bridge)** | Cross-chain bridge UI built on Push Chain Universal Transactions — move tokens between supported chains with a single signature. |
| **[simulate](./apps/simulate)** | Transaction simulation tool — preview universal transactions, estimate fees, and inspect the routing/CEA pipeline before signing. |
| **[migrate](./apps/migrate)** | Migration tool — helps users move state or assets onto Push Chain from external chains. |

Each app lives in its own folder with its own README, dependencies, and run instructions.

---

## Core SDK functions

Small, focused examples that each demonstrate a single capability of `@pushchain/core`. These are the right starting point if you want to see how to do **one specific thing** without the full framing of a tutorial app.

### Setup & client

| Example | Purpose |
|---|---|
| **[create-universal-signer](./core-sdk-functions/create-universal-signer)** | Wrap an ethers wallet, viem account, or Solana keypair into a `UniversalSigner` — the primary input to `PushChain.initialize`. |
| **[custom-universal-signer](./core-sdk-functions/custom-universal-signer)** | Bring your own signing layer (HSM, KMS, MPC) by implementing `signMessage`, `signAndSendTransaction`, `signTypedData` directly. |
| **[initialize-evm-client](./core-sdk-functions/initialize-evm-client)** | Stand up an EVM read client (ethers / viem) pointed at the Donut RPC for read-only state queries. |
| **[initialize-push-chain-client](./core-sdk-functions/initialize-push-chain-client)** | Initialize a `PushChainClient` from a signer or a read-only `UniversalAccount`. |
| **[reading-push-chain-state](./core-sdk-functions/reading-push-chain-state)** | Read blocks, transactions, balances, and contract view calls from Push Chain without the SDK. |

### Sending universal transactions

| Example | Route | What it shows |
|---|---|---|
| **[send-universal-transaction](./core-sdk-functions/send-universal-transaction)** | Route 1 | Minimal happy path — origin signer → Push Chain target. |
| **[send-universal-transaction-to-push-all-cases](./core-sdk-functions/send-universal-transaction-to-push-all-cases)** | Route 1 | The same Route 1, exhaustively, for every supported origin chain (EVMs + Solana). |
| **[send-universal-transaction-to-external-chains](./core-sdk-functions/send-universal-transaction-to-external-chains)** | Route 2 / 3 | Origin signer → external-chain CEA. Includes the Route 3 variant (CEA origin → Push Chain). |
| **[send-universal-transaction-with-funds](./core-sdk-functions/send-universal-transaction-with-funds)** | Route 1 | Move PRC-20 / native value as part of the same universal tx. |
| **[send-universal-transaction-pay-gas-with-any-token](./core-sdk-functions/send-universal-transaction-pay-gas-with-any-token)** | Route 1 | Pay universal gas in a supported PRC-20 instead of native PC. |
| **[send-multichain-transactions](./core-sdk-functions/send-multichain-transactions)** | Cascades | Compose multiple universal transactions under a single signature via `pushChainClient.universal.executeTransactions`. |
| **[batched-universal-transaction](./core-sdk-functions/batched-universal-transaction)** | Route 1 | Pack multiple contract calls into one universal tx (multicall format). |

### PUSD stablecoin

| Example | Purpose |
|---|---|
| **[pusd-mint-from-external-chain](./core-sdk-functions/pusd-mint-from-external-chain)** | **Path A:** mint PUSD by depositing USDT from Ethereum Sepolia in a single signature — multicall (`approve` + `deposit`) plus `funds` to bridge the reserve token in. |
| **[pusd-mint-from-push-eoa](./core-sdk-functions/pusd-mint-from-push-eoa)** | **Path B:** mint PUSD from a native Push EOA — two sequential signatures (`approve`, `deposit`), no bridging. |
| **[pusd-redeem](./core-sdk-functions/pusd-redeem)** | Burn PUSD for a preferred reserve token (with basket fallback) — single call, no PUSD approval needed. |
| **[pusd-read-state](./core-sdk-functions/pusd-read-state)** | Read PUSD supply, fees, per-token reserves, and verify the `totalReserves ≥ totalSupply` solvency invariant. |

### Tracking, messaging, contract-initiated dispatch

| Example | Purpose |
|---|---|
| **[track-universal-transaction](./core-sdk-functions/track-universal-transaction)** | Watch a cross-chain transaction's lifecycle from any chain via `PushChain.utils.tx.track`. |
| **[sign-universal-message](./core-sdk-functions/sign-universal-message)** | Sign personal messages and EIP-712 typed data through a UniversalSigner — works across origins. |
| **[contract-initiated-outbound-execution](./core-sdk-functions/contract-initiated-outbound-execution)** | **Outbound:** A Push Chain contract autonomously dispatches a cross-chain call through UGPC. The contract's CEA executes the payload on the destination chain (BNB counter). |
| **[contract-initiated-inbound-execution](./core-sdk-functions/contract-initiated-inbound-execution)** | **Inbound:** A Sepolia contract calls Sepolia's UniversalGateway to trigger a Push counter increment from the contract's UEA on Push. |
| **[contract-initiated-roundtrip-execution](./core-sdk-functions/contract-initiated-roundtrip-execution)** | **Round-trip:** A Push contract dispatches outbound to BNB, the BNB CEA fires a callback through BNB's gateway, and the resulting inbound advances Push state — both legs in one contract. |
| **[contract-initiated-roundtrip-with-result](./core-sdk-functions/contract-initiated-roundtrip-with-result)** | **Round-trip with app state:** Same flow with a `request → fulfill` state machine — the inbound callback decodes a requestId from the outbound's payload and updates real application state. |
| **[contract-initiated-recipient-bridge](./core-sdk-functions/contract-initiated-recipient-bridge)** | **Funds-only bridge:** A Sepolia contract bridges native ETH to a recipient address on Push (no payload, just funds delivery). |
| **[contract-initiated-inbound-with-funds](./core-sdk-functions/contract-initiated-inbound-with-funds)** | **Inbound + funds:** A Sepolia contract bridges ETH AND triggers `vault.deposit{value}(beneficiary)` on Push — the canonical "deposit-and-execute" pattern. |
| **[contract-initiated-outbound-with-funds](./core-sdk-functions/contract-initiated-outbound-with-funds)** | **Outbound + funds:** Push contract bridges pBNB AND calls a BNB target in the same outbound (symmetric to inbound-with-funds). |
| **[contract-initiated-roundtrip-between-external-chains](./core-sdk-functions/contract-initiated-roundtrip-between-external-chains)** | **Cascade across two external chains:** A Push contract dispatches to BNB; the BNB back-leg triggers Push to fire a NEW outbound to Solana — incrementing counters on **both BNB and Solana** from a single `kickOff()` call. |
| **[others-contract-helpers](./core-sdk-functions/others-contract-helpers)** | Read on-chain helpers — `IUEAFactory.getUEAForOrigin`, `getOriginForUEA`, `getVMType`, etc. |

### Utility surface

| Example | Purpose |
|---|---|
| **[utility-functions](./core-sdk-functions/utility-functions)** | A 1:1 walkthrough of the documented `PushChain.utils.*` namespace — accounts, signers, explorer URLs, helpers, chains, tokens. |
| **[speedrun](./core-sdk-functions/speedrun)** | Smallest possible end-to-end script — wallet → signer → client → tx → done. |

---

## Tutorials

Paired contract + frontend projects, each backed by a published tutorial on push.org/docs. See [`tutorials/README.md`](./tutorials/README.md) for the full list, recommended learning order, and per-tutorial breakdowns.

Available tutorials at a glance:

1. **[simple-counter](./tutorials/simple-counter)** — minimal entry-point dApp.
2. **[universal-counter](./tutorials/universal-counter)** — cross-chain user attribution via UEAs (hardcoded chains).
3. **[universal-counter-dynamic](./tutorials/universal-counter-dynamic)** — dynamic chain discovery, analytics UI, Matter.js leaderboard.
4. **[batch-universal-transactions](./tutorials/batch-universal-transactions)** — multicall patterns.
5. **[universal-claimable-airdrop](./tutorials/universal-claimable-airdrop)** — Merkle-proof airdrop with factory pattern.
6. **[universal-erc-20-mint](./tutorials/universal-erc-20-mint)** — universal-access ERC-20 token.
7. **[derive-universal-executor-account](./tutorials/derive-universal-executor-account)** — playground for UEA derivation (any origin → Push Chain).
8. **[derive-chain-executor-account](./tutorials/derive-chain-executor-account)** — the inverse: Push Chain account → CEA on every supported external chain.
9. **[universal-cross-chain-counters](./tutorials/universal-cross-chain-counters)** — one Push contract that fans `increment()` out to BNB / Sepolia / Arbitrum counters in a single tx, gated by per-chain CEAs.
10. **[x402-universal-transaction](./tutorials/x402-universal-transaction)** — A2A x402 payments settled via Push Chain (advanced, agent-to-agent).
11. **[universal-pusd-payments](./tutorials/universal-pusd-payments)** — paywall dApp that accepts PUSD as payment from any chain in one signature; demonstrates the on-chain PUSD integration pattern.

---

## Quick start

Pick any example and run it standalone — every example is self-contained.

```bash
git clone https://github.com/pushchain/push-chain-examples.git
cd push-chain-examples

# Pick an example and follow its README
cd core-sdk-functions/send-universal-transaction
npm install
npm start
```

For tutorial frontends:

```bash
cd tutorials/simple-counter/app
npm install
npm run dev
```

Each example's README documents prerequisites, environment variables (typically `PUSH_PRIVATE_KEY`), and run commands. Most SDK examples will print a Push Chain explorer URL once they finish so you can verify the on-chain effect.

---

## Prerequisites

- **Node.js** v18 or newer
- A Push native wallet funded with **PC** on Donut Testnet (some examples need 5+ PC for protocol fees)
- For contract examples: **Foundry** (`forge --version`)
- Basic familiarity with TypeScript / React / Solidity depending on the example

---

## Documentation & resources

- [Push Chain docs](https://push.org/docs/chain) — architecture, concepts, and the full tutorial catalog
- [@pushchain/core on npm](https://www.npmjs.com/package/@pushchain/core)
- [@pushchain/ui-kit on npm](https://www.npmjs.com/package/@pushchain/ui-kit)
- [Push Chain GitHub](https://github.com/pushchain)
- [Donut Testnet explorer](https://donut.push.network/)
- [Push Chain Discord](https://discord.gg/pushchain)

---

## Contributing

PRs welcome. Things especially appreciated:

- New SDK function examples that demonstrate a capability not yet covered
- New tutorial apps showing real cross-chain UX patterns
- README fixes when an example's behavior drifts from its docs
- Bug reports / improvements to existing examples

When adding new examples, follow the conventions used elsewhere in the repo:

- Use `PushChain.CONSTANTS.PUSH_NETWORK.TESTNET` (not `TESTNET_DONUT`)
- Pin `@pushchain/core` and `@pushchain/ui-kit` to `"latest"` so the example tracks the SDK
- Only call documented `PushChain.*` / `pushChainClient.*` namespaces — don't import internal helpers
- Each example is self-contained (`npm install && npm start` should work without touching another folder)

## License

MIT.
