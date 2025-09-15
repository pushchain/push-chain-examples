# Universal Simple Counter Smart Contracts

This folder contains the smart contracts for the Universal Simple Counter tutorial, a minimal example demonstrating basic smart contract development and deployment on PushChain.

👉 Full Tutorial: [Read the step-by-step guide on Push.org](https://push.org/docs/chain/tutorials/basics/tutorial-simple-counter/)

## Overview

The Universal Simple Counter is a beginner-friendly tutorial that shows how to create and deploy a simple counter contract on PushChain. This is the perfect starting point for developers new to PushChain development.

## Contracts

### Counter.sol

The main contract that provides:
- A simple counter that can be incremented
- A `countPC` variable to track the current count
- An `increment()` function to increase the counter
- Event emission when the counter is incremented

## Key Features

- **Simple Functionality**: Basic counter operations (increment, reset, read)
- **Event Emission**: Emits `CountIncremented` events for frontend integration
- **Minimal Design**: Clean, easy-to-understand code perfect for learning
- **PushChain Compatible**: Deployed and verified on PushChain testnet

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

Deploy to PushChain testnet:

```bash
forge script script/Deploy.s.sol --rpc-url push_testnet --broadcast
```

Or deploy with a specific private key:

```bash
forge script script/Deploy.s.sol --rpc-url push_testnet --private-key <YOUR_PRIVATE_KEY> --broadcast
```

### Contract Verification

After deployment, verify your contract:

```bash
forge verify-contract <CONTRACT_ADDRESS> src/Counter.sol:Counter --rpc-url push_testnet
```

## Integration with Frontend

The frontend application in the `../app` directory connects to this contract to display and update the counter. It uses the contract's ABI to interact with the deployed contract on PushChain.

## Example Usage

Once deployed, you can interact with the contract:

1. **Read Counter**: Call `countPC()` to get the current counter value
2. **Increment**: Call `increment()` to increase the counter by 1

## Contract Address

Update the contract address in your frontend application after deployment:

```typescript
const COUNTER_CONTRACT_ADDRESS = 'YOUR_DEPLOYED_CONTRACT_ADDRESS'
