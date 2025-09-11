# Universal Airdrop Tutorial

A tutorial demonstrating how to create a cross-chain airdrop system on Push Chain using Universal External Accounts (UEA) and Merkle proofs.

## 🌟 Overview

This tutorial showcases how to build a universal airdrop contract that allows users from different blockchain networks (Ethereum, Solana, etc.) to claim tokens on Push Chain. The system uses:

- **Universal External Accounts (UEA)** for cross-chain identity verification
- **Merkle proofs** for efficient and secure airdrop distribution

## 🚀 Quick Start

### Installation

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Set up environment variables**:
   Create a `.env` file and add your private key:

   ```env
   PRIVATE_KEY=your_private_key_here
   ```

### Deployment

To deploy the contracts, run:

```bash
npx hardhat run scripts/deploy.ts --network pushDonut
```

## 📋 Contract Details

### UniversalAirdrop Contract

**Key Features:**

- Cross-chain recipient verification using UEA
- Merkle proof-based claim verification
- Owner controls for Merkle root updates

**Main Functions:**

```solidity
function claim(
    bytes32[] calldata proof,
    uint256 amount,
    string calldata chainNamespace,
    string calldata chainId
) external nonReentrant
```

### TestToken Contract

A simple ERC20 token with:

- Initial supply of 1,000,000 tokens
- Public mint function for testing
- Standard ERC20 functionality

## 🔧 Configuration

### Airdrop Recipients

Edit `data/airdrop.json` to define recipients:

```json
[
  {
    "recipient": "0xFd6C2fE69bE13d8bE379CCB6c9306e74193EC1A9",
    "chainNamespace": "eip155",
    "chainId": "11155111",
    "amount": "10000000000000000000"
  }
]
```

**Supported Chain Namespaces:**

- `eip155`: Ethereum-compatible chains (Ethereum, Polygon, etc.)
- `solana`: Solana blockchain
- `push`: Push Chain native accounts

## 🚨 Troubleshooting

### Common Issues

1. **"No accounts available"**:
   - Check your `.env` file has a valid `PRIVATE_KEY`
   - Ensure the private key has testnet tokens

2. **"Invalid Merkle proof"**:
   - Verify the recipient data matches exactly
   - Check that the Merkle root is correct

3. **"Already claimed"**:
   - Each (address, chainNamespace, chainId) can only claim once

---

**Happy Building! 🚀**
