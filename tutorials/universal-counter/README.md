# Universal Counter Tutorial

A tutorial demonstrating cross-chain interaction using PushChain's Universal Ethereum Account (UEA) system. This project showcases how users from different blockchains (Ethereum, Solana, and PushChain) can interact with the same smart contract seamlessly.

👉 Full Tutorial: [Read the step-by-step guide on Push.org](https://push.org/docs/chain/tutorials/universal-counter/)

## 🌟 Overview

The Universal Counter is a full-stack application that demonstrates PushChain's cross-chain capabilities:

1. **Cross-Chain User Attribution**: Automatically identifies users' origin chains (Ethereum, Solana, or PushChain)
2. **Universal Counter Logic**: Maintains separate counters for each blockchain
3. **Clean Frontend Interface**: Simple, elegant counter display
4. **Real-Time Updates**: WebSocket integration for instant counter updates across all users

## 📁 Project Structure

This tutorial includes a clean implementation of cross-chain counter functionality:

```
universal-counter/
├── contracts/              # Smart contracts
│   ├── src/
│   │   └── UniversalCounter.sol # Cross-chain counter contract
│   └── README.md
├── app/                    # Frontend application
│   ├── src/
│   │   └── App.tsx         # Counter UI with cross-chain support
│   └── README.md
└── README.md              # This file
```

## 🚀 Application Overview

### **Universal Counter App** (`app/`)
Clean, minimal interface showing:
- Total universal count across all chains
- Individual chain counters (ETH, Sol, PC)
- Simple increment functionality
- Cross-chain user attribution

## ✨ Key Features

### Cross-Chain Capabilities
- **Universal Ethereum Accounts (UEAs)**: Leverages PushChain's UEA system to identify users' origin chains
- **Chain Attribution**: Automatically detects whether a user is from Ethereum, Solana, or PushChain
- **Universal Access**: Users from any supported chain can interact with the same contract

### Smart Contract Features
- **Cross-Chain Support**: Handles Ethereum, Solana, and Push Chain users
- **Chain Attribution**: Automatically detects user origin chains
- **Event Emission**: Real-time updates through blockchain events

### Frontend Features
- **Clean UI**: Minimal, professional interface
- **Real-Time Updates**: WebSocket integration for instant updates
- **Responsive Design**: Works on desktop and mobile devices
- **Cross-Chain Display**: Shows counters for all supported chains

## 🎯 What You'll Learn

### Core Concepts
1. **Universal Ethereum Accounts (UEAs)**: How to identify and work with users from different blockchains
2. **Cross-Chain Interaction**: How to create applications that seamlessly work across multiple blockchains
3. **Chain Attribution**: How to track and attribute user actions to their origin chains
4. **Event Handling**: How to listen for and respond to blockchain events in real-time

### Technical Skills
- Smart contract development with cross-chain features
- Frontend integration with PushChain UI Kit
- Real-time data visualization
- WebSocket event handling

### Design Patterns
- Cross-chain user attribution
- Clean UI design principles
- Real-time counter updates
- Chain-specific data display

## 🚀 Quick Start

### 1. Deploy Smart Contracts

```bash
cd contracts
forge build
forge script script/Deploy.s.sol --rpc-url push_testnet --broadcast
```

### 2. Run the Frontend App

```bash
cd app
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
  "https://evm.rpc-testnet-donut-node1.push.org/"
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
