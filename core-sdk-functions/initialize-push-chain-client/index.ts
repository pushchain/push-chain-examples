// Full Documentation: https://push.org/docs/chain/build/initialize-push-chain-client

// Import Push Chain Core
import { PushChain } from '@pushchain/core';
import { Keypair } from '@solana/web3.js';
import { ethers } from 'ethers';
import { createWalletClient, http } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

// ⭐️ MAIN FUNCTION ⭐️
async function main() {
  console.log('\nTrying to call ethersV6');
  await ethersV6();
  console.log('\nTrying to call viem');
  await viem();
  console.log('\nTrying to call solanaweb3Js');
  await solanaweb3Js();

  console.log('\nAll done!');
}

main().catch(console.error);

async function ethersV6() {
  console.log('Creating Universal Signer - Ethers V6');

  // Create random wallet
  const wallet = ethers.Wallet.createRandom();

  // Set up provider connected to Ethereum Sepolia Testnet
  const provider = new ethers.JsonRpcProvider('https://gateway.tenderly.co/public/sepolia');
  const signer = wallet.connect(provider);

  // Convert ethers signer to Universal Signer
  const universalSigner = await PushChain.utils.signer.toUniversal(signer);
  console.log('🔑 Got universal signer');

  const pushChainClient = await PushChain.initialize(universalSigner, {
    network: PushChain.CONSTANTS.PUSH_NETWORK.TESTNET,
  });
  // ⭐️ MAIN FUNCTION ⭐️
  console.log('🚀 Got push chain client', JSON.stringify(pushChainClient, (_k, v) => typeof v === 'bigint' ? v.toString() : v, 2));

  console.log('📋 Push Chain Client Universal Executor Account (UEA):');
  console.log(JSON.stringify(pushChainClient.universal.account, null, 2));
  console.log('\n📍 Push Chain Client Universal Origin Account (UOA):');
  console.log('Learn about UEA and UOA here: https://push.org/docs/chain/important-concepts');
}

async function viem() {
  console.log('Creating Universal Signer - Viem');

  // Create random wallet
  const account = privateKeyToAccount(generatePrivateKey());
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(),
  });

  // Convert viem wallet client to Universal Signer
  const universalSigner = await PushChain.utils.signer.toUniversal(walletClient);
  console.log('🔑 Got universal signer');

  const pushChainClient = await PushChain.initialize(universalSigner, {
    network: PushChain.CONSTANTS.PUSH_NETWORK.TESTNET,
  });

  console.log('🚀 Got push chain client');

  console.log('📋 Push Chain Client UEA:');
  console.log(JSON.stringify(pushChainClient.universal.account, null, 2));
  console.log('\n📍 Push Chain Client Universal Origin Account:');
  console.log(JSON.stringify(pushChainClient.universal.origin, null, 2));
}

async function solanaweb3Js() {
  console.log('Creating Universal Signer - Solana Web3.js');

  const keyPair = Keypair.generate();

  const universalSigner = await PushChain.utils.signer.toUniversalFromKeypair(keyPair, {
    chain: PushChain.CONSTANTS.CHAIN.SOLANA_DEVNET,
    library: PushChain.CONSTANTS.LIBRARY.SOLANA_WEB3JS,
  });
  console.log('🔑 Got universal signer');

  const pushChainClient = await PushChain.initialize(universalSigner, {
    network: PushChain.CONSTANTS.PUSH_NETWORK.TESTNET,
  });

  console.log('🚀 Got push chain client');

  console.log('📋 Push Chain Client UEA:');
  console.log(JSON.stringify(pushChainClient.universal.account, null, 2));
  console.log('\n📍 Push Chain Client Universal Origin Account:');
  console.log(JSON.stringify(pushChainClient.universal.origin, null, 2));
}
