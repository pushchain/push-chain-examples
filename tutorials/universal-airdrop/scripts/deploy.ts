import { config } from 'dotenv';
import { ethers } from 'hardhat';
import hre from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';
import { buildMerkleTree } from './merkle-proof-generator';

// Load environment variables
config();

interface AirdropEntry {
  recipient: string;
  chainNamespace: string;
  chainId: string;
  amount: string;
}

const AIRDROP_ENTRIES: AirdropEntry[] = [
  {
    recipient: '0xFd6C2fE69bE13d8bE379CCB6c9306e74193EC1A9',
    chainNamespace: 'eip155',
    chainId: '42101',
    amount: '10000000000000000000',
  },
  {
    recipient: '0xFd6C2fE69bE13d8bE379CCB6c9306e74193EC1A9',
    chainNamespace: 'eip155',
    chainId: '11155111',
    amount: '10000000000000000000',
  },
  {
    recipient: '72JBejJFXrRKpQ69Hmaqr7vWJr6pdZXFEL6jt3sadsXU',
    chainNamespace: 'solana',
    chainId: 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
    amount: '10000000000000000000',
  },
];

async function main() {
  console.log('🚀 Starting deployment...');

  // Debug: Check environment and network
  console.log('🔍 Checking environment...');
  console.log('📝 PRIVATE_KEY exists:', !!process.env.PRIVATE_KEY);

  // Get the deployer account
  const signers = await ethers.getSigners();
  console.log('👥 Number of signers:', signers.length);

  console.log('Current network:', hre.network.name);

  if (signers.length === 0) {
    console.log('❌ Current network:', hre.network.name);
    console.log('❌ Network config:', hre.network.config);
    throw new Error('No accounts available. Please check your PRIVATE_KEY in .env file and network configuration.');
  }

  const [deployer] = signers;
  console.log('📝 Deploying contracts with account:', deployer.address);
  console.log('💰 Account balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // Deploy TestToken
  console.log('\n📄 Deploying TestToken...');
  const TestToken = await ethers.getContractFactory('TestToken');
  const token = await TestToken.deploy('TestToken3', 'TEST3');
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log('✅ TestToken deployed to:', tokenAddress);

  // Read airdrop entries and generate Merkle tree
  console.log('\n🌳 Generating Merkle tree...');
  const airdropEntries: AirdropEntry[] = AIRDROP_ENTRIES;
  const treeData = buildMerkleTree(airdropEntries);
  // const treeData = { merkleRoot: '0xce1ce6669c44b16a7bec7bea604abb8f7d6f1c62ff3d463c77140f8f00c15644' };
  console.log('📁 Merkle root:', treeData.merkleRoot);

  // Deploy UniversalAirdrop
  console.log('\n🎯 Deploying UniversalAirdrop...');
  const UniversalAirdrop = await ethers.getContractFactory('UniversalAirdrop');
  const airdrop = await UniversalAirdrop.deploy(tokenAddress, treeData.merkleRoot);
  await airdrop.waitForDeployment();
  const airdropAddress = await airdrop.getAddress();
  console.log('✅ UniversalAirdrop deployed to:', airdropAddress);

  // Calculate total airdrop amount
  const totalAmount = airdropEntries.reduce((sum, entry) => {
    return sum + BigInt(entry.amount);
  }, 0n);

  console.log(`\n💸 Total airdrop amount: ${ethers.formatEther(totalAmount)} TEST tokens`);

  // Transfer tokens to airdrop contract
  console.log('🔄 Transferring tokens to airdrop contract...');
  const transferTx = await token.transfer(airdropAddress, totalAmount);
  await transferTx.wait();
  console.log('✅ Tokens transferred successfully');

  // Verify balances
  const airdropBalance = await token.balanceOf(airdropAddress);
  const deployerBalance = await token.balanceOf(deployer.address);
  console.log(`🏦 Airdrop contract balance: ${ethers.formatEther(airdropBalance)} TEST`);
  console.log(`👤 Deployer balance: ${ethers.formatEther(deployerBalance)} TEST`);

  // Save deployment info
  const deploymentInfo = {
    network: await ethers.provider.getNetwork().then((n) => n.name),
    token: {
      address: tokenAddress,
      symbol: 'TEST',
      name: 'TestToken',
    },
    airdrop: {
      address: airdropAddress,
      merkleRoot: treeData.merkleRoot,
    },
    treeData: treeData,
    airdropEntries: airdropEntries,
    totalAmount: ethers.formatEther(totalAmount),
    deployedAt: new Date().toISOString(),
  };

  const deploymentPath = path.join(__dirname, '../data/deployment.json');
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n💾 Deployment info saved to: ${deploymentPath}`);

  // Save addresses for the frontend
  const addresses = {
    tokenAddress,
    airdropAddress,
    merkleRoot: treeData.merkleRoot,
  };

  const addressesPath = path.join(__dirname, '../data/addresses.json');
  fs.mkdirSync(path.dirname(addressesPath), { recursive: true });
  fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
  console.log(`📄 Contract addresses saved for frontend: ${addressesPath}`);

  console.log('\n🎉 Deployment completed successfully!');
  console.log('\n📋 Summary:');
  console.log(`   Token Contract: ${tokenAddress}`);
  console.log(`   Airdrop Contract: ${airdropAddress}`);
  console.log(`   Merkle Root: ${treeData.merkleRoot}`);
  console.log(`   Recipients: ${airdropEntries.length}`);
  console.log(`   Total Amount: ${ethers.formatEther(totalAmount)} TEST`);

  console.log('\n🚀 Next steps:');
  console.log('   1. For local testing: npx hardhat node');
  console.log('   2. Start frontend: npm run dev');
  console.log('   3. Copy tree.json and addresses.json to public/ for frontend access');
  console.log('   4. Visit http://localhost:5173 to claim tokens');
}

// Handle errors
main().catch((error) => {
  console.error('❌ Deployment failed:', error);
  process.exitCode = 1;
});
