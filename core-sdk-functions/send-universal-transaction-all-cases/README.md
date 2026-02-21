# Universal Transaction Test Suite - All 22 Routes

Comprehensive test suite for Push Chain's Universal Transaction system covering all 22 transaction routes across Ethereum and Solana chains, with automated testing for both existing and new user scenarios.

- [Push Chain Documentation](https://push.org/docs/chain)

## 🚀 Quick Start

```bash
npm install
npm start
```

## 📋 Overview

This example tests **all 22 transaction routes** for both **Ethereum Sepolia** and **Solana Devnet**. The test suite automatically handles both **existing users** (deterministic UEA) and **new users** (fresh wallets for each test).

### 22 Transaction Routes

1. **Value to self** - Send native token value to your own address
2. **Value to others** - Send native token value to another address
3. **Funds to self** - Transfer USDT to your own address
4. **Funds to others** - Transfer USDT to another address
5. ~~**Data to self**~~ - ❌ SKIPPED (Can't execute data on your own UEA)
6. **Data to others** - Execute contract call (increment counter)
7. **Value + Funds to self** - Send value and USDT to yourself
8. **Value + Funds to others** - Send value and USDT to another address
9. ~~**Value + Data to self**~~ - ❌ SKIPPED (Can't execute data on your own UEA)
10. **Value + Data to others** - Send value with contract execution
11. ~~**Funds + Data to self**~~ - ❌ SKIPPED (Can't execute data on your own UEA)
12. **Funds + Data to others** - Transfer USDT with contract execution
13. ~~**Value + Funds + Data to self**~~ - ❌ SKIPPED (Can't execute data on your own UEA)
14. **Value + Funds + Data to others** - Complete transaction with all parameters
15. **Native Funds to self** - Transfer native tokens (ETH/SOL) via moveable token system to yourself
16. **Native Funds to others** - Transfer native tokens to another address
17. **Value + Native Funds to self** - Send value and native funds to yourself
18. **Value + Native Funds to others** - Send value and native funds to another address
19. ~~**Native Funds + Data to self**~~ - ❌ SKIPPED (Can't execute data on your own UEA)
20. **Native Funds + Data to others** - Transfer native funds with contract execution
21. **Value + Funds + Native Funds to self** - Complete transaction with value, USDT, and native funds to yourself
22. **Value + Funds + Native Funds to others** - Complete transaction with all token types

## 🔧 Configuration

### Master Wallet Setup

You can either **generate new wallets** or **use existing private keys**:

```typescript
// Option 1: Use existing private keys (uncomment to use)
// const ETHEREUM_MASTER_PRIVATE_KEY = '0x...'; // Your Ethereum private key
// const SOLANA_MASTER_PRIVATE_KEY = '...'; // Your Solana private key (base58)

// Option 2: Generate new wallets (default)
const ETHEREUM_MASTER_PRIVATE_KEY = null;
const SOLANA_MASTER_PRIVATE_KEY = null;
```

## 🎯 Usage

When you run the script, you'll be prompted for:

### 1. Chain Selection
- `1` = Ethereum Sepolia
- `2` = Solana Devnet

### 2. Route Selection
- Press **Enter** to run all 22 routes
- Or enter a **route number** (1-22) to run a specific route

### 3. Wallet Setup
- **If MASTER_PRIVATE_KEY is configured**: Automatically uses it
- **If MASTER_PRIVATE_KEY is null**:
  - Press **Enter** to generate a new wallet
  - Or **paste your private key** to use an existing wallet

### Example Flow

```bash
npm start

╔════════════════════════════════════════════════════════════════╗
║   Universal Transaction Test Suite - All 22 Routes            ║
╚════════════════════════════════════════════════════════════════╝

Select chain type (1 = Ethereum, 2 = Solana): 1
✅ Selected: Ethereum

📋 Available Test Routes:
   [... 22 routes listed ...]

Run all routes or specific route? (route number or hit enter for all): 
✅ Running all 22 routes

Enter Ethereum private key (with 0x prefix) or hit Enter to generate new wallet: 
✅ Generating new wallet

🔷 ETHEREUM TEST SUITE

🔑 Generated new Ethereum master wallet
   Private Key: 0x...
   Address: 0x...

📋 Please complete the following steps:
   1. Send 0.06 Sepolia ETH to 0x...
   2. Mint 1 USDT from: https://sepolia.etherscan.io/address/...
```

## 🔄 Automated Test Flow

The test suite automatically runs in **two parts**:

### Part 1: Existing User Tests (Deterministic UEA)

1. **Creates existing user** by sending 0.001 ETH/SOL as "Value to Self"
2. This creates a **deterministic UEA** for the master wallet
3. Runs all 22 transaction routes using this existing user

### Part 2: New User Tests (Fresh Wallets)

1. For each transaction route, **generates a fresh wallet**
2. **Transfers 0.002 ETH/SOL** from master wallet to the new wallet
3. **Transfers 0.0001 USDT** if the route requires funds (using SPL token transfer for Solana)
4. Executes the transaction route with the new wallet
5. Each new wallet gets its own UEA created on first transaction

## 📊 Transaction Logging

Each transaction logs the following details:

- **Wallet Address**: Origin wallet address
- **Origin Chain**: Source chain (Ethereum Sepolia / Solana Devnet)
- **Origin Tx Hash**: Transaction hash on the origin chain
- **UEA Address**: Universal Executor Account address
- **Donut Explorer**: Link to view transaction on Push Chain Donut explorer

## 🔍 Example Output

```
══════════════════════════════════════════════════════════════════
PART 1: EXISTING USER TESTS (Deterministic UEA)
══════════════════════════════════════════════════════════════════

📝 Creating existing user by sending 0.01 ETH as Value to Self...

⏳ Waiting for UEA creation transaction...
✅ Existing user created with UEA: 0x5678...

══════════════════════════════════════════════════════════════════
🧪 EXISTING USER - Testing Route 2: Value to others
══════════════════════════════════════════════════════════════════
   💰 Value: 0.0001 ETH
   🎯 To: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb

   ⏳ Sending transaction...

   ✅ Transaction sent successfully!

   📊 Transaction Details:
   ├─ Wallet Address: 0x1234...
   ├─ Origin Chain: Ethereum Sepolia
   ├─ Origin Tx Hash: 0xabc...
   ├─ UEA Address: 0x5678...
   └─ Donut Explorer: https://explorer.push.org/tx/0xabc...

   ✅ Transaction confirmed on Donut
   📊 Counter after: 43

══════════════════════════════════════════════════════════════════
PART 2: NEW USER TESTS (Fresh wallets for each test)
══════════════════════════════════════════════════════════════════

══════════════════════════════════════════════════════════════════
🧪 NEW USER - Testing Route 2: Value to others
══════════════════════════════════════════════════════════════════
   🆕 Generated new wallet: 0x9abc...
   💸 Transferring SOL from master wallet...
   ✅ SOL transferred
   💵 Transferring USDT from master wallet...
   ✅ USDT transferred
   📍 New User UEA: 0xdef0...
   💰 Value: 0.0001 ETH
   🎯 To: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb

   ⏳ Sending transaction...

   ✅ Transaction sent successfully!
```

## 📦 Dependencies

- `@pushchain/core`: 4.0.12-alpha.0 - Push Chain Core SDK
- `ethers`: ^6.14.4 - For Ethereum implementation
- `@solana/web3.js`: ^1.91.1 - For Solana implementation
- `@solana/spl-token`: ^0.3.8 - For Solana SPL token transfers
- `bs58`: ^5.0.0 - For Solana private key encoding/decoding

## 🧪 Testing Strategy

The test suite automatically:
1. **Sets up master wallet** (uses configured key, generates new, or accepts user input)
2. **Creates existing user** with deterministic UEA via 0.001 ETH/SOL Value to Self
3. **Tests all routes with existing user** (17 routes, skipping 5 self-data routes)
4. **Tests all routes with new users** (generates fresh wallet for each route)
5. **Transfers 0.002 ETH/SOL** from master to new wallets automatically
6. **Transfers 0.0001 USDT** to new wallets for routes requiring funds
7. **Reads counter state** before and after data transactions
8. **Logs comprehensive details** for each transaction
9. **Waits for confirmation** on Donut chain

## 💡 Notes

- **Routes 5, 9, 11, 13, and 19** are automatically skipped (can't execute data on your own UEA)
- **Existing user** gets a deterministic UEA from the master wallet
- **New users** each get unique wallets and UEAs
- **Master wallet funding requirements**:
  - **Ethereum**: 0.06 ETH + 1 USDT
  - **Solana**: 0.06 SOL + 1 USDT
- **Counter contract**: Tracks state changes for data transactions
- **Native funds**: Routes 15-22 use the moveable token system for native token transfers
- **SPL tokens**: Solana USDT transfers use `@solana/spl-token` for proper token account handling
- Each transaction waits **2 seconds** before proceeding to the next
- **Dynamic amounts** based on route ID for easy tracking

## 🔑 Key Features

- ✅ **22 comprehensive transaction routes** covering all parameter combinations
- ✅ **Automatic wallet management** with smart prompts
- ✅ **Counter state tracking** for data transactions (before/after values)
- ✅ **Native funds support** via Push Chain's moveable token system
- ✅ **Proper SPL token handling** for Solana USDT transfers
- ✅ **Automatic USDT funding** for new user wallets
- ✅ **Interactive route selection** (all or specific route)
- ✅ **Comprehensive logging** with Donut explorer links
- ✅ **Both existing and new user scenarios** tested automatically
