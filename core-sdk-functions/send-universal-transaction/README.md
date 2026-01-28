# Send Universal Transaction Examples

Learn how to send transactions using Push Chain's Universal Transaction system across multiple chains and clients.

- [Push Chain Documentation](https://push.org/docs/chain)

## 🚀 Quick Start

```bash
npm install
npm start
```

## 🔄 Transaction Examples

This example demonstrates sending universal transactions using three different clients:

### ⚡ EVM Chain with Ethers v6
```javascript
// Create random wallet
const wallet = ethers.Wallet.createRandom();
const provider = new ethers.JsonRpcProvider('https://evm.donut.rpc.push.org/');
const signer = wallet.connect(provider);

// Create universal signer
const universalSigner = await PushChain.utils.signer.toUniversal(signer);

// Send transaction
const txResponse = await pushChainClient.universal.sendTransaction({
  to: '0x0000000000000000000000000000000000042101',
  value: ethers.parseEther('0.001'),
});
```

### 🌟 EVM Chain with Viem
```javascript
// Create random account
const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);

// Create universal signer
const client = createWalletClient({
  account,
  chain: pushTestnet,
  transport: http(),
});
const universalSigner = await PushChain.utils.signer.toUniversal(client);

// Send transaction
const txResponse = await pushChainClient.universal.sendTransaction({
  to: '0x0000000000000000000000000000000000042101',
  value: BigInt(1000000000000000), // 0.001 $PC
});
```

### 🌞 Solana Chain
```javascript
// Create random keypair
const keypair = Keypair.generate();

// Create universal signer
const universalSigner = await PushChain.utils.signer.toUniversalFromKeypair(keypair, {
  chain: PushChain.CONSTANTS.CHAIN.SOLANA_DEVNET,
  library: PushChain.CONSTANTS.LIBRARY.SOLANA_WEB3JS,
});

// Send transaction
const txResponse = await pushChainClient.universal.sendTransaction({
  to: '0x0000000000000000000000000000000000042101',
  value: BigInt(1000000000000), // 0.001 $PC
});
```

## 📦 Dependencies

- `@pushchain/core`: ^0.1.24 - Push Chain Core SDK
- `ethers`: ^6.14.4 - For ethers.js implementation
- `viem`: ^2.31.3 - For viem implementation
- `@solana/web3.js`: ^1.91.1 - For Solana implementation
