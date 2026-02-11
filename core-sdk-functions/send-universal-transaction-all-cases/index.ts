// Full Documentation: https://push.org/docs/chain/build/send-universal-transaction

// Import Push Chain Core
import { PushChain } from '@pushchain/core';

// Import ethers for example
import { ethers } from 'ethers';

// Import Solana web3
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

// Readline for input
import * as readline from 'node:readline/promises';

// Enable User Input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Transaction tracking
interface TransactionRecord {
  description: string;
  walletAddress: string;
  originChain: string;
  originTxHash: string;
  ueaAddress: string;
  donutExplorerUrl: string;
}

const allTransactions: TransactionRecord[] = [];

// ==============================================
// MASTER WALLET CONFIGURATION
// ==============================================
// Option 1: Use existing private keys (uncomment to use)
// const ETHEREUM_MASTER_PRIVATE_KEY = '0x...'; // Your Ethereum private key
// const SOLANA_MASTER_PRIVATE_KEY = '...'; // Your Solana private key (base58)

// Option 2: Generate new wallets (default)
const ETHEREUM_MASTER_PRIVATE_KEY = null;
const SOLANA_MASTER_PRIVATE_KEY = null;

// ==============================================
// CONFIGURATION
// ==============================================
const ETHEREUM_SEPOLIA_RPC = 'https://ethereum-sepolia-rpc.publicnode.com';
const PUSH_DONUT_RPC = 'https://evm.donut.rpc.push.org/';
const SOLANA_DEVNET_RPC = 'https://api.devnet.solana.com';

// Simple Counter ABI on Push Chain with an increment function and view counter
const COUNTER_ABI = [
  {
    inputs: [],
    name: 'increment',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'countPC',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Counter contract address used in examples/tests
const COUNTER_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

// ==============================================
// TRANSACTION ROUTES
// ==============================================
const TRANSACTION_ROUTES = [
  { id: 1, name: 'Value to self', hasValue: true, hasFunds: false, hasData: false, toSelf: true },
  { id: 2, name: 'Value to others', hasValue: true, hasFunds: false, hasData: false, toSelf: false },
  { id: 3, name: 'Funds to self', hasValue: false, hasFunds: true, hasData: false, toSelf: true },
  { id: 4, name: 'Funds to others', hasValue: false, hasFunds: true, hasData: false, toSelf: false },
  { id: 5, name: 'Data to self', hasValue: false, hasFunds: false, hasData: true, toSelf: true, skip: true },
  { id: 6, name: 'Data to others', hasValue: false, hasFunds: false, hasData: true, toSelf: false },
  { id: 7, name: 'Value + Funds to self', hasValue: true, hasFunds: true, hasData: false, toSelf: true },
  { id: 8, name: 'Value + Funds to others', hasValue: true, hasFunds: true, hasData: false, toSelf: false },
  { id: 9, name: 'Value + Data to self', hasValue: true, hasFunds: false, hasData: true, toSelf: true, skip: true },
  { id: 10, name: 'Value + Data to others', hasValue: true, hasFunds: false, hasData: true, toSelf: false },
  { id: 11, name: 'Funds + Data to self', hasValue: false, hasFunds: true, hasData: true, toSelf: true, skip: true },
  { id: 12, name: 'Funds + Data to others', hasValue: false, hasFunds: true, hasData: true, toSelf: false },
  { id: 13, name: 'Value + Funds + Data to self', hasValue: true, hasFunds: true, hasData: true, toSelf: true, skip: true },
  { id: 14, name: 'Value + Funds + Data to others', hasValue: true, hasFunds: true, hasData: true, toSelf: false },
];

// ==============================================
// MAIN FUNCTION
// ==============================================
async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   Universal Transaction Test Suite - All 14 Routes            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const chainType = await rl.question('Select chain type (1 = Ethereum, 2 = Solana): ');

  if (chainType === '1') {
    await testEthereumRoutes();
  } else if (chainType === '2') {
    await testSolanaRoutes();
  } else {
    console.log('❌ Invalid selection');
    process.exit(1);
  }

  rl.close();
}

// Run main
main().catch(console.error);

// ==============================================
// ETHEREUM TEST SUITE
// ==============================================
async function testEthereumRoutes() {
  console.log('\n🔷 ETHEREUM TEST SUITE\n');

  // Setup master wallet
  let masterWallet: ethers.Wallet;
  
  if (ETHEREUM_MASTER_PRIVATE_KEY) {
    masterWallet = new ethers.Wallet(ETHEREUM_MASTER_PRIVATE_KEY);
    console.log('🔑 Using existing Ethereum master wallet');
  } else {
    masterWallet = ethers.Wallet.createRandom();
    console.log('🔑 Generated new Ethereum master wallet');
    console.log(`   Private Key: ${masterWallet.privateKey}`);
  }

  console.log(`   Address: ${masterWallet.address}\n`);

  const provider = new ethers.JsonRpcProvider(ETHEREUM_SEPOLIA_RPC);
  const masterSigner = masterWallet.connect(provider);
  const masterUniversalSigner = await PushChain.utils.signer.toUniversal(masterSigner);
  const masterPushChainClient = await PushChain.initialize(masterUniversalSigner, {
    network: PushChain.CONSTANTS.PUSH_NETWORK.TESTNET,
  });

  // Get USDT token address
  const usdtAddress = masterPushChainClient.moveable.token.USDT.address;
  console.log(`💵 USDT Token Address: ${usdtAddress}\n`);

  console.log('📋 Please complete the following steps:');
  console.log(`   1. Send 0.01 Sepolia ETH to ${masterWallet.address}`);
  console.log(`   2. Mint 1 USDT from: https://sepolia.etherscan.io/address/${usdtAddress}#writeContract#F6`);
  console.log(`      (Connect wallet and call mint function)\n`);
  
  await rl.question('⚠️  Press Enter once you have completed both steps...');

  // ============================================
  // PART 1: EXISTING USER TESTS
  // ============================================
  console.log('\n' + '═'.repeat(70));
  console.log('PART 1: EXISTING USER TESTS (Deterministic UEA)');
  console.log('═'.repeat(70));
  console.log('\n📝 Creating existing user by sending 0.001 ETH as Value to Self...\n');

  // Create existing user with deterministic UEA
  const initTx = await masterPushChainClient.universal.sendTransaction({
    to: masterWallet.address as `0x${string}`,
    value: PushChain.utils.helpers.parseUnits('0.001', 18),
  });
  
  console.log('⏳ Waiting for UEA creation transaction...');
  await initTx.wait();
  
  const existingUserUEA = masterPushChainClient.universal.account;
  console.log(`✅ Existing user created with UEA: ${existingUserUEA}\n`);

  // Track initialization transaction
  const donutUrl = masterPushChainClient.explorer.getTransactionUrl(initTx.hash);
  allTransactions.push({
    description: 'Initialize Existing User (Value to Self)',
    walletAddress: masterWallet.address,
    originChain: 'Ethereum Sepolia',
    originTxHash: initTx.hash,
    ueaAddress: existingUserUEA,
    donutExplorerUrl: donutUrl,
  });

  // Run all tests with existing user
  await runTestRoutes(masterWallet, masterPushChainClient, existingUserUEA, provider, usdtAddress, 'EXISTING USER');

  // ============================================
  // PART 2: NEW USER TESTS
  // ============================================
  console.log('\n\n' + '═'.repeat(70));
  console.log('PART 2: NEW USER TESTS (Fresh wallets for each test)');
  console.log('═'.repeat(70) + '\n');

  for (const route of TRANSACTION_ROUTES) {
    if (route.skip) {
      console.log(`\n⏭️  Route ${route.id}: ${route.name} - SKIPPED (Can't execute data on your own UEA)`);
      allTransactions.push({
        description: `NEW USER - Route ${route.id}: ${route.name} - SKIPPED`,
        walletAddress: 'N/A',
        originChain: 'Ethereum Sepolia',
        originTxHash: 'N/A - Skipped (Cannot execute data on own UEA)',
        ueaAddress: 'N/A',
        donutExplorerUrl: 'N/A',
      });
      continue;
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log(`🧪 NEW USER - Testing Route ${route.id}: ${route.name}`);
    console.log(`${'='.repeat(70)}`);

    try {
      // Generate fresh wallet for this test
      const newWallet = ethers.Wallet.createRandom();
      const newSigner = newWallet.connect(provider);
      console.log(`   🆕 Generated new wallet: ${newWallet.address}`);

      // Generate random other address for this test
      const otherAddress = ethers.Wallet.createRandom().address;

      // Transfer funds from master to new wallet
      console.log('   💸 Transferring funds from master wallet...');
      const fundTx = await masterSigner.sendTransaction({
        to: newWallet.address,
        value: PushChain.utils.helpers.parseUnits('0.00001', 18),
      });
      await fundTx.wait();
      console.log('   ✅ Funds transferred');

      // Initialize Push Chain client for new wallet
      const newUniversalSigner = await PushChain.utils.signer.toUniversal(newSigner);
      const newPushChainClient = await PushChain.initialize(newUniversalSigner, {
        network: PushChain.CONSTANTS.PUSH_NETWORK.TESTNET,
      });

      const newUserUEA = newPushChainClient.universal.account;
      console.log(`   📍 New User UEA: ${newUserUEA}`);

      // Build transaction params
      const txParams: any = {
        to: route.toSelf ? newWallet.address : otherAddress,
      };

      // Dynamic amounts based on route ID
      const ethAmount = `0.000000${route.id}`;
      const usdtAmount = `0.000000${route.id}`;

      if (route.hasValue) {
        txParams.value = PushChain.utils.helpers.parseUnits(ethAmount, 18);
        console.log(`   💰 Value: ${ethAmount} ETH`);
      }

      if (route.hasFunds) {
        txParams.funds = {
          amount: PushChain.utils.helpers.parseUnits(usdtAmount, 6), // USDT has 6 decimals
          token: newPushChainClient.moveable.token.USDT,
        };
        console.log(`   💵 Funds: ${usdtAmount} USDT`);
      }

      if (route.hasData) {
        const iface = new ethers.Interface(COUNTER_ABI);
        txParams.data = iface.encodeFunctionData('increment');
        txParams.to = COUNTER_ADDRESS;
        console.log('   📦 Data: increment()');
      }

      console.log(`   🎯 To: ${txParams.to}`);
      console.log('\n   ⏳ Sending transaction...');

      const txResponse = await newPushChainClient.universal.sendTransaction(txParams);
      
      console.log('\n   ✅ Transaction sent successfully!');
      
      const donutUrl = newPushChainClient.explorer.getTransactionUrl(txResponse.hash);
      allTransactions.push({
        description: `NEW USER - Route ${route.id}: ${route.name}`,
        walletAddress: newWallet.address,
        originChain: 'Ethereum Sepolia',
        originTxHash: txResponse.hash,
        ueaAddress: newUserUEA,
        donutExplorerUrl: donutUrl,
      });

      await logTransactionDetails(newWallet.address, txResponse.hash, newUserUEA, newPushChainClient, 'Ethereum Sepolia');

      await txResponse.wait();
      console.log('   ✅ Transaction confirmed on Donut');

    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log('\n\n✅ Ethereum test suite completed!');
  
  // Display all transactions summary
  displayTransactionSummary();
}

// Helper function to run test routes with existing user
async function runTestRoutes(
  wallet: ethers.Wallet,
  pushChainClient: any,
  ueaAddress: string,
  provider: ethers.JsonRpcProvider,
  usdtAddress: string,
  userType: string
) {
  for (const route of TRANSACTION_ROUTES) {
    // Generate random other address for each test
    const otherAddress = ethers.Wallet.createRandom().address;
    if (route.skip) {
      console.log(`\n⏭️  Route ${route.id}: ${route.name} - SKIPPED (Can't execute data on your own UEA)`);
      allTransactions.push({
        description: `Route ${route.id}: ${route.name} - SKIPPED`,
        walletAddress: wallet.address,
        originChain: 'Ethereum Sepolia',
        originTxHash: 'N/A - Skipped (Cannot execute data on own UEA)',
        ueaAddress: ueaAddress,
        donutExplorerUrl: 'N/A',
      });
      continue;
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log(`🧪 ${userType} - Testing Route ${route.id}: ${route.name}`);
    console.log(`${'='.repeat(70)}`);

    try {
      const txParams: any = {
        to: route.toSelf ? wallet.address : otherAddress,
      };

      // Dynamic amounts based on route ID
      const ethAmount = `0.00000${route.id}`;
      const usdtAmount = `0.00000${route.id}`;

      if (route.hasValue) {
        txParams.value = PushChain.utils.helpers.parseUnits(ethAmount, 18);
        console.log(`   💰 Value: ${ethAmount} ETH`);
      }

      if (route.hasFunds) {
        txParams.funds = {
          amount: PushChain.utils.helpers.parseUnits(usdtAmount, 6), // USDT has 6 decimals
          token: pushChainClient.moveable.token.USDT,
        };
        console.log(`   💵 Funds: ${usdtAmount} USDT`);
      }

      if (route.hasData) {
        const iface = new ethers.Interface(COUNTER_ABI);
        txParams.data = iface.encodeFunctionData('increment');
        txParams.to = COUNTER_ADDRESS;
        console.log('   📦 Data: increment()');
      }

      console.log(`   🎯 To: ${txParams.to}`);
      console.log('\n   ⏳ Sending transaction...');

      const txResponse = await pushChainClient.universal.sendTransaction(txParams);
      
      console.log('\n   ✅ Transaction sent successfully!');
      
      const donutUrl = pushChainClient.explorer.getTransactionUrl(txResponse.hash);
      allTransactions.push({
        description: `Route ${route.id}: ${route.name}`,
        walletAddress: wallet.address,
        originChain: 'Ethereum Sepolia',
        originTxHash: txResponse.hash,
        ueaAddress: ueaAddress,
        donutExplorerUrl: donutUrl,
      });

      await logTransactionDetails(wallet.address, txResponse.hash, ueaAddress, pushChainClient, 'Ethereum Sepolia');

      await txResponse.wait();
      console.log('   ✅ Transaction confirmed on Donut');

    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

// ==============================================
// SOLANA TEST SUITE
// ==============================================
async function testSolanaRoutes() {
  console.log('\n🟣 SOLANA TEST SUITE\n');

  // Setup master wallet
  let masterKeypair: Keypair;
  
  if (SOLANA_MASTER_PRIVATE_KEY) {
    const secretKey = bs58.decode(SOLANA_MASTER_PRIVATE_KEY);
    masterKeypair = Keypair.fromSecretKey(secretKey);
    console.log('🔑 Using existing Solana master wallet');
  } else {
    masterKeypair = Keypair.generate();
    console.log('🔑 Generated new Solana master wallet');
    console.log(`   Private Key (base58): ${bs58.encode(masterKeypair.secretKey)}`);
  }

  console.log(`   Address: ${masterKeypair.publicKey.toBase58()}\n`);

  const masterUniversalSigner = await PushChain.utils.signer.toUniversalFromKeypair(masterKeypair, {
    chain: PushChain.CONSTANTS.CHAIN.SOLANA_DEVNET,
    library: PushChain.CONSTANTS.LIBRARY.SOLANA_WEB3JS,
  });
  
  const masterPushChainClient = await PushChain.initialize(masterUniversalSigner, {
    network: PushChain.CONSTANTS.PUSH_NETWORK.TESTNET,
  });

  // Get USDT token address for Solana
  const usdtAddress = masterPushChainClient.moveable.token.USDT.address;
  console.log(`💵 USDT Token Address: ${usdtAddress}\n`);

  console.log('📋 Please complete the following steps:');
  console.log(`   1. Send 0.01 Devnet SOL to ${masterKeypair.publicKey.toBase58()}`);
  console.log(`   2. Mint 1 USDT (Note: Solana minting process may vary - check token documentation)\n`);
  
  await rl.question('⚠️  Press Enter once you have completed both steps...');

  // ============================================
  // PART 1: EXISTING USER TESTS
  // ============================================
  console.log('\n' + '═'.repeat(70));
  console.log('PART 1: EXISTING USER TESTS (Deterministic UEA)');
  console.log('═'.repeat(70));
  console.log('\n📝 Creating existing user by sending 0.001 SOL as Value to Self...\n');

  // Create existing user with deterministic UEA
  const masterUEA = masterPushChainClient.universal.account;
  const initTx = await masterPushChainClient.universal.sendTransaction({
    to: masterUEA as `0x${string}`,
    value: PushChain.utils.helpers.parseUnits('0.001', 9), // 0.001 SOL (9 decimals for SOL)
  });
  
  console.log('⏳ Waiting for UEA creation transaction...');
  await initTx.wait();
  
  const existingUserUEA = masterPushChainClient.universal.account;
  console.log(`✅ Existing user created with UEA: ${existingUserUEA}\n`);

  // Track initialization transaction
  const donutUrl = masterPushChainClient.explorer.getTransactionUrl(initTx.hash);
  allTransactions.push({
    description: 'Initialize Existing User (Value to Self)',
    walletAddress: masterKeypair.publicKey.toBase58(),
    originChain: 'Solana Devnet',
    originTxHash: initTx.hash,
    ueaAddress: existingUserUEA,
    donutExplorerUrl: donutUrl,
  });

  // Run all tests with existing user
  await runTestRoutesSolana(masterKeypair, masterPushChainClient, existingUserUEA, usdtAddress, 'EXISTING USER');

  // ============================================
  // PART 2: NEW USER TESTS
  // ============================================
  console.log('\n\n' + '═'.repeat(70));
  console.log('PART 2: NEW USER TESTS (Fresh wallets for each test)');
  console.log('═'.repeat(70) + '\n');

  for (const route of TRANSACTION_ROUTES) {
    if (route.skip) {
      console.log(`\n⏭️  Route ${route.id}: ${route.name} - SKIPPED (Can't execute data on your own UEA)`);
      allTransactions.push({
        description: `NEW USER - Route ${route.id}: ${route.name} - SKIPPED`,
        walletAddress: 'N/A',
        originChain: 'Solana Devnet',
        originTxHash: 'N/A - Skipped (Cannot execute data on own UEA)',
        ueaAddress: 'N/A',
        donutExplorerUrl: 'N/A',
      });
      continue;
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log(`🧪 NEW USER - Testing Route ${route.id}: ${route.name}`);
    console.log(`${'='.repeat(70)}`);

    try {
      // Generate fresh wallet for this test
      const newKeypair = Keypair.generate();
      console.log(`   🆕 Generated new wallet: ${newKeypair.publicKey.toBase58()}`);

      // Generate random other address for this test
      const otherAddress = ethers.Wallet.createRandom().address;

      // Transfer funds from master to new wallet (using Solana native transfer)
      console.log('   💸 Transferring funds from master wallet...');
      const { Connection, SystemProgram, Transaction, sendAndConfirmTransaction } = await import('@solana/web3.js');
      const connection = new Connection(SOLANA_DEVNET_RPC, 'confirmed');
      
      const transferIx = SystemProgram.transfer({
        fromPubkey: masterKeypair.publicKey,
        toPubkey: newKeypair.publicKey,
        lamports: 10000000, // 0.01 SOL
      });
      
      const transaction = new Transaction().add(transferIx);
      await sendAndConfirmTransaction(connection, transaction, [masterKeypair]);
      console.log('   ✅ Funds transferred');

      // Initialize Push Chain client for new wallet
      const newUniversalSigner = await PushChain.utils.signer.toUniversalFromKeypair(newKeypair, {
        chain: PushChain.CONSTANTS.CHAIN.SOLANA_DEVNET,
        library: PushChain.CONSTANTS.LIBRARY.SOLANA_WEB3JS,
      });
      
      const newPushChainClient = await PushChain.initialize(newUniversalSigner, {
        network: PushChain.CONSTANTS.PUSH_NETWORK.TESTNET,
      });

      const newUserUEA = newPushChainClient.universal.account;
      console.log(`   📍 New User UEA: ${newUserUEA}`);

      // Build transaction params
      const txParams: any = {
        to: route.toSelf ? newUserUEA : otherAddress,
      };

      // Dynamic amounts based on route ID (smaller amounts for Solana)
      const solAmountStr = `0.000000${route.id}`; // 0.0000001 to 0.0000014 SOL
      const usdtAmount = `0.000000${route.id}`;

      if (route.hasValue) {
        txParams.value = PushChain.utils.helpers.parseUnits(solAmountStr, 9); // SOL has 9 decimals
        console.log(`   💰 Value: ${solAmountStr} SOL`);
      }

      if (route.hasFunds) {
        txParams.funds = {
          amount: PushChain.utils.helpers.parseUnits(usdtAmount, 6), // USDT has 6 decimals
          token: newPushChainClient.moveable.token.USDT,
        };
        console.log(`   💵 Funds: ${usdtAmount} USDT`);
      }

      if (route.hasData) {
        const iface = new ethers.Interface(COUNTER_ABI);
        txParams.data = iface.encodeFunctionData('increment');
        txParams.to = COUNTER_ADDRESS;
        console.log('   📦 Data: increment()');
      }

      console.log(`   🎯 To: ${txParams.to}`);
      console.log('\n   ⏳ Sending transaction...');

      const txResponse = await newPushChainClient.universal.sendTransaction(txParams);
      
      console.log('\n   ✅ Transaction sent successfully!');
      
      const donutUrl = newPushChainClient.explorer.getTransactionUrl(txResponse.hash);
      allTransactions.push({
        description: `NEW USER - Route ${route.id}: ${route.name}`,
        walletAddress: newKeypair.publicKey.toBase58(),
        originChain: 'Solana Devnet',
        originTxHash: txResponse.hash,
        ueaAddress: newUserUEA,
        donutExplorerUrl: donutUrl,
      });

      await logTransactionDetails(
        newKeypair.publicKey.toBase58(),
        txResponse.hash,
        newUserUEA,
        newPushChainClient,
        'Solana Devnet'
      );

      await txResponse.wait();
      console.log('   ✅ Transaction confirmed on Donut');

    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log('\n\n✅ Solana test suite completed!');
  
  // Display all transactions summary
  displayTransactionSummary();
}

// Helper function to run test routes with existing Solana user
async function runTestRoutesSolana(
  keypair: Keypair,
  pushChainClient: any,
  ueaAddress: string,
  usdtAddress: string,
  userType: string
) {
  for (const route of TRANSACTION_ROUTES) {
    // Generate random other address for each test
    const otherAddress = ethers.Wallet.createRandom().address;
    if (route.skip) {
      console.log(`\n⏭️  Route ${route.id}: ${route.name} - SKIPPED (Can't execute data on your own UEA)`);
      allTransactions.push({
        description: `Route ${route.id}: ${route.name} - SKIPPED`,
        walletAddress: keypair.publicKey.toBase58(),
        originChain: 'Solana Devnet',
        originTxHash: 'N/A - Skipped (Cannot execute data on own UEA)',
        ueaAddress: ueaAddress,
        donutExplorerUrl: 'N/A',
      });
      continue;
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log(`🧪 ${userType} - Testing Route ${route.id}: ${route.name}`);
    console.log(`${'='.repeat(70)}`);

    try {
      const txParams: any = {
        to: route.toSelf ? ueaAddress : otherAddress,
      };

      // Dynamic amounts based on route ID (smaller amounts for Solana)
      const solAmountStr = `0.000000${route.id}`; // 0.0000001 to 0.0000014 SOL
      const usdtAmount = `0.000000${route.id}`;

      if (route.hasValue) {
        txParams.value = PushChain.utils.helpers.parseUnits(solAmountStr, 9); // SOL has 9 decimals
        console.log(`   💰 Value: ${solAmountStr} SOL`);
      }

      if (route.hasFunds) {
        txParams.funds = {
          amount: PushChain.utils.helpers.parseUnits(usdtAmount, 6), // USDT has 6 decimals
          token: pushChainClient.moveable.token.USDT,
        };
        console.log(`   💵 Funds: ${usdtAmount} USDT`);
      }

      if (route.hasData) {
        const iface = new ethers.Interface(COUNTER_ABI);
        txParams.data = iface.encodeFunctionData('increment');
        txParams.to = COUNTER_ADDRESS;
        console.log('   📦 Data: increment()');
      }

      console.log(`   🎯 To: ${txParams.to}`);
      console.log('\n   ⏳ Sending transaction...');

      const txResponse = await pushChainClient.universal.sendTransaction(txParams);
      
      console.log('\n   ✅ Transaction sent successfully!');
      
      const donutUrl = pushChainClient.explorer.getTransactionUrl(txResponse.hash);
      allTransactions.push({
        description: `Route ${route.id}: ${route.name}`,
        walletAddress: keypair.publicKey.toBase58(),
        originChain: 'Solana Devnet',
        originTxHash: txResponse.hash,
        ueaAddress: ueaAddress,
        donutExplorerUrl: donutUrl,
      });

      await logTransactionDetails(
        keypair.publicKey.toBase58(),
        txResponse.hash,
        ueaAddress,
        pushChainClient,
        'Solana Devnet'
      );

      await txResponse.wait();
      console.log('   ✅ Transaction confirmed on Donut');

    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

// ==============================================
// TRANSACTION SUMMARY DISPLAY
// ==============================================
function displayTransactionSummary() {
  console.log('\n\n' + '═'.repeat(70));
  console.log('📊 ALL TRANSACTIONS SUMMARY');
  console.log('═'.repeat(70) + '\n');

  allTransactions.forEach((tx, index) => {
    console.log(`   📊 Transaction Details: (${index}) ${tx.description}`);
    console.log(`   ├─ Wallet Address: ${tx.walletAddress}`);
    console.log(`   ├─ Origin Chain: ${tx.originChain}`);
    console.log(`   ├─ Origin Tx Hash: ${tx.originTxHash}`);
    console.log(`   ├─ UEA Address: ${tx.ueaAddress}`);
    console.log(`   └─ Donut Explorer: ${tx.donutExplorerUrl}\n`);
  });

  console.log(`Total Transactions: ${allTransactions.length}`);
  console.log('═'.repeat(70) + '\n');
}

// ==============================================
// HELPER FUNCTIONS
// ==============================================
async function logTransactionDetails(
  walletAddress: string,
  txHash: string,
  ueaAddress: string,
  pushChainClient: any,
  originChain: string
) {
  console.log('\n   📊 Transaction Details:');
  console.log(`   ├─ Wallet Address: ${walletAddress}`);
  console.log(`   ├─ Origin Chain: ${originChain}`);
  console.log(`   ├─ Origin Tx Hash: ${txHash}`);
  console.log(`   ├─ UEA Address: ${ueaAddress}`);
  
  try {
    const donutUrl = pushChainClient.explorer.getTransactionUrl(txHash);
    console.log(`   └─ Donut Explorer: ${donutUrl}`);
  } catch (error) {
    console.log(`   └─ Donut Tx Hash: ${txHash}`);
  }
}
