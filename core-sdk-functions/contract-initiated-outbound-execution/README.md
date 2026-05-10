# Contract-Initiated Multichain Execution

A runnable companion to the [Contract-Initiated Multichain Execution docs](https://push.org/docs/chain/build/contract-initiated-multichain-execution). Deploy a Push Chain smart contract that can dispatch outbound cross-chain transactions through `UniversalGatewayPC` (UGPC) and receive inbound payloads back via `executeUniversalTx`.

> **Why this is different from `send-universal-transaction`**: that example is **user-initiated** — a wallet signs and the SDK routes it. This example is **contract-initiated** — a Push Chain contract autonomously dispatches an outbound call during its own execution. No live user signature is required at the cross-chain hop, and the external-chain `msg.sender` is the contract's CEA, not the user's.

## What this example contains

| File | Purpose |
|---|---|
| [`src/MinimalContractInitiatedExecutor.sol`](src/MinimalContractInitiatedExecutor.sol) | The Solidity contract — exercises both directions: `dispatchOutbound` (Push → external) and `executeUniversalTx` (external → Push) |
| [`index.ts`](index.ts) | Node script that auto-deploys the contract on first run (when `CONTRACT_ADDRESS` is empty) and then calls `dispatchOutbound` to fire a cross-chain `increment()` against a counter on BNB Testnet |
| [`foundry.toml`](foundry.toml) | Foundry config — pinned to `evm_version = "shanghai"` because Push Donut Testnet does not support Cancun opcodes (MCOPY) at runtime. Default Cancun output reverts with `invalid opcode 0x5e` on dispatch. |

## Prerequisites

- **Foundry** installed — `forge --version`
- A Push native wallet with **≥ 10 PC** (covers deploy + the 8 PC outbound msg.value)
- Node ≥ 18

## Step 1 — Build the contract

Compile with Foundry so `out/MinimalContractInitiatedExecutor.sol/MinimalContractInitiatedExecutor.json` exists. The script reads this artifact at deploy time.

```bash
forge build
```

## Step 2 — Configure your wallet

```bash
npm install
cp .env.sample .env
# Edit .env: paste your PUSH_PRIVATE_KEY (Push native wallet with ≥ 10 PC).
# CONTRACT_ADDRESS can stay empty — the script will offer to deploy.
```

## Step 3 — Run the outbound demo

```bash
npm start
```

On first run with no `CONTRACT_ADDRESS`:

```
🔑 Push native EOA: 0x...
📦 No CONTRACT_ADDRESS found in .env.
   Deploy MinimalContractInitiatedExecutor now? (y/n): y

📦 Deploying MinimalContractInitiatedExecutor on Push Donut Testnet...
   ugpc:                    0x00000000000000000000000000000000000000C1
   universalExecutorModule: 0x14191Ea54B4c176fCf86f51b0FAc7CB1E71Df7d7
   📤 deploy tx: 0x...
   ✅ deployed at: 0xDeployed...
   💾 Saved CONTRACT_ADDRESS=0xDeployed... to .env for future runs.

📦 Executor contract: 0xDeployed...
[continues with the dispatchOutbound demo]
```

Subsequent runs reuse the persisted `CONTRACT_ADDRESS` automatically — no prompt.

If you'd rather deploy via Foundry directly (e.g., to verify on BlockScout in the same step), use `forge create` with the constructor args inline:

```bash
forge create src/MinimalContractInitiatedExecutor.sol:MinimalContractInitiatedExecutor \
  --rpc-url push_testnet \
  --private-key $PUSH_PRIVATE_KEY \
  --broadcast \
  --constructor-args \
    0x00000000000000000000000000000000000000C1 \
    0x14191Ea54B4c176fCf86f51b0FAc7CB1E71Df7d7
```

Then paste the deployed address into `.env` as `CONTRACT_ADDRESS`.

The script:

1. Reads the deployed contract address.
2. Derives the **contract's CEA on BNB Testnet** via `PushChain.utils.account.deriveExecutorAccount(contractAccount, { chain })` — this is the address that will execute on BNB.
3. ABI-encodes `counter.increment()` for the BNB counter at `0x7f0936bb90e7dcf3edb47199c2005e7184e44cf8`.
4. Wraps that calldata in the **destination CEA's multicall format** — `0x2cc2842d` (UEA_MULTICALL marker) + `abi.encode((address,uint256,bytes)[])`. Without this prefix the destination CEA falls into its single-call path and reverts with `InvalidRecipient()`.
5. Calls `dispatchOutbound(token=pBnb, amount=0, recipient=contractCEABytes, gasLimit=0, payload=multicallPayload, revertRecipient=wallet)` on the Push contract with **8 PC** as `msg.value` (covers UGPC protocol fee + destination gas; surplus is refunded to the contract).
6. Waits for the Push Chain receipt, then prints both the Push and BNB explorer URLs to watch the cross-chain leg land.

Important notes about the call:

- `token` selects the destination chain — UGPC uses the PRC-20's source-chain namespace to route. `token = 0x0` is rejected even when `amount = 0`. Use the matching `MOVEABLE.TOKEN.PUSH_TESTNET_DONUT.<pXxx>` for the destination chain.
- `recipient` is a legacy/dummy field — UGPC accepts it for ABI compat but the relay does not use it for routing. Pass the contract's CEA on the destination chain as a sensible non-zero value.
- `gasLimit` should be `0` (UGPC auto-floors per chain) or `≥ 500_000`. Values in between revert with no revert data.

## How the flow works

```
       Push Chain                          Off-chain                    BNB Testnet
       ──────────                          ─────────                    ───────────
Caller ──┐
         │ (1) dispatchOutbound(...)
         ▼
  YourContract.dispatchOutbound
         │ (2) sendUniversalTxOutbound{value: fee}
         ▼
       UGPC ───emit event──▶  TSS validators ──submit──▶  YourContract's CEA
       0x...C1                                            │
                                                          │ (3) increment()
                                                          ▼
                                                       BNB Counter
                                                  msg.sender == CEA
```

This example is **one-way only**: there's no inbound back-leg. The destination CEA executes the payload on BNB and the flow ends there. If you want a Push contract that *also* receives a TSS callback when the destination tx finishes (so its own state advances), see [`../contract-initiated-roundtrip-execution/`](../contract-initiated-roundtrip-execution/).

## Key contract surface

```solidity
// Push Chain Donut Testnet predeploy
address constant UGPC = 0x00000000000000000000000000000000000000C1;

// Outbound — your contract calls UGPC to dispatch a cross-chain call.
// The CEA on the destination chain executes `payload` from your contract's identity.
function dispatchOutbound(
    address token,
    uint256 amount,
    bytes calldata recipient,
    uint256 gasLimit,
    bytes calldata payload,
    address revertRecipient
) external payable;
```

## Network

- Push Chain Donut Testnet (chain id `42101`)
- Push RPC: `https://evm.donut.rpc.push.org/`
- BNB Testnet RPC: `https://bsc-testnet-rpc.publicnode.com`
- Network constant in code: `PushChain.CONSTANTS.PUSH_NETWORK.TESTNET`
- UGPC: `0x00000000000000000000000000000000000000C1`
- `UNIVERSAL_EXECUTOR_MODULE`: `0x14191Ea54B4c176fCf86f51b0FAc7CB1E71Df7d7`

## Dependencies

- `@pushchain/core` — `latest`
- `ethers` — for the Push Chain signer + contract call
- `@coral-xyz/anchor` — peer dep required by the SDK for SVM IDL handling

## Related examples

- [`../send-universal-transaction-to-external-chains/`](../send-universal-transaction-to-external-chains/) — user-initiated Route 2 (UOA → external chain via CEA)
- [`../send-multichain-transactions/`](../send-multichain-transactions/) — compose multiple universal transactions under one signature
- [`../utility-functions/`](../utility-functions/) — full SDK utility surface, including `deriveExecutorAccount` used here for the contract CEA lookup
