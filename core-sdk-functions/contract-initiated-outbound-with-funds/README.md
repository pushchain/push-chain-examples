# Contract-Initiated Outbound With Funds

A Push Chain contract dispatches an outbound that bridges PRC-20 tokens to the destination CEA **AND** triggers a contract call there, in the same outbound. The CEA on the destination chain receives the bridged native asset and executes the multicall — the canonical "deposit-and-execute" pattern from Push to external chains.

> Companion to [`../contract-initiated-outbound-execution/`](../contract-initiated-outbound-execution/) — that one's payload-only (`amount = 0`). This one bridges PRC-20 alongside the call (`amount > 0`).

## Pattern + status

The contract code matches the SDK's funds-bearing outbound encoding (`buildOutboundRequest` with `token = pPRC20` + `amount > 0`). End-to-end testing requires the dispatcher contract to **already hold pPRC-20 tokens** before kickoff (UGPC pulls via `transferFrom`). Currently we don't have pBNB on the test wallet, so this example is committed as a runnable pattern but the testnet end-to-end run requires:

1. Bridge BNB testnet → Push to mint pBNB. Use the bridge UI in [`../../apps/bridge/`](../../apps/bridge/) or run a Route 1 inbound from BNB targeting this dispatcher.
2. Once pBNB is on the dispatcher (≥ `BRIDGE_AMOUNT_WEI`), the runner proceeds.

## What this example contains

| File | Purpose |
|---|---|
| [`src/PushOutboundWithFunds.sol`](src/PushOutboundWithFunds.sol) | The Push dispatcher. `dispatchOutboundWithFunds(...)` approves UGPC for the PRC-20 amount, then calls UGPC with `token = pPRC20`, `amount = bridgeAmount`, and a multicall payload. |
| [`index.ts`](index.ts) | Auto-deploys the dispatcher, funds it with PC for the UGPC fee, verifies it holds enough pBNB, then calls `dispatchOutboundWithFunds(bnbCEA, pBNB, 0.0001 BNB, BNB_COUNTER, increment(), 0, 8 PC)` and watches the BNB counter. |

## Flow

```
       Push Chain                          Off-chain                  BNB Testnet
       ──────────                          ─────────                  ───────────
EOA ──┐
      │ dispatcher.dispatchOutboundWithFunds(bnbCEA, pBNB, amount, BNB_COUNTER, increment(), 0, fee)
      ▼
PushOutboundWithFunds.dispatchOutboundWithFunds
      │ pBNB.approve(UGPC, amount)
      │ UGPC.sendUniversalTxOutbound{value: fee}({
      │     target: bnbCEA,
      │     token: pBNB,             // PRC-20 to bridge
      │     amount: 0.0001 BNB,      // UGPC pulls this from the contract
      │     gasLimit: 2_000_000,
      │     payload: 0x2cc2842d || Multicall[(BNB_COUNTER, 0, increment())],
      │     revertRecipient: address(this)
      │ })
      ▼
   UGPC ──emit event──▶  TSS validators ──submit──▶  BNB CEA
                                                     │ (bridged 0.0001 BNB)
                                                     │ executes multicall:
                                                     │   BNB_COUNTER.increment()
                                                     ▼
                                                  BNB Counter (incremented)
```

## Prerequisites

- **Foundry** installed
- A Push EOA with ≥ 10 PC for the first run (deploy + 8 PC fund)
- The dispatcher contract holding ≥ `BRIDGE_AMOUNT_WEI` of pBNB (see [Pattern + status](#pattern--status) above)
- Node ≥ 18

## Run

```bash
forge build
npm install
cp .env.sample .env
# Edit .env: paste your PRIVATE_KEY (Push EOA)
npm start
```

The runner will:

1. Deploy `PushOutboundWithFunds` and persist its address.
2. Fund it with PC if balance is below `KICKOFF_PROTOCOL_FEE_PC`.
3. **Verify pBNB balance** on the dispatcher. If insufficient, exit with the address you need to fund.
4. Once funded with pBNB, dispatch and watch the BNB counter.

## Wire format details

```solidity
UniversalOutboundTxRequest req = {
    target:           bytes(bnbCEAAddress),       // 20 bytes
    token:            pBNB,                       // ← PRC-20 on Push
    amount:           bridgeAmount,               // ← UGPC pulls this via transferFrom
    gasLimit:         2_000_000,                  // headroom for nested call with value
    payload:          0x2cc2842d || abi.encode(Multicall[]{
                          (destinationContract, destinationCallValue, destinationCalldata)
                      }),
    revertRecipient:  address(this)
};
ugpc.sendUniversalTxOutbound{value: protocolFeePc}(req);
```

The `destinationCallValue` parameter lets you forward part (or all) of the bridged native into the inner call as `msg.value`. Set to `0` if `destinationContract.fn()` is not `payable`; otherwise set to `bridgeAmount` (or any portion) to deposit into a payable function.

**Why `gasLimit = 2_000_000`:** the destination CEA has to decode the multicall + execute a call carrying value — the 500k auto-floor is too tight. Same finding as the round-trip example.

## Common pitfalls

| Pitfall | Symptom | Fix |
|---|---|---|
| Dispatcher has no pBNB balance | `InsufficientPRC20` revert (the runner pre-checks) | Bridge BNB → Push first to get pBNB on the dispatcher |
| Forgetting to `approve` UGPC for pBNB | `transferFrom` fails inside UGPC | The contract auto-approves before each kickoff |
| Calling a non-payable destination with `destinationCallValue > 0` | CEA's inner call reverts | Set `destinationCallValue = 0` if target isn't payable |
| `gasLimit = 0` (auto-floor of 500k) | TSS silently drops the relay | Pass `≥ 2_000_000` |

## Key contract surface

```solidity
function fund() external payable;

function dispatchOutboundWithFunds(
    address destinationCEAAddr,
    address prc20Token,
    uint256 amount,
    address destinationContract,
    bytes calldata destinationCalldata,
    uint256 destinationCallValue,
    uint256 protocolFeePc
) external;

event OutboundWithFundsKicked(bytes recipient, address indexed token, uint256 amount, bytes payload);
```

## Network

- Push Chain Donut Testnet (chain id `42101`)
  - UGPC: `0x00000000000000000000000000000000000000C1`
  - pBNB: `0x7a9082dA308f3fa005beA7dB0d203b3b86664E36`
- BNB Testnet (chain id `97`)
  - Counter target: `0x7f0936bb90e7dcf3edb47199c2005e7184e44cf8`

## Related examples

- [`../contract-initiated-outbound-execution/`](../contract-initiated-outbound-execution/) — payload-only outbound (no bridge)
- [`../contract-initiated-inbound-with-funds/`](../contract-initiated-inbound-with-funds/) — the symmetric external-chain → Push version
- [`../contract-initiated-roundtrip-execution/`](../contract-initiated-roundtrip-execution/) — Push → external + auto-callback
