# Derive Universal Executor Account Tutorial

A comprehensive tutorial demonstrating how to derive Universal Executor Accounts (UEA) from any wallet address on any supported blockchain using PushChain's deterministic account mapping system.

👉 **[Live Playground](https://push.org/docs/chain/tutorials/power-features/tutorial-derive-universal-executor-account/#live-playground)**: Try deriving UEAs from any wallet!

## 🌟 Overview

This tutorial showcases PushChain's Universal Executor Account (UEA) derivation system, which enables any wallet from Ethereum, Solana, or other supported chains to deterministically map to a single executor account on Push Chain. The system demonstrates:

- **Universal Account Mapping**: Derive UEAs from any blockchain wallet
- **Deterministic Derivation**: Same origin wallet always maps to the same UEA
- **No New Keys**: Users keep their existing wallet identity
- **Smart Contract Integration**: Derive UEAs directly in Solidity contracts
- **Multi-Chain Support**: Works with Ethereum, Solana, Base, Arbitrum, BNB Chain, and more

## 🎯 What You'll Learn

- How Universal Executor Accounts (UEA) work on PushChain
- Deriving UEAs from connected wallets using `@pushchain/ui-kit`
- Manual UEA derivation from any chain and address
- Using the `IUEAFactory` contract for on-chain UEA derivation
- Building user-friendly UEA derivation interfaces
- Understanding the relationship between origin wallets and executor accounts

## 🚀 Quick Start

### Frontend Application

```bash
# Navigate to app directory
cd app

# Install dependencies
npm install

# Start development server
npm run dev
```

### Try It Out!

1. **Connect Your Wallet**: Click the Universal Account Button to connect
2. **View Your UEA**: See your origin wallet and derived UEA address
3. **Manual Derivation**: Enter any wallet address and chain to derive its UEA
4. **Smart Contract Example**: Learn how to derive UEAs in Solidity

## 📁 Project Structure

```
derive-universal-executor-account/
├── app/                    # React frontend application
│   ├── src/
│   │   ├── App.tsx         # Main app with UEA derivation UI
│   │   ├── App.css         # Styled components
│   │   ├── main.tsx        # Entry point with PushChain providers
│   │   └── index.css       # Global styles
│   ├── package.json        # Frontend dependencies
│   └── README.md           # Frontend-specific documentation
└── README.md               # This file
```

## 🎨 Key Features

### Frontend Features
- **Wallet Integration**: Seamless connection with Push Universal Account Button
- **Automatic UEA Display**: Shows your UEA when wallet is connected
- **Manual Derivation Tool**: Derive UEAs from any wallet address
- **Multi-Chain Support**: Select from different supported blockchains (EVM + non-EVM)
- **Smart Contract Examples**: Solidity code snippets for on-chain derivation
- **Modern UI**: Clean, responsive design with gradient dividers

### Supported Chains
- Push Chain (Testnet)
- Ethereum Sepolia
- Solana Devnet
- Base Sepolia
- Arbitrum Sepolia
- BNB Testnet

For an exhaustive list of supported chains, see the [Get Supported Chains](https://push.org/docs/chain/build/utility-functions/#get-supported-chains) utility function.

## 🔧 How It Works

### Client-Side Derivation

```typescript
// Convert origin address to Universal Account
const account = PushChain.utils.account.toUniversal(
  walletAddress,
  { chain: chainId }
);

// Derive the Universal Executor Account (UEA).
// Note: convertOriginToExecutor() is deprecated in favor of deriveExecutorAccount().
const executorAddress = await PushChain.utils.account.deriveExecutorAccount(account);
```

### Smart Contract Derivation

```solidity
import "push-chain-core-contracts/src/Interfaces/IUEAFactory.sol";

IUEAFactory constant FACTORY = 
    IUEAFactory(0x00000000000000000000000000000000000000eA);

// Get UEA for any origin wallet
function getUEA(UniversalAccountId memory account) 
    public view returns (address uea, bool isDeployed) {
    return FACTORY.getUEAForOrigin(account);
}

// Get origin wallet from UEA
function getOrigin(address uea) 
    public view returns (UniversalAccountId memory, bool) {
    return FACTORY.getOriginForUEA(uea);
}
```

### UEAFactory Contract

**Address**: `0x00000000000000000000000000000000000000eA`

**Key Methods**:
- `getUEAForOrigin(UniversalAccountId)` - Get UEA address for any wallet
- `getOriginForUEA(address)` - Get origin wallet from UEA

## 💡 Understanding UEAs

### What is a Universal Executor Account?

A Universal Executor Account (UEA) is a deterministic address on Push Chain that is derived from any external wallet address on any supported blockchain. Key properties:

1. **Deterministic**: Same origin wallet always derives the same UEA
2. **Universal**: Works across all supported blockchains
3. **No New Keys**: Users don't need to manage new private keys
4. **Execution Surface**: The UEA signs, pays fees, and executes transactions on Push Chain
5. **Identity Preservation**: The origin wallet remains the user's identity

### Why UEAs Matter

- **Seamless Cross-Chain**: Users can interact with Push Chain using their existing wallets
- **No Bridging**: No need to bridge assets or create new accounts
- **Unified Identity**: One UEA per origin wallet across all interactions
- **Developer Friendly**: Easy to integrate and reason about

## 🚨 Troubleshooting

### Common Issues

1. **"Failed to derive UEA"**:
   - Ensure the wallet address format is correct for the selected chain
   - Check that the chain is supported
   - Verify network connection

2. **"Wallet connection issues"**:
   - Make sure you have a compatible wallet installed
   - Try refreshing and reconnecting
   - Check that your wallet supports the selected chain

3. **"UEA not displaying"**:
   - Ensure wallet is fully connected
   - Check browser console for errors
   - Refresh the page

## 📚 Prerequisites

- **For Frontend**: Node.js (v16+), React/TypeScript familiarity
- **For Users**: Compatible wallet (MetaMask, Phantom, etc.)
- **For Smart Contracts**: Basic Solidity knowledge

## 🔗 Resources

- [Tutorial Documentation](https://push.org/docs/chain/tutorials/power-features/tutorial-derive-universal-executor-account/)
- [PushChain Documentation](https://push.org/docs)
- [Contract Helpers Documentation](https://push.org/docs/chain/build/contract-helpers)
- [PushChain UI Kit](https://www.npmjs.com/package/@pushchain/ui-kit)
- [React Documentation](https://react.dev/)

## 🚀 Next Steps

After completing this tutorial, you can:

- **Build Universal Apps**: Create apps that work with any wallet
- **Implement Airdrops**: Use UEAs for cross-chain token distribution
- **Add Authentication**: Use UEAs for universal user authentication
- **Create Multi-Chain DeFi**: Build protocols accessible from any chain
- **Explore Advanced Features**: Batch transactions, gasless transactions, and more

## 🎉 Congratulations!

You've successfully learned how to derive and work with Universal Executor Accounts! This powerful feature enables true cross-chain interoperability and provides a foundation for building universal blockchain applications.

---

**Happy Building with PushChain! 🚀**
