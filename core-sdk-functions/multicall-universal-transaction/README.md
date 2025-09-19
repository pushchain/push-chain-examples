# Multicall Universal Transaction Example

Learn how to send a Universal Transaction that performs a Multicall on Push Chain by passing an array of calls to the `data` field of `sendTransaction`.

- Push Chain Docs: `https://push.org/docs/chain`

## 🚀 Quick Start

```bash
npm install

# Run the example (choose one)
npx tsx index.ts
# or
npx ts-node index.ts
```

## 🧠 What this example does

This example originates a transaction from Ethereum Sepolia using Viem, then executes a Multicall on Push Chain Testnet against a sample Counter contract.

- Generates a fresh Sepolia account using Viem
- Prompts you to fund that account (readline prompt)
- Initializes `PushChain` with a Universal Signer on TESTNET
- Encodes the `increment()` function via `PushChain.utils.helpers.encodeTxData`
- Builds an array of two calls and passes it as `data` to `sendTransaction`
- Executes both increments atomically as a Multicall on Push Chain

Important:
- When using Multicall, `data` must be an array of calls and `to` must be a 0x-prefixed address
- The example uses the same Counter ABI/address pattern from the core SDK tests
- You need Sepolia ETH on the generated account to originate the universal transaction

## 🔧 Key snippet

```ts
// Encode the function call data for Counter.increment()
const incrementData = PushChain.utils.helpers.encodeTxData({
  abi: CounterABI as unknown as any[],
  functionName: 'increment',
}) as `0x${string}`;

// Create an array of calls to be executed atomically on Push Chain
const calls = [
  { to: COUNTER_ADDRESS, value: BigInt(0), data: incrementData },
  { to: COUNTER_ADDRESS, value: BigInt(0), data: incrementData },
];

// Pass the array to the `data` field to trigger Multicall
const txResponse = await pushChainClient.universal.sendTransaction({
  to: COUNTER_ADDRESS,
  value: BigInt(0),
  data: calls,
});
```

## 📝 Flow overview

1. Create a Sepolia account (Viem) and convert it into a Universal Signer
2. Initialize `PushChain` with `PUSH_NETWORK.TESTNET`
3. Prompt user to fund the Sepolia account
4. Build a Multicall payload (array of calls) targeting Push Chain
5. Send the universal transaction; Push Chain executes the calls atomically

## ❗ Troubleshooting

- Missing funds on Sepolia: fund the generated account address shown in the console prompt
- Invalid multicall shape: ensure `data` is an array of `{ to, value, data }` items
- Invalid `to` value: must be a 0x-prefixed address when using multicall

## 📦 Dependencies

- `@pushchain/core`: Push Chain Core SDK
- `viem`: Wallet client and account utilities


