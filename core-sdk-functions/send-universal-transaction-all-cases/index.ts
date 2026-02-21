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
const ARBITRUM_SEPOLIA_RPC = 'https://sepolia-rollup.arbitrum.io/rpc';
const BASE_SEPOLIA_RPC = 'https://sepolia.base.org';
const BSC_TESTNET_RPC = 'https://data-seed-prebsc-1-s1.binance.org:8545';
const PUSH_DONUT_RPC = 'https://evm.donut.rpc.push.org/';
const SOLANA_DEVNET_RPC = 'https://api.devnet.solana.com';

// Simple Counter ABI on Push Chain with an increment function and view counter
const COUNTER_ABI = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'uint256',
        name: 'countPC',
        type: 'uint256',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'caller',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'value',
        type: 'uint256',
      },
    ],
    name: 'CountIncremented',
    type: 'event',
  },
  {
    inputs: [],
    name: 'increment',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'reset',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    stateMutability: 'payable',
    type: 'receive',
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
  {
    inputs: [],
    name: 'getBalance',
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
const COUNTER_ADDRESS_PAYABLE = '0x70d8f7a0fF8e493fb9cbEE19Eb780E40Aa872aaf';

// ==============================================
// TRANSACTION ROUTES
// ==============================================
const TRANSACTION_ROUTES = [
  { id: 1, name: 'Value to self', hasValue: true, hasFunds: false, hasNativeFunds: false, hasData: false, toSelf: true },
  { id: 2, name: 'Value to others', hasValue: true, hasFunds: false, hasNativeFunds: false, hasData: false, toSelf: false },
  { id: 3, name: 'Funds to self', hasValue: false, hasFunds: true, hasNativeFunds: false, hasData: false, toSelf: true },
  { id: 4, name: 'Funds to others', hasValue: false, hasFunds: true, hasNativeFunds: false, hasData: false, toSelf: false },
  { id: 5, name: 'Data to self', hasValue: false, hasFunds: false, hasNativeFunds: false, hasData: true, toSelf: true, skip: true },
  { id: 6, name: 'Data to others', hasValue: false, hasFunds: false, hasNativeFunds: false, hasData: true, toSelf: false },
  { id: 7, name: 'Value + Funds to self', hasValue: true, hasFunds: true, hasNativeFunds: false, hasData: false, toSelf: true },
  { id: 8, name: 'Value + Funds to others', hasValue: true, hasFunds: true, hasNativeFunds: false, hasData: false, toSelf: false },
  { id: 9, name: 'Value + Data to self', hasValue: true, hasFunds: false, hasNativeFunds: false, hasData: true, toSelf: true, skip: true },
  { id: 10, name: 'Value + Data to others', hasValue: true, hasFunds: false, hasNativeFunds: false, hasData: true, toSelf: false },
  { id: 11, name: 'Funds + Data to self', hasValue: false, hasFunds: true, hasNativeFunds: false, hasData: true, toSelf: true, skip: true },
  { id: 12, name: 'Funds + Data to others', hasValue: false, hasFunds: true, hasNativeFunds: false, hasData: true, toSelf: false },
  { id: 13, name: 'Value + Funds + Data to self', hasValue: true, hasFunds: true, hasNativeFunds: false, hasData: true, toSelf: true, skip: true },
  { id: 14, name: 'Value + Funds + Data to others', hasValue: true, hasFunds: true, hasNativeFunds: false, hasData: true, toSelf: false },
  // Native Funds routes
  { id: 15, name: 'Native Funds to self', hasValue: false, hasFunds: false, hasNativeFunds: true, hasData: false, toSelf: true },
  { id: 16, name: 'Native Funds to others', hasValue: false, hasFunds: false, hasNativeFunds: true, hasData: false, toSelf: false },
  { id: 17, name: 'Value + Native Funds to self', hasValue: true, hasFunds: false, hasNativeFunds: true, hasData: false, toSelf: true },
  { id: 18, name: 'Value + Native Funds to others', hasValue: true, hasFunds: false, hasNativeFunds: true, hasData: false, toSelf: false },
  { id: 19, name: 'Native Funds + Data to self', hasValue: false, hasFunds: false, hasNativeFunds: true, hasData: true, toSelf: true, skip: true },
  { id: 20, name: 'Native Funds + Data to others', hasValue: false, hasFunds: false, hasNativeFunds: true, hasData: true, toSelf: false },
  { id: 21, name: 'Value + Funds + Native Funds to self', hasValue: true, hasFunds: true, hasNativeFunds: true, hasData: false, toSelf: true },
  { id: 22, name: 'Value + Funds + Native Funds to others', hasValue: true, hasFunds: true, hasNativeFunds: true, hasData: false, toSelf: false },
];

// ==============================================
// MAIN FUNCTION
// ==============================================
async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   Universal Transaction Test Suite - All 22 Routes            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Step 1: Chain selection
  console.log('📋 Available Chains:\n');
  console.log('   1. Push Chain (Donut)');
  console.log('   2. Ethereum Sepolia');
  console.log('   3. Arbitrum Sepolia');
  console.log('   4. Base Sepolia');
  console.log('   5. BSC Testnet');
  console.log('   6. Solana Devnet\n');
  
  const chainType = await rl.question('Select chain (1-6): ');
  
  const chainMap: Record<string, { name: string; isEVM: boolean; isPushChain: boolean; chainKey: string }> = {
    '1': { name: 'Push Chain (Donut)', isEVM: true, isPushChain: true, chainKey: 'PUSH_TESTNET_DONUT' },
    '2': { name: 'Ethereum Sepolia', isEVM: true, isPushChain: false, chainKey: 'ETHEREUM_SEPOLIA' },
    '3': { name: 'Arbitrum Sepolia', isEVM: true, isPushChain: false, chainKey: 'ARBITRUM_SEPOLIA' },
    '4': { name: 'Base Sepolia', isEVM: true, isPushChain: false, chainKey: 'BASE_SEPOLIA' },
    '5': { name: 'BSC Testnet', isEVM: true, isPushChain: false, chainKey: 'BNB_TESTNET' },
    '6': { name: 'Solana Devnet', isEVM: false, isPushChain: false, chainKey: 'SOLANA_DEVNET' },
  };
  
  if (!chainMap[chainType]) {
    console.log('❌ Invalid selection');
    process.exit(1);
  }
  
  const selectedChain = chainMap[chainType];
  console.log(`✅ Selected: ${selectedChain.name}\n`);

  // Step 2: Display all available routes
  console.log('📋 Available Test Routes:\n');
  TRANSACTION_ROUTES.forEach((route) => {
    let skipLabel = '';
    if (route.skip) {
      skipLabel = ' (SKIPPED - Cannot execute data on own UEA)';
    } else if (selectedChain.isPushChain && (route.hasFunds || route.hasNativeFunds)) {
      skipLabel = ' (SKIPPED - Not Supported on Push Chain)';
    }
    console.log(`   ${route.id.toString().padStart(2, ' ')}. ${route.name}${skipLabel}`);
  });
  
  if (selectedChain.isPushChain) {
    console.log('\n   ℹ️  Note: For funds movement on Push Chain, use ERC-20 ABI (transfer/approve) or native value transfers');
  }
  
  console.log('\n' + '─'.repeat(70) + '\n');
  
  // Step 3: Route selection
  const routeSelection = (await rl.question('Run all routes or specific route? (route number or hit enter for all): ')).trim();
  
  let selectedRoutes: typeof TRANSACTION_ROUTES;
  
  if (routeSelection === '' || routeSelection.toLowerCase() === 'all') {
    selectedRoutes = TRANSACTION_ROUTES;
    console.log('✅ Running all 22 routes\n');
  } else {
    const routeNum = parseInt(routeSelection);
    if (isNaN(routeNum) || routeNum < 1 || routeNum > 22) {
      console.log('❌ Invalid route number. Please enter a number between 1 and 22.');
      process.exit(1);
    }
    selectedRoutes = TRANSACTION_ROUTES.filter(r => r.id === routeNum);
    console.log(`✅ Running Route ${routeNum}: ${selectedRoutes[0].name}\n`);
  }

  // Step 4: Wallet setup
  const masterPrivateKey = selectedChain.isEVM ? ETHEREUM_MASTER_PRIVATE_KEY : SOLANA_MASTER_PRIVATE_KEY;
  let providedPrivateKey: string | null = null;
  
  if (masterPrivateKey !== null) {
    // Automatically use configured master wallet
    console.log('✅ Using configured master wallet\n');
    providedPrivateKey = masterPrivateKey;
  } else {
    // Ask user to provide private key or hit enter to generate new
    const keyPrompt = selectedChain.isEVM
      ? 'Enter EVM private key (with 0x prefix) or hit Enter to generate new wallet: '
      : 'Enter Solana private key (base58 format) or hit Enter to generate new wallet: ';
    
    const walletInput = (await rl.question(keyPrompt)).trim();
    
    if (walletInput === '') {
      console.log('✅ Generating new wallet\n');
      providedPrivateKey = null;
    } else {
      console.log('✅ Using provided wallet\n');
      providedPrivateKey = walletInput;
    }
  }

  if (selectedChain.isEVM) {
    await testEVMRoutes(selectedRoutes, providedPrivateKey, selectedChain.chainKey, selectedChain.name, selectedChain.isPushChain);
  } else {
    await testSolanaRoutes(selectedRoutes, providedPrivateKey);
  }

  rl.close();
}

// Run main
main().catch(console.error);

// ==============================================
// EVM TEST SUITE (Ethereum, Polygon, Arbitrum, Base, Optimism, BSC, Cyber, Push Chain)
// ==============================================
async function testEVMRoutes(
  selectedRoutes: typeof TRANSACTION_ROUTES,
  providedPrivateKey: string | null,
  chainKey: string,
  chainName: string,
  isPushChain: boolean
) {
  console.log(`\n🔷 ${chainName.toUpperCase()} TEST SUITE\n`);

  // Get RPC URL based on chain key
  const rpcMap: Record<string, string> = {
    'PUSH_TESTNET_DONUT': PUSH_DONUT_RPC,
    'ETHEREUM_SEPOLIA': ETHEREUM_SEPOLIA_RPC,
    'ARBITRUM_SEPOLIA': ARBITRUM_SEPOLIA_RPC,
    'BASE_SEPOLIA': BASE_SEPOLIA_RPC,
    'BNB_TESTNET': BSC_TESTNET_RPC,
  };
  
  const rpcUrl = rpcMap[chainKey] || PUSH_DONUT_RPC;

  // Setup master wallet
  let masterWallet: ethers.Wallet;
  
  if (providedPrivateKey) {
    masterWallet = new ethers.Wallet(providedPrivateKey);
    console.log(`🔑 Using provided ${chainName} master wallet`);
  } else {
    masterWallet = ethers.Wallet.createRandom();
    console.log(`🔑 Generated new ${chainName} master wallet`);
    console.log(`   Private Key: ${masterWallet.privateKey}`);
  }

  console.log(`   Address: ${masterWallet.address}\n`);

  // Ask if user wants to see transaction receipts
  const showReceiptsInput = (await rl.question('Show transaction receipts? (y/n or hit Enter for yes): ')).trim().toLowerCase();
  const showReceipts = showReceiptsInput === 'n' || showReceiptsInput === 'no' ? false : true;
  
  if (showReceipts) {
    console.log('✅ Transaction receipts will be displayed\n');
  } else {
    console.log('✅ Transaction receipts will be hidden\n');
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const masterSigner = masterWallet.connect(provider);
  const masterUniversalSigner = await PushChain.utils.signer.toUniversal(masterSigner);
  
  const masterPushChainClient = await PushChain.initialize(masterUniversalSigner);

  // Get USDT token address
  const usdtAddress = masterPushChainClient.moveable.token.USDT.address;

  // Get native token and deposit amount based on chain key
  const nativeTokenMap: Record<string, string> = {
    'PUSH_TESTNET_DONUT': 'PC',
    'ETHEREUM_SEPOLIA': 'ETH',
    'ARBITRUM_SEPOLIA': 'ETH',
    'BASE_SEPOLIA': 'ETH',
    'BNB_TESTNET': 'BNB',
  };
  
  const depositAmountMap: Record<string, string> = {
    'PUSH_TESTNET_DONUT': '1',
    'ETHEREUM_SEPOLIA': '0.08',
    'ARBITRUM_SEPOLIA': '0.06',
    'BASE_SEPOLIA': '0.06',
    'BNB_TESTNET': '0.1',
  };
  
  const nativeToken = nativeTokenMap[chainKey] || 'ETH';
  const depositAmount = depositAmountMap[chainKey] || '0.06';
  
  console.log('📋 Please complete the following steps:');
  console.log(`   1. Send ${depositAmount} ${nativeToken} to ${masterWallet.address}`);
  
  if (!isPushChain) {
    console.log(`   2. Mint 1 USDT (check token faucet or contract for ${chainName})`);
    console.log(`      💵 USDT Token Address: ${usdtAddress}\n`);
    console.log(`      (Connect wallet and call mint function)\n`);
  } else {
    console.log();
  }
  
  await rl.question('⚠️  Press Enter once you have completed the step(s)...');

  // ============================================
  // PART 1: EXISTING USER TESTS
  // ============================================
  console.log('\n' + '═'.repeat(70));
  console.log('PART 1: EXISTING USER TESTS (Deterministic UEA)');
  console.log('═'.repeat(70));
  console.log(`\n📝 Creating existing user by sending 0.001 ${nativeToken} as Value to Self...\n`);

  // Create existing user with deterministic UEA
  const initTx = await sendTransactionWithRetry(masterPushChainClient, {
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
    originChain: chainName,
    originTxHash: initTx.hash,
    ueaAddress: existingUserUEA,
    donutExplorerUrl: donutUrl,
  });

  // Run all tests with existing user
  await runTestRoutes(masterWallet, masterPushChainClient, existingUserUEA, provider, usdtAddress, 'EXISTING USER', showReceipts, selectedRoutes, chainName, nativeToken, chainKey, isPushChain);

  // ============================================
  // PART 2: NEW USER TESTS
  // ============================================
  console.log('\n\n' + '═'.repeat(70));
  console.log('PART 2: NEW USER TESTS (Fresh wallets for each test)');
  console.log('═'.repeat(70) + '\n');

  for (const route of selectedRoutes) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🧪 NEW USER - Testing Route ${route.id}: ${route.name}`);
    console.log(`${'='.repeat(70)}`);

    // Skip routes with funds or native funds on Push Chain (not supported)
    if (isPushChain && (route.hasFunds || route.hasNativeFunds)) {
      console.log(`⏭️  Route ${route.id}: ${route.name} - SKIPPED (Funds/Native Funds not supported on Push Chain)`);
      allTransactions.push({
        description: `NEW USER - Route ${route.id}: ${route.name} - SKIPPED`,
        walletAddress: 'N/A',
        originChain: chainName,
        originTxHash: 'N/A - Skipped (Funds not supported on Push Chain)',
        ueaAddress: 'N/A',
        donutExplorerUrl: 'N/A',
      });
      continue;
    }

    if (route.skip) {
      console.log(`⏭️  Route ${route.id}: ${route.name} - SKIPPED (Can't execute data on your own UEA)`);
      allTransactions.push({
        description: `NEW USER - Route ${route.id}: ${route.name} - SKIPPED`,
        walletAddress: 'N/A',
        originChain: chainName,
        originTxHash: 'N/A - Skipped (Cannot execute data on own UEA)',
        ueaAddress: 'N/A',
        donutExplorerUrl: 'N/A',
      });
      continue;
    }

    // Declare variables outside try block so they're accessible in catch
    let newWallet: ethers.Wallet | undefined;
    let newUserUEA: string = 'N/A';

    try {
      // Generate fresh wallet for this test
      newWallet = ethers.Wallet.createRandom();
      const newSigner = newWallet.connect(provider);
      console.log(`   🆕 Generated new wallet: ${newWallet.address}`);

      // Generate random other address for this test
      const otherAddress = ethers.Wallet.createRandom().address;

      // Transfer native token from master to new wallet
      console.log(`   💸 Transferring ${nativeToken} from master wallet...`);
      const fundTx = await masterSigner.sendTransaction({
        to: newWallet.address,
        value: PushChain.utils.helpers.parseUnits('0.002', 18),
      });
      await fundTx.wait();
      console.log(`   ✅ ${nativeToken} transferred`);

      // Transfer USDT from master to new wallet if route requires funds
      if (route.hasFunds) {
        console.log('   💵 Transferring USDT from master wallet...');
        const usdtContract = new ethers.Contract(
          usdtAddress,
          ['function transfer(address to, uint256 amount) returns (bool)'],
          masterSigner
        );
        const usdtTransferAmount = PushChain.utils.helpers.parseUnits('0.0001', 6); // Transfer 0.0001 USDT
        const usdtTx = await usdtContract.transfer(newWallet.address, usdtTransferAmount);
        await usdtTx.wait();
        console.log('   ✅ USDT transferred');
      }

      // Initialize Push Chain client for new wallet
      const newUniversalSigner = await PushChain.utils.signer.toUniversal(newSigner);
      const newPushChainClient = await PushChain.initialize(newUniversalSigner, {
        network: PushChain.CONSTANTS.PUSH_NETWORK.TESTNET,
      });

      newUserUEA = newPushChainClient.universal.account;
      console.log(`   📍 New User UEA: ${newUserUEA}`);

      // Build transaction params
      const txParams: any = {
        to: route.toSelf ? newUserUEA : otherAddress,
      };

      // Dynamic amounts based on route ID
      const ethAmount = `0.000000${route.id}`;
      const usdtAmountRaw = route.id * 0.000001; // Proper 6 decimal calculation
      const usdtAmount = usdtAmountRaw.toFixed(6);
      const nativeEthAmount = `0.000000${route.id}`; // Native funds amount

      if (route.hasValue) {
        txParams.value = PushChain.utils.helpers.parseUnits(ethAmount, 18);
        console.log(`   💰 Value: ${ethAmount} ${nativeToken}`);
      }

      if (route.hasFunds) {
        txParams.funds = {
          amount: PushChain.utils.helpers.parseUnits(usdtAmount, 6), // USDT has 6 decimals
          token: newPushChainClient.moveable.token.USDT,
        };
        console.log(`   💵 Funds: ${usdtAmount} USDT`);
      }

      if (route.hasNativeFunds) {
        txParams.funds = {
          amount: PushChain.utils.helpers.parseUnits(nativeEthAmount, 18), // Native token has 18 decimals
          token: newPushChainClient.moveable.token.ETH,
        };
        console.log(`   💎 Native Funds: ${nativeEthAmount} ${nativeToken}`);
      }

      if (route.hasData) {
        // Read counter before increment
        const donutProvider = new ethers.JsonRpcProvider(PUSH_DONUT_RPC);
        const counterContract = new ethers.Contract(COUNTER_ADDRESS_PAYABLE, COUNTER_ABI, donutProvider);
        const countBefore = await counterContract.countPC();
        
        const data = PushChain.utils.helpers.encodeTxData({
          abi: COUNTER_ABI as unknown as any[],
          functionName: 'increment',
        }) as `0x${string}`;
        txParams.data = data;
        txParams.to = COUNTER_ADDRESS_PAYABLE;
        console.log(`   📦 Data: increment() | Counter before: ${countBefore.toString()}`);
      }

      console.log(`   🎯 To: ${txParams.to}`);
      console.log('\n   ⏳ Sending transaction...');

      const txResponse = await sendTransactionWithRetry(newPushChainClient, txParams);
      
      console.log('\n   ✅ Transaction sent successfully!');
      
      const donutUrl = newPushChainClient.explorer.getTransactionUrl(txResponse.hash);
      allTransactions.push({
        description: `NEW USER - Route ${route.id}: ${route.name}`,
        walletAddress: newWallet.address,
        originChain: chainName,
        originTxHash: txResponse.hash,
        ueaAddress: newUserUEA,
        donutExplorerUrl: donutUrl,
      });

      await logTransactionDetails(newWallet.address, txResponse.hash, newUserUEA, newPushChainClient, chainName, txParams.to);

      const receipt = await txResponse.wait();
      console.log('   ✅ Transaction confirmed on Donut');
      
      // Read counter after increment if data transaction
      if (route.hasData) {
        const donutProvider = new ethers.JsonRpcProvider(PUSH_DONUT_RPC);
        const counterContract = new ethers.Contract(COUNTER_ADDRESS_PAYABLE, COUNTER_ABI, donutProvider);
        const countAfter = await counterContract.countPC();
        console.log(`   📊 Counter after: ${countAfter.toString()}`);
      }

      // Display transaction receipt if requested
      if (showReceipts) {
        console.log('\n   📜 Transaction Receipt:');
        console.log(JSON.stringify(receipt, (key, value) => 
          typeof value === 'bigint' ? value.toString() : value
        , 2));
      }

    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
      
      // Add failed transaction to summary
      allTransactions.push({
        description: `NEW USER - Route ${route.id}: ${route.name} - FAILED`,
        walletAddress: newWallet?.address || 'N/A',
        originChain: chainName,
        originTxHash: `Error: ${error.message}`,
        ueaAddress: newUserUEA,
        donutExplorerUrl: 'N/A',
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log(`\n\n✅ ${chainName} test suite completed!`);
  
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
  userType: string,
  showReceipts: boolean,
  selectedRoutes: typeof TRANSACTION_ROUTES,
  chainName: string,
  nativeToken: string,
  chainKey: string,
  isPushChain: boolean
) {
  for (const route of selectedRoutes) {
    // Generate random other address for each test
    const otherAddress = ethers.Wallet.createRandom().address;

    console.log(`\n${'='.repeat(70)}`);
    console.log(`🧪 ${userType} - Testing Route ${route.id}: ${route.name}`);
    console.log(`${'='.repeat(70)}`);

    // Skip routes with funds or native funds on Push Chain (not supported)
    if (isPushChain && (route.hasFunds || route.hasNativeFunds)) {
      console.log(`⏭️  Route ${route.id}: ${route.name} - SKIPPED (Funds/Native Funds not supported on Push Chain)`);
      allTransactions.push({
        description: `Route ${route.id}: ${route.name} - SKIPPED`,
        walletAddress: wallet.address,
        originChain: chainName,
        originTxHash: 'N/A - Skipped (Funds not supported on Push Chain)',
        ueaAddress: ueaAddress,
        donutExplorerUrl: 'N/A',
      });
      continue;
    }

    if (route.skip) {
      console.log(`⏭️  Route ${route.id}: ${route.name} - SKIPPED (Can't execute data on your own UEA)`);
      allTransactions.push({
        description: `Route ${route.id}: ${route.name} - SKIPPED`,
        walletAddress: wallet.address,
        originChain: chainName,
        originTxHash: 'N/A - Skipped (Cannot execute data on own UEA)',
        ueaAddress: ueaAddress,
        donutExplorerUrl: 'N/A',
      });
      continue;
    }

    try {
      const txParams: any = {
        to: route.toSelf ? ueaAddress : otherAddress,
      };

      // Dynamic amounts based on route ID
      const ethAmount = `0.00000${route.id}`;
      const usdtAmountRaw = route.id * 0.000001; // Proper 6 decimal calculation
      const usdtAmount = usdtAmountRaw.toFixed(6);
      const nativeEthAmount = `0.00000${route.id}`; // Native funds amount

      if (route.hasValue) {
        txParams.value = PushChain.utils.helpers.parseUnits(ethAmount, 18);
        console.log(`   💰 Value: ${ethAmount} ${nativeToken}`);
      }

      if (route.hasFunds) {
        txParams.funds = {
          amount: PushChain.utils.helpers.parseUnits(usdtAmount, 6), // USDT has 6 decimals
          token: pushChainClient.moveable.token.USDT,
        };
        console.log(`   💵 Funds: ${usdtAmount} USDT`);
      }

      if (route.hasNativeFunds) {
        txParams.funds = {
          amount: PushChain.utils.helpers.parseUnits(nativeEthAmount, 18), // Native token has 18 decimals
          token: pushChainClient.moveable.token.ETH,
        };
        console.log(`   💎 Native Funds: ${nativeEthAmount} ${nativeToken}`);
      }

      if (route.hasData) {
        // Read counter before increment
        const donutProvider = new ethers.JsonRpcProvider(PUSH_DONUT_RPC);
        const counterContract = new ethers.Contract(COUNTER_ADDRESS_PAYABLE, COUNTER_ABI, donutProvider);
        const countBefore = await counterContract.countPC();
        
        const data = PushChain.utils.helpers.encodeTxData({
          abi: COUNTER_ABI as unknown as any[],
          functionName: 'increment',
        }) as `0x${string}`;
        txParams.data = data;
        txParams.to = COUNTER_ADDRESS_PAYABLE;
        console.log(`   📦 Data: increment() | Counter before: ${countBefore.toString()}`);
      }

      console.log(`   🎯 To: ${txParams.to}`);
      console.log('\n   ⏳ Sending transaction...');

      const txResponse = await sendTransactionWithRetry(pushChainClient, txParams);
      
      console.log('\n   ✅ Transaction sent successfully!');
      
      const donutUrl = pushChainClient.explorer.getTransactionUrl(txResponse.hash);
      allTransactions.push({
        description: `Route ${route.id}: ${route.name}`,
        walletAddress: wallet.address,
        originChain: chainName,
        originTxHash: txResponse.hash,
        ueaAddress: ueaAddress,
        donutExplorerUrl: donutUrl,
      });

      await logTransactionDetails(wallet.address, txResponse.hash, ueaAddress, pushChainClient, chainName, txParams.to);

      const receipt = await txResponse.wait();
      console.log('   ✅ Transaction confirmed on Donut');
      
      // Read counter after increment if data transaction
      if (route.hasData) {
        const donutProvider = new ethers.JsonRpcProvider(PUSH_DONUT_RPC);
        const counterContract = new ethers.Contract(COUNTER_ADDRESS_PAYABLE, COUNTER_ABI, donutProvider);
        const countAfter = await counterContract.countPC();
        console.log(`   📊 Counter after: ${countAfter.toString()}`);
      }

      // Display transaction receipt if requested
      if (showReceipts) {
        console.log('\n   📜 Transaction Receipt:');
        console.log(JSON.stringify(receipt, (key, value) => 
          typeof value === 'bigint' ? value.toString() : value
        , 2));
      }

    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
      
      // Add failed transaction to summary
      allTransactions.push({
        description: `Route ${route.id}: ${route.name} - FAILED`,
        walletAddress: wallet.address,
        originChain: chainName,
        originTxHash: `Error: ${error.message}`,
        ueaAddress: ueaAddress,
        donutExplorerUrl: 'N/A',
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

// ==============================================
// SOLANA TEST SUITE
// ==============================================
async function testSolanaRoutes(selectedRoutes: typeof TRANSACTION_ROUTES, providedPrivateKey: string | null) {
  console.log('\n🟣 SOLANA TEST SUITE\n');

  // Setup master wallet
  let masterKeypair: Keypair;
  
  if (providedPrivateKey) {
    const secretKey = bs58.decode(providedPrivateKey);
    masterKeypair = Keypair.fromSecretKey(secretKey);
    console.log('🔑 Using provided Solana master wallet');
  } else {
    masterKeypair = Keypair.generate();
    console.log('🔑 Generated new Solana master wallet');
    console.log(`   Private Key (base58): ${bs58.encode(masterKeypair.secretKey)}`);
  }

  console.log(`   Address: ${masterKeypair.publicKey.toBase58()}\n`);

  // Ask if user wants to see transaction receipts
  const showReceiptsInput = (await rl.question('Show transaction receipts? (y/n or hit Enter for yes): ')).trim().toLowerCase();
  const showReceipts = showReceiptsInput === 'n' || showReceiptsInput === 'no' ? false : true;
  
  if (showReceipts) {
    console.log('✅ Transaction receipts will be displayed\n');
  } else {
    console.log('✅ Transaction receipts will be hidden\n');
  }

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
  console.log(`   1. Send 0.06 Devnet SOL to ${masterKeypair.publicKey.toBase58()}`);
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
  const initTx = await sendTransactionWithRetry(masterPushChainClient, {
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
  await runTestRoutesSolana(masterKeypair, masterPushChainClient, existingUserUEA, usdtAddress, 'EXISTING USER', showReceipts, selectedRoutes);

  // ============================================
  // PART 2: NEW USER TESTS
  // ============================================
  console.log('\n\n' + '═'.repeat(70));
  console.log('PART 2: NEW USER TESTS (Fresh wallets for each test)');
  console.log('═'.repeat(70) + '\n');

  for (const route of selectedRoutes) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🧪 NEW USER - Testing Route ${route.id}: ${route.name}`);
    console.log(`${'='.repeat(70)}`);

    if (route.skip) {
      console.log(`⏭️  Route ${route.id}: ${route.name} - SKIPPED (Can't execute data on your own UEA)`);
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

    // Declare variables outside try block so they're accessible in catch
    let newKeypair: Keypair | undefined;
    let newUserUEA: string = 'N/A';

    try {
      // Generate fresh wallet for this test
      newKeypair = Keypair.generate();
      console.log(`   🆕 Generated new wallet: ${newKeypair.publicKey.toBase58()}`);

      // Generate random other address for this test
      const otherAddress = ethers.Wallet.createRandom().address;

      // Transfer SOL from master to new wallet (using Solana native transfer)
      console.log('   💸 Transferring SOL from master wallet...');
      const { Connection, SystemProgram, Transaction, sendAndConfirmTransaction } = await import('@solana/web3.js');
      const connection = new Connection(SOLANA_DEVNET_RPC, 'confirmed');
      
      const transferIx = SystemProgram.transfer({
        fromPubkey: masterKeypair.publicKey,
        toPubkey: newKeypair.publicKey,
        lamports: 2000000, // 0.002 SOL
      });
      
      const transaction = new Transaction().add(transferIx);
      await sendAndConfirmTransaction(connection, transaction, [masterKeypair]);
      console.log('   ✅ SOL transferred');

      // Transfer USDT from master to new wallet if route requires funds
      if (route.hasFunds) {
        console.log('   💵 Transferring USDT from master wallet...');
        // Use SPL token transfer for Solana USDT
        const { getOrCreateAssociatedTokenAccount, transfer, getMint } = await import('@solana/spl-token');
        const { PublicKey } = await import('@solana/web3.js');
        
        const usdtMintAddress = new PublicKey(usdtAddress);
        
        // Get or create associated token accounts
        const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
          connection,
          masterKeypair,
          usdtMintAddress,
          masterKeypair.publicKey
        );
        
        const toTokenAccount = await getOrCreateAssociatedTokenAccount(
          connection,
          masterKeypair,
          usdtMintAddress,
          newKeypair.publicKey
        );
        
        // Transfer 0.0001 USDT (100000 with 6 decimals)
        await transfer(
          connection,
          masterKeypair,
          fromTokenAccount.address,
          toTokenAccount.address,
          masterKeypair.publicKey,
          100000 // 0.0001 USDT with 6 decimals
        );
        
        console.log('   ✅ USDT transferred');
      }

      // Initialize Push Chain client for new wallet
      const newUniversalSigner = await PushChain.utils.signer.toUniversalFromKeypair(newKeypair, {
        chain: PushChain.CONSTANTS.CHAIN.SOLANA_DEVNET,
        library: PushChain.CONSTANTS.LIBRARY.SOLANA_WEB3JS,
      });
      
      const newPushChainClient = await PushChain.initialize(newUniversalSigner, {
        network: PushChain.CONSTANTS.PUSH_NETWORK.TESTNET,
      });

      newUserUEA = newPushChainClient.universal.account;
      console.log(`   📍 New User UEA: ${newUserUEA}`);

      // Build transaction params
      const txParams: any = {
        to: route.toSelf ? newUserUEA : otherAddress,
      };

      // Dynamic amounts based on route ID (smaller amounts for Solana)
      const solAmountStr = `0.000000${route.id}`; // 0.0000001 to 0.0000014 SOL
      const usdtAmountRaw = route.id * 0.000001; // Proper 6 decimal calculation
      const usdtAmount = usdtAmountRaw.toFixed(6);
      const nativeSolAmount = `0.000000${route.id}`; // Native funds amount

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

      if (route.hasNativeFunds) {
        txParams.funds = {
          amount: PushChain.utils.helpers.parseUnits(nativeSolAmount, 9), // SOL has 9 decimals
          token: newPushChainClient.moveable.token.SOL,
        };
        console.log(`   💎 Native Funds: ${nativeSolAmount} SOL`);
      }

      if (route.hasData) {
        // Read counter before increment
        const donutProvider = new ethers.JsonRpcProvider(PUSH_DONUT_RPC);
        const counterContract = new ethers.Contract(COUNTER_ADDRESS_PAYABLE, COUNTER_ABI, donutProvider);
        const countBefore = await counterContract.countPC();
        
        const data = PushChain.utils.helpers.encodeTxData({
          abi: COUNTER_ABI as unknown as any[],
          functionName: 'increment',
        }) as `0x${string}`;
        txParams.data = data;
        txParams.to = COUNTER_ADDRESS_PAYABLE;
        console.log(`   📦 Data: increment() | Counter before: ${countBefore.toString()}`);
      }

      console.log(`   🎯 To: ${txParams.to}`);
      console.log('\n   ⏳ Sending transaction...');

      const txResponse = await sendTransactionWithRetry(newPushChainClient, txParams);
      
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
        'Solana Devnet',
        txParams.to
      );

      const receipt = await txResponse.wait();
      console.log('   ✅ Transaction confirmed on Donut');
      
      // Read counter after increment if data transaction
      if (route.hasData) {
        const donutProvider = new ethers.JsonRpcProvider(PUSH_DONUT_RPC);
        const counterContract = new ethers.Contract(COUNTER_ADDRESS_PAYABLE, COUNTER_ABI, donutProvider);
        const countAfter = await counterContract.countPC();
        console.log(`   📊 Counter after: ${countAfter.toString()}`);
      }

      // Display transaction receipt if requested
      if (showReceipts) {
        console.log('\n   📜 Transaction Receipt:');
        console.log(JSON.stringify(receipt, (key, value) => 
          typeof value === 'bigint' ? value.toString() : value
        , 2));
      }

    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
      
      // Add failed transaction to summary
      allTransactions.push({
        description: `NEW USER - Route ${route.id}: ${route.name} - FAILED`,
        walletAddress: newKeypair?.publicKey.toBase58() || 'N/A',
        originChain: 'Solana Devnet',
        originTxHash: `Error: ${error.message}`,
        ueaAddress: newUserUEA,
        donutExplorerUrl: 'N/A',
      });
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
  userType: string,
  showReceipts: boolean,
  selectedRoutes: typeof TRANSACTION_ROUTES
) {
  for (const route of selectedRoutes) {
    // Generate random other address for each test
    const otherAddress = ethers.Wallet.createRandom().address;

    console.log(`\n${'='.repeat(70)}`);
    console.log(`🧪 ${userType} - Testing Route ${route.id}: ${route.name}`);
    console.log(`${'='.repeat(70)}`);

    if (route.skip) {
      console.log(`⏭️  Route ${route.id}: ${route.name} - SKIPPED (Can't execute data on your own UEA)`);
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

    try {
      const txParams: any = {
        to: route.toSelf ? ueaAddress : otherAddress,
      };

      // Dynamic amounts based on route ID (smaller amounts for Solana)
      const solAmountStr = `0.000000${route.id}`; // 0.0000001 to 0.0000014 SOL
      const usdtAmountRaw = route.id * 0.000001; // Proper 6 decimal calculation
      const usdtAmount = usdtAmountRaw.toFixed(6);
      const nativeSolAmount = `0.000000${route.id}`; // Native funds amount

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

      if (route.hasNativeFunds) {
        txParams.funds = {
          amount: PushChain.utils.helpers.parseUnits(nativeSolAmount, 9), // SOL has 9 decimals
          token: pushChainClient.moveable.token.SOL,
        };
        console.log(`   💎 Native Funds: ${nativeSolAmount} SOL`);
      }

      if (route.hasData) {
        // Read counter before increment
        const donutProvider = new ethers.JsonRpcProvider(PUSH_DONUT_RPC);
        const counterContract = new ethers.Contract(COUNTER_ADDRESS_PAYABLE, COUNTER_ABI, donutProvider);
        const countBefore = await counterContract.countPC();
        
        const data = PushChain.utils.helpers.encodeTxData({
          abi: COUNTER_ABI as unknown as any[],
          functionName: 'increment',
        }) as `0x${string}`;
        txParams.data = data;
        txParams.to = COUNTER_ADDRESS_PAYABLE;
        console.log(`   📦 Data: increment() | Counter before: ${countBefore.toString()}`);
      }

      console.log(`   🎯 To: ${txParams.to}`);
      console.log('\n   ⏳ Sending transaction...');

      const txResponse = await sendTransactionWithRetry(pushChainClient, txParams);
      
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
        'Solana Devnet',
        txParams.to
      );

      const receipt = await txResponse.wait();
      console.log('   ✅ Transaction confirmed on Donut');
      
      // Read counter after increment if data transaction
      if (route.hasData) {
        const donutProvider = new ethers.JsonRpcProvider(PUSH_DONUT_RPC);
        const counterContract = new ethers.Contract(COUNTER_ADDRESS_PAYABLE, COUNTER_ABI, donutProvider);
        const countAfter = await counterContract.countPC();
        console.log(`   📊 Counter after: ${countAfter.toString()}`);
      }

      // Display transaction receipt if requested
      if (showReceipts) {
        console.log('\n   📜 Transaction Receipt:');
        console.log(JSON.stringify(receipt, (key, value) => 
          typeof value === 'bigint' ? value.toString() : value
        , 2));
      }

    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
      
      // Add failed transaction to summary
      allTransactions.push({
        description: `Route ${route.id}: ${route.name} - FAILED`,
        walletAddress: keypair.publicKey.toBase58(),
        originChain: 'Solana Devnet',
        originTxHash: `Error: ${error.message}`,
        ueaAddress: ueaAddress,
        donutExplorerUrl: 'N/A',
      });
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
function getNativeTokenName(chainKey: string): string {
  const nativeTokenMap: Record<string, string> = {
    'PUSH_TESTNET_DONUT': 'PC',
    'ETHEREUM_SEPOLIA': 'ETH',
    'ARBITRUM_SEPOLIA': 'ETH',
    'BASE_SEPOLIA': 'ETH',
    'BNB_TESTNET': 'BNB',
  };
  return nativeTokenMap[chainKey] || 'ETH';
}

async function sendTransactionWithRetry(
  pushChainClient: any,
  txParams: any
): Promise<any> {
  try {
    return await pushChainClient.universal.sendTransaction(txParams);
  } catch (error: any) {
    console.log(`   ⚠️  Transaction failed, retrying once after 10 seconds...`);
    console.log(`   ℹ️  Error: ${error.message}`);
    await new Promise((resolve) => setTimeout(resolve, 10000));
    
    // Retry once with increased gas price (20% higher)
    const retryParams = { ...txParams };
    
    // Increase maxFeePerGas and maxPriorityFeePerGas by 20% if they exist
    if (retryParams.maxFeePerGas) {
      retryParams.maxFeePerGas = (BigInt(retryParams.maxFeePerGas) * BigInt(120)) / BigInt(100);
    }
    if (retryParams.maxPriorityFeePerGas) {
      retryParams.maxPriorityFeePerGas = (BigInt(retryParams.maxPriorityFeePerGas) * BigInt(120)) / BigInt(100);
    }
    
    console.log(`   🔄 Retrying with 20% higher gas price...`);
    return await pushChainClient.universal.sendTransaction(retryParams);
  }
}

async function logTransactionDetails(
  walletAddress: string,
  txHash: string,
  ueaAddress: string,
  pushChainClient: any,
  originChain: string,
  toAddress: string
) {
  console.log('\n   📊 Transaction Details:');
  console.log(`   ├─ Wallet Address: ${walletAddress}`);
  console.log(`   ├─ Origin Chain: ${originChain}`);
  console.log(`   ├─ Origin Tx Hash: ${txHash}`);
  console.log(`   ├─ UEA Address: ${ueaAddress}`);
  console.log(`   ├─ To Address: ${toAddress}`);
  
  try {
    const donutUrl = pushChainClient.explorer.getTransactionUrl(txHash);
    console.log(`   └─ Donut Explorer: ${donutUrl}`);
  } catch (error) {
    console.log(`   └─ Donut Tx Hash: ${txHash}`);
  }
}
