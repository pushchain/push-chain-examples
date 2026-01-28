# Batch Universal Transactions Frontend

A React application demonstrating how to execute multiple contract calls in a single transaction (multicall) on PushChain using the PushChain UI Kit.

👉 Full Tutorial: [Read the step-by-step guide on Push.org](https://push.org/docs/chain/tutorials/power-features/tutorial-batch-transactions/)

## Overview

This frontend application provides an interface for executing batch transactions on PushChain. It demonstrates advanced PushChain capabilities by simultaneously interacting with multiple smart contracts in a single transaction, showcasing gas optimization and improved user experience.

## Features

- **Batch Transactions**: Execute multiple contract calls in a single transaction
- **Multi-Contract Support**: Interact with both Counter and ERC20 contracts simultaneously
- **Real-time Updates**: Displays both counter value and token balance
- **Gas Optimization**: Reduced transaction costs through batching
- **Universal Wallet Support**: Connect from Ethereum, Solana, or any supported chain
- **Clean UI**: Minimal design with centered layout and clear visual feedback
- **Error Handling**: Comprehensive error messages and loading states
- **TypeScript**: Fully typed for better development experience

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Deployed Counter and ERC20 contracts on PushChain testnet

## Installation

1. Install dependencies:
```bash
npm install
```

2. Update the contract addresses in `src/App.tsx`:
```typescript
const COUNTER_CONTRACT_ADDRESS = 'YOUR_DEPLOYED_COUNTER_ADDRESS'
const ERC20_CONTRACT_ADDRESS = 'YOUR_DEPLOYED_ERC20_ADDRESS'
```

3. Start the development server:
```bash
npm run dev
```

## Project Structure

```
app/
├── src/
│   ├── App.tsx          # Main application component with batch transactions
│   ├── App.css          # Application styles
│   ├── index.css        # Global styles
│   ├── abi/
│   │   ├── Counter.json # Counter contract ABI
│   │   └── ERC20.json   # ERC20 contract ABI
│   └── providers/
│       └── PushChainProviders.tsx # PushChain provider configuration
├── package.json         # Dependencies and scripts
└── README.md           # This file
```

## Key Components

### App.tsx

The main application component that includes:

- **PushChain Hooks**: Uses `usePushWalletContext`, `usePushChainClient`, and `usePushChain`
- **State Management**: Manages counter value, token balance, loading states, and errors
- **Batch Transactions**: Executes multiple contract calls in a single transaction
- **Multi-Contract Interaction**: Reads from and writes to both Counter and ERC20 contracts
- **UI Components**: Clean, centered layout with wallet connection and real-time updates

### Batch Transaction Implementation

The app demonstrates PushChain's batch transaction capabilities:

```typescript
// Create batch transaction with multiple contract calls
const batchTx = await pushChainClient.universal.sendTransaction({
  to: pushChainClient.universal.account,
  data: [
    { 
      to: COUNTER_CONTRACT_ADDRESS, 
      value: BigInt(0), 
      data: incrementData 
    },
    { 
      to: ERC20_CONTRACT_ADDRESS, 
      value: BigInt(0), 
      data: mintData 
    },
  ],
});

// Reading from multiple contracts
const counterContract = new ethers.Contract(COUNTER_CONTRACT_ADDRESS, CounterABI, provider);
const erc20Contract = new ethers.Contract(ERC20_CONTRACT_ADDRESS, ERC20ABI, provider);
```

### PushChainProviders.tsx

Configures the PushChain Universal Wallet Provider with:

- **Network Configuration**: Testnet setup for development
- **Wallet Options**: Support for multiple wallet types and chains
- **App Metadata**: Branding and description for wallet connection prompts
- **Chain Configuration**: Custom RPC endpoints and chain settings

## Configuration

### Contract Addresses

Update both contract addresses after deploying your contracts:

```typescript
const COUNTER_CONTRACT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3'
const ERC20_CONTRACT_ADDRESS = '0x0165878A594ca255338adfa4d48449f69242Eb8F'
```

### RPC Endpoint

The app uses the PushChain testnet RPC endpoint:

```typescript
const provider = new ethers.JsonRpcProvider(
  "https://evm.donut.rpc.push.org/"
);
```

## User Experience

1. **Page Load**: Both counter value and token balance display immediately
2. **Wallet Connection**: Click "Connect Account" to connect wallet
3. **Batch Transaction**: Click "Do Batch Transaction" to execute both operations
4. **Real-time Updates**: Both counter and balance update automatically after the batch transaction
5. **Token Import**: Optional token contract address shown for wallet import

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Styling

The app uses inline styles for simplicity, with a focus on:
- Clean white background
- Centered layout
- Responsive design
- Clear visual hierarchy

## Dependencies

Key dependencies include:

- **@pushchain/ui-kit**: PushChain UI components and hooks for batch transactions
- **ethers**: Ethereum library for blockchain interactions
- **react**: Frontend framework
- **typescript**: Type safety and better development experience
- **vite**: Build tool and development server

## Batch Transaction Flow

The application executes the following operations in a single transaction:

1. **Counter Increment**: Calls `Counter.increment()` to increase counter by 1
2. **Token Minting**: Calls `ERC20.mint()` to mint 11 UNICORN tokens to user's address

This demonstrates:
- **Gas Efficiency**: Multiple operations in one transaction
- **Atomic Execution**: All operations succeed or fail together
- **Better UX**: Single confirmation for multiple actions

## Troubleshooting

### Common Issues

1. **Contract not found**: Ensure both contract addresses are correct
2. **Batch transaction fails**: Check wallet connection and network
3. **Values not updating**: Verify RPC endpoint and contract deployments
4. **Token balance not showing**: Confirm ERC20 contract is deployed and accessible

### Error Messages

The app provides clear error messages for:
- Wallet connection issues
- Batch transaction failures
- Contract interaction problems
- Network connectivity issues

## Next Steps

After running this tutorial, you can:

- Implement more complex batch operations (DEX swaps + staking)
- Add batch transaction support to existing dApps
- Explore cross-chain batch transactions
- Build advanced DeFi protocols using multicall patterns
- Optimize gas costs for multi-step workflows

## Resources

- [PushChain Documentation](https://push.org/docs)
- [PushChain UI Kit](https://www.npmjs.com/package/@pushchain/ui-kit)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
