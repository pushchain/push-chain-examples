# Universal Cross-Chain Counters — Frontend

A small React + Vite app that connects a Push wallet, derives the orchestrator's CEA on every destination chain, polls each destination's `count()`, and offers a one-click `tickAll` button that fans an `increment()` outbound out to every destination from the Push-side `MultiChainCounter`.

👉 Full tutorial: [Build Universal Cross-Chain Counters](https://push.org/docs/chain/tutorials/power-features/tutorial-universal-cross-chain-counters/)

## Stack

- **Vite + React 19** — same scaffold the other Push Chain tutorials use.
- **`@pushchain/ui-kit`** — `PushUniversalAccountButton`, `usePushChain`, `usePushChainClient`, `usePushWalletContext`. Wallet connection, network selection, signer, SDK access.
- **`ethers` v6** — for read-only `count()` calls on each destination chain over its own RPC.

## Run

```bash
npm install
npm run dev
```

Then open the dev server URL.

## Pre-wired demo

`src/App.tsx` ships pre-wired to a working reference deployment so you can hit **Tick all destinations** immediately after starting the dev server:

| Contract | Chain | Address |
|---|---|---|
| `MultiChainCounter` | Push Donut Testnet | `0x6448B16c0b295F24DAB9743C80d842f47F923D15` |
| `ExternalCounter` | Ethereum Sepolia | `0x6448B16c0b295F24DAB9743C80d842f47F923D15` |
| `ExternalCounter` | BNB Testnet | `0xb3fB98A3C6EEA643532198CF22cc50BC48026E79` |
| `ExternalCounter` | Arbitrum Sepolia | `0xb3fB98A3C6EEA643532198CF22cc50BC48026E79` |

To run against your own deploys, edit the constants at the top of `src/App.tsx`:

1. **`ORCHESTRATOR_ADDRESS`** — your `MultiChainCounter` on Push Chain.
2. For each entry in **`DESTINATIONS`**:
   - `counterAddress` — your `ExternalCounter` on that destination chain.
   - `pushRoutingToken`, `destinationRpc`, `gasLimit` are pre-wired for Sepolia / BNB / Arbitrum testnets — adjust if you target different chains.

The app:

1. Connects a Push wallet.
2. Derives the orchestrator's CEA on each destination chain via `PushChain.utils.account.deriveExecutorAccount(account, { chain, skipNetworkCheck: true })`.
3. Reads `ExternalCounter.count()` directly on each destination chain's RPC.
4. **`Tick all destinations`** sends a single Push tx that calls `MultiChainCounter.tickAll(perCallFee, revertRecipient)` — UGPC dispatches one outbound per destination. After a few seconds the destination CEAs deploy (lazily, on first use) and call `ExternalCounter.increment()`. The app re-polls counts a few times to surface the updates.

## Wallet config (`PushChainProviders.tsx`)

The provider is set to `PushUI.CONSTANTS.PUSH_NETWORK.TESTNET`. If you point the contracts at a different Push Chain network, update this constant accordingly.

## Notes

- **`PER_CALL_FEE_PC` is hardcoded to 5 PC.** A real app should quote each destination's fee via `UniversalCore.getOutboundTxGasAndFees(token, gasLimit)`. 5 PC is comfortable headroom for testnet outbound to Ethereum-family / BNB destinations; surplus refunds back into the orchestrator contract via its `receive()` hook.
- **First-time CEA deployment.** The first time the orchestrator dispatches to a destination chain, the TSS network deploys the CEA contract at the deterministic address. Subsequent calls reuse it. Deployment gas is covered by the `gasLimit` you set in `addDestination`.
- **Counts only update after the TSS relay lands.** The polling loop re-reads counts every 15s for ~90s after `tickAll` to catch the relay; if you don't see numbers move, refresh manually using the "Refresh counts" button.

For the bigger picture (CEAs, the deploy order, why pre-authorization works on day zero), read the [tutorial](https://push.org/docs/chain/tutorials/power-features/tutorial-universal-cross-chain-counters/) and [`../contracts/README.md`](../contracts/README.md).
