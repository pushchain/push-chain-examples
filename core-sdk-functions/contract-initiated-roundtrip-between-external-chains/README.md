# Contract-Initiated Roundtrip Between External Chains

A single Push Chain contract call triggers a **3-chain cascade**: Push → BNB Testnet → back to Push → Solana Devnet. Counters increment on both BNB and Solana from one `kickOff()`.

> The most ambitious of the contract-initiated examples. Builds on:
> - [`../contract-initiated-outbound-execution/`](../contract-initiated-outbound-execution/) — Push → BNB outbound
> - [`../contract-initiated-roundtrip-execution/`](../contract-initiated-roundtrip-execution/) — Push → BNB → Push back-leg via SDK Route 3 wire format
> - [`../send-universal-transaction-to-external-chains/`](../send-universal-transaction-to-external-chains/) — Solana program target + IDL

## Cascade flow

```
       Push Chain                          Off-chain                BNB Testnet                   Solana Devnet
       ──────────                          ─────────                ───────────                   ─────────────
EOA ──┐
      │ (1) kickOff(bnbCEAAddr, fee, nonce)
      ▼
MultiChainCascade.kickOff
      │ outbound 1: UGPC → BNB CEA, payload = outer multicall:
      │   [(BNB counter, increment()),
      │    (BNB CEA, sendUniversalTxToUEA(...))]
      ▼
   UGPC ───emit event───▶ TSS ──submit──▶ BNB CEA
                                          │
                                          │ (2) execute outer multicall:
                                          │   step 1: BNB counter.increment() ────────────▶ BNB Counter (+1)
                                          │   step 2: CEA.sendUniversalTxToUEA(...)
                                          ▼
                                  gateway.sendUniversalTxFromCEA
                                          │
                                          ▼
                       TSS ──submit──▶ MultiChainCascade.executeUniversalTx
                                          │ (3) bnbBackLegCount += 1
                                          │ (4) auto-fires SECOND outbound:
                                          │   UGPC.sendUniversalTxOutbound{value: contractBalance/2}({
                                          │     target: solanaCEABytes,
                                          │     token: pSOL,
                                          │     payload: <Anchor-encoded receive_sol(0)>,
                                          │   })
                                          ▼
                                       UGPC ───emit event───▶ TSS ──submit──▶ Solana CEA
                                                                              │
                                                                              ▼
                                                                       test_counter
                                                                       receive_sol(0) ───▶ Solana counter (+1)
```

Net effect from **one Push tx**: counters on **two different external chains** advance.

## Why this works (the SDK Route 3 wire format insight)

The pivot is the BNB CEA's outer multicall. Step 2 is a self-call to `CEA.sendUniversalTxToUEA(...)` — this is what TSS recognizes as "fire a back-leg to the originating Push account." That back-leg lands on `MultiChainCascade.executeUniversalTx(...)` (the docs-style 6-arg signature, the one TSS dispatches to for Push-native contracts).

Inside `executeUniversalTx`, the contract has full Push-side privileges — including the ability to call UGPC again. So it fires a NEW outbound, this time targeting Solana.

The contract holds its own PC balance for both UGPC dispatches; the EOA only pays gas for `kickOff`. UGPC's surplus refunds flow back into the contract via `receive()`, so balance stabilizes over many runs.

## What this example contains

| File | Purpose |
|---|---|
| [`src/MultiChainCascade.sol`](src/MultiChainCascade.sol) | The single Push contract. Holds the BNB target + Solana target config (settable by owner). `kickOff()` dispatches outbound 1 (Push → BNB). `executeUniversalTx()` receives the back-leg AND fires outbound 2 (Push → Solana). |
| [`index.ts`](index.ts) | Auto-deploys, funds with PC, derives both CEAs (BNB + Solana), encodes the Solana payload using the test_counter IDL, configures the contract, runs `kickOff()`, then watches all three legs. |

## Prerequisites

- **Foundry** + Node ≥ 18
- A Push EOA with ≥ 12 PC for first run (deploy + 8 PC fund + gas headroom)
- No funding needed on the destination CEAs (BNB or Solana). UGPC's gas budget for each outbound is forwarded to the CEA as `msg.value` when TSS submits the destination tx, so the CEA has native balance for nested gateway calls during that tx.

## Run

```bash
forge build
npm install
cp .env.sample .env
# Edit .env: paste your PRIVATE_KEY (Push EOA)
npm start
```

First run will:
1. Deploy `MultiChainCascade` on Push.
2. Fund it with 8 PC.
3. Derive both destination CEAs (BNB + Solana) and configure both targets on the contract.
4. Fire `kickOff` and watch the cascade.

## Configuration model

The contract has `configureBnbTarget(address, bytes)` and `configureSolanaTarget(bytes, bytes)` — owner-only setters that store the destination + payload bytes. The runner computes both off-chain and writes them once. Subsequent runs reuse the stored config.

This separation lets the contract logic stay simple (no inline payload-builder for every chain) while keeping all the wire format details runner-side where the SDK helpers (`encodeTxData({ idl })`) live.

## Wire format details

**Outbound 1 (Push → BNB):**

```solidity
UniversalOutboundTxRequest req = {
    target:           bytes(bnbCEAAddr),
    token:            pBNB,                 // selects BNB Testnet
    amount:           0,
    gasLimit:         2_000_000,            // headroom for nested gateway call
    payload:          0x2cc2842d || abi.encode(Multicall[]{
                          (bnbDestinationContract, 0, increment()),
                          (bnbCEAAddr, 0, sendUniversalTxToUEA(0, 0, INBOUND_PAYLOAD, address(this)))
                      }),
    revertRecipient:  address(this)
};
```

The INBOUND_PAYLOAD is a normal `UniversalPayload` struct with a sentinel multicall (no Push-side calls — this contract handles routing inside `executeUniversalTx`).

**Outbound 2 (Push → Solana, fired from `executeUniversalTx`):**

```solidity
UniversalOutboundTxRequest req = {
    target:           solanaCEABytes,           // 32-byte program-derived address
    token:            pSOL,                     // selects Solana Devnet
    amount:           0,
    gasLimit:         2_000_000,
    payload:          solanaPayload,            // Anchor-encoded receive_sol(0)
    revertRecipient:  address(this)
};
// msg.value = solanaOutboundValuePc (set by runner — see "Sizing the Solana value")
```

`solanaPayload` is built off-chain by the runner via `PushChain.utils.helpers.encodeTxData({ idl: TEST_COUNTER_IDL, functionName: 'receive_sol', args: [0n] })`.

## Sizing the Solana outbound value

UGPC swaps native PC into the destination chain's gas-token (here, pSOL) on the Push-side leg. If the PC value passed isn't enough to fill the swap at current Uniswap V3 pool prices, the swap router reverts with `STF` (SafeTransferFrom). A flat percentage of contract balance (e.g. `balance/2`) is **not safe** — pool prices move and the swap can fail unpredictably.

The runner mirrors the SDK's `estimateNativeValueForSwap` algorithm to size the value precisely, then stores it on the contract via `configureSolanaOutboundValue(uint256)`:

1. `UGPC.UNIVERSAL_CORE()` → UniversalCore address.
2. `UniversalCore.getOutboundTxGasAndFees(pSOL, 2_000_000)` → `gasFee` (in pSOL).
3. `UniversalCore.WPC()` / `.uniswapV3Factory()` / `.defaultFeeTier(pSOL)`.
4. `factory.getPool(WPC, pSOL, feeTier)` → pool address.
5. `pool.slot0()` → `sqrtPriceX96`.
6. `wpcNeeded = (gasFee × sqrtPriceX96²) / 2¹⁹²` (or the inverse if pSOL > WPC by address).
7. Multiply by 2 (SDK `SWAP_BUFFER`) then by 1.1 (10% executor buffer) → `solanaOutboundValuePc`.

The contract dispatches outbound 2 with `value: solanaOutboundValuePc`. UGPC refunds any surplus into the contract via `receive()`, so over-sizing is safe.

## Common pitfalls

| Pitfall | Symptom | Fix |
|---|---|---|
| `gasLimit < 2_000_000` on outbound 1 | BNB CEA runs out of gas inside the nested `sendUniversalTxToUEA` call; back-leg never fires | Hardcoded 2M in the contract; don't lower it |
| Solana value undersized for current pool depth | Outbound 2 reverts inside UGPC's swap with `STF` | Runner computes `solanaOutboundValuePc` via `estimateNativeValueForSwap` mirror — never use `balance/2` |
| Contract PC balance too low to cover BOTH legs | kickOff succeeds but executeUniversalTx reverts with `InsufficientPC` | Fund contract ≥ `protocolFee + solanaOutboundValuePc` (the runner tops up automatically) |
| Solana payload decoded but program not found / mismatch | Solana CEA executes but the test_counter program errors | Verify SOL_TEST_PROGRAM is reachable on Solana Devnet; check explorer for the CEA tx |
| Auto-trigger inside executeUniversalTx fails (e.g., insufficient PC) | BNB back-leg lands but Solana never dispatches | Use `dispatchSolanaManually()` (owner-only) to retry — fund the contract first |

## Key contract surface

```solidity
function fund() external payable;
function configureBnbTarget(address bnbDestinationContract, bytes calldata bnbDestinationCalldata) external;
function configureSolanaTarget(bytes calldata solanaCEABytes, bytes calldata solanaPayload) external;
function configureSolanaOutboundValue(uint256 valuePc) external;       // owner-only — sized off-chain
function kickOff(address bnbCEAAddr, uint256 protocolFeePc, uint256 ueaNonce) external;
function executeUniversalTx(string, bytes, bytes, uint256, address, bytes32) external payable;
function dispatchSolanaManually() external;     // owner-only fallback

uint256 public kickOffCount;
uint256 public bnbBackLegCount;
uint256 public solanaDispatchCount;
uint256 public solanaOutboundValuePc;            // PC value for outbound 2 (set by runner)
```

## Network

- Push Chain Donut Testnet (`42101`) — UGPC at `0x...C1`
- BNB Testnet (`97`) — counter at `0x7f0936bb90e7dcf3edb47199c2005e7184e44cf8`, Universal Gateway at `0x44aFFC...EaC0`
- Solana Devnet — test_counter program at `8yNqjrMnFiFbVTVQcKij8tNWWTMdFkrDf9abCGgc2sgx`

Routing tokens on Push:
- pBNB: `0x7a9082dA308f3fa005beA7dB0d203b3b86664E36`
- pSOL: `0x5D525Df2bD99a6e7ec58b76aF2fd95F39874EBed`

## Related examples

- [`../contract-initiated-roundtrip-execution/`](../contract-initiated-roundtrip-execution/) — bare round-trip Push → BNB → Push (the wire format this example builds on).
- [`../contract-initiated-roundtrip-with-result/`](../contract-initiated-roundtrip-with-result/) — round-trip with app-state side-effects.
- [`../contract-initiated-outbound-execution/`](../contract-initiated-outbound-execution/) — one-way Push → BNB.
- [`../send-universal-transaction-to-external-chains/`](../send-universal-transaction-to-external-chains/) — user-initiated Solana program call (where the test_counter IDL came from).
