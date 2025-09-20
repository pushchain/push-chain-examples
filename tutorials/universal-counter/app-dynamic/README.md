# Universal Counter App (Dynamic)

An advanced React application demonstrating dynamic cross-chain interaction with the Universal Counter Dynamic smart contract. This implementation automatically detects and displays data for all chains that have interacted with the contract, featuring a comprehensive data table.

👉 Full Tutorial: [Read the step-by-step guide on Push.org](https://push.org/docs/chain/tutorials/universal-counter/)

## Overview

This frontend application provides an advanced interface for the Universal Counter Dynamic contract. Unlike the basic app with hardcoded chains, this version dynamically detects all chains that have interacted with the contract and displays comprehensive analytics in a data table format.

## Features

- **Dynamic Chain Detection**: Automatically discovers all chains that have interacted with the contract
- **Comprehensive Data Table**: Displays chain names, total counts, and unique user counts
- **Real-Time Analytics**: Shows live data for all participating chains
- **Chain Name Resolution**: Converts raw chain hashes to human-readable names
- **Total Universal Count**: Displays the overall count across all chains
- **Wallet Integration**: Connect wallet using Push Universal Account Button
- **Transaction Support**: Increment counter using PushChain transactions
- **Error Handling**: Proper error messages and loading states
- **TypeScript**: Fully typed for better development experience

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- A deployed Universal Counter Dynamic contract on PushChain testnet

## Installation

1. Install dependencies:
```bash
npm install
```

2. Update the contract address in `src/App.tsx`:
```typescript
const COUNTER_CONTRACT_ADDRESS = 'YOUR_DEPLOYED_UNIVERSAL_COUNTER_DYNAMIC_ADDRESS'
```

3. Start the development server:
```bash
npm run dev
```

## Project Structure

```
app-dynamic/
├── src/
│   ├── App.tsx                      # Main application component
│   ├── App.css                      # Application styles
│   ├── index.css                    # Global styles
│   └── abi/
│       └── UniversalCounterDynamic.json # Contract ABI
├── package.json                     # Dependencies and scripts
└── README.md                       # This file
```

## Key Components

### App.tsx

The main application component that includes:

- **PushChain Hooks**: Uses `usePushWalletContext`, `usePushChainClient`, and `usePushChain`
- **Dynamic State Management**: Manages counter value, chain data array, loading states, and errors
- **Advanced Contract Interaction**: Reads total counts and iterates through all chain data
- **Data Table UI**: Displays comprehensive chain analytics in a professional table format
- **Chain Name Resolution**: Converts raw chain hashes to human-readable names

### Dynamic Chain Detection

The app demonstrates advanced contract interaction patterns:

```typescript
// Reading total counts
const [totalCount, totalUniqueCount] = await contract.getCount();

// Dynamic chain discovery
const newChainData = [];
let chainIndex = 0;

try {
  while (true) {
    const chainHash = await contract.chainIds(chainIndex);
    const count = await contract.chainCount(chainHash);
    const uniqueCount = await contract.chainCountUnique(chainHash);
    
    newChainData.push({
      chainHash: ethers.hexlify(chainHash),
      count: Number(count),
      uniqueCount: Number(uniqueCount)
    });
    
    chainIndex++;
  }
} catch (error) {
  // Expected error when we reach the end of the array
}
```

### Chain Data Table

The app features a comprehensive data table showing:
- **Chain Name**: Human-readable chain names resolved from hashes
- **Count**: Total interactions from each chain
- **Unique Count**: Number of unique users from each chain

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
