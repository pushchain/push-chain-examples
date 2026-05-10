# Contract-Initiated Recipient Bridge

A Sepolia contract bridges native ETH to a recipient address on Push Chain — no payload to execute, just funds delivery. The simplest "value bridge" pattern, contract-initiated.

> **Companion to** [`../contract-initiated-inbound-execution/`](../contract-initiated-inbound-execution/) (no funds, calldata only) **and** [`../send-universal-transaction-with-funds/`](../send-universal-transaction-with-funds/) (the same flow but user-initiated through the SDK).

## What this example contains

| File | Purpose |
|---|---|
| [`src/EthereumFundsBridge.sol`](src/EthereumFundsBridge.sol) | The Sepolia bridge contract. `bridgeToPush(recipient, amount, nonce)` calls Sepolia's UniversalGateway with a funds-only request whose payload encodes a single native transfer to `recipient`. |
| [`index.ts`](index.ts) | Auto-deploys the bridge, derives the bridge contract's UEA on Push (the address the gateway credits before forwarding), then dispatches one bridge transfer and polls the recipient's balance on Push. |
| [`foundry.toml`](foundry.toml) | Foundry config — Sepolia-only deploy. |

## Flow

```
       Sepolia                                Off-chain               Push Chain
       ───────                                ─────────               ──────────
EOA ──┐
      │ bridge.bridgeToPush(recipient, amount, nonce)
      │ msg.value = amount + fee
      ▼
EthereumFundsBridge.bridgeToPush
      │ gateway.sendUniversalTx{value: amount + fee}({
      │     recipient: 0,
      │     token: 0,           // native ETH
      │     amount: bridgeAmount,
      │     payload: encode(UniversalPayload{
      │         data: 0x2cc2842d || Multicall[(recipient, amount, "")]
      │     }),
      │     ...
      │ })
      ▼
   UniversalGateway ──emit UniversalTx event──▶ TSS validators ──submit──▶ bridge contract's UEA on Push
   0x05bD...281A                                                              │ (UEA receives `amount` PC)
                                                                              │
                                                                              │ (UEA executes the inner multicall:)
                                                                              │   recipient.call{value: amount}("")
                                                                              ▼
                                                                       recipient on Push
                                                                       (balance += amount PC)
```

The recipient sees a **direct native PC credit** — no contract logic, no events, just a balance bump.

> **Note on conversion:** the bridge sends `amount` wei worth of ETH from Sepolia, and the recipient on Push receives the same `amount` wei worth of PC. On the testnet that's effectively 1:1 wei↔wei. Mainnet rates may differ once mainnet is live.

## Prerequisites

- **Foundry** installed
- A Sepolia EOA with ≥ 0.05 ETH (covers deploy + at least one bridge with fee)
- Node ≥ 18

## Step 1 — Build

```bash
forge build
npm install
cp .env.sample .env
# Edit .env: paste your PRIVATE_KEY (Sepolia EOA)
# PUSH_RECIPIENT (optional) — defaults to the same EOA on Push.
```

## Step 2 — Run

```bash
npm start
```

Output on first run:

```
🔑 Sepolia EOA: 0x...
🎯 Push recipient: 0x... (defaults to your EOA on Push)
💰 Sepolia balance: 0.40 ETH

📦 Deploying EthereumFundsBridge on Sepolia...
   ✅ deployed at: 0x...

📍 Bridge UEA on Push: 0x...    ← the address that holds the bridged ETH on Push
                                    before forwarding to your recipient
📊 Bridge UEA nonce on Push: 0
📊 Recipient start balance:  18.0 PC
💸 Bridging:                  0.0001 ETH
💸 Fee budget:                0.005 ETH
💸 Total msg.value:           0.0051 ETH

🚀 Calling bridge.bridgeToPush(...)...
   📤 Sepolia tx: 0x...
✅ Sepolia leg settled.

📡 Waiting for the TSS network to relay onto Push...

✅ Recipient credited:
   start: 18.0 PC
   end:   18.0001 PC
   net:   +0.0001 PC
```

Subsequent runs reuse the deployed bridge.

## Wire format details

```solidity
// What the contract builds and passes to gateway.sendUniversalTx:
UniversalTxRequest req = {
    recipient:        address(0),                 // ← always 0; real recipient is inside payload
    token:            address(0),                 // ← 0 = native ETH bridging
    amount:           bridgeAmount,               // ← gateway treats this as the bridge amount
    payload: abi.encode(
        address(0),                               // to: 0 (UEA on Push)
        uint256(0),                               // value: 0 at the UEA level
        bytes(0x2cc2842d ||                        // UEA_MULTICALL marker
              abi.encode(Multicall[]{
                  (recipient, bridgeAmount, "")    // ← native transfer to recipient on Push
              })),
        uint256(1e7),                             // gasLimit
        uint256(1e10),                            // maxFeePerGas
        uint256(0),                               // maxPriorityFeePerGas
        ueaNonce,                                 // nonce on Push UEA
        uint256(9999999999),                      // deadline
        uint8(0)                                  // vType
    ),
    revertRecipient:  msg.sender,                 // refunds on revert
    signatureData:    "0x"                        // gateway authenticates via msg.sender
};
gateway.sendUniversalTx{value: bridgeAmount + fee}(req);
```

The TSS sees the gateway event, deploys the bridge contract's UEA on Push if it's not already, credits it `bridgeAmount`, and the UEA's first action is the inner multicall — a single native transfer to `recipient`.

## Common pitfalls

| Pitfall | Symptom | Fix |
|---|---|---|
| `msg.value <= bridgeAmount` (no fee included) | Contract reverts on `InsufficientValue` | Send `bridgeAmount + fee`. The `.env` defaults pad fee to 0.005 ETH. |
| Setting `recipient` on the gateway request to anything but `address(0)` | Gateway emits the event but TSS silently drops | Always use `address(0)` for `recipient` — real target is inside the encoded payload. |
| Skipping the `0x2cc2842d` multicall marker | UEA falls into the single-call path; reverts | Always prefix the encoded `Multicall[]` with `0x2cc2842d`. |
| Stale UEA nonce | Relay drops or replays incorrectly | Read the UEA's `nonce()` on Push before each bridge (see `getUEANonce` in [`index.ts`](index.ts)). For an undeployed UEA, nonce starts at 0 and increments per relayed tx. |
| Using `amount` for ERC-20 bridge | Native bridging won't trigger | This contract only does native ETH. For ERC-20, the gateway has a separate path with token approval — see SDK source for `executeFundsOnly`. |

## Key contract surface

```solidity
constructor(address _gateway);

/// Bridge `bridgeAmount` wei of native ETH from Sepolia to `pushRecipient`.
/// `msg.value` MUST equal `bridgeAmount + fee`.
function bridgeToPush(
    address pushRecipient,
    uint256 bridgeAmount,
    uint256 nonce
) external payable;

event Bridged(address indexed pushRecipient, uint256 bridgeAmount, uint256 fee);
```

## Network

- Sepolia (chain id `11155111`)
  - UniversalGateway: `0x05bD7a3D18324c1F7e216f7fBF2b15985aE5281A`
- Push Chain Donut Testnet (chain id `42101`)
  - RPC: `https://evm.donut.rpc.push.org/`
  - Explorer: `https://donut.push.network/`

## Related examples

- [`../contract-initiated-inbound-execution/`](../contract-initiated-inbound-execution/) — same gateway path but with non-empty payload (calldata against a Push contract instead of a value transfer)
- [`../send-universal-transaction-with-funds/`](../send-universal-transaction-with-funds/) — the user-initiated version of this flow through the SDK
