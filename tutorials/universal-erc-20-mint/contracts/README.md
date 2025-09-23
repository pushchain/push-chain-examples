# Universal ERC-20 Mint Smart Contracts

This folder contains the smart contracts for the Universal ERC-20 Mint tutorial, demonstrating how to create and deploy a mintable ERC-20 token ($UNICORN) on PushChain that can be accessed by users from any blockchain.

👉 **Live Contract**: `0x0165878A594ca255338adfa4d48449f69242Eb8F`

## Overview

The Universal ERC-20 Mint tutorial showcases how to build a standard ERC-20 token with minting capabilities on PushChain. This contract enables users from different blockchain networks (Ethereum, Solana, etc.) to mint $UNICORN tokens using PushChain's Universal External Accounts.

## Contracts

### UniversalERC20.sol

The main ERC-20 token contract that provides:
- Standard ERC-20 functionality (transfer, approve, allowance)
- Minting capabilities for authorized addresses
- Owner-controlled minting permissions
- Full compatibility with existing ERC-20 tools and wallets
- Event emission for all standard ERC-20 operations

## Key Features

- **Standard ERC-20**: Full compliance with ERC-20 token standard
- **Minting Functionality**: Owner can mint tokens to any address
- **Universal Access**: Works seamlessly with PushChain's Universal External Accounts
- **Security**: Built with OpenZeppelin's battle-tested contracts
- **Wallet Compatible**: Works with MetaMask, Trust Wallet, and other ERC-20 wallets
- **DeFi Ready**: Can be integrated into DEXs, lending protocols, and other DeFi applications

## Development

This project uses [Foundry](https://book.getfoundry.sh/) for smart contract development and deployment.

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Basic understanding of ERC-20 tokens
- PushChain testnet setup

### Building

```bash
forge build
```

### Testing

```bash
forge test
```

### Local Development

```bash
# Start local anvil node
anvil

# Deploy to local network
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast
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
forge verify-contract <CONTRACT_ADDRESS> src/UniversalERC20.sol:UniversalERC20 --rpc-url push_testnet
```

### Constructor Arguments

The contract requires constructor arguments for deployment:

```solidity
constructor(
    string memory name,     // Token name: "Unicorn Token"
    string memory symbol    // Token symbol: "UNICORN"
)
```

Example deployment with constructor args:

```bash
forge create src/UniversalERC20.sol:UniversalERC20 \
    --constructor-args "Unicorn Token" "UNICORN" \
    --rpc-url push_testnet \
    --private-key <YOUR_PRIVATE_KEY>
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

```

## Contract Interface

### Core ERC-20 Functions

```solidity
// Standard ERC-20 functions
function balanceOf(address account) external view returns (uint256);
function transfer(address to, uint256 amount) external returns (bool);
function approve(address spender, uint256 amount) external returns (bool);
function allowance(address owner, address spender) external view returns (uint256);
function transferFrom(address from, address to, uint256 amount) external returns (bool);

// Token metadata
function name() external view returns (string memory);
function symbol() external view returns (string memory);
function decimals() external view returns (uint8);
function totalSupply() external view returns (uint256);
```

### Minting Functions

```solidity
// Mint tokens to specified address (owner only)
function mint(address to, uint256 amount) external onlyOwner;
```

### Events

```solidity
event Transfer(address indexed from, address indexed to, uint256 value);
event Approval(address indexed owner, address indexed spender, uint256 value);
```

## Integration with Frontend

The frontend application in the `../app` directory connects to this contract to:
- Display user's $UNICORN token balance
- Allow users to mint new tokens
- Show transaction history and status
- Provide links to view transactions on PushChain explorer

## Example Usage

Once deployed, you can interact with the contract:

### Reading Token Information

```javascript
// Get token balance
const balance = await contract.balanceOf(userAddress);
const formattedBalance = ethers.formatUnits(balance, 18);

// Get token metadata
const name = await contract.name();        // "Unicorn Token"
const symbol = await contract.symbol();    // "UNICORN"
const decimals = await contract.decimals(); // 18
const totalSupply = await contract.totalSupply();
```

### Minting Tokens (Owner Only)

```javascript
// Mint 100 tokens to user address
const mintAmount = ethers.parseUnits("100", 18);
const tx = await contract.mint(userAddress, mintAmount);
await tx.wait();
```

### Standard ERC-20 Operations

```javascript
// Transfer tokens
const transferAmount = ethers.parseUnits("10", 18);
const tx = await contract.transfer(recipientAddress, transferAmount);

// Approve spending
const approveAmount = ethers.parseUnits("50", 18);
const tx = await contract.approve(spenderAddress, approveAmount);
```

## Deployed Contract

### PushChain Testnet

- **Contract Address**: `0x0165878A594ca255338adfa4d48449f69242Eb8F`
- **Token Name**: Unicorn Token
- **Token Symbol**: UNICORN
- **Decimals**: 18
- **Network**: PushChain Testnet

### Adding to Wallet

To add $UNICORN to your wallet:

1. Open your wallet (MetaMask, etc.)
2. Go to "Add Token" or "Import Token"
3. Select "Custom Token"
4. Enter contract address: `0x0165878A594ca255338adfa4d48449f69242Eb8F`
5. Token symbol and decimals should auto-populate
6. Click "Add Token"

### Frontend Integration

Update the contract address in your frontend application:

```typescript
const CONTRACT_ADDRESS = '0x0165878A594ca255338adfa4d48449f69242Eb8F'
