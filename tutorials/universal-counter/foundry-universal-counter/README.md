# Universal Counter Smart Contracts

This directory contains the smart contracts for the Universal Counter tutorial, demonstrating cross-chain user identification and interaction using PushChain's Universal Ethereum Account (UEA) system.

👉 Full Tutorial: [Read the step-by-step guide on Push.org](https://push.org/docs/chain/tutorials/universal-counter/)

## 🎯 Overview

The Universal Counter contracts showcase PushChain's revolutionary cross-chain capabilities. These contracts automatically detect users' origin chains and maintain separate counters, enabling true cross-chain user attribution without bridges or complex infrastructure.

**Key Innovation**: Users from Ethereum, Solana, and Push Chain can all interact with the same contract, with their actions automatically attributed to their origin chain.

## 📋 Contracts

### UniversalCounter.sol

The main contract powering the basic and ballsy apps:

**Core Functions:**
- `increment()` - Increments counter for caller's origin chain
- `countETH()` - Returns Ethereum users' total count
- `countSOL()` - Returns Solana users' total count  
- `countPC()` - Returns Push Chain users' total count
- `countETHUnique()` - Returns unique Ethereum users count
- `countSOLUnique()` - Returns unique Solana users count
- `countPCUnique()` - Returns unique Push Chain users count

**Chain Detection Logic:**
```solidity
// Automatic chain detection using PushChain's UEA system
bytes memory chainHash = abi.encodePacked(chainNamespace, ":", chainId);
chainCount[chainHash]++;

// Track unique users per chain
if (!userHasIncremented[chainHash][msg.sender]) {
    chainCountUnique[chainHash]++;
    userHasIncremented[chainHash][msg.sender] = true;
}
```

## ✨ Key Features

### Cross-Chain User Attribution
- **Automatic Detection**: No manual chain selection required
- **Universal Accounts**: Leverages PushChain's UEA system for seamless cross-chain identity
- **Chain Namespace Mapping**: Uses `chainNamespace:chainId` format for precise chain identification

### Counter Analytics
- **Total Counters**: Track overall interactions per chain (ETH, SOL, PC)
- **Unique User Tracking**: Count distinct users from each chain
- **Real-Time Events**: Emit events for frontend real-time updates

### Security & Efficiency
- **Gas Optimized**: Efficient storage patterns and minimal gas usage
- **Reentrancy Protection**: Safe against common attack vectors
- **Event-Driven**: Comprehensive event emission for frontend integration

## Development

This project uses [Foundry](https://book.getfoundry.sh/) for smart contract development.

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)

### Building

```bash
forge build
```

### Testing

```bash
forge test
```

### Deployment

The contracts can be deployed to PushChain using the deployment scripts in the `script` directory.

```bash
forge script script/Deploy.s.sol --rpc-url <PUSH_CHAIN_RPC_URL> --private-key <YOUR_PRIVATE_KEY>
```

## Integration with Frontend

The frontend application in the `../app` directory connects to these contracts to display and update the counters. It uses the contract's ABI to interact with the deployed contract on PushChain.
