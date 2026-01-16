# Universal Claimable Airdrop App

A comprehensive React application demonstrating a cross-chain claimable airdrop system using Merkle proofs and Universal Executor Accounts (UEA) on PushChain. This tutorial shows how users from any supported chain can claim their airdrop allocation seamlessly.

👉 Full Tutorial: [Read the step-by-step guide on Push.org](https://push.org/docs/chain/tutorials/token-systems/tutorial-universal-airdrop/)

## Overview

This frontend application provides a complete 4-step tutorial interface for creating and managing a universal claimable airdrop. It demonstrates how to convert addresses from multiple chains to Universal Executor Addresses (UEA), generate Merkle trees for efficient verification, deploy airdrop contracts, and enable cross-chain claiming.

## Features

- **Multi-Wallet Support**: Separate wallet connections for deployer and claimer roles
- **Cross-Chain Address Conversion**: Convert addresses from Ethereum, Solana, Base, and other chains to UEA
- **Merkle Tree Generation**: Uses OpenZeppelin's StandardMerkleTree for secure proof generation
- **Factory Contract Deployment**: Deploy airdrop contracts via the UniversalAirdropFactory
- **Claim Verification**: Check eligibility and claim status before attempting transactions
- **Manual Address Lookup**: Query eligibility for any address from any supported chain
- **Collapsible UI**: Clean interface with expandable Merkle tree data section
- **Real-time Status Updates**: Automatic claim status checking and UI updates

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- A deployed UniversalAirdropFactory contract on PushChain testnet

## Installation

1. Install dependencies:
```bash
npm install
```

2. Update the factory contract address in `src/App.tsx`:
```typescript
const FACTORY_ADDRESS = '0xf5059a5D33d5853360D16C683c16e67980206f36'
```

3. Start the development server:
```bash
npm run dev
```

## Project Structure

```
app/
├── src/
│   ├── App.tsx                          # Main application component
│   ├── main.tsx                         # App entry with nested wallet providers
│   └── abi/
│       ├── UniversalAirdropFactory.json # Factory contract ABI
│       └── UniversalAirdrop.json        # Airdrop contract ABI
├── package.json                         # Dependencies and scripts
└── README.md                           # This file
```

## Tutorial Steps

### Step 1: Add Wallets

- Select chain (Ethereum, Solana, Base, etc.)
- Enter wallet addresses with allocation amounts
- Automatically converts to Universal Executor Addresses (UEA)
- Preview converted addresses with their deterministic UEA addresses

### Step 2: Generate Merkle Tree

- Reviews all eligible addresses and amounts
- Generates Merkle tree using OpenZeppelin's StandardMerkleTree
- Creates Merkle root for contract deployment
- Displays tree data with collapsible interface

### Step 3: Deploy Airdrop Contract

- Connect deployer wallet
- Deploy via UniversalAirdropFactory
- Automatically mints $UNICORN tokens to the airdrop contract
- Extracts deployed contract address from event logs

### Step 4: Claim Airdrop

- **Deployment Successful Section**:
  - Shows deployed contract address
  - Collapsible Merkle tree data (root + eligible addresses JSON)
  
- **Test Claim Section**:
  - Connect claimer wallet
  - Automatic eligibility check with claim status
  - Manual address lookup for any chain
  - Claim button (disabled if already claimed)

## Key Components

### Nested Wallet Providers

The app uses nested `PushUniversalWalletProvider` components for separate deployer and claimer wallets:

```typescript
<PushUniversalWalletProvider uid="AirdropDeployer">
  <PushUniversalWalletProvider uid="AirdropClaimer">
    <App />
  </PushUniversalWalletProvider>
</PushUniversalWalletProvider>
```

### Address Conversion

Converts origin addresses to Universal Executor Addresses:

```typescript
const account = PushChain.utils.account.toUniversal(address, { chain });
const executorAddress = await PushChain.utils.account.convertOriginToExecutor(account);
```

### Merkle Tree Generation

Uses OpenZeppelin's StandardMerkleTree with double hashing to match contract verification:

```typescript
const tree = StandardMerkleTree.of(
  convertedAddresses.map(([addr, amt]) => [addr, amt]),
  ["address", "uint256"]
);
const merkleRoot = tree.root;
```

### Claim Verification

Checks if address has already claimed before attempting transaction:

```typescript
const provider = new ethers.JsonRpcProvider("https://evm.donut.rpc.push.org/");
const contract = new ethers.Contract(deployedAirdropAddress, UniversalAirdropABI, provider);
const hasClaimed = await contract.hasClaimed(claimerAddress);
```

### Merkle Proof Generation

Generates proof for specific address and amount:

```typescript
for (const [i, v] of merkleTree.tree.entries()) {
  if (v[0].toLowerCase() === claimAddr.toLowerCase()) {
    proof = merkleTree.tree.getProof(i);
    break;
  }
}
```

## Configuration

### Contract Addresses

**Factory Contract**: `0xf5059a5D33d5853360D16C683c16e67980206f36`  
**$UNICORN Token**: `0x0165878A594ca255338adfa4d48449f69242Eb8F`

### RPC Endpoint

The app uses the PushChain testnet RPC endpoint:

```typescript
const provider = new ethers.JsonRpcProvider("https://evm.donut.rpc.push.org/");
```

### Supported Chains

- Push Chain Testnet
- Ethereum Sepolia
- Solana Devnet
- Base Sepolia
- Arbitrum Sepolia
- Optimism Sepolia
- Polygon Amoy

## User Experience

### Deployer Flow

1. Navigate through Steps 1-3
2. Add eligible addresses with amounts
3. Generate Merkle tree
4. Deploy airdrop contract
5. Share contract address with claimers

### Claimer Flow

1. Go to Step 4
2. Connect wallet from any supported chain
3. Check eligibility (automatic or manual lookup)
4. Claim tokens if eligible and not already claimed
5. See "Already Claimed ✓" status after successful claim

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Styling

The app uses inline styles with:
- Clean white background
- Step-based navigation
- Color-coded sections (blue for deployment, orange for claiming)
- Responsive design
- Collapsible sections for advanced data

## Dependencies

Key dependencies include:

- **@pushchain/ui-kit**: PushChain UI components and hooks
- **@openzeppelin/merkle-tree**: Merkle tree generation and proof verification
- **ethers**: Ethereum library for blockchain interactions
- **react**: Frontend framework
- **typescript**: Type safety
- **vite**: Build tool and development server

## Troubleshooting

### Common Issues

1. **Invalid proof error**: Ensure Merkle tree uses same format as contract (double hashing)
2. **Already claimed error**: Check claim status before attempting transaction
3. **Address not found**: Verify address was included in original Merkle tree
4. **Transaction fails**: Check wallet connection and network

### Error Messages

The app provides clear error messages for:
- Wallet connection issues
- Transaction failures
- Contract interaction problems
- Claim status verification

## Next Steps

After completing this tutorial, you can:

- Deploy your own airdrop campaigns
- Customize token amounts and eligibility criteria
- Add more supported chains
- Implement time-based claiming windows
- Create multi-phase airdrops

## Resources

- [PushChain Documentation](https://push.org/docs)
- [PushChain UI Kit](https://www.npmjs.com/package/@pushchain/ui-kit)
- [OpenZeppelin Merkle Tree](https://www.npmjs.com/package/@openzeppelin/merkle-tree)
- [Smart Contract Source Code](https://github.com/pushchain/push-chain-examples/tree/main/tutorials/universal-claimable-airdrop/contracts)
- [Factory Contract on Blockscout](https://donut.push.network/address/0xf5059a5D33d5853360D16C683c16e67980206f36?tab=contract)
