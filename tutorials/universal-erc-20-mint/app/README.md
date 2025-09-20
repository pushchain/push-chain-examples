# Universal Counter App

A clean React application demonstrating cross-chain interaction with the Universal Counter smart contract on PushChain. This implementation shows cross-chain counters with a simple, professional interface.

👉 Full Tutorial: [Read the step-by-step guide on Push.org](https://push.org/docs/chain/tutorials/universal-counter/)

## Overview

This frontend application provides a clean, minimal interface for the Universal Counter contract. It demonstrates cross-chain user attribution by showing separate counters for Ethereum, Solana, and Push Chain users, with a focus on simplicity and clarity.

## Features

- **Cross-Chain Attribution**: Automatically detects user's origin chain (Ethereum, Solana, Push Chain)
- **Clean UI**: Minimal interface with centered layout matching the provided design
- **Total Universal Count**: Displays the total count across all chains
- **Individual Chain Counters**: Shows separate counters for ETH, Sol, and PC
- **Wallet Integration**: Connect wallet using Push Universal Account Button
- **Transaction Support**: Increment counter using PushChain transactions
- **Error Handling**: Proper error messages and loading states
- **TypeScript**: Fully typed for better development experience

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- A deployed Universal Counter contract on PushChain testnet

## Installation

1. Install dependencies:
```bash
npm install
```

2. Update the contract address in `src/App.tsx`:
```typescript
const COUNTER_CONTRACT_ADDRESS = 'YOUR_DEPLOYED_CONTRACT_ADDRESS'
```

3. Start the development server:
```bash
npm run dev
```

## Project Structure

```
app/
├── src/
│   ├── App.tsx          # Main application component
│   ├── App.css          # Application styles
│   ├── index.css        # Global styles
│   └── abi/
│       └── Counter.json # Contract ABI
├── package.json         # Dependencies and scripts
└── README.md           # This file
```

## Key Components

### App.tsx

The main application component that includes:

- **PushChain Hooks**: Uses `usePushWalletContext`, `usePushChainClient`, and `usePushChain`
- **State Management**: Manages counter value, loading states, and errors
- **Contract Interaction**: Reads counter value and sends increment transactions
- **UI Components**: Clean, centered layout with wallet connection and counter display

### Contract Integration

The app demonstrates proper PushChain integration patterns:

```typescript
// Reading contract state
const provider = new ethers.JsonRpcProvider(
  "https://evm.rpc-testnet-donut-node1.push.org/"
);
const contract = new ethers.Contract(CONTRACT_ADDRESS, CounterABI, provider);
const currentCount = await contract.countPC();

// Sending transactions
const tx = await pushChainClient.universal.sendTransaction({
  to: CONTRACT_ADDRESS,
  data: getTxData(),
  value: BigInt(0),
});
```

## Configuration

### Contract Address

Update the contract address after deploying your Counter contract:

```typescript
const COUNTER_CONTRACT_ADDRESS = '0x9F95857e43d25Bb9DaFc6376055eFf63bC0887C1'
```

### RPC Endpoint

The app uses the PushChain testnet RPC endpoint:

```typescript
const provider = new ethers.JsonRpcProvider(
  "https://evm.rpc-testnet-donut-node1.push.org/"
);
```

## User Experience

1. **Page Load**: Counter value displays immediately
2. **Wallet Connection**: Click "Connect Account" to connect wallet
3. **Counter Interaction**: Click "Increment Counter" to increase the value
4. **Real-time Updates**: Counter updates automatically after transactions

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

- **@pushchain/ui-kit**: PushChain UI components and hooks
- **ethers**: Ethereum library for blockchain interactions
- **react**: Frontend framework
- **typescript**: Type safety
- **vite**: Build tool and development server

## Troubleshooting

### Common Issues

1. **Contract not found**: Ensure the contract address is correct
2. **Transaction fails**: Check wallet connection and network
3. **Counter not updating**: Verify RPC endpoint and contract deployment

### Error Messages

The app provides clear error messages for:
- Wallet connection issues
- Transaction failures
- Contract interaction problems

## Next Steps

After running this tutorial, you can:

- Explore the more advanced Universal Counter tutorial
- Add more contract functions (reset, custom increment values)
- Enhance the UI with additional features
- Deploy to other networks supported by PushChain

## Resources

- [PushChain Documentation](https://push.org/docs)
- [PushChain UI Kit](https://www.npmjs.com/package/@pushchain/ui-kit)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
