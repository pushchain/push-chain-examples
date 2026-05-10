# Send Universal Transaction - Pay Gas with Any Token

Learn how to pay for gas fees using any supported token (like USDC) instead of native ETH when sending universal transactions on Push Chain.

- [Push Chain Documentation](https://push.org/docs/chain/build/send-universal-transaction)

## 🚀 Quick Start

```bash
npm install
npm start
```

## 📋 Overview

This example demonstrates Push Chain's **flexible gas payment system**, allowing you to pay transaction gas fees with **any supported token** (e.g., USDC) instead of requiring native ETH. This is particularly useful for users who hold stablecoins but don't want to acquire native tokens for gas.

### What You'll Learn

- How to use the `payGasWith` parameter
- Paying gas fees with USDC instead of ETH
- Combining token transfers (USDT) with custom gas payment
- Reading contract state and token balances before/after execution

## 🔄 Transaction Flow

```
Ethereum Sepolia (Origin)
     ↓
  Transaction Parameters:
  - Transfer: 1 USDT (via funds)
  - Gas Payment: USDC (via payGasWith)
  - Contract Call: increment()
     ↓
Push Chain (Execution)
     ↓
  ✅ Counter incremented
  ✅ USDT transferred
  ✅ Gas paid with USDC
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

// 3. Encode contract call data
const data = PushChain.utils.helpers.encodeTxData({
  abi: COUNTER_ABI,
  functionName: 'increment',
}) as `0x${string}`;

// 4. Send transaction with custom gas payment
const txResponse = await pushChainClient.universal.sendTransaction({
  to: COUNTER_ADDRESS,
  value: BigInt(0),
  data,
  funds: {
    amount: PushChain.utils.helpers.parseUnits('1', 6), // 1 USDT
    token: pushChainClient.moveable.token.USDT,
  },
  payGasWith: {
    token: pushChainClient.payable.token.USDC, // Pay gas with USDC instead of ETH
  },
});

console.log('Transaction Hash:', txResponse.hash);
await txResponse.wait();
console.log('Transaction confirmed!');
```

## 🎯 Key Concepts

### payGasWith Parameter

The `payGasWith` parameter allows you to specify which token to use for gas payment:

```typescript
payGasWith: {
  token: Token  // Token reference from pushChainClient.payable.token
}
```

### Supported Gas Payment Tokens

Access via `pushChainClient.payable.token`:
- **USDC** - USD Coin (6 decimals)
- **USDT** - Tether (6 decimals)
- **ETH** - Ethereum native token (18 decimals)
- **SOL** - Solana native token (9 decimals)

### Complete Transaction Parameters

```typescript
{
  to: string,              // Contract address to call
  value: bigint,           // Native token value
  data: `0x${string}`,     // Encoded function call
  funds: {                 // Token transfer (moveable system)
    amount: bigint,
    token: Token
  },
  payGasWith: {            // Custom gas payment token
    token: Token
  }
}
```

## 📦 Dependencies

- `@pushchain/core`: 4.0.12-alpha.0 - Push Chain Core SDK
- `viem`: ^2.31.3 - For wallet and client management
- `dotenv`: ^16.0.0 - For environment variables

## 🔧 Setup Requirements

### 1. Fund Your Wallet

You'll need on **Ethereum Sepolia**:
- **ETH** - For origin chain gas fees
- **USDT** - For the funds transfer (1 USDT in this example)
- **USDC** - For paying Push Chain gas fees

### 2. Mint Tokens (if needed)

**USDT on Sepolia** (real ERC-20 on Sepolia — call `mint`):
```
https://sepolia.etherscan.io/address/0x7169D38820dfd117C3FA1f22a697dBA58d90BA06#writeContract
```

**USDC on Sepolia** (real ERC-20 on Sepolia — call `mint`):
```
https://sepolia.etherscan.io/address/0x97F477B7f970D47a87B42869ceeace218106152a#writeContract
```

> Don't confuse these Sepolia addresses with the matching Donut representations — the relay bridges from Sepolia to Donut, where the actual `funds`-side balance lives.

## 📊 Example Output

```
🌟 Viem Example - Send Universal Transaction with Funds

1. Create Universal Signer (Sepolia)
🔑 Got account: 0x1234...
🔑 Got universal signer

2. Initialize Push Chain Client
🚀 Got push chain client

3. Fund the Sepolia account to cover the origin transaction
:::prompt:::Please send ETH to 0x1234... on Ethereum Sepolia and Press Enter to continue.
:::prompt:::Please send 1 USDT to 0x1234... on Ethereum Sepolia and Press Enter to continue.
:::prompt:::Please send USDC to 0x1234... on Ethereum Sepolia and Press Enter to continue.

4. Prepare call data for Counter.increment on Push Chain
📦 Encoded increment() call

5. Send universal transaction
📤 Transaction hash: 0xabc...
⏳ Waiting for confirmation...
✅ Transaction confirmed!

💰 Balance before: 0
💰 Balance after: 1000000

🎉 Congrats! You just sent a universal transaction with funds!
1️⃣  You sent Sepolia-origin funds (USDT) to the Universal Gateway
2️⃣  Validators settled and executed your function call on Push Chain
📊 Counter on Push Chain → before: 42 | after: 43
```

## 💡 Benefits of Custom Gas Payment

### 1. **User Convenience**
- Users don't need to hold native tokens (ETH) for gas
- Can pay with stablecoins they already hold

### 2. **Simplified Onboarding**
- New users can transact immediately with just stablecoins
- No need to acquire multiple token types

### 3. **Cost Predictability**
- Stablecoin gas payments provide more predictable costs
- Avoid native token price volatility

### 4. **Cross-Chain Flexibility**
- Same gas payment mechanism works across all supported chains
- Unified experience regardless of origin chain

## 🔍 How It Works

1. **Origin Chain**: Transaction is signed on Ethereum Sepolia
2. **Token Preparation**: 
   - USDT is prepared for transfer via moveable system
   - USDC is prepared for gas payment via payable system
3. **Universal Gateway**: Validators receive the transaction
4. **Execution**: 
   - Contract call executes on Push Chain
   - USDT is transferred to destination
   - Gas is deducted from USDC balance
5. **Settlement**: Transaction is confirmed on Push Chain

## 💡 Notes

- **Origin chain**: Ethereum Sepolia (where transaction is signed)
- **Execution chain**: Push Chain Testnet (where contract is called)
- **Gas payment**: USDC (instead of default ETH)
- **Token transfer**: USDT (via moveable system)
- **Contract**: Simple counter that increments on each call
- **Decimals**: Both USDT and USDC use 6 decimals

## 🔗 Related Examples

- **[send-universal-transaction](../send-universal-transaction)** - Basic value transfers
- **[send-universal-transaction-with-funds](../send-universal-transaction-with-funds)** - Token transfers (USDT)
- **[send-universal-transaction-all-cases](../send-universal-transaction-all-cases)** - Comprehensive test suite for all 22 transaction routes

## 🎓 Learn More

- [Push Chain Universal Transactions](https://push.org/docs/chain/build/send-universal-transaction)
- [Moveable Token System](https://push.org/docs/chain/concepts/moveable-tokens)
- [Payable Token System](https://push.org/docs/chain/concepts/payable-tokens)
- [Universal Executor Accounts](https://push.org/docs/chain/concepts/universal-executor-account)
