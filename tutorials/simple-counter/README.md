# Simple Counter Tutorial

A minimal example demonstrating how to build a simple counter dApp on PushChain. This tutorial shows the basics of smart contract deployment and frontend integration with PushChain.

👉 Full Tutorial: [Read the step-by-step guide on Push.org](https://push.org/docs/chain/tutorials/basics/tutorial-simple-counter/)

## Overview

This tutorial consists of:

- **Smart Contract**: A simple counter contract that can be incremented
- **Frontend App**: A clean, minimal React app that interacts with the counter contract

## What You'll Learn

- How to deploy a simple smart contract on PushChain testnet
- How to create a minimal frontend with PushChain UI Kit
- How to use `pushChainClient` for sending transactions
- How to read contract state using JsonRpcProvider
- Best practices for PushChain dApp development

## Project Structure

```
universal-simple-counter/
├── contracts/          # Smart contract code and deployment
│   ├── src/
│   │   └── Counter.sol  # Simple counter contract
│   ├── foundry.toml     # Foundry configuration
│   └── README.md        # Contract-specific instructions
├── app/                 # React frontend application
│   ├── src/
│   │   ├── App.tsx      # Main app component
│   │   └── abi/         # Contract ABI
│   ├── package.json     # Frontend dependencies
│   └── README.md        # Frontend-specific instructions
└── README.md           # This file
```

## Quick Start

### 1. Deploy the Smart Contract

```bash
cd contracts
forge build
forge script script/Deploy.s.sol --rpc-url push_testnet --broadcast
```

### 2. Run the Frontend

```bash
cd app
npm install
npm run dev
```

### 3. Update Contract Address

Update the contract address in `app/src/App.tsx` with your deployed contract address.

## Features

- **Simple UI**: Clean white background with centered layout
- **Wallet Integration**: Connect wallet using Push Universal Account Button
- **Real-time Updates**: Counter value updates immediately on page load
- **Transaction Support**: Increment counter using PushChain transactions
- **Error Handling**: Proper error messages and loading states

## Contract Details

- **Contract Address**: `0x5FbDB2315678afecb367f032d93F642f64180aa3` (example)
- **Network**: Push Chain Testnet
- **Functions**:
  - `countPC()`: Returns current counter value
  - `increment()`: Increments the counter by 1

## Prerequisites

- Node.js and npm
- Foundry for smart contract development
- Basic knowledge of React and TypeScript
- Understanding of blockchain concepts

## Resources

- [PushChain Documentation](https://push.org/docs)
- [PushChain UI Kit](https://www.npmjs.com/package/@pushchain/ui-kit)
- [Foundry Documentation](https://book.getfoundry.sh/)

## Next Steps

After completing this tutorial, you can:

- Explore the more advanced Universal Counter tutorial
- Add more functions to the smart contract
- Enhance the UI with additional features
- Deploy to other networks supported by PushChain
