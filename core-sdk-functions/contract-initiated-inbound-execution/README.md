# Contract-Initiated Inbound Execution

A runnable companion to the [Contract-Initiated Multichain Execution docs](https://push.org/docs/chain/build/contract-initiated-multichain-execution). A contract on **Sepolia** dispatches a universal transaction whose Push Chain leg runs from the contract's own UEA — no live user signature is required at the cross-chain hop.

> **The companion to [`../contract-initiated-outbound-execution/`](../contract-initiated-outbound-execution/)**: that example dispatches **outbound** (Push contract → external chain). This one dispatches **inbound** (external-chain contract → Push Chain), and the resulting Push-side `msg.sender` is the **Sepolia contract's UEA**, not the user's.

## What this example contains

| File | Purpose |
|---|---|
| [`src/EthereumInboundDispatcher.sol`](src/EthereumInboundDispatcher.sol) | The Sepolia-side dispatcher. Calls the per-chain UniversalGateway with the exact wire format the SDK uses (encoded `UniversalPayload` containing a `UEA_MULTICALL` payload). Works on any V1 gateway chain (Sepolia / Arbitrum Sepolia / Base Sepolia / BNB Testnet) — only the constructor address changes. |
| [`src/PushCounter.sol`](src/PushCounter.sol) | A trivial counter on Push Chain that records `msg.sender`. Used as the inbound target. |
| [`index.ts`](index.ts) | Auto-deploys both contracts on first run, derives the dispatcher's UEA on Push, dispatches an inbound `increment()` from Sepolia, then polls Push for the relayed effect. |
| [`foundry.toml`](foundry.toml) | Foundry config — `evm_version = "shanghai"` so the same artifact deploys cleanly on both Sepolia and Push Donut Testnet. |

## Prerequisites

- **Foundry** installed — `forge --version`
- One EOA private key funded on **both** chains:
  - **Push Donut Testnet:** ≥ 1 PC (covers the counter deployment + reading)
  - **Sepolia:** ≥ 0.05 ETH (covers the dispatcher deployment + ~0.005 ETH gateway fee per dispatch)
- Node ≥ 18

## Step 1 — Build the contracts

```bash
forge build
```

This produces `out/EthereumInboundDispatcher.sol/...json` and `out/PushCounter.sol/...json`, which the runner reads at deploy time.

## Step 2 — Configure your wallet

```bash
npm install
cp .env.sample .env
# Edit .env: paste your PRIVATE_KEY (works on both chains).
# SEPOLIA_DISPATCHER_ADDRESS / PUSH_COUNTER_ADDRESS can stay empty —
# the script will deploy them and persist the addresses back.
```

## Step 3 — Run the inbound demo

```bash
npm start
```

Output on first run:

```
🔑 EOA (used on both chains): 0x...
💰 Push balance:    26.0 PC
💰 Sepolia balance: 0.40 ETH

📦 Deploying PushCounter on Push Donut Testnet...
   ✅ deployed at: 0xb1C7...01B7d
📦 Deploying EthereumInboundDispatcher on Sepolia...
   ✅ deployed at: 0xb1C7...01B7d
📍 Dispatcher's UEA on Push: 0xeEFd...246b
📊 Dispatcher UEA nonce on Push: 0

🚀 Dispatching inbound from Sepolia...
   📤 Sepolia tx: 0x36da0e8a...
✅ Sepolia leg settled. status=success block=10818002

📡 Waiting for the TSS network to relay onto Push Chain...
✅ Push counter incremented: 1 → 2
   lastCaller (UEA on Push): 0xeEFd...246b
   matches dispatcher UEA?:  true
```

Subsequent runs reuse the persisted addresses automatically — no prompt.

## How the flow works

```
        Sepolia                            Off-chain                  Push Chain
        ───────                            ─────────                  ──────────
EOA ──┐
      │ (1) dispatcher.triggerOnPush(...)
      ▼
 Dispatcher.triggerOnPush
      │ (2) gateway.sendUniversalTx{value: fee}(req)
      ▼
   UniversalGateway ──emit UniversalTx event──▶ TSS validators ──submit──▶ Dispatcher's UEA on Push
   0x05bD...281A                                                          │
                                                                          │ (3) UEA executes the encoded
                                                                          │     UniversalPayload's `data`
                                                                          │     = UEA_MULTICALL marker +
                                                                          │       Multicall[(PushCounter, 0, increment())]
                                                                          ▼
                                                                       PushCounter.increment()
                                                                  msg.sender == dispatcher's UEA on Push
```

The Push-side relay is **automatic** — TSS validators monitor every supported gateway and submit the corresponding tx on Push.

## Wire format details

Most "gotchas" of contract-initiated inbound dispatch live in how `UniversalGateway.sendUniversalTx(req)` is built. The contract here mirrors the SDK exactly:

```solidity
UniversalTxRequest req = {
    recipient:        address(0),                // ← always 0; real target is inside payload
    token:            address(0),                // ← only set when bridging funds alongside the call
    amount:           0,
    payload:          abi.encode(UniversalPayload({
        to:                    address(0),       // ← always 0
        value:                 0,
        data:                  bytes4(keccak256("UEA_MULTICALL"))   // 0x2cc2842d
                              || abi.encode(Multicall[(pushTarget, 0, calldata)]),
        gasLimit:              1e7,              // matches SDK default
        maxFeePerGas:          1e10,             // 10 gwei
        maxPriorityFeePerGas:  0,
        nonce:                 <UEA's current nonce on Push>,
        deadline:              9999999999,
        vType:                 0                 // universalTxVerification
    })),
    revertRecipient:  msg.sender,                // gets fee refund if Push side reverts
    signatureData:    "0x"                       // EVM gateway authenticates via msg.sender; signature unused
};
```

What the gateway emits (`UniversalTx` event):

- `sender` (indexed): the dispatcher contract address.
- `recipient` (indexed): zero. Real target lives inside the encoded `UniversalPayload`'s `data` field.
- `payload`: the abi-encoded `UniversalPayload` struct.
- `fromCEA`: `false` for ordinary contract callers (only EOAs / verified CEAs see `true`). The TSS still relays `fromCEA = false` events as long as the payload is well-formed.

### Common pitfalls

| Pitfall | Symptom | Fix |
|---|---|---|
| Passing raw `increment()` calldata as `payload` (the natural-looking thing) | Sepolia tx succeeds but the Push counter never updates — TSS silently drops the malformed event | Wrap as `abi.encode(UniversalPayload{ ..., data: 0x2cc2842d \|\| abi.encode(Multicall[]) })` |
| Setting `recipient = pushTarget` instead of `address(0)` | Same as above — silent drop | Pass `recipient = address(0)`. The real target is **inside** the multicall encoding. |
| Using a stale nonce | Relay drops or replays incorrectly | Read the UEA's `nonce()` on Push before each dispatch (see [`getUEANonce`](index.ts) in the runner). For an undeployed UEA, nonce starts at 0. |
| Skipping the `UEA_MULTICALL` marker (`0x2cc2842d`) | UEA falls into single-call path; reverts on `InvalidRecipient` since the inner `to` is 0 | Always prefix the encoded `Multicall[]` with the 4-byte marker. |
| `evm_version = "cancun"` | Dispatcher reverts at runtime on Push (MCOPY = `0x5e` not supported) — but Sepolia still works | Pin `evm_version = "shanghai"` so the same artifact runs on both chains. |

## Key contract surface

```solidity
// UniversalGateway addresses (from SDK chain constants, lockerContract field)
// Sepolia:         0x05bD7a3D18324c1F7e216f7fBF2b15985aE5281A
// Arbitrum Sepolia 0x2cd870e0166Ba458dEC615168Fd659AacD795f34
// Base Sepolia     0xFD4fef1F43aFEc8b5bcdEEc47f35a1431479aC16
// BNB Testnet      0x44aFFC61983F4348DdddB886349eb992C061EaC0

// The dispatcher's only entry point — wraps a single call to a Push contract.
function triggerOnPush(
    address pushTarget,
    bytes calldata pushCalldata,
    uint256 nonce,
    address revertRecipient
) external payable;
```

## Network

- Sepolia (chain id `11155111`)
  - RPC: `https://ethereum-sepolia-rpc.publicnode.com`
  - Explorer: `https://sepolia.etherscan.io/`
  - UniversalGateway: `0x05bD7a3D18324c1F7e216f7fBF2b15985aE5281A`
- Push Chain Donut Testnet (chain id `42101`)
  - RPC: `https://evm.donut.rpc.push.org/`
  - Explorer: `https://donut.push.network/`
  - Network constant in code: `PushChain.CONSTANTS.PUSH_NETWORK.TESTNET`

## Dependencies

- `@pushchain/core` — `latest` (only used here for UEA derivation; the dispatcher contract talks to the gateway directly)
- `ethers` — for the EVM signers + contract calls
- `@coral-xyz/anchor` — peer dep required by the SDK for SVM IDL handling

## Related examples

- [`../contract-initiated-outbound-execution/`](../contract-initiated-outbound-execution/) — the **outbound** counterpart (Push contract → BNB counter via UGPC)
- [`../send-universal-transaction-to-push-all-cases/`](../send-universal-transaction-to-push-all-cases/) — the equivalent flow but **user-initiated** through the SDK from every supported origin
- [`../utility-functions/`](../utility-functions/) — `deriveExecutorAccount` and the rest of the documented SDK utility surface
