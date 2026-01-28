// Full Documentation: https://push.org/docs/chain/build/send-universal-transaction

// Import Push Chain Core
import { PushChain } from '@pushchain/core';

// Import ethers for example
import { ethers } from 'ethers';

// Import Solana web3
import { Keypair } from '@solana/web3.js';

// Import viem
import { createWalletClient, http } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

// Readline for input
import * as readline from 'node:readline/promises';

// Enable User Input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// ⭐️ MAIN FUNCTION ⭐️
async function main() {
  // console.log('\n🏃‍♂️ Quickstart Example');
  // await quickstartExample();

  // console.log('\n⚡ Ethers v6 Example - PUSH Chain');
  // await ethersV6();

  console.log('\n🌟 Viem Example - PUSH Chain');
  await viemExample();

  console.log('\n🌞 Solana Example - SOL Chain');
  await solanaExample();
}

// Run main
main().catch(console.error);

// --- Quickstart Example ---
// --------------------------
async function quickstartExample() {
  console.log('Quickstart Example - See rest of the examples for end-to-end flow');

  // Set up wallet, provider and signer
  const wallet = ethers.Wallet.createRandom();

  // Replace it with different JsonRpcProvider to target Ethereum Account, BNB Account, etc
  // const provider = new ethers.JsonRpcProvider('https://gateway.tenderly.co/public/sepolia');
  const provider = new ethers.JsonRpcProvider('https://evm.donut.rpc.push.org/');
  const signer = wallet.connect(provider);

  // Convert ethers signer to Universal Signer and Initialize Push Chain SDK
  const universalSigner = await PushChain.utils.signer.toUniversal(signer);
  const pushChainClient = await PushChain.initialize(universalSigner, {
    network: PushChain.CONSTANTS.PUSH_NETWORK.TESTNET,
  });

  try {
    // Note: This would fail in playground without funds
    // In production, ensure wallet has funds
    const txResponse = await pushChainClient.universal.sendTransaction({
      to: '0x0000000000000000000000000000000000042101',
      value: BigInt('100000000000000000'), // 0.1 PC in wei
    });
    console.log('Transaction Response:', JSON.stringify(txResponse));
  } catch (error) {
    console.error('Transaction failed:', error);

    // In playground, this will fail without funds
    console.log('Note: In playground, this might fail without funds. Ensure your wallet has PC tokens.');
  }
}

// --- Ethers Example ---
// ---------------------
async function ethersV6() {
  // Choose chain from which to send transaction
  const chainSelection = await returnChainSelection();

  // Set provider based on chain selection
  const PROVIDER =
    chainSelection === '1'
      ? 'https://evm.donut.rpc.push.org/'
      : 'https://ethereum-sepolia-rpc.publicnode.com';

  // LFG!!
  console.log('\n1. Create Universal Signer');
  const wallet = ethers.Wallet.createRandom();
  console.log('🔑 Got wallet: ', wallet.address);

  const provider = new ethers.JsonRpcProvider(PROVIDER);
  const signer = wallet.connect(provider);
  const universalSigner = await PushChain.utils.signer.toUniversal(signer);
  console.log('🔑 Got universal signer');

  console.log('\n2. Initialize Push Chain Client');
  const pushChainClient = await PushChain.initialize(universalSigner, {
    network: PushChain.CONSTANTS.PUSH_NETWORK.TESTNET,
  });
  console.log('🚀 Got push chain client');

  // Wait for testnet funds to be sent by developer
  console.log('\n3. Wait for testnet funds to be sent by developer');
  await rl.question(
    `:::prompt:::Please send funds to ${wallet.address} on ${
      chainSelection === '1' ? 'Push Testnet Donut' : 'Ethereum Sepolia'
    } and Press Enter to continue.`
  );

  // Send Universal Transaction
  console.log('\n4. Send Universal Transaction');
  try {
    // Example: Send 0.001 ETH to a random address
    const txResponse = await pushChainClient.universal.sendTransaction({
      to: '0x0000000000000000000000000000000000042101', // receiver address
      value: PushChain.utils.helpers.parseUnits('0.001', 18), // 0.001 PC in uPC (wei)
    });
    console.log('📤 Transaction Response:', txResponse);

    // TODO: enable when txResponse object is done
    // const receipt = txResponse.wait();
    // console.log('✅ Transaction mined receipt:', receipt);

    if (chainSelection !== '1') {
      console.log('🎉 Congrats! You just sent a universal transaction! Here is what happened:');
      console.log('1️⃣  You sent SEPOLIA ETH to our Universal Gateway on Sepolia');
      console.log('2️⃣  Our Universal Gateway locked the funds, converted them to USD stablecoin');
      console.log(
        '3️⃣  Push Chain Validators confirmed the funds and deployed Universal Executor Account(gasslessly), controlled by your Sepolia wallet'
      );
      console.log('4️⃣  Push Chain Validators then minted equivalent amount of $PC through internal AMM on Push Chain');
      console.log(
        '5️⃣  Your signature was then used to verify and complete your transaction on Push Chain and gas was paid in $PC from your UEA'
      );
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.log('💡 Note: This example requires testnet funds to execute');
  }
}

// --- Viem Example ---
// ---------------------
async function viemExample() {
  // Choose chain from which to send transaction
  const chainSelection = await returnChainSelection();

  // Set RPC based on chain selection
  const RPC_URL =
    chainSelection === '1'
      ? 'https://evm.donut.rpc.push.org/'
      : 'https://ethereum-sepolia-rpc.publicnode.com';

  // LFG!!
  console.log('\n1. Create Universal Signer');
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  console.log('🔑 Got account: ', account.address);

  // create viem client
  const client = createWalletClient({
    account,
    transport: http(RPC_URL),
  });
  const universalSigner = await PushChain.utils.signer.toUniversal(client);
  console.log('🔑 Got universal signer');

  console.log('\n2. Initialize Push Chain Client');
  const pushChainClient = await PushChain.initialize(universalSigner, {
    network: PushChain.CONSTANTS.PUSH_NETWORK.TESTNET,
  });
  console.log('🚀 Got push chain client');

  console.log('\n3. Wait for testnet funds to be sent by developer');
  await rl.question(
    `:::prompt:::Please send funds to ${account.address} on ${
      chainSelection === '1' ? 'Push Testnet Donut' : 'Ethereum Sepolia'
    } and Press Enter to continue.`
  );

  console.log('\n4. Send Universal Transaction');
  try {
    const txResponse = await pushChainClient.universal.sendTransaction({
      to: '0x0000000000000000000000000000000000042101',
      value: BigInt(1000000000000000), // 0.001 PC in wei
    });
    console.log('📤 Transaction Response:', txResponse);

    // TODO: enable when txResponse object is done
    // const receipt = txResponse.wait();
    // console.log('✅ Transaction mined receipt:', receipt);

    if (chainSelection !== '1') {
      console.log('🎉 Congrats! You just sent a universal transaction! Here is what happened:');
      console.log('1️⃣  You sent SEPOLIA ETH to our Universal Gateway on Sepolia');
      console.log('2️⃣  Our Universal Gateway locked the funds, converted them to USD stablecoin');
      console.log(
        '3️⃣  Push Chain Validators confirmed the funds and deployed Universal Executor Account(gasslessly), controlled by your Sepolia wallet'
      );
      console.log('4️⃣  Push Chain Validators then minted equivalent amount of $PC through internal AMM on Push Chain');
      console.log(
        '5️⃣  Your signature was then used to verify and complete your transaction on Push Chain and gas was paid in $PC from your UEA'
      );
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.log('💡 Note: This example requires testnet funds to execute');
  }
}

// --- EVM Helper Function ---
// ------------------------
async function returnChainSelection() {
  const chainSelection = await rl.question(
    `Please select the chain(1 for Push Testnet Donut, 2 for Ethereum Sepolia): `
  );

  if (chainSelection !== '1' && chainSelection !== '2') {
    console.log('Invalid selection. Please select 1 or 2.');
    process.exit(0);
  }

  return chainSelection;
}

// --- Solana Example ---
// ---------------------
async function solanaExample() {
  console.log('\n1. Create Universal Signer');
  const keypair = Keypair.generate();
  console.log('🔑 Got keypair: ', keypair.publicKey.toBase58());

  // Create connection
  const universalSigner = await PushChain.utils.signer.toUniversalFromKeypair(keypair, {
    chain: PushChain.CONSTANTS.CHAIN.SOLANA_DEVNET,
    library: PushChain.CONSTANTS.LIBRARY.SOLANA_WEB3JS,
  });

  console.log('🔑 Got universal signer');

  console.log('\n2. Initialize Push Chain Client');
  const pushChainClient = await PushChain.initialize(universalSigner, {
    network: PushChain.CONSTANTS.PUSH_NETWORK.TESTNET,
  });
  console.log('🚀 Got push chain client');

  console.log('\n3. Wait for testnet funds to be sent by developer');
  await rl.question(`:::prompt:::Please send funds to ${keypair.publicKey.toBase58()} and Press Enter to continue.`);

  console.log('\n4. Send Universal Transaction');
  try {
    const txResponse = await pushChainClient.universal.sendTransaction({
      to: '0x0000000000000000000000000000000000042101',
      value: BigInt(1000000000000), // .001 PC
    });
    console.log('📤 Transaction Response:', txResponse);

    // TODO: enable when txResponse object is done
    // const receipt = txResponse.wait();
    // console.log('✅ Transaction mined receipt:', receipt);

    console.log('🎉 Congrats! You just sent a universal transaction! Here is what happened:');
    console.log('1️⃣  You sent DEVNET SOLANA to our Universal Gateway on Solana Devnet');
    console.log('2️⃣  Our Universal Gateway locked the funds, converted them to USD stablecoin');
    console.log(
      '3️⃣  Push Chain Validators confirmed the funds and deployed Universal Executor Account(gasslessly), controlled by your Solana wallet'
    );
    console.log('4️⃣  Push Chain Validators then minted equivalent amount of $PC through internal AMM on Push Chain');
    console.log(
      '5️⃣  Your signature was then used to verify and complete your transaction on Push Chain and gas was paid in $PC from your UEA'
    );
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.log('💡 Note: This example requires testnet funds to execute');
  }
}
