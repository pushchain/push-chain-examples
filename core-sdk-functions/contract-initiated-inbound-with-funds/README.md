# Contract-Initiated Inbound With Funds

A Sepolia contract bridges native ETH to Push **AND** triggers a contract call against a target on Push, in the same universal transaction. Combines the funds-only and inbound-execution patterns into the canonical "deposit-and-execute" flow that real apps need.

> Companion to:
> - [`../contract-initiated-recipient-bridge/`](../contract-initiated-recipient-bridge/) — funds-only (no contract call)
> - [`../contract-initiated-inbound-execution/`](../contract-initiated-inbound-execution/) — calldata-only (no funds bridged)

## What this example contains

| File | Purpose |
|---|---|
| [`src/EthereumInboundWithFunds.sol`](src/EthereumInboundWithFunds.sol) | The Sepolia dispatcher. `bridgeAndCall(target, calldata, amount, nonce)` calls Sepolia's UniversalGateway with `token = 0`, `amount = bridgeAmount`, and a payload whose multicall step calls `target.<calldata>{value: bridgeAmount}` from the Push UEA. |
| [`src/PushVault.sol`](src/PushVault.sol) | Trivial `deposit(address beneficiary)` payable target on Push — credits incoming `msg.value` to a beneficiary. Stand-in for any payable Push contract (yield vault, escrow, NFT mint, etc.). |
| [`index.ts`](index.ts) | Auto-deploys both contracts, derives the Sepolia inbound's UEA on Push, calls `bridgeAndCall(vault, deposit(beneficiary), 0.0001 ETH, nonce)`, then polls `vault.depositOf(beneficiary)` for the credit. |

## Flow

```
       Sepolia                                Off-chain               Push Chain
       ───────                                ─────────               ──────────
EOA ──┐
      │ inbound.bridgeAndCall(vault, deposit(beneficiary), 0.0001 ETH, nonce)
      │ msg.value = 0.0001 + fee
      ▼
EthereumInboundWithFunds.bridgeAndCall
      │ gateway.sendUniversalTx{value: msg.value}({
      │     recipient: 0,
      │     token: 0,                  // 0 = native ETH
      │     amount: 0.0001 ETH,        // gateway pulls this from msg.value, bridges to UEA
      │     payload: encode(UniversalPayload{
      │         data: 0x2cc2842d || Multicall[(vault, 0.0001 ETH, deposit(beneficiary))]
      │     }),
      │     ...
      │ })
      ▼
   Sepolia UniversalGateway ─emit event─▶ TSS ──▶ inbound contract's UEA on Push
                                                  (credited 0.0001 PC)
                                                  │
                                                  │ executes inner multicall:
                                                  │   vault.deposit{value: 0.0001 PC}(beneficiary)
                                                  ▼
                                              PushVault
                                              depositOf[beneficiary] += 0.0001 PC
```

## Prerequisites

- **Foundry** installed
- One private key funded on **both** chains:
  - **Sepolia**: ≥ 0.05 ETH (deploy + bridge fee per call)
  - **Push**: ≥ 1 PC (deploy the vault contract — once)
- Node ≥ 18

## Run

```bash
forge build
npm install
cp .env.sample .env
# Edit .env: paste your PRIVATE_KEY (used on both chains)
npm start
```

Expected output:

```
🔑 EOA: 0x...
🎯 Beneficiary on Push: 0x...
💰 Sepolia: 0.40 ETH
💰 Push:    1.0 PC

📦 Deploying PushVault on Push Donut Testnet...
   ✅ deployed at: 0xVault...
📦 Deploying EthereumInboundWithFunds on Sepolia...
   ✅ deployed at: 0xInbound...

📍 Inbound contract UEA on Push: 0xUEA...
📊 UEA nonce on Push: 0

📊 Pre-call vault state:
   depositOf(beneficiary): 0.0 PC
   bridgeAmount: 0.0001 ETH
   total msg.value: 0.0051 ETH

🚀 Calling inbound.bridgeAndCall(...)...
   📤 Sepolia tx: 0x...
✅ Sepolia leg settled.

📡 Waiting for the TSS to relay onto Push...

✅ PushVault credited beneficiary:
   depositOf: 0.0 → 0.0001 PC
   delta: +0.0001 PC
   lastDepositor (UEA on Push): 0xUEA...
   matches inbound UEA?: true
```

## Wire format details

The wire format is identical to `contract-initiated-recipient-bridge` except the multicall step's `value` is the bridged amount AND the `data` is non-empty calldata:

```solidity
UniversalTxRequest req = {
    recipient:        address(0),                 // always 0
    token:            address(0),                 // 0 = native ETH
    amount:           bridgeAmount,               // gateway pulls this from msg.value
    payload: abi.encode(
        address(0),                               // to: 0
        uint256(0),                               // value: 0 at the UEA level
        bytes(0x2cc2842d ||                        // UEA_MULTICALL marker
              abi.encode(Multicall[]{
                  (pushTarget, bridgeAmount, calldata)  // ← value AND calldata here
              })),
        uint256(1e7),                             // gasLimit
        uint256(1e10),                            // maxFeePerGas
        uint256(0),                               // maxPriorityFeePerGas
        ueaNonce,                                 // nonce
        uint256(9999999999),                      // deadline
        uint8(0)                                  // vType
    ),
    revertRecipient:  msg.sender,
    signatureData:    "0x"
};
gateway.sendUniversalTx{value: bridgeAmount + fee}(req);
```

The TSS gives the UEA `bridgeAmount` of native PC (post-bridge), then the UEA executes the multicall — `pushTarget.call{value: bridgeAmount}(calldata)`.

## Common pitfalls

| Pitfall | Symptom | Fix |
|---|---|---|
| Calling a non-`payable` Push function with non-zero `bridgeAmount` | UEA's call reverts; vault never credits; bridged ETH refunded to revertRecipient | Either make the target `payable`, OR set `bridgeAmount = 0` (then this is just `contract-initiated-inbound-execution`) |
| Wrong `bridgeAmount` vs `msg.value` | Contract reverts on `InsufficientValue` (msg.value must be `> bridgeAmount`) | Send `bridgeAmount + fee` total; default fee is 0.005 ETH |
| Stale UEA nonce | Relay drops or replays | Read `UEA.nonce()` per dispatch (runner does this automatically) |

## Network

- Sepolia (chain id `11155111`)
  - UniversalGateway: `0x05bD7a3D18324c1F7e216f7fBF2b15985aE5281A`
- Push Chain Donut Testnet (chain id `42101`)
  - RPC: `https://evm.donut.rpc.push.org/`

## Related examples

- [`../contract-initiated-inbound-execution/`](../contract-initiated-inbound-execution/) — same flow without bridging funds
- [`../contract-initiated-recipient-bridge/`](../contract-initiated-recipient-bridge/) — same flow with no contract call (just funds delivery)
- [`../contract-initiated-outbound-with-funds/`](../contract-initiated-outbound-with-funds/) — the symmetric Push → external version
