# Universal ERC-20 Mint App

A beautiful React application demonstrating universal ERC-20 token minting with PushChain's Universal External Accounts. Users can mint $UNICORN tokens with an engaging UI featuring animated rainbow balance display.

👉 **Live Demo**: Experience cross-chain token minting in action!

## Overview

This frontend application provides an intuitive interface for minting $UNICORN tokens on PushChain. It showcases how users from any blockchain can seamlessly interact with ERC-20 tokens using Universal External Accounts, with a focus on beautiful user experience and real-time feedback.

## ✨ Features

- **Universal Token Minting**: Mint $UNICORN tokens from any supported blockchain
- **Animated Rainbow Balance**: Beautiful gradient animation on token balance display
- **Real-time Updates**: Live balance tracking after successful mints
- **Wallet Integration**: Seamless connection with Push Universal Account Button
- **Transaction Handling**: Proper loading states, error handling, and success feedback
- **Explorer Integration**: Direct links to view transactions on PushChain explorer
- **Responsive Design**: Clean, modern UI that works on desktop and mobile
- **TypeScript**: Fully typed for better development experience and reliability

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- A deployed Universal ERC-20 contract on PushChain testnet
- Compatible wallet (MetaMask, etc.) for testing

## Installation

1. Install dependencies:
```bash
npm install
```

2. Update the contract address in `src/App.tsx` (if needed):
```typescript
const CONTRACT_ADDRESS = '0x0165878A594ca255338adfa4d48449f69242Eb8F'
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to the local development URL
5. Connect your wallet and start minting $UNICORN tokens!

## Project Structure

```
app/
├── src/
│   ├── App.tsx          # Main application component
│   ├── App.css          # Application styles with rainbow animation
│   ├── index.css        # Global styles
│   └── abi/
│       └── ERC20.json   # ERC-20 contract ABI
├── package.json         # Dependencies and scripts
├── vite.config.ts       # Vite configuration
├── tsconfig.json        # TypeScript configuration
└── README.md           # This file
```

## Key Components

### App.tsx

The main application component that includes:

- **PushChain Hooks**: Uses `usePushWalletContext`, `usePushChainClient`, and `usePushChain`
- **State Management**: Manages token balance, loading states, errors, and transaction hashes
- **Contract Interaction**: Reads ERC-20 balance and sends mint transactions
- **UI Components**: Beautiful interface with animated balance display and minting controls
- **Rainbow Animation**: Stunning gradient animation on the token balance

### Contract Integration

The app demonstrates proper ERC-20 and PushChain integration patterns:

```typescript
// Reading ERC-20 balance
const provider = new ethers.JsonRpcProvider(
  "https://evm.rpc-testnet-donut-node1.push.org/"
);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ERC20ABI, provider);
const balance = await contract.balanceOf(userAddress);
const formattedBalance = ethers.formatUnits(balance, 18);

// Minting tokens
const tx = await pushChainClient.universal.sendTransaction({
  to: CONTRACT_ADDRESS,
  data: PushChain.utils.helpers.encodeTxData({
    abi: ERC20ABI,
    functionName: "mint",
    args: [userAddress, PushChain.utils.helpers.parseUnits("100", 18)]
  }),
  value: BigInt(0),
});
```

## Configuration

### Contract Address

The $UNICORN token contract is deployed at:

```typescript
const CONTRACT_ADDRESS = '0x0165878A594ca255338adfa4d48449f69242Eb8F'
```

### RPC Endpoint

The app uses the PushChain testnet RPC endpoint:

```typescript
const provider = new ethers.JsonRpcProvider(
  "https://evm.rpc-testnet-donut-node1.push.org/"
);
```

### Minting Configuration

- **Mint Amount**: 100 $UNICORN tokens per transaction
- **Token Decimals**: 18 (standard ERC-20)
- **Gas**: Automatically estimated by the wallet

## User Experience

1. **Page Load**: Token balance displays immediately (shows 0 for new users)
2. **Wallet Connection**: Click "Connect Account" to connect your wallet
3. **Token Minting**: Click "Mint 100 $UNICORN" to mint tokens
4. **Rainbow Animation**: Watch your balance animate with beautiful rainbow colors
5. **Real-time Updates**: Balance updates automatically after successful mints
6. **Transaction Tracking**: View transaction details on PushChain explorer

## 🌈 Rainbow Animation Feature

The app includes a stunning rainbow gradient animation on the token balance:

```css
@keyframes rainbow {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
```

The animation uses:
- 7-color rainbow gradient (red → orange → yellow → green → blue → indigo → violet)
- Smooth 3-second animation cycle
- WebKit text clipping for gradient text effect
- Bold font weight for enhanced visibility

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint for code quality

### Styling

The app uses a combination of inline styles and CSS classes:
- **Inline Styles**: Component-specific styling for layout and colors
- **CSS Classes**: Global animations and reusable styles in `App.css`
- **Design Principles**: Clean white background, centered layout, responsive design
- **Animations**: CSS keyframes for smooth rainbow gradient effects
- **Typography**: Clear visual hierarchy with proper font sizes and weights

## Dependencies

Key dependencies include:

- **@pushchain/ui-kit**: PushChain UI components and hooks for wallet connection
- **ethers**: Ethereum library for blockchain interactions and ERC-20 operations
- **react**: Frontend framework for building the user interface
- **typescript**: Type safety and better development experience
- **vite**: Fast build tool and development server

### Development Dependencies

- **@vitejs/plugin-react**: React support for Vite
- **@types/react**: TypeScript definitions for React
- **tailwindcss**: Utility-first CSS framework
- **eslint**: Code linting and quality assurance

## Troubleshooting

### Common Issues

1. **"Transaction failed"**:
   - Ensure you have sufficient gas (ETH) for the transaction
   - Check that you're connected to PushChain testnet
   - Verify the contract address is correct

2. **"Balance not updating"**:
   - Wait for transaction confirmation (usually 1-2 blocks)
   - Refresh the page if the balance doesn't update automatically
   - Check the transaction hash on the explorer

3. **"Wallet connection issues"**:
   - Make sure you have a compatible wallet installed (MetaMask recommended)
   - Try refreshing the page and reconnecting
   - Clear browser cache if connection persists to fail

4. **"Rainbow animation not showing"**:
   - Ensure your browser supports CSS gradients and animations
   - Check if you have reduced motion settings enabled
   - Try a different browser if issues persist

### Error Messages

The app provides clear error messages for:
- Wallet connection failures
- Transaction rejections
- Network connectivity issues
- Contract interaction problems

## Next Steps

After running this tutorial, you can:

- **Add More Features**: Implement token burning, transfer functionality, or allowances
- **Enhance UI/UX**: Add more animations, charts showing mint history, or user analytics
- **Token Utilities**: Create staking mechanisms, governance voting, or reward systems
- **DeFi Integration**: Build DEX pools, lending protocols, or yield farming features
- **Multi-chain Support**: Extend to other chains supported by PushChain
- **Production Deployment**: Deploy to mainnet with proper security audits

## 🎯 Learning Outcomes

By completing this tutorial, you've learned:

- How to integrate ERC-20 tokens with React applications
- PushChain Universal External Account patterns
- Modern UI/UX design with CSS animations
- Real-time blockchain interaction patterns
- Error handling and user feedback in DeFi applications
- Transaction lifecycle management in web3 apps

## Resources

- [PushChain Documentation](https://push.org/docs)
- [PushChain UI Kit](https://www.npmjs.com/package/@pushchain/ui-kit)
- [ERC-20 Token Standard](https://eips.ethereum.org/EIPS/eip-20)
- [Ethers.js Documentation](https://docs.ethers.org/)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [CSS Animations Guide](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Animations)

---

**Happy Minting with $UNICORN! 🦄✨**
