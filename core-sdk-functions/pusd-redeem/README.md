# Redeem PUSD

Burn **PUSD** for a reserve token (USDT.eth) — locally on Push **or** delivered cross-chain to your **Ethereum Sepolia** wallet in a single signature. PUSDManager holds `BURNER_ROLE` on PUSD and burns `msg.sender` directly, so **no PUSD approval is required** on either path.

- [PUSD docs](https://pusd.push.org/docs)

## 🚀 Quick Start

```bash
cp .env.sample .env       # set PUSH_PRIVATE_KEY and/or SEPOLIA_PRIVATE_KEY
npm install
npm start                 # interactive scenario chooser
```

## 📋 Scenarios

The script offers two flows. Pick at the prompt:

### 1) Local redeem on Push (Path B native EOA)

- Sign from a Push EOA (one signature, one tx).
- Burn 1 PUSD; PUSDManager pays out USDT.eth (Donut representation) to the same Push EOA.
- Best when you minted PUSD via [`pusd-mint-from-push-eoa`](../pusd-mint-from-push-eoa) and want the reserve back on the same Push address.

### 2) Cross-chain redeem to Ethereum Sepolia (Push EOA, two txs)

- Sign from the same Push EOA (two signatures, both on Push):
  - **Tx 1**: `PUSDManager.redeem(...)` on Push — recipient is the same Push EOA. USDT.eth (Donut representation) lands on the EOA.
  - **Tx 2**: bridge the USDT.eth from the EOA → user's Sepolia EOA via `funds`. Default Sepolia destination is the same `0x…` address (same private key produces the same EOA on every EVM chain).
- Net result: PUSD burned on Push, USDT delivered to the user's Sepolia wallet. **No Sepolia ETH needed** — gas is paid in PC.
- Why two txs and not a one-shot cascade? The SDK forbids `prepareTransaction` for Push-targeting hops when the signer is a native Push EOA — `prepareTransaction` is reserved for UEAs (external-chain origins). The redeem hop targets Push, so it must use `sendTransaction` directly. The bridge hop uses a second `sendTransaction` with `to: { chain: SEPOLIA }, funds`. (For a true single-signature cascade you'd sign from a Sepolia wallet — Path A — and pay Sepolia ETH for the cascade gas.)
- Best when you minted PUSD via [`pusd-mint-from-push-eoa`](../pusd-mint-from-push-eoa) (PUSD on the Push EOA) and want the reserve back on your origin chain.

## 🎯 Key Concepts

### `PUSDManager.redeem(pusdAmount, preferredAsset, allowBasket, recipient)` routing

| Route             | Condition                                       | Fee                    |
|-------------------|-------------------------------------------------|------------------------|
| Preferred asset   | preferredAsset `ENABLED` + sufficient liquidity | `baseFee + preferredFee` |
| Basket            | preferred unavailable, `allowBasket = true`     | `baseFee` only         |
| Emergency         | any token in `EMERGENCY_REDEEM` status          | forced proportional drain |

**Always pass `allowBasket = true` in production** — if the preferred token runs dry the call falls back to a proportional basket payout instead of reverting. Fees apply to *what you receive*, not to the PUSD burned.

### Why no approve

`PUSDManager` holds `BURNER_ROLE` on PUSD and burns `msg.sender` directly. ERC-20 approvals are unnecessary on either path. Adding one is a no-op cost.

### Cross-chain bridge amount (Scenario 2)

Because the bridge step runs in a separate tx, the script reads the EOA's actual USDT.eth balance change after `redeem` and bridges that exact amount. No conservative fee estimation needed — whatever the redeem returned is exactly what gets sent across.

### Two-tx shape (Scenario 2)

```ts
// Tx 1: burn PUSD on Push — recipient = the same Push EOA
const burnTx = await pushChainClient.universal.sendTransaction({
  to: PUSD_MANAGER,
  data: encodeRedeem(pusdAmount, USDT_DONUT, true, wallet.address),
});
await burnTx.wait();

// Read what just landed on the EOA
const justReceived = await reserve.balanceOf(wallet.address) - reserveBeforeEoa;

// Tx 2: bridge USDT.eth out to the same address on Sepolia
const bridgeTx = await pushChainClient.universal.sendTransaction({
  to: { address: wallet.address, chain: PushChain.CONSTANTS.CHAIN.ETHEREUM_SEPOLIA },
  data: '0x',
  funds: {
    amount: justReceived,
    token: PushChain.CONSTANTS.MOVEABLE.TOKEN.ETHEREUM_SEPOLIA.USDT,
  },
});
await bridgeTx.wait();
```

## 📦 Dependencies

- `@pushchain/core` — `"latest"`
- `@coral-xyz/anchor` — peer dep loaded by `@pushchain/core`
- `ethers` — wallet, provider, contract reads
- `dotenv` — load env vars

## 🔧 Setup Requirements

| Scenario | Account | Needs |
|---|---|---|
| 1 — Local redeem | Push EOA (`PUSH_PRIVATE_KEY`) | A small amount of PC for gas + ≥ 1 PUSD on this EOA |
| 2 — Cross-chain → Sepolia | Push EOA (`PUSH_PRIVATE_KEY`) | ≥ 5 PC (gas for both txs + outbound swap) + ≥ 1 PUSD on this EOA |

Both scenarios sign from the **same Push EOA**. PUSD must be on this EOA — the natural source is [`pusd-mint-from-push-eoa`](../pusd-mint-from-push-eoa) with the same `PUSH_PRIVATE_KEY`.

> Note: PUSD minted via [`pusd-mint-from-external-chain`](../pusd-mint-from-external-chain) lands on your **UEA**, which is a different address on Push than the Push EOA. To redeem that PUSD with this script, transfer it from the UEA to the Push EOA first, or sign from a Sepolia wallet (Path A) and switch to a `prepareTransaction` + `executeTransactions` cascade (which costs Sepolia ETH).

## 📊 Example Output (Scenario 2)

```
── Scenario 2: Cross-chain redeem → Ethereum Sepolia ──────────
🔑 Using PUSH_PRIVATE_KEY from environment.
📍 Push EOA (signer + holds PUSD): 0xabcd…
📍 Sepolia EOA (payout target):    0xabcd… (same key, same address)

📊 PC   balance: 7.5 PC
📊 PUSD balance: 1 PUSD

💰 PUSD on Push EOA BEFORE:        1 PUSD
💰 USDT.eth on Push EOA BEFORE:    0 USDT.eth
💰 USDT on Sepolia BEFORE:         0 USDT

🚀 Tx 1 of 2 — Redeeming 1 PUSD → USDT.eth on Push (basket fallback enabled)
   📤 redeem hash: 0x…
   ✅ redeem confirmed
   💰 USDT.eth received on EOA: 0.9985 USDT.eth (after baseFee + preferredFee)

🚀 Tx 2 of 2 — Bridging 0.9985 USDT.eth → Sepolia
   📤 bridge hash: 0x…
   ✅ bridge confirmed (Sepolia delivery follows once relayed)

⏳ Waiting for cross-chain delivery to Sepolia (poll every 5 s, up to ~60 s)…

💰 PUSD on Push EOA AFTER:         0 PUSD
💰 USDT.eth on Push EOA AFTER:     0 USDT.eth
💰 USDT on Sepolia AFTER:          0.9985 USDT

🎉 PUSD redeemed on Push and USDT delivered to your Sepolia wallet (two signatures from one Push EOA).
```

## 🔗 Related Examples

- **[pusd-mint-from-external-chain](../pusd-mint-from-external-chain)** — Path A external-chain mint (pairs with Scenario 2).
- **[pusd-mint-from-push-eoa](../pusd-mint-from-push-eoa)** — Path B native Push EOA mint (pairs with Scenario 1).
- **[pusd-read-state](../pusd-read-state)** — Inspect reserves, fees, supported tokens.
- **[send-multichain-transactions](../send-multichain-transactions)** — Generic cascade pattern this example builds on.

## 🎓 Learn More

- [PUSD overview](https://pusd.push.org/docs)
