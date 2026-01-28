// Full Documentation: https://push.org/docs/chain/build/create-universal-signer/

// Import Push Chain Core
import { PushChain } from '@pushchain/core';

// Import if you are using ethers
import { ethers } from 'ethers';

// Import if you are using viem
import { createWalletClient, http } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

// Import if you are using solana web3 js
import { Keypair } from '@solana/web3.js';

// ⭐️ MAIN FUNCTION ⭐️
async function main() {
  console.log('\n⚡ Ethers v6 Examples');
  console.log('\n1. Push Chain Account');
  await createUniversalSigner_EthersV6_PushChain();

  console.log('\n2. Ethereum Account');
  await createUniversalSigner_EthersV6_Ethereum();

  console.log('\n🌟 Viem Examples');
  console.log('\n1. Push Chain Account');
  await createUniversalSigner_Viem_PushChain();

  console.log('\n2. Ethereum Account');
  await createUniversalSigner_Viem_Ethereum();

  console.log('\n☀️ Solana Examples');
  await createUniversalSigner_Web3JSSolana();
}

main().catch(console.error);

// --- Ethers V6 Usage and Examples ---
// Create Universal Signer - Ethers V6 - Push Chain Account
async function createUniversalSigner_EthersV6_PushChain() {
  // Create random wallet
  const wallet = ethers.Wallet.createRandom();

  // Set up provider
  const provider = new ethers.JsonRpcProvider('https://evm.donut.rpc.push.org/');
  const signer = wallet.connect(provider);

  // Convert ethers signer to Universal Signer
  const universalSigner = await PushChain.utils.signer.toUniversal(signer);
  console.log('🔑 Got universal signer');
  console.log('📄 Signer details:', JSON.stringify(universalSigner, null, 2));
}

// Create Universal Signer - Ethers V6 - Ethereum Sepolia Account
async function createUniversalSigner_EthersV6_Ethereum() {
  // Create random wallet
  const wallet = ethers.Wallet.createRandom();

  // Set up provider
  const provider = new ethers.JsonRpcProvider('https://gateway.tenderly.co/public/sepolia');
  const signer = wallet.connect(provider);

  // Convert ethers signer to Universal Signer
  const universalSigner = await PushChain.utils.signer.toUniversal(signer);
  console.log('🔑 Got universal signer');
  console.log('📄 Signer details:', JSON.stringify(universalSigner, null, 2));
}

// --- Viem Usage and Examples ---
// Create Universal Signer - Viem - Push Chain Account
async function createUniversalSigner_Viem_PushChain() {
  // Create random wallet
  const account = privateKeyToAccount(generatePrivateKey());

  // set chain to sepolia
  const walletClient = createWalletClient({
    account,
    transport: http('https://evm.donut.rpc.push.org/'),
  });

  // Convert viem signer to Universal Signer
  const universalSigner = await PushChain.utils.signer.toUniversal(walletClient);
  console.log('🔑 Got universal signer');
  console.log('📄 Signer details:', JSON.stringify(universalSigner, null, 2));
}

// Create Universal Signer - Viem - Ethereum Sepolia Account
async function createUniversalSigner_Viem_Ethereum() {
  // Create random wallet
  const account = privateKeyToAccount(generatePrivateKey());

  // set chain to sepolia
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(),
  });

  // Convert viem signer to Universal Signer
  const universalSigner = await PushChain.utils.signer.toUniversal(walletClient);
  console.log('🔑 Got universal signer');
  console.log('📄 Signer details:', JSON.stringify(universalSigner, null, 2));
}

// --- Solana Usage and Examples ---
async function createUniversalSigner_Web3JSSolana() {
  // Create random wallet
  const solKeypair = Keypair.generate();

  // Convert solana signer to Universal Signer
  const universalSigner = await PushChain.utils.signer.toUniversalFromKeypair(solKeypair, {
    chain: PushChain.CONSTANTS.CHAIN.SOLANA_DEVNET,
    library: PushChain.CONSTANTS.LIBRARY.SOLANA_WEB3JS,
  });
  console.log('🔑 Got universal signer');
  console.log('📄 Signer details:', JSON.stringify(universalSigner, null, 2));
}
