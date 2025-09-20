# PushChain Tutorials

This directory contains step-by-step tutorials and example projects to help you learn and build on PushChain. Each tutorial is designed to demonstrate specific features and capabilities of the PushChain ecosystem.

👉 All Tutorials: [Explore the full list on Push.org](https://push.org/docs/chain/tutorials/)

## Available Tutorials

### 1. Simple Counter

A basic introduction to PushChain development with a simple counter application.

**What you'll learn:**
- Basic PushChain UI Kit integration
- Universal Account connection
- Simple smart contract interaction
- Cross-chain transaction sending

**Components:**
- [`contracts/`](./simple-counter/contracts/) - Simple Counter smart contract
- [`app/`](./simple-counter/app/) - Clean React frontend with Push Chain UI Kit

[Go to Simple Counter Tutorial →](./simple-counter)

### 2. Universal Counter

A comprehensive tutorial demonstrating cross-chain interaction using PushChain's Universal Ethereum Account (UEA) system. This project shows how users from Ethereum, Solana, and PushChain can interact with the same application seamlessly.

**What you'll learn:**
- Cross-chain user attribution
- Dynamic vs hardcoded chain handling
- Universal Counter contract patterns
- Interactive physics-based UI
- Real-time leaderboard systems

**Components:**
- [`contracts/`](./universal-counter/contracts/) - Universal Counter smart contracts
- [`app/`](./universal-counter/app/) - Clean counter display with hardcoded chains
- [`app-dynamic/`](./universal-counter/app-dynamic/) - Dynamic chain detection with data table
- [`ballsy-app/`](./universal-counter/ballsy-app/) - Interactive physics-based leaderboard game

[Go to Universal Counter Tutorial →](./universal-counter)

### 3. Universal Airdrop

A tutorial demonstrating how to create a cross-chain airdrop system using Universal External Accounts (UEA) and Merkle proofs.

**What you'll learn:**
- Cross-chain airdrop distribution
- Merkle proof verification
- Universal External Account integration
- Token claiming mechanisms

**Components:**
- [`contracts/`](./universal-airdrop/contracts/) - Universal Airdrop and TestToken contracts
- [`scripts/`](./universal-airdrop/scripts/) - Deployment and Merkle tree generation scripts
- [`data/`](./universal-airdrop/data/) - Airdrop recipient configuration

[Go to Universal Airdrop Tutorial →](./universal-airdrop)

### 4. Universal ERC-20 Mint

A tutorial showing how to create a universal ERC-20 token minting system that works across different chains.

**What you'll learn:**
- Cross-chain token minting
- Universal token standards
- Multi-chain token distribution
- ERC-20 contract patterns

**Components:**
- [`contracts/`](./universal-erc-20-mint/contracts/) - Universal ERC-20 minting contracts

[Go to Universal ERC-20 Mint Tutorial →](./universal-erc-20-mint)

## Tutorial Components Overview

### Smart Contracts (`contracts/`)
Each tutorial includes Solidity smart contracts that demonstrate:
- **Simple Counter**: Basic increment functionality
- **Universal Counter**: Cross-chain user attribution and counting
- **Universal Counter Dynamic**: Dynamic chain detection and storage

### Frontend Applications

#### Basic Apps (`app/`)
Clean, minimal interfaces focusing on core functionality:
- Simple wallet connection
- Transaction sending
- Counter display
- Explorer links

#### Dynamic Apps (`app-dynamic/`)
Advanced interfaces with dynamic data handling:
- Real-time chain detection
- Data tables with chain information
- Dynamic counter attribution
- Comprehensive chain analytics

#### Interactive Apps (`ballsy-app/`)
Engaging, game-like experiences:
- Matter.js physics engine integration
- Interactive ball animations
- Real-time leaderboards
- Cross-chain competition mechanics

## Tutorial Structure

Each tutorial typically includes:

- **Smart contracts** written in Solidity with deployment scripts
- **Frontend applications** built with React, TypeScript, and Push Chain UI Kit
- **Detailed README files** explaining concepts and implementation
- **Step-by-step instructions** for deployment and usage
- **Live demos** and deployment configurations

## Getting Started

To get started with any tutorial:

1. **Choose your tutorial** based on your learning goals
2. **Navigate to the tutorial directory** of your choice
3. **Read the README** for an overview of the project
4. **Set up contracts** by following the smart contract deployment guide
5. **Run the frontend** by following the app setup instructions
6. **Experiment and customize** the code to make it your own!

## Prerequisites

Most tutorials assume basic knowledge of:

- **Blockchain concepts** and Ethereum development
- **JavaScript/TypeScript** and modern web development
- **React** and component-based UI development
- **Smart contract development** with Solidity
- **Git** and package management (npm/yarn)

## Learning Path

If you're new to PushChain development, we recommend following these tutorials in order:

1. **Simple Counter** - Learn the basics of PushChain integration
2. **Universal Counter (app)** - Understand cross-chain user attribution
3. **Universal Counter (app-dynamic)** - Explore dynamic chain detection
4. **Universal Counter (ballsy-app)** - Build interactive, engaging experiences
5. **Universal Airdrop** - Learn cross-chain token distribution with Merkle proofs
6. **Universal ERC-20 Mint** - Explore universal token minting patterns

## Key Concepts Covered

### Cross-Chain Interaction
- Universal Ethereum Accounts (UEAs)
- Chain-agnostic user interfaces
- Cross-chain transaction handling

### Smart Contract Patterns
- Counter contracts with chain attribution
- Dynamic chain detection and storage
- Event emission for real-time updates

### Frontend Development
- Push Chain UI Kit integration
- Real-time data fetching and updates
- Interactive animations and physics
- Responsive design patterns

### Advanced Features
- WebSocket event subscriptions
- Matter.js physics integration
- Dynamic data visualization
- Cross-chain leaderboard systems

## Resources

For more information about PushChain development:

- [PushChain Documentation](https://push.org/docs)
- [PushChain UI Kit](https://www.npmjs.com/package/@pushchain/ui-kit)
- [PushChain GitHub](https://github.com/pushchain)
- [PushChain Community Discord](https://discord.gg/pushchain)
- [Push Chain Explorer](https://donut.push.network/)
