# PushChain Tutorials

This directory contains step-by-step tutorials and example projects to help you learn and build on PushChain. Each tutorial is designed to demonstrate specific features and capabilities of the PushChain ecosystem.

👉 All Tutorials: [Explore the full list on Push.org](https://push.org/docs/chain/tutorials/)

## Available Tutorials

### 1. Simple Counter

A minimal entry-point tutorial — basic smart contract deployment + a simple React frontend with PushChain UI Kit. Best place to start if you've never built on PushChain.

**What you'll learn:**
- Basic PushChain UI Kit integration
- Universal Account connection
- Simple smart contract interaction
- Sending transactions with `pushChainClient`

**Components:**
- [`contracts/`](./simple-counter/contracts/) — Simple `Counter.sol`
- [`app/`](./simple-counter/app/) — Minimal React frontend

[Go to Simple Counter Tutorial →](./simple-counter)

---

### 2. Universal Counter

Cross-chain user attribution: a single counter contract on Push Chain that detects whether the caller originated from Ethereum, Solana, or Push Chain (via the UEA system) and attributes increments accordingly. Hardcoded chain IDs for clarity.

**What you'll learn:**
- Universal Ethereum Accounts (UEAs)
- `IUEAFactory.getOriginForUEA` for cross-chain user attribution
- Building a frontend that works for any origin chain

**Components:**
- [`contracts/`](./universal-counter/contracts/) — `UniversalCounter.sol`
- [`app/`](./universal-counter/app/) — Counter UI with hardcoded chain handling

[Go to Universal Counter Tutorial →](./universal-counter)

---

### 3. Universal Counter (Dynamic)

The dynamic variant of Universal Counter. Instead of hardcoding supported chains, the contract discovers participating chains at runtime. Ships with two frontends: an analytics-style data table and an interactive Matter.js physics game.

**What you'll learn:**
- Dynamic chain discovery on-chain
- Per-chain analytics (total counts, unique users)
- Building richer cross-chain UIs (data tables, physics simulations)

**Components:**
- [`contracts/`](./universal-counter-dynamic/contracts/) — `UniversalCounterDynamic.sol`
- [`app/`](./universal-counter-dynamic/app/) — Dynamic analytics UI with chain table
- [`ballsy-app/`](./universal-counter-dynamic/ballsy-app/) — Matter.js physics-based leaderboard

[Go to Universal Counter Dynamic Tutorial →](./universal-counter-dynamic)

---

### 4. Batch Universal Transactions

Demonstrates how to execute multiple contract calls in a single universal transaction (multicall). Combines a counter increment with an ERC-20 mint into one transaction.

**What you'll learn:**
- Multicall / batch transaction patterns
- Multi-contract interaction in one tx
- Gas optimization via batching

**Components:**
- [`app/`](./batch-universal-transactions/app/) — React frontend (uses pre-deployed testnet contracts)

[Go to Batch Universal Transactions Tutorial →](./batch-universal-transactions)

---

### 5. Universal Claimable Airdrop

Cross-chain airdrop using Merkle proofs and UEAs. Wallets from any supported chain can claim their token allocation, with deduplication and on-chain verification.

**What you'll learn:**
- Cross-chain airdrop distribution via UEAs
- Merkle tree generation + on-chain proof verification (OpenZeppelin)
- Factory pattern for deploying multiple campaigns

**Components:**
- [`contracts/`](./universal-claimable-airdrop/contracts/) — `UniversalAirdropFactory.sol` + `UniversalAirdrop.sol`
- [`app/`](./universal-claimable-airdrop/app/) — Multi-step UI (add wallets → generate tree → deploy → claim)

[Go to Universal Claimable Airdrop Tutorial →](./universal-claimable-airdrop)

---

### 6. Universal ERC-20 Mint

A standard ERC-20 token (`$UNICORN`) that can be minted by users from any supported chain. Used as a building block by other tutorials (Batch, Airdrop).

**What you'll learn:**
- Deploying ERC-20 contracts on Push Chain
- Universal access via UEAs
- Real-time balance tracking with React + ethers.js

**Components:**
- [`contracts/`](./universal-erc-20-mint/contracts/) — `UniversalERC20.sol`
- [`app/`](./universal-erc-20-mint/app/) — Minting UI

[Go to Universal ERC-20 Mint Tutorial →](./universal-erc-20-mint)

---

### 7. Derive Universal Executor Account

Interactive playground for deriving a UEA from any wallet on any supported chain. Shows both the client-side (`PushChain.utils.account.deriveExecutorAccount`) and the on-chain (`IUEAFactory.getUEAForOrigin`) paths.

**What you'll learn:**
- How UEAs are deterministically derived from any origin wallet
- Client-side derivation via `@pushchain/core` utilities
- On-chain derivation via the `IUEAFactory` precompile

**Components:**
- [`app/`](./derive-universal-executor-account/app/) — Interactive UEA derivation tool

[Go to Derive UEA Tutorial →](./derive-universal-executor-account)

---

### 8. Derive Chain Executor Account

The inverse of Derive Universal Executor Account. Connect a Push Chain wallet, see the deterministic CEA your account controls on every supported external chain. Frontend-only, no contracts.

**What you'll learn:**
- The CEA half of the UEA ↔ CEA model
- Driving `PushChain.utils.account.deriveExecutorAccount(account, { chain })` for every supported external chain
- Surfacing CEA deployment status in a UI

**Components:**
- [`app/`](./derive-chain-executor-account/app/) — React frontend (no contracts)

[Go to Derive Chain Executor Account Tutorial →](./derive-chain-executor-account)

---

### 9. Universal Cross-Chain Counters

Builds on Derive Chain Executor Account. A **single Push contract** orchestrates `increment()` calls to per-chain `ExternalCounter` deployments on Ethereum, BNB, and Base in one transaction. Each destination counter only accepts calls from the orchestrator's deterministic CEA.

**What you'll learn:**
- Cross-chain orchestration from one Push contract via `UniversalGatewayPC`
- Pre-computing and pre-authorizing a contract's CEA on every destination chain
- The `UniversalOutboundTxRequest` shape — `recipient`, `token` routing, `amount = 0`, `gasLimit`, `payload`, `revertRecipient`
- `msg.sender` on a destination chain resolving to the orchestrator's deterministic CEA

**Components:**
- [`contracts/`](./universal-cross-chain-counters/contracts/) — `MultiChainCounter.sol` (Push orchestrator) + `ExternalCounter.sol` (destination counter)
- [`app/`](./universal-cross-chain-counters/app/) — Frontend that derives CEAs, polls counters across chains, and triggers `tickAll`

[Go to Universal Cross-Chain Counters Tutorial →](./universal-cross-chain-counters)

---

### 11. Universal PUSD Payments

A paired contract + frontend tutorial that demonstrates a real-product PUSD use case: a paywall accepting PUSD as payment from users on any chain in **one signature**. Showcases the on-chain Solidity integration for PUSD (`IPUSD.transferFrom`) and the universal transaction layer's multicall mode (`approve` + `paywall.pay()` ride together).

**What you'll learn:**
- Integrating PUSD into a Solidity contract (`IPUSD` interface, `transferFrom` charging pattern)
- Bundling `approve + call` in a single signature via multicall (outer `to` = `0x0`)
- Cross-chain user attribution through UEAs — `msg.sender` is the user's deterministic UEA on Push, so the same contract works for callers on Sepolia, Solana, BNB, Base, native Push, etc.
- Deploying with Foundry on Donut Testnet and wiring the address into a Vite + React frontend

**Components:**
- [`contracts/`](./universal-pusd-payments/contracts/) — `PusdPaywall.sol`
- [`app/`](./universal-pusd-payments/app/) — React frontend with the multicall pay flow

[Go to Universal PUSD Payments Tutorial →](./universal-pusd-payments)

---

### 10. X402 Universal Transactions (advanced)

Combines the X402 Agent-to-Agent payment protocol with PushChain Universal Transactions. AI agents request payments via HTTP 402 exceptions; payments are settled cross-chain via Push.

**What you'll learn:**
- X402 protocol integration (request, sign, settle)
- Wrapping external-chain signers into PushChain Universal Signers from a Node agent
- Cross-chain payment settlement for AI agent commerce

**Components:**
- [`a2a-x402-typescript/client-agent/`](./x402-universal-transaction/a2a-x402-typescript/client-agent/) — Wallet agent with PushChain integration
- [`a2a-x402-typescript/merchant-agent/`](./x402-universal-transaction/a2a-x402-typescript/merchant-agent/) — Merchant agent that requests + settles payments
- [`a2a-x402-typescript/x402_a2a/`](./x402-universal-transaction/a2a-x402-typescript/x402_a2a/) — Reusable a2a-x402 protocol library

[Go to X402 Tutorial →](./x402-universal-transaction)

---

## Recommended Learning Path

If you're new to PushChain development:

1. **Simple Counter** — basic dApp scaffolding
2. **Universal Counter** — first cross-chain UEA pattern (hardcoded chains)
3. **Derive Universal Executor Account** — understand UEA derivation in depth
4. **Universal Counter (Dynamic)** — dynamic chain discovery
5. **Universal ERC-20 Mint** — universal token contract
6. **Batch Universal Transactions** — multicall patterns
7. **Universal Claimable Airdrop** — Merkle proofs + factory pattern
8. **Derive Chain Executor Account** — the CEA half of the identity model
9. **Universal Cross-Chain Counters** — apply CEAs to a one-contract orchestrator
10. **X402 Universal Transactions** — backend / agent payment flows
11. **Universal PUSD Payments** — accept PUSD as payment in your contract (real-product DeFi pattern)

## Tutorial Conventions

All tutorials assume:
- **Network**: Push Chain Donut Testnet (chain id `42101`)
- **RPC**: `https://evm.donut.rpc.push.org/`
- **Explorer**: `https://donut.push.network/`
- **Network constant in code**: `PushChain.CONSTANTS.PUSH_NETWORK.TESTNET`

Most tutorials are full-stack (Solidity contracts + React app). Each subdirectory contains its own README with the project structure, deployment instructions, and how to run the frontend.

## Prerequisites

- **Node.js** (v18 or higher) and npm/yarn
- **Foundry** (for tutorials that include smart contracts)
- Basic knowledge of React/TypeScript and Solidity
- A wallet (MetaMask, Phantom, etc.) for testing

## Resources

- [PushChain Documentation](https://push.org/docs)
- [PushChain UI Kit](https://www.npmjs.com/package/@pushchain/ui-kit)
- [PushChain Core SDK](https://www.npmjs.com/package/@pushchain/core)
- [PushChain GitHub](https://github.com/pushchain)
- [PushChain Discord](https://discord.gg/pushchain)
- [Push Chain Explorer](https://donut.push.network/)
