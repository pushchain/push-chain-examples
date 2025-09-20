# Universal Counter Dynamic Smart Contracts

This directory contains the advanced smart contracts for the Universal Counter Dynamic tutorial, demonstrating dynamic cross-chain user identification and comprehensive analytics using PushChain's Universal Ethereum Account (UEA) system.

👉 Full Tutorial: [Read the step-by-step guide on Push.org](https://push.org/docs/chain/tutorials/universal-counter/)

## 🎯 Overview

The Universal Counter Dynamic contracts showcase PushChain's most advanced cross-chain capabilities. These contracts automatically detect and track any chain that interacts with them, maintaining comprehensive analytics and enabling true dynamic cross-chain user attribution without bridges or complex infrastructure.

**Key Innovation**: Users from any blockchain can interact with the contract, and the system automatically discovers, tracks, and analyzes their chain interactions in real-time.

## 📋 Contract

### UniversalCounterDynamic.sol

The advanced contract powering both the dynamic analytics app and ballsy gaming app with comprehensive chain tracking:

**Enhanced Functions:**
- `increment()` - Increments with dynamic chain tracking
- `getCount()` - Returns total count and unique users across all chains
- `chainIds(uint256)` - Array of all chain hashes that have interacted
- `chainCount(bytes)` - Count for specific chain hash
- `chainCountUnique(bytes)` - Unique users for specific chain hash

**Dynamic Chain Discovery:**
```solidity
// Automatically tracks new chains as they interact
if (chainCount[chainHash] == 0) {
    chainIds.push(chainHash); // Add new chain to tracking array
}
```

## ✨ Key Features

### Cross-Chain User Attribution
- **Automatic Detection**: No manual chain selection required
- **Universal Accounts**: Leverages PushChain's UEA system for seamless cross-chain identity
- **Chain Namespace Mapping**: Uses `chainNamespace:chainId` format for precise chain identification

### Dynamic Analytics
- **Total Counters**: Track overall interactions per chain
- **Unique User Tracking**: Count distinct users from each chain
- **Dynamic Chain Discovery**: Automatically detect new participating chains
- **Comprehensive Chain Array**: Maintains array of all chain hashes for iteration
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

The frontend applications in the `../app` (dynamic analytics) and `../ballsy-app` (interactive gaming) directories connect to this contract to display and update the counters. They use the contract's ABI to interact with the deployed contract on PushChain.

### Dynamic App Integration
- Iterates through `chainIds` array to discover all participating chains
- Calls `chainCount()` and `chainCountUnique()` for each chain
- Uses `getCount()` for total statistics across all chains

### Ballsy App Integration
- Uses the same dynamic contract for leaderboard data
- Triggers physics animations based on counter increments
- Real-time updates via contract events
