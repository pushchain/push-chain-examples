# Universal Claimable Airdrop Smart Contracts

This folder contains the smart contracts for the Universal Claimable Airdrop tutorial, demonstrating how to create a cross-chain airdrop system using Merkle proofs and Universal Executor Accounts (UEA) on PushChain.

👉 Full Tutorial: [Read the step-by-step guide on Push.org](https://push.org/docs/chain/tutorials/token-systems/tutorial-universal-airdrop/)

## Overview

The Universal Claimable Airdrop tutorial shows how to create an airdrop system that works seamlessly across multiple chains using PushChain's Universal Executor Accounts (UEA). Users from any supported chain can claim their airdrop using their deterministic addresses, making it truly universal.

## Contracts

### UniversalAirdropFactory.sol

This file contains two main contracts:

#### UniversalAirdrop

The airdrop contract that provides:
- **Hardcoded $UNICORN Token**: Uses the $UNICORN ERC-20 token at `0x0165878A594ca255338adfa4d48449f69242Eb8F`
- **Automatic Minting**: Mints the total airdrop amount upon deployment
- **Merkle Proof Verification**: Uses OpenZeppelin's MerkleProof library for secure claim verification
- **Claim Tracking**: Prevents double-claiming with a mapping of claimed addresses
- **Owner Controls**: Allows merkle root updates and token withdrawal

#### UniversalAirdropFactory

The factory contract that:
- Deploys new `UniversalAirdrop` instances
- Automatically mints the specified amount of $UNICORN tokens to each airdrop
- Emits events for tracking deployed airdrops
- Simplifies the deployment process

## Key Features

- **Universal Executor Accounts (UEA)**: Users interact from deterministic addresses across all chains
- **Merkle Tree Verification**: Efficient and secure claim verification using OpenZeppelin's implementation
- **Automatic Token Minting**: $UNICORN tokens are minted directly to the airdrop contract on deployment
- **Factory Pattern**: Easy deployment of multiple airdrop campaigns
- **Cross-Chain Compatible**: Works seamlessly with users from any supported chain
- **Gas Efficient**: Merkle proofs minimize on-chain storage requirements

## Development

This project uses [Foundry](https://book.getfoundry.sh/) for smart contract development.

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)

### Building

```bash
forge build
```

### Testing

```bash
forge test
```

### Deployment

Deploy the factory contract to PushChain testnet:

```bash
forge create src/UniversalAirdropFactory.sol:UniversalAirdropFactory \
  --rpc-url push_testnet \
  --chain 42101 \
  --account myKeystore \
  --broadcast
```

Or deploy with a specific private key:

```bash
forge create src/UniversalAirdropFactory.sol:UniversalAirdropFactory \
  --rpc-url push_testnet \
  --chain 42101 \
  --private-key <YOUR_PRIVATE_KEY> \
  --broadcast
```

### Contract Verification

After deployment, verify your factory contract on Blockscout:

```bash
forge verify-contract \
  --chain 42101 \
  --verifier blockscout \
  <FACTORY_CONTRACT_ADDRESS> \
  src/UniversalAirdropFactory.sol:UniversalAirdropFactory
```

## Integration with Frontend

The frontend application in the `../app` directory provides a 4-step tutorial interface:

1. **Step 1**: Add wallets with chain selection and convert to Universal Executor Addresses (UEA)
2. **Step 2**: Preview converted addresses and generate Merkle tree and proofs
3. **Step 3**: Deploy the airdrop contract via the factory
4. **Step 4**: Users claim their airdrop tokens

## Example Usage

### Creating an Airdrop

Once the factory is deployed, create a new airdrop campaign:

```solidity
// Call the factory's createAirdrop function
UniversalAirdropFactory.createAirdrop(
  totalAmount,  // Total amount of $UNICORN tokens to mint (sum of all allocations)
  merkleRoot    // Root of the merkle tree containing all eligible addresses and amounts
)
```

### Claiming Tokens

Users can claim their allocated tokens:

```solidity
// Call the airdrop contract's claim function
UniversalAirdrop.claim(
  amount,       // Amount allocated to the claimer
  merkleProof   // Array of merkle proof hashes
)
```

## Contract Addresses

**$UNICORN Token**: `0x0165878A594ca255338adfa4d48449f69242Eb8F`

Update the factory contract address in your frontend application after deployment:

```typescript
const FACTORY_CONTRACT_ADDRESS = 'YOUR_DEPLOYED_FACTORY_ADDRESS'
