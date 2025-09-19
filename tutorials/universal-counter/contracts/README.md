# Universal Counter Smart Contracts

This folder contains the smart contracts for the Universal Counter application, which demonstrates cross-chain user identification and interaction using PushChain's Universal Ethereum Account (UEA) system.

## Overview

The Universal Counter is a demonstration of how PushChain enables native cross-chain user interactions. The contract tracks and increments counters for users from different blockchains (Ethereum, Solana, and PushChain) based on their origin chain.

## Contracts

### UniversalCounter.sol

The main contract that:

- Maintains separate counters for Ethereum, Solana, and PushChain users
- Automatically identifies the origin chain of the caller using PushChain's UEA system
- Increments the appropriate counter based on the user's origin chain
- Emits events when counters are incremented
- Provides functions to check the current count for each blockchain

### Counter.sol

A simple helper contract that provides basic counter functionality.

## Key Features

- **Cross-Chain User Identification**: Automatically detects whether a user is from Ethereum, Solana, or PushChain
- **Universal Ethereum Accounts (UEAs)**: Leverages PushChain's UEA system to identify users' origin chains
- **Event Emission**: Emits events when counters are incremented, enabling real-time updates in the frontend

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
