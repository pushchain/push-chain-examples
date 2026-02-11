# Universal Transaction Test Suite - All 14 Routes

Comprehensive test suite for Push Chain's Universal Transaction system covering all 14 transaction routes across Ethereum and Solana chains, with automated testing for both existing and new user scenarios.

- [Push Chain Documentation](https://push.org/docs/chain)

## 🚀 Quick Start

```bash
npm install
npm start
```

## 📋 Overview

This example tests **all 14 transaction routes** for both **Ethereum Sepolia** and **Solana Devnet**. The test suite automatically handles both **existing users** (deterministic UEA) and **new users** (fresh wallets for each test).

### 14 Transaction Routes

1. **Value to self** - Send native token value to your own address
2. **Value to others** - Send native token value to another address
3. **Funds to self** - Transfer funds to your own address
4. **Funds to others** - Transfer funds to another address
5. ~~**Data to self**~~ - ❌ SKIPPED (Can't execute data on your own UEA)
6. **Data to others** - Execute contract call on another address
7. **Value + Funds to self** - Send value and funds to yourself
8. **Value + Funds to others** - Send value and funds to another address
9. ~~**Value + Data to self**~~ - ❌ SKIPPED (Can't execute data on your own UEA)
10. **Value + Data to others** - Send value with contract execution
11. ~~**Funds + Data to self**~~ - ❌ SKIPPED (Can't execute data on your own UEA)
12. **Funds + Data to others** - Transfer funds with contract execution
13. ~~**Value + Funds + Data to self**~~ - ❌ SKIPPED (Can't execute data on your own UEA)
14. **Value + Funds + Data to others** - Complete transaction with all parameters

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

When you run the script, you'll be prompted to select:

**Chain Type**: 
- `1` = Ethereum Sepolia
- `2` = Solana Devnet

### Example Flow

```bash
npm start

# Select chain type (1 = Ethereum, 2 = Solana): 1

# You'll need to fund the master wallet:
# ⚠️  Please send Sepolia ETH to 0x... and press Enter to continue...
```

## 🔄 Automated Test Flow

The test suite automatically runs in **two parts**:

### Part 1: Existing User Tests (Deterministic UEA)

1. **Creates existing user** by sending 0.01 ETH/SOL as "Value to Self"
2. This creates a **deterministic UEA** for the master wallet
3. Runs all 14 transaction routes using this existing user

### Part 2: New User Tests (Fresh Wallets)

1. For each transaction route, **generates a fresh wallet**
2. **Transfers funds** from master wallet to the new wallet
3. Executes the transaction route with the new wallet
4. Each new wallet gets its own UEA created on first transaction

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

══════════════════════════════════════════════════════════════════
PART 2: NEW USER TESTS (Fresh wallets for each test)
══════════════════════════════════════════════════════════════════

══════════════════════════════════════════════════════════════════
🧪 NEW USER - Testing Route 2: Value to others
══════════════════════════════════════════════════════════════════
   🆕 Generated new wallet: 0x9abc...
   💸 Transferring funds from master wallet...
   ✅ Funds transferred
   📍 New User UEA: 0xdef0...
   💰 Value: 0.0001 ETH
   🎯 To: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb

   ⏳ Sending transaction...

   ✅ Transaction sent successfully!
```

## 📦 Dependencies

- `@pushchain/core`: latest - Push Chain Core SDK
- `ethers`: ^6.14.4 - For Ethereum implementation
- `@solana/web3.js`: ^1.91.1 - For Solana implementation
- `bs58`: ^5.0.0 - For Solana private key encoding/decoding

## 🧪 Testing Strategy

The test suite automatically:
1. **Sets up master wallet** (generates or uses existing private key)
2. **Creates existing user** with deterministic UEA via 0.01 ETH/SOL Value to Self
3. **Tests all routes with existing user** (10 routes, skipping 4 self-data routes)
4. **Tests all routes with new users** (generates fresh wallet for each route)
5. **Transfers funds** from master to new wallets automatically
6. **Logs comprehensive details** for each transaction
7. **Waits for confirmation** on Donut chain

## 💡 Notes

- **Routes 5, 9, 11, and 13** are automatically skipped (can't execute data on your own UEA)
- **Existing user** gets a deterministic UEA from the master wallet
- **New users** each get unique wallets and UEAs
- Master wallet needs sufficient funds to cover:
  - Initial 0.01 ETH/SOL for existing user creation
  - 0.05 ETH/SOL transfer to each new user wallet (10 wallets)
  - All transaction costs
- Each transaction waits **2 seconds** before proceeding to the next
- Test amounts: **0.0001 ETH/SOL** for value/funds transfers
