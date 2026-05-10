# Universal Cross-Chain Counters — Contracts

Two tiny Solidity contracts that together form a Push-side orchestrator with destination-side counters on every external chain you wire up.

👉 Full tutorial: [Build Universal Cross-Chain Counters](https://push.org/docs/chain/tutorials/power-features/tutorial-universal-cross-chain-counters/)

## Contracts

### `src/MultiChainCounter.sol` — the orchestrator (Push Chain)

One contract that holds a list of destinations and dispatches an `increment()` outbound through `UniversalGatewayPC` (UGPC) to each in a single Push transaction.

- `addDestination(bytes target, address chainToken, uint256 gasLimit)` — register an `ExternalCounter` deployment on a destination chain. `chainToken` is the PRC-20 on Push that maps to the destination (`pETH` for Ethereum-family, `pBNB` for BSC, etc.). **`gasLimit` should be ≥ 1_000_000** — the destination's CEA needs to execute the Vault wrapper + decode the multicall + call your target. Lower budgets revert with selector `0xff633a38` from the destination's CEA.
- `setDestinationGasLimit(uint256 index, uint256 newGasLimit)` (owner-only) — persist a registered destination's gas budget. Lets you tune per-chain when one destination needs more headroom than another.
- `tickAll(uint256[] perCallFee, address revertRecipient) payable` — dispatches one outbound per destination, all in the same call. Uses each destination's stored `gasLimit`. `perCallFee[i]` is the protocolFee + gasFee quoted for destination `i`. Surplus PC refunds back to this contract via `receive()`.
- `tickAllWithGas(uint256[] perCallFee, address revertRecipient, uint256[] gasLimitOverrides) payable` — same as `tickAll` but accepts per-destination gas overrides for this single call. Pass 0 in any slot to fall back to the stored value. Useful when the SDK caller wants to bump gas without persisting it on-chain.

> **About SDK-side gas overrides:** the SDK's `pushChainClient.universal.sendTransaction({ ..., gasLimit })` only sets gas for the Push-side execution of `tickAll`. The destination-chain gas budget is what the contract passes to `UGPC.sendUniversalTxOutbound(req)` as `req.gasLimit` — i.e., either the stored `destinations[i].gasLimit` (via `tickAll`) or the override array you pass to `tickAllWithGas`. If you're seeing destination-side reverts (e.g. selector `0xff633a38`), bump the gas through the contract, not the SDK.

UGPC is a predeploy at `0x00000000000000000000000000000000000000C1` on every Push Chain network.

### `src/ExternalCounter.sol` — the destination counter

A tiny counter on each destination chain. `increment()` is **public** — anyone can call. The contract records `lastCaller`, so when the orchestrator's CEA on this chain calls in (via UGPC + the TSS relay), you'll see that deterministic CEA address show up as `lastCaller`. This is intentional: keeping the counter open keeps the example reachable in a live playground without a per-chain redeploy.

For production, gate `increment()` to a known caller — typically the orchestrator's CEA. See the snippet at the bottom of the [tutorial page](https://push.org/docs/chain/tutorials/power-features/tutorial-universal-cross-chain-counters/) for the auth pattern.

- `count()` — public total counter
- `lastCaller()` — the address that most recently incremented; matches the orchestrator's CEA when the increment came through UGPC

## Build

```bash
forge build
```

Produces `out/MultiChainCounter.sol/MultiChainCounter.json` and `out/ExternalCounter.sol/ExternalCounter.json` for use by the runner in [`../app/`](../app).

## Deploy order

`ExternalCounter` takes no constructor args (auth is omitted in this tutorial), so the deploy order is straightforward:

1. **Deploy `MultiChainCounter` on Push Chain** — note the deployed address.
2. **Deploy one `ExternalCounter` per destination chain** (no constructor args).
3. **(Optional, recommended for production)** — derive the orchestrator's CEA per destination via `PushChain.utils.account.deriveExecutorAccount(orchestratorOnPush, { chain: <destChain>, skipNetworkCheck: true })` and stash it. The CEA is what shows up as `lastCaller` once the relay lands; you'll want it if you later harden `ExternalCounter` to only accept calls from that CEA.
4. **Call `MultiChainCounter.addDestination(...)`** once per destination so the orchestrator knows where to dispatch.
5. **Call `MultiChainCounter.tickAll(perCallFee, revertRecipient)`** with `msg.value = sum(perCallFee)` to fan out an `increment()` to every destination.

Quote each destination's fee separately via `UniversalCore.getOutboundTxGasAndFees(token, gasLimit)` — fees vary per chain based on current gas price and the configured `gasLimit`.

## Foundry config

`foundry.toml` pins `evm_version = "shanghai"` so the same artifact deploys on Push Donut Testnet (which does not support Cancun's MCOPY opcode) AND on Sepolia / BNB Testnet / Arbitrum Sepolia / Base Sepolia. RPC endpoints for all five chains are pre-wired so you can `forge create --rpc-url <name>` without redoing config.

## Reference deployment

If you just want addresses to point at without redeploying:

| Contract | Chain | Address |
|---|---|---|
| `MultiChainCounter` | Push Donut Testnet | `0x6448B16c0b295F24DAB9743C80d842f47F923D15` |
| `ExternalCounter` | Ethereum Sepolia | `0x6448B16c0b295F24DAB9743C80d842f47F923D15` |
| `ExternalCounter` | BNB Testnet | `0xb3fB98A3C6EEA643532198CF22cc50BC48026E79` |
| `ExternalCounter` | Arbitrum Sepolia | `0xb3fB98A3C6EEA643532198CF22cc50BC48026E79` |

These are wired into [`../app/src/App.tsx`](../app/src/App.tsx) and the website's tutorial playground out of the box.

## How CEAs show up in this example

`ExternalCounter` is unauthenticated in this tutorial, but the orchestrator still calls in **as its CEA** on the destination chain — the TSS network signs the destination tx from that deterministic address. Watch `lastCaller`: when the relay lands you'll see the orchestrator's CEA as the most recent caller, even though anyone else *could* also bump the counter.

To turn that observation into enforcement, derive the orchestrator's CEA off-chain (or via `ICEAFactory.getCEAForPushAccount` on the destination), pass it to `ExternalCounter`'s constructor as an `immutable AUTHORIZED_CEA`, and require `msg.sender == AUTHORIZED_CEA` in `increment()`. That's the production hardening — kept out of this base example so the contracts stay redeploy-free for live playgrounds.

For more on the CEA model, see the [Derive Chain Executor Account tutorial](../../derive-chain-executor-account).
