# Universal ERC-20 Mint Tutorial

A tutorial demonstrating how to create a universal ERC-20 token minting system that works across different chains using PushChain's Universal External Accounts (UEA).

## 🌟 Overview

This tutorial showcases how to build a universal ERC-20 token contract that allows users from different blockchain networks (Ethereum, Solana, etc.) to mint tokens on Push Chain. The system uses:

- **Universal External Accounts (UEA)** for cross-chain identity verification
- **ERC-20 token standards** for compatibility
- **Cross-chain minting mechanisms** for universal access

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

### Deployment

To deploy the contracts, run:

```bash
forge script script/Deploy.s.sol --rpc-url push_testnet --broadcast
```

## 📋 Contract Details

### Universal ERC-20 Mint Contract

**Key Features:**

- Cross-chain minting using UEA
- Standard ERC-20 functionality
- Owner controls for minting permissions
- Chain attribution for minted tokens

**Main Functions:**

```solidity
function mint(
    address to,
    uint256 amount,
    string calldata chainNamespace,
    string calldata chainId
) external
```

## 🔧 Configuration

### Minting Parameters

The contract supports minting with chain attribution:

- `to`: Recipient address
- `amount`: Amount of tokens to mint
- `chainNamespace`: Chain namespace (e.g., "eip155", "solana", "push")
- `chainId`: Specific chain identifier

**Supported Chain Namespaces:**

- `eip155`: Ethereum-compatible chains (Ethereum, Polygon, etc.)
- `solana`: Solana blockchain
- `push`: Push Chain native accounts

## 🎯 What You'll Learn

- How to create universal ERC-20 tokens
- Cross-chain token minting patterns
- Universal External Account integration
- Token distribution mechanisms
- Chain attribution in token contracts

## 📁 Project Structure

```
universal-erc-20-mint/
├── contracts/              # Smart contract code
│   ├── src/
│   │   └── UniversalERC20.sol  # Universal ERC-20 contract
│   ├── script/
│   │   └── Deploy.s.sol    # Deployment script
│   ├── foundry.toml        # Foundry configuration
│   └── README.md           # Contract-specific instructions
└── README.md               # This file
```

## 🚨 Troubleshooting

### Common Issues

1. **"Insufficient permissions"**:
   - Check that the caller has minting permissions
   - Verify the contract owner settings

2. **"Invalid chain parameters"**:
   - Ensure chainNamespace and chainId are valid
   - Check supported chain formats

3. **"Token transfer failed"**:
   - Verify recipient address is valid
   - Check token balance and allowances

## 📚 Prerequisites

- Foundry for smart contract development
- Basic knowledge of ERC-20 tokens
- Understanding of cross-chain concepts
- Familiarity with PushChain UEA system

## 🔗 Resources

- [ERC-20 Token Standard](https://eips.ethereum.org/EIPS/eip-20)
- [PushChain Documentation](https://push.org/docs)
- [Foundry Documentation](https://book.getfoundry.sh/)

## 🚀 Next Steps

After completing this tutorial, you can:

- Explore advanced token features (burning, pausing, etc.)
- Add governance mechanisms
- Implement token vesting schedules
- Create token distribution strategies

---

**Happy Building! 🚀**
