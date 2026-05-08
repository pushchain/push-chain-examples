# Batched Universal Transaction Example

Learn how to send a single universal transaction that batches multiple contract calls together. This is the pattern referenced as "Batch Transactions (Multicall)" in the [Send Universal Transaction docs](https://push.org/docs/chain/build/send-universal-transaction#send-batch-transactions-multicall).

> **Note:** This is for batching multiple calls into one universal transaction (single route). To compose multiple universal transactions across different routes / chains in one signature, see [`send-multichain-transactions`](../send-multichain-transactions/) instead.

- Push Chain Docs: `https://push.org/docs/chain`

## Quick Start

```bash
npm install

# Run the example
npx tsx index.ts
# or
npx ts-node index.ts
```

## What this example does

The script originates a transaction from Ethereum Sepolia using Viem, then executes a batch on Push Chain Testnet against a sample Counter contract.

- Generates a fresh Sepolia account using Viem
- Prompts you to fund that account (readline prompt)
- Initializes `PushChain` with a Universal Signer on TESTNET
- Encodes `increment()` via `PushChain.utils.helpers.encodeTxData`
- Builds an array of two calls and passes it as `data` to `sendTransaction`
- Executes both increments atomically as a batch on Push Chain

## Important

- When batching, `data` must be an array of `{ to, value, data }` calls.
- `tx.to` should be the zero address `0x0000000000000000000000000000000000000000` — the SDK warns otherwise and will require it in a future release.
- Batching is supported only **from external origin chains**. Push-native users cannot use batched mode for Push Chain calls — but they can use it on other chains via Route 2 / Route 3.

## Key snippet

```ts
// Encode the function call data for Counter.increment()
const incrementData = PushChain.utils.helpers.encodeTxData({
  abi: CounterABI,
  functionName: 'increment',
});

// Two calls executed atomically as a batch
const txResponse = await pushChainClient.universal.sendTransaction({
  to: '0x0000000000000000000000000000000000000000', // zero address signals batch mode
  data: [
    { to: COUNTER_ADDRESS, value: BigInt(0), data: incrementData },
    { to: COUNTER_ADDRESS, value: BigInt(0), data: incrementData },
  ],
});
```

## Flow overview

1. Create a Sepolia account (Viem) and convert it into a Universal Signer
2. Initialize `PushChain` with `PUSH_NETWORK.TESTNET`
3. Prompt user to fund the Sepolia account
4. Build a batch payload (array of calls) targeting Push Chain
5. Send the universal transaction; Push Chain executes the calls atomically

## Troubleshooting

- **Missing funds on Sepolia**: fund the generated account shown in the console prompt
- **Invalid batch shape**: ensure `data` is an array of `{ to, value, data }` items
- **Push-native origin error**: batched mode is unavailable for Push-native signers; use Sepolia or another external chain as the origin

## Dependencies

- `@pushchain/core` — Push Chain Core SDK
- `viem` — Wallet client and account utilities
