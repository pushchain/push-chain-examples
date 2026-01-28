# Universal Counter Dynamic Tutorial

An advanced tutorial demonstrating dynamic cross-chain interaction using PushChain's Universal Ethereum Account (UEA) system. This project showcases advanced features including dynamic chain detection, comprehensive analytics, and interactive physics-based gaming.

👉 Full Tutorial: [Read the step-by-step guide on Push.org](https://push.org/docs/chain/tutorials/universal-counter/)

## 🌟 Overview

The Universal Counter Dynamic is an advanced full-stack application that demonstrates the power of PushChain's cross-chain capabilities through dynamic implementations:

1. **Dynamic Chain Detection**: Automatically discovers and tracks any chain that interacts with the contract
2. **Advanced Analytics**: Comprehensive data tables showing chain statistics and user metrics
3. **Interactive Gaming**: Physics-based competitive experience with Matter.js integration
4. **Real-Time Updates**: WebSocket integration for instant counter updates across all users

## 📁 Project Structure

This tutorial includes advanced implementations demonstrating dynamic cross-chain capabilities:

```
universal-counter-dynamic/
├── contracts/              # Advanced smart contracts
│   ├── src/
│   │   └── UniversalCounterDynamic.sol # Dynamic chain detection contract
│   └── README.md
├── app/                    # Dynamic analytics interface
│   ├── src/
│   │   └── App.tsx         # Dynamic counter with data table
│   └── README.md
├── ballsy-app/            # Interactive physics-based game
│   ├── src/
│   │   ├── App.tsx         # Main game component
│   │   └── Matter.tsx      # Physics engine integration
│   └── README.md
└── README.md              # This file
```

## 🚀 Applications Overview

### 1. **Dynamic Analytics App** (`app/`)
Advanced interface featuring:
- **Dynamic Chain Detection**: Automatically discovers all participating chains
- **Comprehensive Data Table**: Shows chain names, total counts, and unique user counts
- **Real-Time Analytics**: Live updates as new chains interact with the contract
- **Chain Name Resolution**: Converts raw chain hashes to human-readable names

### 2. **Ballsy Gaming App** (`ballsy-app/`)
Interactive physics-based gaming experience:
- **Matter.js Physics Engine**: Realistic ball physics and interactions
- **Cross-Chain Competition**: Real-time leaderboard showing which chain is winning
- **Interactive Gameplay**: Drag and throw balls with mouse controls
- **Visual Chain Representation**: Different colored balls for each blockchain

## ✨ Key Features

### Cross-Chain Capabilities
- **Universal Ethereum Accounts (UEAs)**: Leverages PushChain's UEA system to identify users' origin chains
- **Chain Attribution**: Automatically detects whether a user is from Ethereum, Solana, or PushChain
- **Universal Access**: Users from any supported chain can interact with the same contract

### Advanced Smart Contract Features
- **Dynamic Chain Discovery**: Automatically tracks new chains as they interact
- **Comprehensive Analytics**: Stores total counts and unique user counts per chain
- **Chain Array Management**: Maintains an array of all participating chain hashes
- **Event Emission**: Real-time updates through blockchain events

### Frontend Implementations
- **Clean UI**: Minimal, professional interfaces
- **Interactive Physics**: Engaging visual feedback with Matter.js
- **Real-Time Updates**: WebSocket integration for instant updates
- **Responsive Design**: Works on desktop and mobile devices

## 🎯 What You'll Learn

### Core Concepts
1. **Universal Ethereum Accounts (UEAs)**: How to identify and work with users from different blockchains
2. **Cross-Chain Interaction**: How to create applications that seamlessly work across multiple blockchains
3. **Chain Attribution**: How to track and attribute user actions to their origin chains
4. **Event Handling**: How to listen for and respond to blockchain events in real-time

### Technical Skills
- Smart contract development with cross-chain features
- Frontend integration with PushChain UI Kit
- Physics engine integration (Matter.js)
- Real-time data visualization
- WebSocket event handling

### Design Patterns
- Hardcoded vs dynamic chain handling
- Clean UI design principles
- Interactive user experience design
- Cross-chain leaderboard systems

## 🚀 Quick Start

### 1. Deploy Smart Contracts

```bash
cd contracts
forge build
forge script script/Deploy.s.sol --rpc-url push_testnet --broadcast
```

### 2. Choose Your Frontend

#### Dynamic Analytics App
```bash
cd app
npm install
npm run dev
```

#### Interactive Ballsy Gaming App
```bash
cd ballsy-app
npm install
npm run dev
```

### 3. Update Contract Addresses

Update the contract addresses in each app's `src/App.tsx` file with your deployed contract address.

## 📋 Prerequisites

- **Node.js** (v16 or higher)
- **Foundry** for smart contract development
- **Basic knowledge** of React and TypeScript
- **Understanding** of blockchain concepts
- **PushChain testnet tokens** for deployment and testing

## 🔧 Configuration

### Contract Addresses
Each app needs the deployed contract address:
```typescript
const CONTRACT_ADDRESS = 'YOUR_DEPLOYED_CONTRACT_ADDRESS'
```

### RPC Endpoint
All apps use the PushChain testnet:
```typescript
const provider = new ethers.JsonRpcProvider(
  "https://evm.donut.rpc.push.org/"
);
```

## 🎮 User Experience Flow

1. **Connect Wallet**: Users connect using Push Universal Account Button
2. **Chain Detection**: System automatically detects user's origin chain
3. **Increment Counter**: Users click to increment their chain's counter
4. **Visual Feedback**: 
   - Basic app: Counter numbers update
   - Dynamic app: Data table updates with chain information
   - Ballsy app: Physics balls drop and leaderboard updates
5. **Real-Time Updates**: All users see live updates from other participants

## 🚨 Troubleshooting

### Common Issues
1. **Contract not found**: Ensure contract address is correct in all apps
2. **Transaction fails**: Check wallet connection and testnet tokens
3. **Physics not working**: Verify Matter.js integration in ballsy-app
4. **Real-time updates missing**: Check WebSocket connection

## 📚 Resources

- [PushChain Documentation](https://push.org/docs)
- [PushChain UI Kit](https://www.npmjs.com/package/@pushchain/ui-kit)
- [Matter.js Documentation](https://brm.io/matter-js/)
- [Foundry Documentation](https://book.getfoundry.sh/)

## 🚀 Next Steps

After completing this tutorial, you can:

- Explore advanced cross-chain patterns
- Add more interactive features to the physics simulation
- Implement token rewards for participation
- Create your own cross-chain applications
- Deploy to mainnet networks

---

**Ready to build universal applications! 🌍**
