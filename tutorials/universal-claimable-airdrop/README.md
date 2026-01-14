# Universal Claimable Airdrop Tutorial

A comprehensive tutorial demonstrating how to create a cross-chain claimable airdrop system using Merkle proofs and Universal Executor Accounts (UEA) on PushChain.

👉 **Full Tutorial**: [Read the step-by-step guide on Push.org](https://push.org/docs/chain/tutorials/token-systems/tutorial-universal-airdrop/)

## 🌟 Overview

This tutorial showcases how to build a universal airdrop system that allows users from any supported blockchain (Ethereum, Solana, Base, etc.) to claim their token allocation on Push Chain. The system uses:

- **Universal Executor Accounts (UEA)** for deterministic cross-chain addresses
- **Merkle Tree Proofs** for efficient and secure claim verification
- **Factory Pattern** for easy deployment of multiple airdrop campaigns
- **$UNICORN ERC-20 Token** for airdrop distribution

## 🚀 Quick Start

### Installation

1. **Navigate to contracts directory**:
   ```bash
   cd contracts
   ```

2. **Install dependencies**:
   ```bash
   forge install
   ```

3. **Navigate to app directory**:
   ```bash
   cd ../app
   ```

4. **Install frontend dependencies**:
   ```bash
   npm install
   ```

### Deployment

**Deploy the Factory Contract:**

```bash
cd contracts
forge create src/UniversalAirdropFactory.sol:UniversalAirdropFactory \
  --rpc-url push_testnet \
  --chain 42101 \
  --account myKeystore \
  --broadcast
```

**Run the Frontend Application:**

```bash
cd app
npm run dev
```

## 📋 Contract Details

### UniversalAirdropFactory

The factory contract that deploys individual airdrop instances:

**Key Features:**
- Deploys new `UniversalAirdrop` contracts
- Automatically mints $UNICORN tokens to each airdrop
- Emits events for tracking deployments
- Simplifies multi-campaign management

**Main Function:**

```solidity
function createAirdrop(
    uint256 totalAmount,
    bytes32 merkleRoot
) external returns (address)
```

### UniversalAirdrop

The airdrop contract that handles claims:

**Key Features:**
- Merkle proof verification using OpenZeppelin
- Prevents double-claiming
- Supports cross-chain claimers via UEA
- Owner controls for merkle root updates

**Main Functions:**

```solidity
function claim(uint256 amount, bytes32[] calldata merkleProof) external
function hasClaimed(address account) external view returns (bool)
```

## 🔧 Configuration

### Contract Addresses

**Factory Contract**: `0xa82fF9aFd8f496c3d6ac40E2a0F282E47488CFc9`  
**$UNICORN Token**: `0x0165878A594ca255338adfa4d48449f69242Eb8F`

### Supported Chains

- Push Chain Testnet
- Ethereum Sepolia
- Solana Devnet
- Base Sepolia
- Arbitrum Sepolia

## 🎯 What You'll Learn

- How to convert addresses from multiple chains to Universal Executor Addresses (UEA)
- Merkle tree generation and proof verification with OpenZeppelin
- Factory pattern for contract deployment
- Cross-chain token claiming mechanisms
- Frontend integration with PushChain UI Kit
- Multi-wallet management in React applications

## 📁 Project Structure

```
universal-claimable-airdrop/
├── contracts/                      # Smart contract code
│   ├── src/
│   │   └── UniversalAirdropFactory.sol  # Factory and Airdrop contracts
│   ├── foundry.toml                # Foundry configuration
│   └── README.md                   # Contract-specific instructions
├── app/                            # Frontend application
│   ├── src/
│   │   ├── App.tsx                 # Main React component
│   │   ├── main.tsx                # Entry point with wallet providers
│   │   └── abi/                    # Contract ABIs
│   ├── package.json                # Frontend dependencies
│   └── README.md                   # Frontend documentation
└── README.md                       # This file
```

## 🎓 Tutorial Steps

### Step 1: Add Wallets
- Select chain for each address
- Enter wallet addresses with allocation amounts
- Automatically converts to Universal Executor Addresses (UEA)
- Preview converted addresses

### Step 2: Generate Merkle Tree
- Reviews all eligible addresses and amounts
- Generates Merkle tree using OpenZeppelin's StandardMerkleTree
- Creates Merkle root for contract deployment
- Displays tree data

### Step 3: Deploy Airdrop Contract
- Connect deployer wallet
- Deploy via UniversalAirdropFactory
- Automatically mints $UNICORN tokens
- Extracts deployed contract address from events

### Step 4: Claim Airdrop
- Connect claimer wallet from any supported chain
- Automatic eligibility and claim status checking
- Manual address lookup for any chain
- Claim tokens with Merkle proof verification

## 🚨 Troubleshooting

### Common Issues

1. **"Invalid proof" error**:
   - Ensure Merkle tree uses same format as contract (double hashing)
   - Verify address and amount match the tree entry exactly

2. **"Already claimed" error**:
   - Check claim status before attempting transaction
   - UI automatically updates to show claimed status

3. **"Address not found" error**:
   - Verify address was included in original Merkle tree
   - Check that address conversion to UEA was correct

4. **Transaction fails**:
   - Ensure wallet is connected to correct network
   - Verify contract has sufficient token balance

## 📚 Prerequisites

- **For Contracts**:
  - Foundry for smart contract development
  - Basic knowledge of Solidity and Merkle trees
  - Understanding of factory patterns

- **For Frontend**:
  - Node.js (v16 or higher)
  - React knowledge
  - Familiarity with ethers.js

## 🔗 Resources

- [PushChain Documentation](https://push.org/docs)
- [OpenZeppelin Merkle Tree](https://www.npmjs.com/package/@openzeppelin/merkle-tree)
- [PushChain UI Kit](https://www.npmjs.com/package/@pushchain/ui-kit)
- [Foundry Documentation](https://book.getfoundry.sh/)
- [Factory Contract on Blockscout](https://donut.push.network/address/0xa82fF9aFd8f496c3d6ac40E2a0F282E47488CFc9?tab=contract)

## 🚀 Next Steps

After completing this tutorial, you can:

- Deploy your own airdrop campaigns with custom tokens
- Implement time-based claiming windows
- Add whitelist or eligibility criteria
- Create multi-phase airdrops
- Integrate with governance systems
- Build custom claim interfaces

---

**Happy Building! 🚀**
