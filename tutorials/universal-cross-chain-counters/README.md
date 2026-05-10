# Universal Cross-Chain Counters Tutorial

A tutorial that demonstrates a true cross-chain orchestrator on Push Chain. **One** Push contract — `MultiChainCounter` — fans out an `increment()` call to **multiple destination chains** (Ethereum Sepolia, BNB Testnet, Arbitrum Sepolia) in a single Push transaction. Each destination has its own `ExternalCounter` that records the deterministic CEA bound to the orchestrator as `lastCaller`.

## 🔧 Reference Deployment

The app and live playground come pre-wired to a working reference deployment so you can see the full flow without redeploying anything:

| Contract | Chain | Address |
|---|---|---|
| `MultiChainCounter` | Push Donut Testnet | [`0x6448…3D15`](https://donut.push.network/address/0x6448B16c0b295F24DAB9743C80d842f47F923D15) |
| `ExternalCounter` | Ethereum Sepolia | [`0x6448…3D15`](https://sepolia.etherscan.io/address/0x6448B16c0b295F24DAB9743C80d842f47F923D15) |
| `ExternalCounter` | BNB Testnet | [`0xb3fB…6E79`](https://testnet.bscscan.com/address/0xb3fB98A3C6EEA643532198CF22cc50BC48026E79) |
| `ExternalCounter` | Arbitrum Sepolia | [`0xb3fB…6E79`](https://sepolia.arbiscan.io/address/0xb3fB98A3C6EEA643532198CF22cc50BC48026E79) |

Want to run against your own deploys? Edit the constants at the top of [`app/src/App.tsx`](./app/src/App.tsx) — the deploy steps below produce the same shape.

👉 Full tutorial: [Read the step-by-step guide on Push.org](https://push.org/docs/chain/tutorials/power-features/tutorial-universal-cross-chain-counters/)

## 🌟 Overview

This tutorial puts Push Chain's [Chain Executor Account (CEA)](../derive-chain-executor-account/) primitive to work. CEAs are deterministic per-chain identities that a Push-side contract owns on every external chain — pre-computable and only controllable by the Push-side contract that owns them.

The pattern:

1. **One orchestrator on Push Chain** stores a list of destinations and dispatches an outbound through `UniversalGatewayPC` for each one on `tickAll()`.
2. **One destination counter per chain** that records `lastCaller` on every increment — when the orchestrator dispatches via UGPC, the destination CEA is what TSS signs from, so `lastCaller` ends up being the deterministic CEA address.
3. **Off-chain (or on-chain via `ICEAFactory`)**, derive each CEA address ahead of time so you can verify it shows up as `lastCaller` after a `tickAll`.

> The base contracts leave `increment()` open so the example stays reachable in a live playground without per-chain redeploys. To gate it to the orchestrator's CEA in production, pass the derived CEA to `ExternalCounter`'s constructor as `AUTHORIZED_CEA` and `require(msg.sender == AUTHORIZED_CEA)`. The auth pattern is one snippet — see the [contracts README](./contracts/README.md#how-ceas-show-up-in-this-example) and the tutorial page for the exact diff.

```
       Push Chain                 Off-chain (TSS)              Destination chains
       ──────────                 ───────────────             ─────────────────────
User ──┐
       │ tickAll()
       ▼
MultiChainCounter ──UGPC──▶  TSS validators ──submit──▶  CEA on Ethereum  ──▶ ExternalCounter (Sepolia)
                                                          CEA on BNB       ──▶ ExternalCounter (BNB Testnet)
                                                          CEA on Arbitrum  ──▶ ExternalCounter (Arb Sepolia)
```

No off-chain bot. No relayer key. No per-chain hot wallet. The orchestrator lives entirely on Push Chain and reaches every external chain through a deterministic identity that destination protocols can pre-authorize on day zero.

## 📁 Project Structure

```
universal-cross-chain-counters/
├── contracts/
│   ├── src/
│   │   ├── MultiChainCounter.sol   # Push-side orchestrator (UGPC dispatcher)
│   │   └── ExternalCounter.sol     # Destination-side counter (CEA-gated)
│   ├── foundry.toml
│   └── README.md
├── app/
│   ├── src/
│   │   ├── App.tsx                 # Connects wallet, derives CEAs, polls counts, tickAll button
│   │   ├── abi/
│   │   ├── providers/PushChainProviders.tsx
│   │   └── ...
│   ├── package.json
│   └── README.md
└── README.md                       # This file
```

## 🎯 What You'll Learn

- **Cross-chain orchestration from a single Push contract** — fan out one transaction into many destination-chain transactions through `UniversalGatewayPC`.
- **CEAs as a deterministic identity** — derive a Push contract's destination-chain CEA before any cross-chain activity has happened. Same Push-side contract → same CEA on every destination chain.
- **`UniversalGatewayPC` outbound shape** — `recipient`, `token` (PRC-20 routing), `amount = 0`, `gasLimit`, `payload`, `revertRecipient`. Why `token` is required even with `amount = 0`. Why `recipient` is `bytes` (not `address`).
- **`msg.sender` on the destination chain resolves to the deterministic CEA** — verifiable via `ExternalCounter.lastCaller()` after each tick.
- **Optional production hardening** — gate `increment()` to the orchestrator's CEA so only one Push-side contract can speak for that destination address.

## 🚀 Quick Start

### 1. Build the contracts

```bash
cd contracts
forge build
```

### 2. Deploy MultiChainCounter on Push Chain

```bash
forge create src/MultiChainCounter.sol:MultiChainCounter \
  --rpc-url push_testnet \
  --private-key $PUSH_DEPLOYER_KEY \
  --broadcast
```

Note the deployed address — you'll use it everywhere below.

### 3. Derive the orchestrator's CEA on every destination chain

```typescript
import { PushChain } from '@pushchain/core';

const orchestrator = PushChain.utils.account.toUniversal(
  '0xYourMultiChainCounter',
  { chain: PushChain.CONSTANTS.CHAIN.PUSH_TESTNET }
);

const ceaSepolia = await PushChain.utils.account.deriveExecutorAccount(
  orchestrator,
  { chain: PushChain.CONSTANTS.CHAIN.ETHEREUM_SEPOLIA, skipNetworkCheck: true }
);
const ceaBnb = await PushChain.utils.account.deriveExecutorAccount(
  orchestrator,
  { chain: PushChain.CONSTANTS.CHAIN.BNB_TESTNET, skipNetworkCheck: true }
);
const ceaArb = await PushChain.utils.account.deriveExecutorAccount(
  orchestrator,
  { chain: PushChain.CONSTANTS.CHAIN.ARBITRUM_SEPOLIA, skipNetworkCheck: true }
);
```

These addresses are deterministic — they exist before the actual contract is deployed at them. The TSS network lazily deploys the CEA on first use.

### 4. Deploy ExternalCounter on every destination chain

`ExternalCounter` takes no constructor args in this base version (auth is omitted; see the production hardening note below). Deploy on each destination chain you want to tick:

```bash
# Sepolia
forge create src/ExternalCounter.sol:ExternalCounter \
  --rpc-url sepolia \
  --private-key $SEPOLIA_DEPLOYER_KEY \
  --broadcast

# BNB Testnet
forge create src/ExternalCounter.sol:ExternalCounter \
  --rpc-url bsc_testnet \
  --private-key $BSC_DEPLOYER_KEY \
  --broadcast

# Arbitrum Sepolia
forge create src/ExternalCounter.sol:ExternalCounter \
  --rpc-url arbitrum_sepolia \
  --private-key $ARB_DEPLOYER_KEY \
  --broadcast
```

### 5. Register destinations on the orchestrator

```typescript
import { encodePacked } from 'viem';

await pushChainClient.universal.sendTransaction({
  to: ORCHESTRATOR_ADDRESS,
  data: PushChain.utils.helpers.encodeTxData({
    abi: MultiChainCounterABI,
    functionName: 'addDestination',
    args: [
      encodePacked(['address'], [externalCounterAddressOnDestination]),
      pushRoutingToken,                 // pETH for Sepolia, pBNB for BSC, pETH_ARB for Arbitrum
      1_000_000n,                       // destination gasLimit (≥ 1M; see Troubleshooting)
    ],
  }),
});
```

Repeat once per destination.

### 6. Run the app

```bash
cd app
npm install
npm run dev
```

Open the dev server URL, edit `src/App.tsx` to paste your `ORCHESTRATOR_ADDRESS` and each `counterAddress`, connect your Push wallet, then click **Tick all destinations**. The app sends one Push transaction; the TSS network relays each outbound to its destination; every counter ticks within ~30-90s.

## 📋 Prerequisites

- **Foundry** for contract deploys (`forge --version`)
- **Node.js v18+** for the frontend
- A Push wallet with **≥ 20 PC** on Donut Testnet (deploy + 3 × 5 PC outbound fee with headroom)
- A funded EOA on each destination chain you target (Sepolia / BNB / Arbitrum testnets) for the `ExternalCounter` deploy itself

> If you just want to **try the demo**, you don't need any of the destination-chain funding — the reference deployment is already wired into the app. You only need PC on Push to call `tickAll()`.

## 🔑 The CEA Story

The orchestrator dispatches to each destination chain through UGPC. TSS validators execute the destination tx as the orchestrator's deterministic CEA on that chain — that CEA address is what `ExternalCounter.lastCaller()` records. From the destination chain's perspective the CEA is a regular `address`, but Push Chain's CEA-factory guarantees that only one Push-side contract (this orchestrator) can produce calls from it. So `lastCaller` matching the derived CEA = visible proof that the increment came from your Push contract.

### Production hardening: gate `increment()` to the CEA

To turn that observation into enforcement, swap `ExternalCounter.sol` for the auth-gated variant:

```solidity
contract ExternalCounter {
    uint256 public count;
    address public immutable AUTHORIZED_CEA;
    error NotAuthorizedCEA();

    constructor(address authorizedCEA) {
        AUTHORIZED_CEA = authorizedCEA;
    }

    function increment() external {
        if (msg.sender != AUTHORIZED_CEA) revert NotAuthorizedCEA();
        unchecked { count += 1; }
    }
}
```

Pass the orchestrator's per-chain CEA as the constructor arg. Now anyone calling from a different sender reverts; only the Push-side `MultiChainCounter` can drive the counter.

For the under-the-hood lifecycle (lazy deployment, the TSS path, the `(CEA → pushAccount)` mapping), see [How CEA Works](https://push.org/docs/chain/deep-dives/how-cea-works) on push.org.

## 🚨 Troubleshooting

- **`tickAll` reverts with `LengthMismatch`** — `perCallFee.length` must equal the number of registered destinations.
- **`tickAll` reverts with `InsufficientValue`** — `msg.value` must equal the sum of `perCallFee`. UniversalCore refunds the surplus back into the orchestrator contract via its `receive()` hook.
- **Destination tx reverts with `0xff633a38`** — the per-destination `gasLimit` you registered is too tight. The destination CEA has to execute the Vault wrapper + decode the multicall + call your target — 300k isn't enough headroom on most chains. Use ≥ 1_000_000 in `addDestination`. To bump an already-registered destination without redeploying: `setDestinationGasLimit(index, newLimit)`.
- **Destination tx never lands at all** — UGPC silently drops relays that would run out of gas. Same fix as above: bump `gasLimit`.
- **`lastCaller` doesn't match the derived CEA** — make sure you derived the CEA for the *exact* orchestrator address you deployed. Re-deploying the orchestrator gives a different CEA on every chain.

## 📚 Related Examples

- [`../derive-chain-executor-account/`](../derive-chain-executor-account/) — the CEA-derivation primitive this tutorial builds on.
- [`../../core-sdk-functions/contract-initiated-outbound-execution/`](../../core-sdk-functions/contract-initiated-outbound-execution/) — minimal Push contract that dispatches a single outbound (the building block for `tickAll`).
- [`../../core-sdk-functions/send-multichain-transactions/`](../../core-sdk-functions/send-multichain-transactions/) — a user-initiated cascade: compose multiple universal transactions under one signature, similar in spirit but driven from a wallet not a contract.

---

**Ready to ship cross-chain orchestrators! 🌍**
