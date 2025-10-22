# Batch Universal Transactions Smart Contracts

This folder contains the smart contracts used in the Batch Universal Transactions tutorial, demonstrating how to interact with multiple contracts in a single transaction (multicall) on PushChain.

👉 Full Tutorial: [Read the step-by-step guide on Push.org](https://push.org/docs/chain/tutorials/power-features/tutorial-batch-transactions/)

## Overview

The Batch Universal Transactions tutorial uses existing deployed contracts to demonstrate PushChain's multicall capabilities. This tutorial focuses on frontend batch transaction implementation rather than contract deployment, showcasing how to optimize gas costs and improve user experience through batching multiple contract calls.

## Contracts Used

This tutorial demonstrates batch transactions using pre-deployed contracts:

### Counter Contract
**Address**: `0x5FbDB2315678afecb367f032d93F642f64180aa3`

- A simple counter that can be incremented
- `countPC()` function to read the current count
- `increment()` function to increase the counter by 1
- Emits `CountIncremented` events for frontend integration

### ERC20 Contract (UNICORN Token)
**Address**: `0x0165878A594ca255338adfa4d48449f69242Eb8F`

- Standard ERC20 token with minting capability
- `mint(address to, uint256 amount)` function for token creation
- `balanceOf(address account)` function to check token balance
- Used to demonstrate multi-contract batch operations

## Key Features

- **Batch Transaction Support**: Multiple contract calls in a single transaction
- **Gas Optimization**: Reduced transaction costs through batching
- **Atomic Execution**: All operations succeed or fail together
- **Multi-Contract Interaction**: Demonstrates interaction with different contract types
- **PushChain Compatible**: Deployed and verified on PushChain testnet

## Batch Transaction Example

The tutorial demonstrates executing these operations in a single batch transaction:

1. **Counter Increment**: Calls `Counter.increment()` to increase the counter
2. **Token Minting**: Calls `ERC20.mint()` to mint 11 UNICORN tokens to the user

### Frontend Integration

The frontend application in the `../app` directory demonstrates how to:

- Encode multiple function calls using `PushChain.utils.helpers.encodeTxData()`
- Execute batch transactions using `pushChainClient.universal.sendTransaction()`
- Handle atomic execution where all operations succeed or fail together

### Batch Transaction Code Example

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
```

## Contract Addresses

The tutorial uses these pre-deployed contract addresses:

```typescript
const COUNTER_CONTRACT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3'
const ERC20_CONTRACT_ADDRESS = '0x0165878A594ca255338adfa4d48449f69242Eb8F'
```

## Benefits of Batch Transactions

- **Gas Efficiency**: Multiple operations in one transaction reduces overall gas costs
- **Atomic Execution**: All operations succeed or fail together, ensuring consistency
- **Better UX**: Users only need to confirm one transaction for multiple actions
- **Reduced Network Load**: Fewer transactions on the network
