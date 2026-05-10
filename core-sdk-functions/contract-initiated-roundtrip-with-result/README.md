# Contract-Initiated Round-Trip With Result

"External action done → do action here." From a single Push contract call:

1. **External action.** A counter on BNB Testnet increments.
2. **Push action.** When the back-leg lands, this contract pops the oldest pending request off a FIFO queue and marks it `Fulfilled`. That state change is what application code reacts to.

> Companion to [`../contract-initiated-roundtrip-execution/`](../contract-initiated-roundtrip-execution/) — same wire format and configuration. This one carries a real BNB-side effect AND a real Push-side state change, instead of just bumping callback counters.

## What this example contains

| File | Purpose |
|---|---|
| [`src/RoundtripWithResult.sol`](src/RoundtripWithResult.sol) | Push contract maintaining a `request → fulfilled` state machine. `request(...)` enqueues a pending request and dispatches outbound. The destination CEA's outer multicall does TWO things: increment a BNB counter AND self-call `sendUniversalTxToUEA` to trigger the back-leg. The inbound `executeUniversalTx` pops the oldest pending request and marks it Fulfilled. |
| [`index.ts`](index.ts) | Auto-deploys, funds with PC, dispatches `request(...)`, snapshots the BNB counter + Push `fulfilledCount` before/after, and watches both state changes. |

## Pattern

```
       Push                                  Off-chain                BNB
       ────                                  ─────────                ───
EOA ──┐
      │ dispatcher.request(bnbCounter, bnbCEA, pBNB, fee, nonce, tag)
      ▼
RoundtripWithResult.request
      │ requestId = keccak256(this, seq, time, tag)
      │ requests[requestId] = { Pending, tag, createdAt: now, ... }
      │ pendingQueue.push(requestId)
      │ outbound = [bnbCounter.increment(),
      │             CEA.sendUniversalTxToUEA(...)]
      │ UGPC.sendUniversalTxOutbound{value: fee}(req)
      ▼
   UGPC ──TSS──▶ BNB CEA
                  │ step 1: bnbCounter.increment()                ──▶ BNB counter (+1)
                  │ step 2: CEA.sendUniversalTxToUEA(...)
                  ▼
              gateway.sendUniversalTxFromCEA
                  │
                  ▼
   TSS ──▶ dispatcher.executeUniversalTx(srcChain, ceaAddr, payload, ...)
                  │ pop oldest pending requestId
                  │ requests[requestId].status = Fulfilled
                  │ fulfilledCount += 1
                  ▼
              emit Fulfilled(requestId, txId, ...)
```

## Why FIFO instead of decoding requestId from the inbound payload?

The back-leg's `payload` arg is the encoded `UniversalPayload` struct that the outbound built. In principle you could `abi.decode` it to recover any data you packed in. In practice TSS-delivered bytes don't always round-trip cleanly through Solidity's `abi.decode` — the previous version of this example tried that and silently reverted in the callback.

A FIFO queue is the simpler, more robust answer:
- Every `request()` pushes a new requestId onto `pendingQueue`.
- Every callback pops `pendingQueue[pendingHead]` and increments `pendingHead`.
- TSS preserves outbound-submission order in back-leg delivery, so the popped request always corresponds to the just-completed outbound.

For applications where multiple `request()` calls can be in flight, this means the FIRST request enqueued is the FIRST to be fulfilled — natural FIFO ordering with no payload introspection.

## Prerequisites

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
Push EOA: 0x...
EOA balance: 10.0 PC

Deploying RoundtripWithResult on Push Donut Testnet...
   deployed at: 0x...

Dispatcher PC balance: 0 PC
Funding contract with 8.0 PC...

Dispatcher's CEA on BNB: 0x...
BNB CEA balance: 0.05 BNB

BNB counter (before):       42
Push fulfilledCount (before): 0

Request tag: 0xc1f4b4...
Calling request() on Push contract...
   Push tx: 0x...
   Push leg settled. status=success
   requestId = 0xa1b2c3...

Watching for the cascade (BNB increment + Push fulfill)...
BNB counter:      42 -> 43
Push fulfilledCount: 0 -> 1

Request fulfilled.
   requestId:   0xa1b2c3...
   fulfilledAt: 1715299200
   inboundTxId: 0x...

Final state:
  BNB counter:           42 -> 43
  Push fulfilledCount:   0 -> 1
```

## Common pitfalls

| Pitfall | Symptom | Fix |
|---|---|---|
| `gasLimit < 2_000_000` on outbound | BNB CEA runs out of gas inside the nested gateway call; back-leg never fires | Hardcoded 2M in the contract; don't lower it |
| Contract PC balance too low | UGPC outbound reverts (or back-leg cannot dispatch) | Fund the contract with ≥ 8 PC; UGPC refunds surplus so 8 PC covers many round-trips |
| BNB CEA not funded with BNB | BNB counter increment + back-leg's gateway call revert | Faucet ≥ 0.05 BNB to the printed CEA address |
| Calling `request()` again before back-leg of the previous one lands | Multiple pending entries in queue. Each subsequent callback pops the oldest. | Wait for `pendingCount() == 0` before kicking another, OR rely on FIFO ordering across multiple in-flight requests |

## Key contract surface

```solidity
function fund() external payable;
function request(address bnbCounter, address bnbCEAAddr, address tokenForRouting,
                 uint256 protocolFeePc, uint256 ueaNonce, bytes32 tag)
    external returns (bytes32 requestId);
function executeUniversalTx(string, bytes, bytes, uint256, address, bytes32) external payable;

uint256 public nextRequestSeq;
uint256 public fulfilledCount;
uint256 public pendingHead;
function pendingCount() external view returns (uint256);
mapping(bytes32 => Request) public requests;     // requestId → {status, tag, createdAt, fulfilledAt, inboundTxId}
```

## Related examples

- [`../contract-initiated-roundtrip-execution/`](../contract-initiated-roundtrip-execution/) — bare round-trip Push → BNB → Push (the wire format this example builds on).
- [`../contract-initiated-outbound-execution/`](../contract-initiated-outbound-execution/) — one-way Push → BNB.
- [`../contract-initiated-inbound-execution/`](../contract-initiated-inbound-execution/) — receive an inbound from an external contract.
