# Universal Counter App

A React application that demonstrates cross-chain interaction using PushChain's Universal Ethereum Account (UEA) system. This app allows users from Ethereum, Solana, and PushChain to increment counters, with real-time visual feedback through interactive physics simulations.

## Features

- **Cross-Chain Interaction**: Connect with wallets from Ethereum, Solana, or PushChain
- **Interactive Physics Simulation**: Watch blockchain-colored balls drop as counters increment
- **Real-Time Updates**: WebSocket integration for instant counter updates
- **Blockchain-Specific Counters**: Track separate counts for each blockchain
- **Interactive UI**: Drag and play with the physics balls using mouse controls

## Technology Stack

- **Frontend**: React with TypeScript
- **Build Tool**: Vite
- **Physics Engine**: Matter.js
- **Blockchain Integration**: ethers.js and PushChain SDK
- **UI Components**: PushChain UI Kit

## Installation

```bash
# Install dependencies
yarn install

# Start the development server
yarn dev
```

## Usage

1. Connect your wallet using the "Connect Wallet" button
2. Choose your preferred blockchain (Ethereum, Solana, or PushChain)
3. Click the increment button for your blockchain to increase its counter
4. Watch as colored balls drop from the top of the screen:
   - Blue balls for Ethereum
   - Purple balls for Solana
   - Green balls for PushChain
5. Interact with the balls by dragging them with your mouse

## Project Structure

- `src/App.tsx`: Main application component with wallet connection and counter logic
- `src/Matter.tsx`: Physics simulation using Matter.js for the interactive balls
- `src/abi/`: Smart contract ABIs for blockchain interaction
- `src/types/`: TypeScript type definitions

## Integration with Smart Contracts

This app connects to the Universal Counter smart contract deployed on PushChain. The contract:

- Identifies the origin chain of the user (Ethereum, Solana, or PushChain)
- Increments the appropriate counter based on the user's origin
- Emits events that are captured by the app's WebSocket listener

The contract source code is available in the `../contracts` directory.

## Development

This project uses Vite for fast development and builds. You can customize the ESLint configuration for your specific needs.
