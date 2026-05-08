// Full Documentation: https://push.org/docs/chain/build/send-multichain-transactions
//
// Send Multichain Transactions
// =============================
// Compose multiple universal transactions into a single ordered flow that
// the user signs ONCE. The SDK then coordinates execution across Push Chain
// and supported external chains automatically.
//
// Mental model:
//   1. Prepare each transaction step with `pushChainClient.universal.prepareTransaction(...)`.
//   2. Execute the whole array together with `pushChainClient.universal.executeTransactions([...])`.
//
// This script lets you pick a scenario interactively. Each scenario mirrors a
// section of the docs page above:
//
//   1. Inspect a PreparedUniversalTx (no funding required — just run prepareTransaction).
//   2. Increment counters on Push Chain + BNB Testnet (2-hop cascade).
//   3. Increment counters on Push Chain + BNB Testnet + Solana Devnet (3-hop).

import { PushChain } from '@pushchain/core';
import { ethers } from 'ethers';
import * as readline from 'node:readline/promises';

// ──────────────────────────────────────────────────────────────────────────────
// Config
// ──────────────────────────────────────────────────────────────────────────────

const RPC_SEPOLIA = 'https://ethereum-sepolia-rpc.publicnode.com';
const RPC_PUSH = 'https://evm.donut.rpc.push.org/';
const RPC_BNB = 'https://bsc-testnet-rpc.publicnode.com';

// Counter contracts used in the docs examples
const COUNTER_PUSH = '0x5FbDB2315678afecb367f032d93F642f64180aa3'; // Push Chain Donut
const COUNTER_BNB = '0x7f0936bb90e7dcf3edb47199c2005e7184e44cf8'; // BNB Testnet
const SOL_TEST_PROGRAM = '8yNqjrMnFiFbVTVQcKij8tNWWTMdFkrDf9abCGgc2sgx'; // Solana Devnet

const COUNTER_ABI = [
  { inputs: [], name: 'increment', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'count', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'countPC', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
];

// Trimmed Anchor IDL — only the receive_sol instruction we call below.
// In a real app this comes from your Anchor program's target/idl/*.json.
const TEST_COUNTER_IDL = {
  address: SOL_TEST_PROGRAM,
  metadata: { name: 'test_counter', version: '0.1.0', spec: '0.1.0' },
  instructions: [
    {
      name: 'receive_sol',
      discriminator: [121, 244, 250, 3, 8, 229, 225, 1],
      accounts: [
        { name: 'counter', writable: true, pda: { seeds: [{ kind: 'const', value: [99, 111, 117, 110, 116, 101, 114] }] } },
        { name: 'recipient', writable: true, address: '89q1AUFb7YREHtjc1aYaPywovPq6tb3GYNPyDUJ3rshi' },
        { name: 'cea_authority', writable: true },
        { name: 'system_program', address: '11111111111111111111111111111111' },
      ],
      args: [{ name: 'amount', type: 'u64' }],
    },
  ],
};

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Send Multichain Transactions — Interactive Scenarios');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('Pick a scenario:');
  console.log('  1) Inspect a PreparedUniversalTx (no funding needed)');
  console.log('  2) 2-hop cascade: increment Push Chain + BNB Testnet');
  console.log('  3) 3-hop cascade: increment Push Chain + BNB Testnet + Solana Devnet');
  console.log('');

  const choice = (await rl.question('Choice (1/2/3): ')).trim();

  switch (choice) {
    case '1':
      await inspectPreparedTx();
      break;
    case '2':
      await twoHopCascade();
      break;
    case '3':
      await threeHopCascade();
      break;
    default:
      console.log('Invalid choice.');
  }

  rl.close();
}

main().catch((err) => {
  console.error(err);
  rl.close();
});

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

// Build a fresh Sepolia-origin Push Chain client. Returns the raw wallet too so
// callers can show it in funding prompts.
async function buildSepoliaClient() {
  const wallet = ethers.Wallet.createRandom();
  const provider = new ethers.JsonRpcProvider(RPC_SEPOLIA);
  const signer = wallet.connect(provider);
  console.log('🔑 Sepolia wallet (UOA):', wallet.address);

  const universalSigner = await PushChain.utils.signer.toUniversal(signer);
  const client = await PushChain.initialize(universalSigner, {
    network: PushChain.CONSTANTS.PUSH_NETWORK.TESTNET,
  });
  console.log('📍 UEA on Push Chain:', client.universal.account);

  return { client, wallet };
}


// ──────────────────────────────────────────────────────────────────────────────
// Scenario 1 — Inspect a PreparedUniversalTx
// (no funding required; demonstrates prepareTransaction only)
// ──────────────────────────────────────────────────────────────────────────────

async function inspectPreparedTx() {
  console.log('\n── Scenario 1: Inspect a PreparedUniversalTx ──────────────────');

  const { client } = await buildSepoliaClient();

  const calldata = PushChain.utils.helpers.encodeTxData({
    abi: COUNTER_ABI,
    functionName: 'increment',
  });

  // Route 1: prepare a Push Chain transaction without sending it.
  const route1 = await client.universal.prepareTransaction({
    to: COUNTER_PUSH,
    value: BigInt(0),
    data: calldata,
  });
  console.log('\n📋 Route 1 (Push Chain target):');
  console.log('   route:        ', route1.route);
  console.log('   estimatedGas: ', route1.estimatedGas?.toString?.());
  console.log('   nonce:        ', route1.nonce?.toString?.());
  console.log('   deadline:     ', route1.deadline?.toString?.());

  // Route 2: prepare a cross-chain transaction.
  const route2 = await client.universal.prepareTransaction({
    to: { address: COUNTER_BNB, chain: PushChain.CONSTANTS.CHAIN.BNB_TESTNET },
    value: BigInt(0),
    data: calldata,
  });
  console.log('\n📋 Route 2 (BNB Testnet via CEA):');
  console.log('   route:        ', route2.route);
  console.log('   estimatedGas: ', route2.estimatedGas?.toString?.());

  console.log('\n💡 PreparedUniversalTx is opaque — pass it to executeTransactions, do not modify.');
}

// ──────────────────────────────────────────────────────────────────────────────
// Scenario 2 — Increment Push Chain + BNB via CEA (2-hop)
// Mirrors docs section "Fund BNB CEA then Increment Counter on BNB Testnet"
// ──────────────────────────────────────────────────────────────────────────────

async function twoHopCascade() {
  console.log('\n── Scenario 2: 2-hop cascade (Push Chain + BNB Testnet) ───────');

  const { client, wallet } = await buildSepoliaClient();

  await rl.question(
    `:::prompt:::Fund these accounts, then press Enter:\n` +
      `  • UOA ${wallet.address} on Sepolia — at least 0.005 ETH (gas to sign the cascade)\n` +
      `  • UEA ${client.universal.account} on Push Chain — at least 10 PC (covers gas + outbound swap for the BNB hop)\n` +
      `Sepolia faucet: https://cloud.google.com/application/web3/faucet/ethereum/sepolia\n` +
      `Push Chain faucet: https://faucet.push.org/`
  );

  // Balance precheck on the UEA — fail fast if the cascade can't pay.
  const pushProvider = new ethers.JsonRpcProvider(RPC_PUSH);
  const ueaBalance = await pushProvider.getBalance(client.universal.account);
  console.log(`📊 UEA balance: ${ethers.formatEther(ueaBalance)} PC`);
  if (ueaBalance < ethers.parseEther('10')) {
    console.log('⚠️  UEA still has < 10 PC. Aborting before submission.');
    return;
  }

  // Read counters BEFORE
  const bnbProvider = new ethers.JsonRpcProvider(RPC_BNB);
  const pushCounter = new ethers.Contract(COUNTER_PUSH, COUNTER_ABI, pushProvider);
  const bnbCounter = new ethers.Contract(COUNTER_BNB, COUNTER_ABI, bnbProvider);
  console.log('\n📊 Push Chain counter BEFORE:', (await pushCounter.countPC()).toString());
  console.log('📊 BNB counter BEFORE:        ', (await bnbCounter.count()).toString());

  const calldata = PushChain.utils.helpers.encodeTxData({
    abi: COUNTER_ABI,
    functionName: 'increment',
  });

  // Hop 0 (Route 1): increment counter on Push Chain
  const hop0 = await client.universal.prepareTransaction({
    to: COUNTER_PUSH,
    value: BigInt(0),
    data: calldata,
  });
  console.log('\n✅ hop0 prepared — route:', hop0.route);

  // Hop 1 (Route 2): increment counter on BNB Testnet via CEA
  const hop1 = await client.universal.prepareTransaction({
    to: { address: COUNTER_BNB, chain: PushChain.CONSTANTS.CHAIN.BNB_TESTNET },
    value: BigInt(0),
    data: calldata,
  });
  console.log('✅ hop1 prepared — route:', hop1.route);

  console.log('\n🚀 Executing cascade (one user signature)...');
  const cascade = await client.universal.executeTransactions([hop0, hop1]);
  console.log('   initialTxHash:', cascade.initialTxHash);
  console.log('   hopCount:     ', cascade.hopCount);

  const result = await cascade.wait({
    progressHook: (e: { hopIndex: number; status: string; chain: string }) =>
      console.log(`   [Hop ${e.hopIndex}] ${e.status} on ${e.chain}`),
  });
  console.log('🏁 All hops complete. Success:', result.success);

  if (result.success) {
    console.log('\n📊 Push Chain counter AFTER:', (await pushCounter.countPC()).toString());
    console.log('📊 BNB counter AFTER:        ', (await bnbCounter.count()).toString());
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Scenario 3 — Push Chain + BNB + Solana (3-hop)
// Mirrors docs section "Batch Contract Calls: Push Chain + BNB + Solana in One Signature"
// ──────────────────────────────────────────────────────────────────────────────

async function threeHopCascade() {
  console.log('\n── Scenario 3: 3-hop cascade (Push Chain + BNB + Solana) ──────');

  const { client, wallet } = await buildSepoliaClient();

  await rl.question(
    `:::prompt:::Fund these accounts, then press Enter:\n` +
      `  • UOA ${wallet.address} on Sepolia — at least 0.005 ETH\n` +
      `  • UEA ${client.universal.account} on Push Chain — at least 25 PC (covers gas + outbound swaps; SVM outbound alone needs ~5.2 PC)\n` +
      `Sepolia faucet: https://cloud.google.com/application/web3/faucet/ethereum/sepolia\n` +
      `Push Chain faucet: https://faucet.push.org/`
  );

  // Balance precheck — fail fast if the cascade can't cover both outbound legs.
  const pushProvider = new ethers.JsonRpcProvider(RPC_PUSH);
  const ueaBalance = await pushProvider.getBalance(client.universal.account);
  console.log(`📊 UEA balance: ${ethers.formatEther(ueaBalance)} PC`);
  if (ueaBalance < ethers.parseEther('25')) {
    console.log('⚠️  UEA still has < 25 PC. Aborting before submission.');
    return;
  }

  // Read EVM counters BEFORE
  const bnbProvider = new ethers.JsonRpcProvider(RPC_BNB);
  const pushCounter = new ethers.Contract(COUNTER_PUSH, COUNTER_ABI, pushProvider);
  const bnbCounter = new ethers.Contract(COUNTER_BNB, COUNTER_ABI, bnbProvider);
  console.log('\n📊 Push Chain counter BEFORE:', (await pushCounter.countPC()).toString());
  console.log('📊 BNB counter BEFORE:        ', (await bnbCounter.count()).toString());

  const evmCalldata = PushChain.utils.helpers.encodeTxData({
    abi: COUNTER_ABI,
    functionName: 'increment',
  });

  // Hop 0 (Route 1): Push Chain counter increment
  const hop0 = await client.universal.prepareTransaction({
    to: COUNTER_PUSH,
    value: BigInt(0),
    data: evmCalldata,
  });
  console.log('\n✅ hop0 prepared — route:', hop0.route);

  // Hop 1 (Route 2): BNB counter via CEA
  const hop1 = await client.universal.prepareTransaction({
    to: { address: COUNTER_BNB, chain: PushChain.CONSTANTS.CHAIN.BNB_TESTNET },
    value: BigInt(0),
    data: evmCalldata,
  });
  console.log('✅ hop1 prepared — route:', hop1.route);

  // Hop 2 (Route 2): Solana program call via CEA. The SDK auto-resolves
  // accounts, PDAs, and the sender's CEA from the IDL.
  const solCalldata = PushChain.utils.helpers.encodeTxData({
    idl: TEST_COUNTER_IDL as any,
    functionName: 'receive_sol',
    args: [BigInt(0)],
  });
  const hop2 = await client.universal.prepareTransaction({
    to: { address: SOL_TEST_PROGRAM, chain: PushChain.CONSTANTS.CHAIN.SOLANA_DEVNET },
    value: BigInt(0),
    data: solCalldata,
  });
  console.log('✅ hop2 prepared — route:', hop2.route);

  console.log('\n🚀 Executing 3-hop cascade (one user signature)...');
  const cascade = await client.universal.executeTransactions([hop0, hop1, hop2]);
  console.log('   initialTxHash:', cascade.initialTxHash);
  console.log('   hopCount:     ', cascade.hopCount);

  const result = await cascade.wait({
    progressHook: (e: { hopIndex: number; status: string; chain: string }) =>
      console.log(`   [Hop ${e.hopIndex}] ${e.status} on ${e.chain}`),
  });
  console.log('🏁 All hops complete. Success:', result.success);

  if (result.success) {
    console.log('\n📊 Push Chain counter AFTER:', (await pushCounter.countPC()).toString());
    console.log('📊 BNB counter AFTER:        ', (await bnbCounter.count()).toString());
    console.log('📊 Solana hop: see explorer link in cascade.hops outboundDetails');
  }
}
