# Contract-Initiated Round-Trip Execution

A Push Chain contract dispatches an outbound transaction to BNB Testnet AND is wired to receive an automatic completion callback when the destination-chain leg finishes — so its own state advances without any external orchestration.

> **Companion to** [`../contract-initiated-outbound-execution/`](../contract-initiated-outbound-execution/) (one-way outbound, Push → BNB) **and** [`../contract-initiated-inbound-execution/`](../contract-initiated-inbound-execution/) (one-way inbound, Sepolia → Push). This example combines both directions in a single contract on Push.

## Status (Donut testnet, May 2026) — ✅ working end-to-end

Verified complete round-trip at dispatcher `0x94D2FA05f854588bb2E1dC40d97f338618cBDc6c`: `outboundCount` 0→1 (Push leg + UGPC outbound emit), BNB CEA `0x32025e2B…Cb26` deployed by TSS validators, BNB-side multicall executed (CEA self-call to `sendUniversalTxToUEA`), and the inbound back-leg landed on Push via `executeUniversalTx(string,bytes,bytes,uint256,address,bytes32)` — `inboundCount` 0→1, `lastInboundTxId = 0xcf3d0150…48dd`.

**Three configurations needed to make the back-leg fire**, all verified by elimination across earlier failed runs:

1. **`gasLimit ≥ 2_000_000`** on the UGPC outbound. The 500k auto-floor is too tight for the destination CEA to finish its multicall — TSS silently drops the back-leg if the destination tx would run out of gas.
2. **Contract pre-funded with PC.** Per [the docs](https://push.org/docs/chain/build/contract-initiated-multichain-execution): "the CEA inbound to Push Chain needs $PC for execution fees. Funding your Push-side contract with $PC is your responsibility." 1.5 PC was sufficient with the wire format below.
3. **Outbound payload uses the SDK Route 3 wire format**: the destination CEA's outer multicall must include a step that **self-calls** `CEA.sendUniversalTxToUEA(token, amount, encodedUniversalPayload, revertRecipient)`. That self-call is what the TSS uses as the trigger to fire the inbound. Plain multicalls (no self-call to `sendUniversalTxToUEA`) DID NOT trigger the back-leg, even with sufficient gas/PC.

**Empirical answer for which `executeUniversalTx` overload TSS calls on a Push-native contract:** the **docs-style 6-arg version** `executeUniversalTx(string sourceChainNamespace, bytes ceaAddress, bytes payload, uint256 amount, address prc20, bytes32 txId)`. The UEA-style 2-arg version (`executeUniversalTx(UniversalPayload, bytes)`) is reserved for actual UEA proxy accounts and does NOT fire here — confirmed by deploying a contract with both overloads side-by-side and observing only the 6-arg counter advance.

## What this example contains

| File | Purpose |
|---|---|
| [`src/RoundtripDispatcher.sol`](src/RoundtripDispatcher.sol) | The single Push Chain contract. `kickOff(...)` dispatches outbound; `executeUniversalTx(...)` is the gated back-leg handler the executor module would invoke. Holds its own PC via `fund()`. |
| [`index.ts`](index.ts) | Auto-deploys the contract, funds it with PC if empty, derives the BNB CEA, calls `kickOff`, and polls both the BNB counter (forward leg) and the dispatcher's `inboundCount` (back-leg). |
| [`foundry.toml`](foundry.toml) | Foundry config — pinned to Shanghai. |

## Flow (as designed)

```
       Push Chain                          Off-chain                   BNB Testnet
       ──────────                          ─────────                   ───────────
Caller ──┐
         │ (1) kickOff(...)
         ▼
RoundtripDispatcher.kickOff
         │ outboundCount += 1
         │ (2) UGPC.sendUniversalTxOutbound{value: contractBalance}(...)
         ▼
       UGPC ───emit event──▶  TSS validators ──submit──▶  BNB CEA
       0x...C1                                            │ (deployed lazily)
                                                          │ (3) increment() on BNB counter
                                                          ▼
                                                       BNB Counter
                                                  msg.sender == CEA

Once the destination tx finalizes, TSS automatically:
                          ┌────────────────────────────────────────┐
                          │                                        │
                          ▼                                        │
       UNIVERSAL_EXECUTOR_MODULE ──executeUniversalTx──▶ RoundtripDispatcher.executeUniversalTx
       0x14191Ea5...Df7d7                                          │ inboundCount += 1
                                                                   │ executedTxIds[txId] = true
                                                                   ▼
                                                             (callback complete)
```

## Funding model

To avoid bleeding the user's EOA on every run (UGPC refunds surplus to the *contract* via `receive()`, not to the EOA), this example:

1. Has a `fund() external payable` entrypoint — the runner tops up the contract once with 8 PC.
2. `kickOff` spends from `address(this).balance`, not from `msg.value`. The EOA only pays gas (~0.05 PC per call).
3. UGPC's surplus refund flows back into the contract — over time, the balance stabilizes around the pre-funded amount.

The contract also needs PC for inbound execution fees (per the [docs](https://push.org/docs/chain/build/contract-initiated-multichain-execution): "the CEA inbound to Push Chain needs $PC for execution fees. Funding your Push-side contract with $PC is your responsibility."). The 8 PC pre-fund covers both outbound *and* inbound for many round-trips.

## Prerequisites

- **Foundry** installed
- A Push EOA with ≥ 10 PC for the first run (deploy + 8 PC contract fund). Subsequent runs use the contract's balance.
- Node ≥ 18

## Run

```bash
forge build
npm install
cp .env.sample .env
# Edit .env: paste your PRIVATE_KEY (Push EOA)
npm start
```

Expected output (forward leg works; back-leg is the part currently TSS-blocked):

```
🔑 Push EOA: 0x...
💰 EOA balance: 10.0 PC

📦 Deploying RoundtripDispatcher on Push Donut Testnet...
   ✅ deployed at: 0x...

📊 Dispatcher balance: 0 PC
💸 Funding contract with 8.0 PC (one-time)...
   ✅ Dispatcher balance now: 8.0 PC

📍 Dispatcher's CEA on BNB: 0x...

📊 Pre-kick state:
   outboundCount: 0
   inboundCount:  0
   BNB counter:   <N>

🚀 Calling kickOff() on Push contract...
   📤 Push kickOff tx: 0x...
   ✅ Push leg settled.

📡 Waiting for the round-trip to complete...

✅ Forward leg landed:
   BNB counter: <N> → <N+1>

⚠️  Did not observe `inboundCount` advance within 6 minutes.
   The forward leg landed (BNB counter advanced), but the TSS
   auto-callback to executeUniversalTx has not arrived yet.
```

## Wire format details

The outbound payload is the same simple format as the one-way outbound example: `0x2cc2842d` (UEA_MULTICALL marker) + `abi.encode((address,uint256,bytes)[])` with a single call to `BNB counter.increment()`. No nested gateway calls, no special opt-in flag — just the documented format.

The inbound handler matches the docs:

```solidity
function executeUniversalTx(
    string calldata sourceChainNamespace,
    bytes calldata ceaAddress,
    bytes calldata payload,
    uint256 amount,
    address prc20,
    bytes32 txId
) external payable {
    if (msg.sender != universalExecutorModule) revert NotUniversalExecutor();
    if (executedTxIds[txId]) revert TxAlreadyExecuted();
    executedTxIds[txId] = true;
    inboundCount += 1;
    // ... record txId, sourceChain, etc.
}
```

## Key contract surface

```solidity
constructor(address _ugpc, address _module, address _destinationContract);
function fund() external payable;
function kickOff(
    bytes calldata destinationCEABytes,
    address tokenForRouting,
    bytes calldata destinationCalldata,
    uint256 protocolFeePc
) external;
function executeUniversalTx(
    string calldata sourceChainNamespace,
    bytes calldata ceaAddress,
    bytes calldata payload,
    uint256 amount,
    address prc20,
    bytes32 txId
) external payable;
function outboundCount() view returns (uint256);
function inboundCount() view returns (uint256);
function lastInboundTxId() view returns (bytes32);
function lastInboundSourceChain() view returns (string);
```

## Network

- Push Chain Donut Testnet (chain id `42101`)
  - UGPC: `0x00000000000000000000000000000000000000C1`
  - Universal Executor Module: `0x14191Ea54B4c176fCf86f51b0FAc7CB1E71Df7d7`
- BNB Testnet (chain id `97`)
  - Counter target: `0x7f0936bb90e7dcf3edb47199c2005e7184e44cf8`
- Routing token: `0x7a9082dA308f3fa005beA7dB0d203b3b86664E36` (pBNB)

## Related examples

- [`../contract-initiated-outbound-execution/`](../contract-initiated-outbound-execution/) — one-way outbound, the same first leg this example uses.
- [`../contract-initiated-inbound-execution/`](../contract-initiated-inbound-execution/) — one-way inbound from Sepolia.
- [`../contract-initiated-recipient-bridge/`](../contract-initiated-recipient-bridge/) — funds-only inbound bridge.
