# Ballsy App - Universal Counter Game

An interactive React application that gamifies cross-chain interaction using PushChain's Universal Ethereum Account (UEA) system. This app transforms the Universal Counter into an engaging physics-based game where users compete for leaderboard glory across different blockchains.

👉 Full Tutorial: [Read the step-by-step guide on Push.org](https://push.org/docs/chain/tutorials/universal-counter/)

## 🎮 Overview

Ballsy is the most engaging implementation of the Universal Counter tutorial. It combines cross-chain blockchain interaction with interactive physics to create a competitive gaming experience where every chain battles for glory.

**The Concept**: "Ballsy lets every chain battle for glory 🏆. No matter if you're on Ethereum, Solana, or Push Chain, your clicks count towards your chain's leaderboard. One app, shared across all chains."

## ✨ Features

### Gaming Experience
- **Interactive Physics Simulation**: Matter.js-powered balls that drop, bounce, and can be dragged
- **Cross-Chain Competition**: Real-time leaderboard showing which chain is winning
- **Chain-Colored Balls**: Visual feedback with different colors for each blockchain
- **Draggable Physics**: Click and drag balls around the screen with realistic physics

### Blockchain Integration
- **Cross-Chain Interaction**: Connect with wallets from Ethereum, Solana, or PushChain
- **Universal Counter Logic**: Automatic chain detection and attribution
- **Real-Time Updates**: WebSocket integration for instant leaderboard updates
- **Chain-Specific Counters**: Track separate counts and unique users for each blockchain

### User Experience
- **Frosted Glass UI**: Modern backdrop blur effects for the leaderboard
- **Responsive Design**: Works seamlessly on desktop and mobile
- **Interactive Feedback**: Balls drop on every counter increment
- **Competitive Elements**: See your chain's ranking in real-time

## 🛠️ Technology Stack

- **Frontend**: React with TypeScript
- **Build Tool**: Vite
- **Physics Engine**: Matter.js for realistic ball physics
- **Blockchain Integration**: ethers.js and PushChain SDK
- **UI Components**: PushChain UI Kit
- **Styling**: CSS with backdrop-filter effects
- **Real-Time**: WebSocket event subscriptions

## 🚀 Installation

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

## 🎯 How to Play

1. **Connect Your Wallet**: Click "Connect Account" to connect your universal wallet
2. **Join the Battle**: Your chain is automatically detected (Ethereum, Solana, or Push Chain)
3. **Increment to Win**: Click "Increment Counter" to add points for your chain
4. **Watch the Physics**: Colored balls drop and bounce with realistic physics:
   - **Blue balls** for Ethereum users
   - **Purple balls** for Solana users  
   - **Green balls** for Push Chain users
5. **Interact & Play**: Drag balls around the screen, throw them, and watch them bounce
6. **Compete for Glory**: Check the leaderboard to see which chain is winning!

## 📁 Project Structure

```
ballsy-app/
├── src/
│   ├── App.tsx              # Main game component with leaderboard
│   ├── Matter.tsx           # Physics engine integration
│   ├── App.css              # Styling with backdrop blur effects
│   └── abi/
│       └── UniversalCounter.json # Contract ABI
├── package.json             # Dependencies and scripts
└── README.md               # This file
```

## 🔧 Key Components

### App.tsx - Game Logic
- **Leaderboard System**: Real-time chain rankings with frosted glass UI
- **Chain Detection**: Automatic user chain attribution
- **Ball Drop Logic**: Triggers physics balls on counter increments
- **WebSocket Integration**: Live updates from other players
- **Responsive Design**: Mobile-friendly leaderboard

### Matter.tsx - Physics Engine
- **Matter.js Integration**: Realistic physics simulation
- **Interactive Balls**: Draggable with mouse constraints
- **Chain-Colored Balls**: Visual feedback for different blockchains
- **Boundary Physics**: Balls bounce off screen edges and UI elements
- **Performance Optimized**: Smooth 60fps physics rendering

## 🎮 Game Mechanics

### Scoring System
- Each increment adds **1 point** to your chain's total
- **Unique users** are tracked separately for each chain
- **Real-time leaderboard** shows current standings

### Physics Interactions
- **Ball Drops**: One ball drops per increment
- **Drag & Throw**: Click and drag balls to throw them around
- **Realistic Physics**: Balls bounce, roll, and interact naturally
- **Chain Colors**: Visual identification of which chain each ball represents

### Competitive Elements
- **Live Leaderboard**: See which chain is currently winning
- **Cross-Chain Battle**: Users from all chains compete in the same space
- **Real-Time Updates**: Instant updates when other players increment

## 🔗 Smart Contract Integration

This app connects to the Universal Counter smart contract deployed on PushChain:

- **Chain Attribution**: Automatically detects user's origin chain
- **Counter Logic**: Increments appropriate chain counters
- **Event Emission**: Real-time updates via blockchain events
- **Cross-Chain Support**: Works with Ethereum, Solana, and Push Chain users

Contract source code is available in the `../contracts` directory.

## 🛠️ Development

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Configuration
Update the contract address in `src/App.tsx`:
```typescript
const CONTRACT_ADDRESS = 'YOUR_DEPLOYED_CONTRACT_ADDRESS'
```

### Physics Customization
Modify physics parameters in `Matter.tsx`:
- Ball size, bounce, and friction
- Gravity and air resistance
- Mouse interaction sensitivity

## 🚨 Troubleshooting

### Common Issues
1. **Balls not dropping**: Check Matter.js integration and canvas setup
2. **Physics not interactive**: Verify mouse constraint and pointer events
3. **Leaderboard not updating**: Check WebSocket connection and contract events
4. **Performance issues**: Reduce ball count or physics complexity

## 🎨 Customization

### Visual Themes
- Modify ball colors in `Matter.tsx`
- Adjust backdrop blur effects in `App.css`
- Customize leaderboard styling

### Game Mechanics
- Change ball drop frequency
- Adjust physics parameters
- Add new interactive elements

## 🚀 Deployment

The app can be deployed to any static hosting service:
```bash
npm run build
# Deploy the dist/ folder to your hosting service
```

## 📚 Resources

- [Matter.js Documentation](https://brm.io/matter-js/)
- [PushChain UI Kit](https://www.npmjs.com/package/@pushchain/ui-kit)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)

---

**Ready to battle for chain supremacy! 🏆**
