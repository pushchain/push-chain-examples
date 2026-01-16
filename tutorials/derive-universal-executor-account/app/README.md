# Derive Universal Executor Account App

A beautiful React application demonstrating how to derive Universal Executor Accounts (UEA) from any wallet address on any supported blockchain using PushChain's deterministic account mapping system.

👉 **[Live Playground](https://push.org/docs/chain/tutorials/power-features/tutorial-derive-universal-executor-account/#live-playground)**: Try deriving UEAs from any wallet!

## Overview

This frontend application provides an intuitive interface for deriving Universal Executor Accounts (UEA) from any wallet address on any supported blockchain. It showcases three methods of UEA derivation: automatic derivation from connected wallets, manual derivation from any address, and smart contract-based derivation examples.

## ✨ Features

- **Automatic UEA Display**: Shows your UEA when you connect your wallet
- **Manual Derivation Tool**: Derive UEAs from any wallet address and chain
- **Multi-Chain Support**: Works with 6+ blockchains (Ethereum, Solana, Base, Arbitrum, BNB, Push Chain)
- **Smart Contract Examples**: Solidity code snippets for on-chain UEA derivation
- **Wallet Integration**: Seamless connection with Push Universal Account Button

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Compatible wallet (MetaMask, Phantom, etc.) for testing
- Basic understanding of blockchain addresses

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to the local development URL
4. Connect your wallet to see your UEA or manually derive UEAs from any address!

## Project Structure

```
app/
├── src/
│   ├── App.tsx          # Main application component with UEA derivation
│   ├── App.css          # Application styles with CSS classes
│   ├── index.css        # Global styles and body layout
│   └── main.tsx         # Entry point with PushChain providers
├── package.json         # Dependencies and scripts
├── vite.config.ts       # Vite configuration
├── tsconfig.json        # TypeScript configuration
└── README.md           # This file
```

## Key Components

### App.tsx

The main application component that includes:

- **PushChain Hooks**: Uses `usePushWalletContext`, `usePushChainClient`, and `usePushChain`
- **State Management**: Manages manual lookup state, loading states, and derived UEA results
- **UEA Derivation**: Implements client-side UEA derivation using PushChain utilities
- **Multi-Chain Support**: Chain selector for deriving UEAs from different blockchains

### UEA Derivation Logic

The app demonstrates proper UEA derivation patterns:

```typescript
// Convert origin address to Universal Account
const account = PushChain.utils.account.toUniversal(
  walletAddress,
  { chain: chainId }
);

// Derive the Universal Executor Account (UEA)
const executorAddress = await PushChain.utils.account.convertOriginToExecutor(account);

// Display the derived UEA address
setManualLookupResult(executorAddress.address);
```

### Supported Chains

The app supports UEA derivation from:
- Push Chain (Testnet)
- Ethereum Sepolia
- Solana Devnet
- Base Sepolia
- Arbitrum Sepolia
- BNB Testnet

For an exhaustive list of supported chains, see the [Get Supported Chains](https://push.org/docs/chain/build/utility-functions/#get-supported-chains) utility function.

## Configuration

### UEAFactory Contract

The app references the UEAFactory contract for smart contract examples:

```typescript
const UEA_FACTORY_ADDRESS = '0x00000000000000000000000000000000000000eA'
```

### Chain Configuration

The app uses PushChain constants for chain selection:

```typescript
const chains = [
  { value: PushChain.CONSTANTS.CHAIN.PUSH_TESTNET, label: "Push Chain" },
  { value: PushChain.CONSTANTS.CHAIN.ETHEREUM_SEPOLIA, label: "Ethereum Sepolia" },
  { value: PushChain.CONSTANTS.CHAIN.SOLANA_DEVNET, label: "Solana Devnet" },
  // ... more chains
];
```

## User Experience

1. **Page Load**: View tutorial description and connect wallet button
2. **Wallet Connection**: Click "Connect Account" to connect your wallet
3. **Automatic UEA Display**: See your origin wallet and derived UEA immediately
4. **Manual Derivation**: Enter any wallet address and select a chain
5. **Derive UEA**: Click "Derive UEA" to see the deterministic UEA address
6. **Smart Contract Examples**: View Solidity code for on-chain UEA derivation

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint for code quality

## Dependencies

Key dependencies include:

- **@pushchain/ui-kit**: PushChain UI components and hooks for wallet connection and UEA derivation
- **react**: Frontend framework for building the user interface
- **vite**: Fast build tool and development server

### Development Dependencies

- **@vitejs/plugin-react**: React support for Vite
- **@types/react**: TypeScript definitions for React
- **tailwindcss**: Utility-first CSS framework
- **eslint**: Code linting and quality assurance

## Troubleshooting

### Common Issues

1. **"Failed to derive Universal Executor Account"**:
   - Ensure the wallet address format is correct for the selected chain
   - Verify the chain is supported
   - Check your network connection

2. **"UEA not displaying after wallet connection"**:
   - Ensure your wallet is fully connected
   - Check browser console for errors
   - Try refreshing the page and reconnecting

3. **"Wallet connection issues"**:
   - Make sure you have a compatible wallet installed (MetaMask, Phantom, etc.)
   - Try refreshing the page and reconnecting
   - Clear browser cache if connection persists to fail

4. **"Invalid address format"**:
   - Ensure you're entering the correct address format for the selected chain
   - Ethereum addresses start with 0x
   - Solana addresses are base58 encoded

### Error Messages

The app provides clear error messages for:
- Invalid wallet addresses
- Unsupported chains
- Network connectivity issues
- UEA derivation failures

## Next Steps

After running this tutorial, you can:

- **Build Universal Apps**: Create applications that work with any wallet from any chain
- **Implement Airdrops**: Use UEAs for cross-chain token distribution
- **Add Authentication**: Build universal authentication systems using UEAs
- **Create Multi-Chain DeFi**: Build protocols accessible from any blockchain
- **Smart Contract Integration**: Implement on-chain UEA derivation in your contracts
- **Production Deployment**: Deploy to mainnet and support more chains

## 🎯 Learning Outcomes

By completing this tutorial, you've learned:

- How Universal Executor Accounts (UEA) work on PushChain
- Client-side UEA derivation using `@pushchain/ui-kit`
- Building multi-chain wallet interfaces
- Modern UI/UX design with CSS classes and gradients
- Error handling and user feedback in web3 applications
- Smart contract integration patterns for UEA derivation

## Resources

- [Tutorial Documentation](https://push.org/docs/chain/tutorials/power-features/tutorial-derive-universal-executor-account/)
- [PushChain Documentation](https://push.org/docs)
- [Contract Helpers Documentation](https://push.org/docs/chain/build/contract-helpers)
- [PushChain UI Kit](https://www.npmjs.com/package/@pushchain/ui-kit)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

---

**Happy Building with PushChain! 🚀**
