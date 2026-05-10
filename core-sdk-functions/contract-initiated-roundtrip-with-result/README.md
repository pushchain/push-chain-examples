# Contract-Initiated Round-Trip With Result

Real-world variation of the bare round-trip: instead of just bumping a counter, the inbound callback decodes a payload that the outbound encoded and uses it to drive **application state** — fulfilling a "request" by id.

> Companion to [`../contract-initiated-roundtrip-execution/`](../contract-initiated-roundtrip-execution/) — same wire format and configuration; this one ties the back-leg into a request/fulfill state machine instead of just incrementing counters.

## What this example contains

| File | Purpose |
|---|---|
| [`src/RoundtripWithResult.sol`](src/RoundtripWithResult.sol) | Push contract that maintains a `request → fulfilled` state machine. `request(...)` mints a unique `requestId` and dispatches outbound; the inbound callback decodes the requestId from the inbound payload and marks the request fulfilled. |
| [`index.ts`](index.ts) | Auto-deploys, funds the contract with PC, dispatches `request(...)`, then polls `requests(requestId).status` for fulfillment. |

## Pattern

```
       Push                                  Off-chain                   BNB
       ────                                  ─────────                   ───
EOA ──┐
      │ dispatcher.request(bnbCEA, pBNB, fee, nonce, tag)
      ▼
RoundtripWithResult.request
      │ requestId = keccak256(this, seq, time, tag)
      │ requests[requestId] = { status: Pending, tag, createdAt: now, ... }
      │ outbound payload includes requestId in the inner multicall data
      │ UGPC.sendUniversalTxOutbound{value: fee}(req)
      ▼
   UGPC ──TSS──▶ BNB CEA
                  │
                  │ multicall: CEA.sendUniversalTxToUEA(0, 0, inboundPayload, this)
                  ▼
              gateway.sendUniversalTxFromCEA
                  │
                  ▼
   TSS ──▶ dispatcher.executeUniversalTx(srcChain, ceaAddr, payload, ...)
                  │ extractRequestIdFromInboundPayload(payload) → requestId
                  │ requests[requestId].status = Fulfilled
                  │ requests[requestId].resultData = payload
                  ▼
              emit Fulfilled(requestId, txId, ...)
```

## How requestId survives the round-trip

The trick is encoding the requestId into the inner multicall's `data` field on the outbound side. The inbound callback receives the FULL UniversalPayload bytes as its `payload` arg, so we can unpack:

1. `payload` = `abi.encode(UniversalPayload struct fields)` — decode to get the inner `data` bytes.
2. Strip the `0x2cc2842d` prefix.
3. Decode as `Multicall[]`.
4. Read `Multicall[0].data` = `abi.encode(requestId)`.

The Push contract's `_extractRequestIdFromInboundPayload` does exactly this.

## Prerequisites

Same as `contract-initiated-roundtrip-execution`:
- **Foundry** + **Node ≥ 18**
- Push EOA with ≥ 10 PC for the first run (deploy + fund the contract)
- BNB testnet faucet to fund the contract's CEA (printed by the runner) with ≥ 0.05 BNB

## Run

```bash
forge build
npm install
cp .env.sample .env
# Edit .env: paste your PRIVATE_KEY (Push EOA)
npm start
```

Output (after CEA is funded):

```
🔑 Push EOA: 0x...
💰 EOA balance: 10.0 PC

📦 Deploying RoundtripWithResult on Push Donut Testnet...
   ✅ deployed at: 0x...

📊 Dispatcher PC balance: 0 PC
💸 Funding contract with 8.0 PC...
   ✅ funded

📍 Dispatcher's CEA on BNB: 0x...
📊 BNB CEA balance: 0.05 BNB
   ✅ funded

📊 Request tag: 0xc1f4b4...

🚀 Calling request() on Push contract...
   📤 Push tx: 0x...
   ✅ Push leg settled.
   📜 requestId = 0xa1b2c3...

📡 Watching for the inbound callback to fulfill the request...

🎉 Request fulfilled!
   requestId:   0xa1b2c3...
   fulfilledAt: 1715299200
   resultData:  0x... (608 bytes)
```

## Common pitfalls

Same as `contract-initiated-roundtrip-execution`. The only thing additional here is that the inbound payload decoding is sensitive to the encoding format — keep `vType = 1`, the `0x2cc2842d` prefix, and the `Multicall[]` structure.

## Related examples

- [`../contract-initiated-roundtrip-execution/`](../contract-initiated-roundtrip-execution/) — the canonical bare round-trip that proved the wire format works.
- [`../contract-initiated-outbound-execution/`](../contract-initiated-outbound-execution/) — the outbound leg only.
- [`../contract-initiated-inbound-execution/`](../contract-initiated-inbound-execution/) — receive an inbound from an external contract.
