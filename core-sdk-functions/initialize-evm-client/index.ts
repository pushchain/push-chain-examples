// Full Documentation: https://push.org/docs/chain/build/initialize-evm-client

// Import if you are using ethers
import { ethers } from 'ethers';

// Import if you are using viem
import { createPublicClient, defineChain, http } from 'viem';

// ⭐️ MAIN FUNCTION ⭐️
async function main() {
  console.log('\n⚡ Ethers Examples');
  console.log('\n1. Initialize Provider');
  await initializeEthersProvider();

  console.log('\n2. Get Transaction');
  await getEthersTransaction();

  console.log('\n🌟 Viem Examples');
  console.log('\n1. Initialize Client');
  await initializeViemClient();

  console.log('\n2. Get Transaction');
  await getViemTransaction();
}

main().catch(console.error);

// --- Ethers Examples ---

// Initialize Ethers Provider
async function initializeEthersProvider() {
  const provider = new ethers.JsonRpcProvider('https://evm.donut.rpc.push.org/');
  console.log('🔑 Got provider instance');
  return provider;
}

// Get Transaction with Ethers
async function getEthersTransaction() {
  const transactionHash = '0xe5bec93aa8e98405093f03ab4ed695b673dd08680728788963b6fac77d65aed3';
  const provider = await initializeEthersProvider();
  const transaction = await provider.getTransaction(transactionHash);
  console.log('📄 Transaction details:', transaction);
  return transaction;
}

// --- Viem Examples ---

// Initialize Viem Client
async function initializeViemClient() {
  // Define Push Testnet chain configuration
  const pushTestnet = defineChain({
    id: 42101,
    name: 'Push Testnet',
    nativeCurrency: {
      decimals: 18,
      name: 'PC',
      symbol: '$PC',
    },
    rpcUrls: {
      default: {
        http: ['https://evm.donut.rpc.push.org/'],
      },
    },
    blockExplorers: {
      default: {
        name: 'Push Testnet Explorer',
        url: 'https://explorer.testnet.push.org/',
      },
    },
  });

  const publicClient = createPublicClient({
    chain: pushTestnet,
    transport: http(),
  });

  console.log('🔑 Got public client instance');
  return publicClient;
}

// Get Transaction with Viem
async function getViemTransaction() {
  const transactionHash = '0x750b4d83b2cc3fbab878c2f1b1e9a5413e19d3cdb7db844877d7f7881b8250a0';
  const publicClient = await initializeViemClient();
  const transaction = await publicClient.getTransaction({
    hash: transactionHash,
  });
  console.log('📄 Transaction details:', transaction);
  return transaction;
}
