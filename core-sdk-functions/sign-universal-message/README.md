# Sign Universal Message

A runnable, interactive companion for the [Sign Universal Message docs](https://push.org/docs/chain/build/sign-universal-message). Sign arbitrary data with your universal signer:

| API | Use | Chains |
|---|---|---|
| `pushChainClient.universal.signMessage(bytes)` | Plain message bytes | EVM + Solana |
| `pushChainClient.universal.signTypedData({ domain, types, primaryType, message })` | EIP-712 structured data | EVM only |

## Quick Start

```bash
npm install
npm start
```

No funding required — signing is purely off-chain. Pick a scenario at the prompt:

| # | Scenario | Notes |
|---|----------|-------|
| 1 | signMessage — sign plain bytes | Works on any signer |
| 2 | signTypedData — sign EIP-712 typed data | EVM signers only |
| 3 | Run both | |

The script uses a throwaway ethers.js signer (so `signTypedData` works). Swap it for a Solana keypair via `PushChain.utils.signer.toUniversalFromKeypair(...)` to demo the SVM `signMessage` path.

## Key APIs used

```typescript
import { PushChain } from '@pushchain/core';

// 1) Plain message
const message = new TextEncoder().encode('Hello, Push Chain!');
const signature = await pushChainClient.universal.signMessage(message);
// → '0xf10cabddd923cf05578dd253c0642009e7651286171a17b3d40f270f42e97aff…'

// 2) EIP-712 typed data (EVM only)
const typedSignature = await pushChainClient.universal.signTypedData({
  domain: {
    name: 'Push Chain',
    version: '1',
    chainId: 42101,
    verifyingContract: '0x1234567890123456789012345678901234567890',
  },
  types: {
    Person: [
      { name: 'name', type: 'string' },
      { name: 'wallet', type: 'address' },
    ],
  },
  primaryType: 'Person',
  message: { name: 'Alice', wallet: '0x9821655B609186a9296261638FA74e1DFBA4AC88' },
});
```

## Network

- Push Chain Donut Testnet (chain id `42101`)
- Push RPC: `https://evm.donut.rpc.push.org/`
- Network constant in code: `PushChain.CONSTANTS.PUSH_NETWORK.TESTNET`

## Dependencies

- `@pushchain/core` — `latest`
- `ethers` — for the demo signer
- `@coral-xyz/anchor` — peer dep required by the SDK for SVM IDL handling

## Related examples

- [`../send-universal-transaction/`](../send-universal-transaction/) — submitting transactions with the same signer
- [`../track-universal-transaction/`](../track-universal-transaction/) — re-check tx status by hash
- [`../utility-functions/`](../utility-functions/) — full SDK utility surface, including `signer.toUniversal` and `signer.toUniversalFromKeypair`
