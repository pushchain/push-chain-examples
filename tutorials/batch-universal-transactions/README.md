# Batch Universal Transactions Tutorial

An advanced example demonstrating how to execute multiple contract calls in a single transaction (multicall) on PushChain. This tutorial shows how to batch operations to reduce gas costs and improve user experience.

👉 Full Tutorial: [Read the step-by-step guide on Push.org](https://push.org/docs/chain/tutorials/power-features/tutorial-batch-transactions/)

## Overview

This tutorial consists of:

- **Frontend App**: A React app that executes batch transactions using PushChain's multicall feature
- **Pre-deployed contracts**: Uses already-deployed `Counter` and `ERC20` (UNICORN) contracts on Donut Testnet — no deployment step needed

## What You'll Learn

- How to execute multiple contract calls in a single transaction
- How to use PushChain's batch transaction capabilities
- How to encode multiple function calls for multicall
- How to interact with multiple contracts simultaneously
- Best practices for optimizing transaction costs with batch operations

## Project Structure

```
batch-universal-transactions/
├── app/                 # React frontend application
│   ├── src/
│   │   ├── App.tsx      # Main app component with batch transactions
│   │   ├── abi/         # Contract ABIs (Counter.json, ERC20.json)
│   │   └── providers/   # PushChain provider configuration
│   ├── package.json     # Frontend dependencies
│   └── README.md        # Frontend-specific instructions
└── README.md           # This file
```

## Quick Start

### 1. Run the Frontend

```bash
cd app
npm install
npm run dev
```

The tutorial uses pre-deployed contracts on PushChain testnet:
- **Counter Contract**: `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- **ERC20 Contract**: `0x0165878A594ca255338adfa4d48449f69242Eb8F`

### 2. Connect Wallet and Test

1. Open the app in your browser
2. Connect your wallet using the Universal Account Button
3. Click "Do Batch Transaction" to execute both counter increment and token minting
4. View the transaction on the PushChain explorer

## Features

- **Batch Transactions**: Execute multiple contract calls in a single transaction
- **Multi-Contract Interaction**: Simultaneously interact with Counter and ERC20 contracts
- **Real-time Updates**: Both counter and token balance update after batch execution
- **Gas Optimization**: Reduced transaction costs through batching
- **Universal Wallet Support**: Connect from Ethereum, Solana, or any supported chain
- **Error Handling**: Comprehensive error messages and loading states

## Batch Transaction Details

The app demonstrates a batch transaction that:
1. **Increments Counter**: Calls `Counter.increment()` to increase the counter by 1
2. **Mints Tokens**: Calls `ERC20.mint()` to mint 11 UNICORN tokens to the user's address

### Contract Details

**Counter Contract**:
- **Address**: `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- **Functions**:
  - `countPC()`: Returns current counter value
  - `increment()`: Increments the counter by 1

**ERC20 Contract**:
- **Address**: `0x0165878A594ca255338adfa4d48449f69242Eb8F`
- **Symbol**: UNICORN
- **Functions**:
  - `mint(address to, uint256 amount)`: Mints tokens to specified address
  - `balanceOf(address account)`: Returns token balance

## Code Example

Here's how the batch transaction is implemented:

```typescript
// Create batch transaction
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
```

## Prerequisites

- Node.js and npm
- Foundry for smart contract development
- Basic knowledge of React and TypeScript
- Understanding of blockchain and multicall concepts
- Familiarity with the simple counter tutorial (recommended)

## Resources

- [PushChain Documentation](https://push.org/docs)
- [PushChain UI Kit](https://www.npmjs.com/package/@pushchain/ui-kit)
- [Foundry Documentation](https://book.getfoundry.sh/)
- [Multicall Pattern Explanation](https://push.org/docs/chain/concepts/multicall)

## Next Steps

After completing this tutorial, you can:

- Implement more complex batch operations
- Add batch transaction support to existing dApps
- Explore cross-chain batch transactions
- Build advanced DeFi protocols using batch operations
- Optimize gas costs for multi-step workflows
