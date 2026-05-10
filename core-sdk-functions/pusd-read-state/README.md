# Read PUSD Protocol State

A pure-read inspection of the PUSD protocol on Push Chain Donut Testnet — no signer, no PC, no env vars. Useful for dashboards, scripts, monitoring, and verifying that PUSD is solvent before integrating it into your dApp.

- [PUSD docs](https://pusd.push.org/docs)

## 🚀 Quick Start

```bash
npm install
npm start
```

## 📋 Overview

The script enumerates everything an integrator typically needs to know about PUSD's current state:

- **Supplies** — `PUSD.totalSupply`, `PUSD+.totalSupply`.
- **Fees** — `baseFee`, `preferredFeeMin`, `preferredFeeMax` (all in bps).
- **PUSD+ vault** — `nav()` (1e18 fixed-point), `totalAssets`, queue state.
- **Reserve inventory** — for each supported token: status (`ENABLED` / `REDEEM_ONLY` / `EMERGENCY_REDEEM` / `REMOVED`), origin chain, surplus haircut, manager-held balance, accrued surplus.
- **Solvency invariant (I-01)** — verifies `Σ reserves ≥ PUSD totalSupply`.

All accounting on Donut is at **6 decimals** for PUSD, PUSD+, and every reserve token.

### What You'll Learn

- How to call PUSD's read-only contract surface from off-chain code.
- How to enumerate supported reserve tokens via `getSupportedTokensCount` + `getSupportedTokenAt(i)`.
- How `getTokenInfo` returns a packed tuple per token.
- How to verify the solvency invariant.

## 💻 Code Highlights

```ts
const manager = new ethers.Contract(PUSD_MANAGER, MANAGER_READ_ABI, provider);

// Walk each supported token
const count = await manager.getSupportedTokensCount();
for (let i = 0n; i < count; i++) {
  const tokenAddr = await manager.getSupportedTokenAt(i);
  const info = await manager.getTokenInfo(tokenAddr);
  // info = [exists, status, decimals, surplusHaircutBps, name, chainNamespace]

  const reserveBal = await new ethers.Contract(tokenAddr, ERC20_BALANCE_ABI, provider)
    .balanceOf(PUSD_MANAGER);
  const surplus = await manager.getAccruedSurplus(tokenAddr);
  // ...
}
```

## 🎯 Key Concepts

### TokenStatus enum

```
0 REMOVED            — not allowed
1 ENABLED            — mint + redeem
2 REDEEM_ONLY        — no new mints; redeems route here
3 EMERGENCY_REDEEM   — forced proportional drain on redeem
```

### Solvency invariant I-01

```
Σ reserve_token.balanceOf(PUSDManager) ≥ PUSD.totalSupply
```

If this ever holds with strict equality minus accrued surplus, the protocol is exactly solvent. Slack = surplus + haircut buffer + accrued protocol fees.

### `nav()` is 1e18 fixed-point

PUSD+ accounting is 6 decimals, but the NAV multiplier is 1e18 to keep precision when integrating with vault math. `previewMintPlus(pusdIn)` and `previewBurnPlus(plusIn)` already return 6-decimal results — use those for quoting.

## 📦 Dependencies

- `ethers` — read-only provider, contract reads. No SDK initialization needed.

## 📊 Example Output

```
🌟 PUSD Protocol State — Donut Testnet (chain 42101)

RPC:      https://evm.donut.rpc.push.org/
PUSD:     0x488d080e16386379561a47A4955D22001d8A9D89
Manager:  0x7A24Eea43a1095e9Dc652AB9Cba156a93Ed5Ed46
Vault:    0xb55a5B36d82D3B7f18Afe42F390De565080A49a1

1️⃣  Protocol-level supplies + fees
   PUSD totalSupply        : 12345.6789 PUSD
   baseFee                 : 5 bps  (0.05%)
   preferredFeeMin         : 0 bps
   preferredFeeMax         : 200 bps  (≤ 200)

2️⃣  PUSD+ vault state
   PUSD+ totalSupply       : 4321 PUSD+
   NAV (1e18 fixed-point)  : 1010000000000000000
   totalAssets             : 4364.21 PUSD-equiv

3️⃣  Supported reserve tokens (enumerated on-chain)
   count: 9

   symbol  status           chain             reserve         surplus       haircut  address
   ─────────────────────────────────────────────────────────────────────────────────────────
   USDT    ENABLED          Ethereum_Sepolia  10000           0             0 bps    0xCA0C5E…
   USDC    ENABLED          Ethereum_Sepolia  ...
   ...

4️⃣  Solvency invariant (I-01): totalReserves ≥ totalSupply
   totalReserves  : 13210
   PUSD supply    : 12345.6789
   accrued surplus: 0
   ✅ Invariant holds (slack: 864.3211)
```

## 🔗 Related Examples

- **[pusd-mint-from-external-chain](../pusd-mint-from-external-chain)** — mint PUSD by depositing USDT from Sepolia.
- **[pusd-mint-from-push-eoa](../pusd-mint-from-push-eoa)** — mint from a native Push EOA.
- **[pusd-redeem](../pusd-redeem)** — burn PUSD for a reserve token.
- **[reading-push-chain-state](../reading-push-chain-state)** — generic Push Chain state reads (blocks, txs, balances).

## 🎓 Learn More

- [PUSD overview](https://pusd.push.org/docs)
- [Push Chain reading state](https://push.org/docs/chain/build/reading-blockchain-state)
