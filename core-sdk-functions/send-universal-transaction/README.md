# Send Universal Transaction

Learn how to send basic universal transactions using Push Chain's Universal Transaction system across multiple chains and wallet libraries.

- [Push Chain Documentation](https://push.org/docs/chain/build/send-universal-transaction)

## 🚀 Quick Start

```bash
npm install
npm start
```

## 📋 Overview

This example demonstrates sending simple **value transfer** transactions using Push Chain's Universal Transaction system with three different wallet implementations:

1. **Ethers v6** - EVM chains (Ethereum)
2. **Viem** - EVM chains (Ethereum) 
3. **Solana Web3.js** - Solana chain

Each example shows how to:
- Create a wallet/keypair
- Convert to a universal signer
- Initialize Push Chain client
- Send a value transfer transaction
- View transaction on Donut explorer

## 🔄 Transaction Examples

### ⚡ Ethers v6 Example

```typescript
// Create wallet and provider
const wallet = ethers.Wallet.createRandom();
const provider = new ethers.JsonRpcProvider('https://evm.donut.rpc.push.org/');
const signer = wallet.connect(provider);

// Convert to universal signer
const universalSigner = await PushChain.utils.signer.toUniversal(signer);

// Initialize Push Chain client
const pushChainClient = await PushChain.initialize(universalSigner, {
  network: PushChain.CONSTANTS.PUSH_NETWORK.TESTNET,
});

// Send transaction
const txResponse = await pushChainClient.universal.sendTransaction({
  to: '0x0000000000000000000000000000000000042101',
  value: ethers.parseEther('0.001'),
});

console.log('Transaction Hash:', txResponse.hash);
console.log('Explorer:', pushChainClient.explorer.getTransactionUrl(txResponse.hash));
```

### 🌟 Viem Example

```typescript
// Create account
const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);

// Create wallet client
const client = createWalletClient({
  account,
  chain: pushTestnet,
  transport: http(),
});

// Convert to universal signer
const universalSigner = await PushChain.utils.signer.toUniversal(client);

// Initialize Push Chain client
const pushChainClient = await PushChain.initialize(universalSigner, {
  network: PushChain.CONSTANTS.PUSH_NETWORK.TESTNET,
});

// Send transaction
const txResponse = await pushChainClient.universal.sendTransaction({
  to: '0x0000000000000000000000000000000000042101',
  value: BigInt(1000000000000000), // 0.001 $PC
});

console.log('Transaction Hash:', txResponse.hash);
```

### 🌞 Solana Example

```typescript
// Create keypair
const keypair = Keypair.generate();

// Convert to universal signer
const universalSigner = await PushChain.utils.signer.toUniversalFromKeypair(keypair, {
  chain: PushChain.CONSTANTS.CHAIN.SOLANA_DEVNET,
  library: PushChain.CONSTANTS.LIBRARY.SOLANA_WEB3JS,
});

// Initialize Push Chain client
const pushChainClient = await PushChain.initialize(universalSigner, {
  network: PushChain.CONSTANTS.PUSH_NETWORK.TESTNET,
});

// Send transaction
const txResponse = await pushChainClient.universal.sendTransaction({
  to: '0x0000000000000000000000000000000000042101',
  value: BigInt(1000000000000), // 0.001 $PC (9 decimals for SOL)
});

console.log('Transaction Hash:', txResponse.hash);
```

## 🎯 Key Concepts

### Universal Signer
The universal signer is an abstraction that allows Push Chain to work with any wallet library:
- **Ethers**: `PushChain.utils.signer.toUniversal(signer)`
- **Viem**: `PushChain.utils.signer.toUniversal(client)`
- **Solana**: `PushChain.utils.signer.toUniversalFromKeypair(keypair, config)`

### Transaction Parameters
```typescript
{
  to: string,           // Recipient address (hex format)
  value?: bigint,       // Amount to send in wei/lamports
  data?: `0x${string}`, // Contract call data (optional)
  funds?: {             // Token transfers (optional)
    amount: bigint,
    token: Token
  },
  nativeFunds?: bigint  // Native token transfers via moveable system (optional)
}
```

## 📦 Dependencies

- `@pushchain/core`: 4.0.12-alpha.0 - Push Chain Core SDK
- `ethers`: ^6.14.4 - For Ethers v6 implementation
- `viem`: ^2.31.3 - For Viem implementation
- `@solana/web3.js`: ^1.91.1 - For Solana implementation

## 💡 Notes

- All examples send **0.001 tokens** to a test address
- Transactions are executed on **Push Chain Testnet (Donut)**
- Each wallet/keypair is randomly generated for demonstration
- Transaction hashes can be viewed on the **Donut Explorer**
- **Ethers/Viem** use 18 decimals (wei), **Solana** uses 9 decimals (lamports)

## 🔗 Related Examples

- **[send-universal-transaction-with-funds](../send-universal-transaction-with-funds)** - Token transfers (USDT)
- **[send-universal-transaction-all-cases](../send-universal-transaction-all-cases)** - Comprehensive test suite for all 22 transaction routes
