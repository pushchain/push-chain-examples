# Send Universal Transaction with Funds

Learn how to send universal transactions with token transfers (USDT) using Push Chain's moveable token system.

- [Push Chain Documentation](https://push.org/docs/chain/build/send-universal-transaction#send-transaction-with-funds)

## 🚀 Quick Start

```bash
npm install
npm start
```

## 📋 Overview

This example demonstrates how to send a universal transaction that includes **token transfers (USDT)** along with a contract call. The transaction originates from **Ethereum Sepolia** and executes on **Push Chain**, using USDT to fund the contract execution.

### What You'll Learn

- How to transfer tokens (USDT) with a universal transaction
- Using the `funds` parameter with Push Chain's moveable token system
- Executing contract calls with token transfers
- Reading contract state before and after execution

## 🔄 Transaction Flow

```
Ethereum Sepolia (Origin) → Push Chain (Execution)
     ↓
  USDT Transfer + Contract Call (increment counter)
     ↓
  Counter State Updated on Push Chain
```

## 💻 Code Example

```typescript
// 1. Create wallet and universal signer
const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);

const walletClient = createWalletClient({
  account,
  transport: http(SEPOLIA_RPC_URL),
});

const universalSigner = await PushChain.utils.signer.toUniversal(walletClient);

// 2. Initialize Push Chain client
const pushChainClient = await PushChain.initialize(universalSigner, {
  network: PushChain.CONSTANTS.PUSH_NETWORK.TESTNET,
});

// 3. Get USDT token reference
const usdtToken = pushChainClient.moveable.token.USDT;
console.log('USDT Address:', usdtToken.address);

// 4. Encode contract call data
const data = PushChain.utils.helpers.encodeTxData({
  abi: COUNTER_ABI,
  functionName: 'increment',
}) as `0x${string}`;

// 5. Send transaction with funds
const txResponse = await pushChainClient.universal.sendTransaction({
  to: COUNTER_ADDRESS,
  data: data,
  funds: {
    amount: PushChain.utils.helpers.parseUnits('0.01', 6), // 0.01 USDT (6 decimals)
    token: usdtToken,
  },
});

console.log('Transaction Hash:', txResponse.hash);
console.log('Explorer:', pushChainClient.explorer.getTransactionUrl(txResponse.hash));

// 6. Wait for confirmation
await txResponse.wait();
console.log('Transaction confirmed!');
```

## 🎯 Key Concepts

### Funds Parameter

The `funds` parameter allows you to transfer tokens alongside your transaction:

```typescript
funds: {
  amount: bigint,  // Amount in token's smallest unit
  token: Token     // Token reference from pushChainClient.moveable.token
}
```

### Supported Tokens

Push Chain's moveable token system supports:
- **USDT** - Tether (6 decimals)
- **ETH** - Ethereum native token (18 decimals)
- **SOL** - Solana native token (9 decimals)

Access via: `pushChainClient.moveable.token.USDT`

### Transaction Parameters

```typescript
{
  to: string,              // Contract address to call
  data: `0x${string}`,     // Encoded function call
  funds: {                 // Token transfer
    amount: bigint,
    token: Token
  },
  value?: bigint,          // Native token value (optional)
}
```

## 📦 Dependencies

- `@pushchain/core`: 4.0.12-alpha.0 - Push Chain Core SDK
- `viem`: ^2.31.3 - For wallet and client management

## 🔧 Setup Requirements

### 1. Fund Your Wallet

You'll need:
- **Sepolia ETH** for gas on origin chain
- **USDT on Sepolia** for the funds transfer

### 2. Mint USDT (if needed)

Mint test USDT on **Ethereum Sepolia** (the real ERC-20 the user holds before bridging):
```
https://sepolia.etherscan.io/address/0x7169D38820dfd117C3FA1f22a697dBA58d90BA06#writeContract
```

Call the `mint` function to get test USDT.

> Don't confuse this Sepolia address with `0xCA0C5E6F002A389E1580F0DB7cd06e4549B5F9d3` — that one is the **Donut representation** of Sepolia USDT (only exists on Push Chain Donut Testnet).

## 📊 Example Output

```
🌟 Viem Example - Send Universal Transaction with Funds

1. Create Universal Signer (Sepolia)
🔑 Got account: 0x1234...
🔑 Got universal signer

2. Initialize Push Chain Client
✅ Push Chain client initialized

3. Get USDT Token
💵 USDT Address: 0xCA0C5E6F002A389E1580F0DB7cd06e4549B5F9d3

4. Read Counter Before
📊 Counter before: 42

5. Encode Transaction Data
📦 Encoded increment() call

6. Send Transaction with Funds
⏳ Sending transaction...
✅ Transaction sent!
   Hash: 0xabc...
   Explorer: https://explorer.push.org/tx/0xabc...

7. Wait for Confirmation
⏳ Waiting for confirmation...
✅ Transaction confirmed!

8. Read Counter After
📊 Counter after: 43
✅ Counter incremented successfully!
```

## 💡 Notes

- **Origin chain**: Ethereum Sepolia (where transaction is signed)
- **Execution chain**: Push Chain Testnet (where contract is called)
- **Token transfer**: USDT moves via Push Chain's moveable token system
- **Contract**: Simple counter that increments on each call
- **Decimals**: USDT uses 6 decimals (1 USDT = 1,000,000 units)

## 🔗 Related Examples

- **[send-universal-transaction](../send-universal-transaction)** - Basic value transfers
- **[send-universal-transaction-all-cases](../send-universal-transaction-all-cases)** - Comprehensive test suite for all 22 transaction routes

## 🎓 Learn More

- [Push Chain Universal Transactions](https://push.org/docs/chain/build/send-universal-transaction)
- [Moveable Token System](https://push.org/docs/chain/concepts/moveable-tokens)
- [Universal Executor Accounts](https://push.org/docs/chain/concepts/universal-executor-account)
