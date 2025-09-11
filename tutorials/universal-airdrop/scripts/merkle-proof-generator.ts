// @ts-nocheck
import { keccak256 } from 'viem';
import { makeMerkleTree, getProof } from '@openzeppelin/merkle-tree/dist/core.js';
import bs58 from 'bs58';

// Hardcoded airdrop data (previously read from data/airdrop.json)
const AIRDROP_ENTRIES = [
  {
    recipient: '0xFd6C2fE69bE13d8bE379CCB6c9306e74193EC1A9',
    chainNamespace: 'eip155',
    chainId: '11155111',
    amount: '10000000000000000000',
  },
];

/**
 * Generate a leaf hash matching the Solidity contract
 * leaf = keccak256(abi.encodePacked(recipientOnPush, chainNamespace, chainId, amount))
 */
function generateLeaf(entry) {
  const { recipient, chainNamespace, chainId, amount } = entry;

  // Normalize recipient address:
  // - If hex 0x address (length 42), parse as 20-byte address
  // - Else treat as base58 (e.g., Solana), hash bytes and take last 20 bytes
  let recipientAddressHex: string;
  if (recipient.startsWith('0x')) {
    const addr = recipient.toLowerCase();
    const addressBytes = addr.slice(2).padStart(40, '0');
    recipientAddressHex = addressBytes;
  } else {
    const raw = Buffer.from(bs58.decode(recipient));
    const hashed = Buffer.from(keccak256('0x' + raw.toString('hex')).slice(2), 'hex');
    const last20 = hashed.slice(-20);
    recipientAddressHex = last20.toString('hex');
  }

  const namespaceBytes = Buffer.from(chainNamespace, 'utf8');
  const chainIdBytes = Buffer.from(chainId, 'utf8');
  const amountBytes = Buffer.alloc(32);
  amountBytes.writeBigUInt64BE(BigInt(amount), 24);

  const packedBytes = Buffer.concat([
    Buffer.from(recipientAddressHex, 'hex'),
    namespaceBytes,
    chainIdBytes,
    amountBytes,
  ]);

  return keccak256('0x' + packedBytes.toString('hex'));
}

/**
 * Build Merkle tree from airdrop entries
 */
function buildMerkleTree(entries) {
  // Generate leaves
  const leaves = entries.map((entry) => generateLeaf(entry));

  // Create Merkle tree with sorted node hashing (default)
  const tree = makeMerkleTree(leaves);
  const merkleRoot = tree[0];

  // Generate proofs for each entry
  const entriesWithProofs = entries.map((entry, index) => {
    const leafIndex = tree.length - 1 - index;
    const proof = getProof(tree, leafIndex);

    return {
      ...entry,
      leaf: leaves[index],
      proof,
    };
  });

  return {
    merkleRoot,
    entries: entriesWithProofs,
  };
}

/**
 * Print summary of the airdrop data
 */
function printSummary(treeData) {
  const { entries, merkleRoot } = treeData;

  console.log('🌳 Universal Airdrop Merkle Tree Summary');
  console.log('=====================================');
  console.log('📁 Merkle Root: ' + merkleRoot);
  console.log('👥 Total Recipients: ' + entries.length);

  // Calculate totals per chain namespace
  const chainStats = entries.reduce((acc, entry) => {
    const key = entry.chainNamespace + ':' + entry.chainId;
    if (!acc[key]) {
      acc[key] = { count: 0, totalAmount: BigInt(0) };
    }
    acc[key].count += 1;
    acc[key].totalAmount += BigInt(entry.amount);
    return acc;
  }, {});

  console.log('\n📊 Per-Chain Breakdown:');
  Object.entries(chainStats).forEach(([chain, stats]) => {
    console.log('  ' + chain + ': ' + stats.count + ' recipients, ' + stats.totalAmount.toString() + ' tokens');
  });

  // Calculate total amount
  const totalAmount = entries.reduce((sum, entry) => sum + BigInt(entry.amount), BigInt(0));
  console.log('\n💰 Total Airdrop Amount: ' + totalAmount.toString() + ' tokens');
}

// Main execution
async function main() {
  // Use hardcoded airdrop entries
  const entries = AIRDROP_ENTRIES;

  // Validate entries
  for (const entry of entries) {
    const isHex = entry.recipient.startsWith('0x') && entry.recipient.length === 42;
    const isBase58 = !entry.recipient.startsWith('0x');
    if (!isHex && !isBase58) {
      throw new Error('Invalid recipient: ' + entry.recipient + ' (must be 0x-address or base58)');
    }
    if (!entry.chainNamespace || !entry.chainId) {
      throw new Error('Missing chain info for ' + entry.recipient);
    }
    if (isNaN(parseInt(entry.amount)) || BigInt(entry.amount) <= 0) {
      throw new Error('Invalid amount for ' + entry.recipient + ': ' + entry.amount);
    }
  }

  console.log('🔨 Building Merkle tree for ' + entries.length + ' recipients...');

  // Build Merkle tree
  const treeData = buildMerkleTree(entries);

  // Output Merkle tree data to console instead of writing to a file
  console.log(JSON.stringify(treeData, null, 2));
  console.log('✅ Merkle tree built successfully!');

  // Print summary
  printSummary(treeData);
}

// Export functions for testing
export { generateLeaf, buildMerkleTree, printSummary };

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
