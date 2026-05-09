// Full Documentation: https://push.org/docs/chain/build/send-universal-transaction
//
// Send Universal Transaction to External Chains (Route 2)
// ========================================================
// Route 2 routes a universal transaction to an EXTERNAL chain. The user signs
// once on Push Chain; the SDK coordinates execution on the target chain via
// the user's CEA (Chain Executor Account) there.
//
//   tx.to = { address, chain: <target> }   ← what makes it Route 2
//
// This script is interactive. Pick a scenario:
//
//   1. Discover your CEAs on every supported external chain (no funding).
//   2. Increment a counter on BNB Testnet via your CEA there.
//   3. Increment a counter on Solana Devnet via your CEA there (Anchor IDL).
//
// Persistent signer
// -----------------
// Set PUSH_PRIVATE_KEY in your environment so re-runs reuse the same Push
// Chain account (and therefore the same CEAs). On first run the script
// generates one and prints it so you can save it.

import 'dotenv/config';
import { PushChain } from '@pushchain/core';
import { ethers } from 'ethers';
import { PublicKey } from '@solana/web3.js';
import * as readline from 'node:readline/promises';

const RPC_PUSH = 'https://evm.donut.rpc.push.org/';
const RPC_BNB = 'https://bsc-testnet-rpc.publicnode.com';

// EVM counter contracts used in the docs examples
const COUNTER_BNB = '0x7f0936bb90e7dcf3edb47199c2005e7184e44cf8' as `0x${string}`;

// Solana Anchor program (Devnet)
const SOL_TEST_PROGRAM = '8yNqjrMnFiFbVTVQcKij8tNWWTMdFkrDf9abCGgc2sgx';

const COUNTER_ABI = [
  { inputs: [], name: 'increment', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'count', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
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
  console.log('  Send Universal Transaction to External Chains (Route 2)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('Pick a scenario:');
  console.log('  1) Discover your CEAs across supported chains (no funding)');
  console.log('  2) Route 2 — increment a counter on BNB Testnet via your CEA');
  console.log('  3) Route 2 — call a Solana program on Devnet via your CEA');
  console.log('');

  const choice = (await rl.question('Choice (1/2/3): ')).trim();
  switch (choice) {
    case '1':
      await discoverCEAs();
      break;
    case '2':
      await route2BnbCounter();
      break;
    case '3':
      await route2SolanaCounter();
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
// Persistent Push Chain signer
// ──────────────────────────────────────────────────────────────────────────────

async function buildPushClient() {
  const provider = new ethers.JsonRpcProvider(RPC_PUSH);

  let wallet: ethers.Wallet;
  if (process.env.PUSH_PRIVATE_KEY) {
    wallet = new ethers.Wallet(process.env.PUSH_PRIVATE_KEY, provider);
    console.log('🔑 Using PUSH_PRIVATE_KEY from environment.');
  } else {
    const random = ethers.Wallet.createRandom();
    wallet = new ethers.Wallet(random.privateKey, provider);
    console.log('🔑 No PUSH_PRIVATE_KEY env var found — generated a fresh wallet.');
    console.log('   To re-run with the same Push account (and same CEAs), save:');
    console.log(`   PUSH_PRIVATE_KEY=${random.privateKey}`);
  }

  const universalSigner = await PushChain.utils.signer.toUniversal(wallet);
  const client = await PushChain.initialize(universalSigner, {
    network: PushChain.CONSTANTS.PUSH_NETWORK.TESTNET,
  });

  console.log('📍 Push native EOA:', wallet.address);
  console.log('📍 UEA on Push:    ', client.universal.account);

  return { client, wallet };
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

// SVM (Solana) chains return CEA addresses as 32-byte hex; show them in the
// base58 form Solana developers expect.
function formatChainAddress(chain: string, address: string): string {
  if (!chain.startsWith('solana:')) return address;
  const bytes = Buffer.from(address.replace(/^0x/, ''), 'hex');
  return new PublicKey(bytes).toBase58();
}

// Pretty-print a low-level ProgressEvent fired from
// `tx.progressHook(callback)` registered on the UniversalTxResponse.
// These are the SDK's per-step lifecycle events for an outbound Route 2 tx —
// IDs in the SEND-TX-2xx series cover route stages, outbound polling, and
// terminal status.
function formatLifecycleProgress(p: {
  id: string;
  title: string;
  message?: string;
  level: 'INFO' | 'SUCCESS' | 'ERROR';
}) {
  const emoji = p.level === 'SUCCESS' ? '✅' : p.level === 'ERROR' ? '❌' : 'ℹ️ ';
  console.log(`   ${emoji} ${p.id} — ${p.title}`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Scenario 1 — Discover CEAs across every supported external chain
// ──────────────────────────────────────────────────────────────────────────────

async function discoverCEAs() {
  console.log('\n── Scenario 1: Discover your CEAs ─────────────────────────────');

  const { client } = await buildPushClient();

  const pushAccount = PushChain.utils.account.toUniversal(
    client.universal.account,
    { chain: PushChain.CONSTANTS.CHAIN.PUSH_TESTNET }
  );

  const { chains } = PushChain.utils.chains.getSupportedChains(
    PushChain.CONSTANTS.PUSH_NETWORK.TESTNET
  );

  console.log('\n🛰️  CEA addresses (one per supported external chain):\n');
  for (const chain of chains) {
    if (chain === PushChain.CONSTANTS.CHAIN.PUSH_TESTNET) continue;
    const friendly = PushChain.utils.chains.getChainName(chain) ?? chain;
    try {
      const cea = await PushChain.utils.account.deriveExecutorAccount(pushAccount, { chain });
      const deployed = 'deployed' in cea ? cea.deployed : 'n/a';
      const addr = formatChainAddress(chain, cea.address);
      console.log(`  ${friendly.padEnd(20)} ${addr.padEnd(48)}   deployed=${deployed}`);
    } catch (err) {
      console.log(`  ${friendly.padEnd(20)} (skipped: ${err instanceof Error ? err.message : String(err)})`);
    }
  }

  console.log('');
  console.log('💡 CEAs activate the first time you target their chain via Route 2.');
  console.log('   Try scenarios 2 or 3 to fire one.');
}

// ──────────────────────────────────────────────────────────────────────────────
// Scenario 2 — Route 2 to BNB Testnet (EVM target)
// ──────────────────────────────────────────────────────────────────────────────

async function route2BnbCounter() {
  console.log('\n── Scenario 2: Route 2 — increment counter on BNB Testnet ─────');

  const { client } = await buildPushClient();

  // Show the user's CEA on BNB Testnet so they can see where execution happens
  // on the target chain.
  const pushAccount = PushChain.utils.account.toUniversal(
    client.universal.account,
    { chain: PushChain.CONSTANTS.CHAIN.PUSH_TESTNET }
  );
  const bnbCEA = await PushChain.utils.account.deriveExecutorAccount(pushAccount, {
    chain: PushChain.CONSTANTS.CHAIN.BNB_TESTNET,
    skipNetworkCheck: true,
  });
  console.log('📍 BNB Testnet CEA:', bnbCEA.address);

  await rl.question(
    `:::prompt:::Fund this account, then press Enter:\n` +
      `  • UEA ${client.universal.account} on Push Chain — at least 10 PC (covers gas + outbound swap; minimum varies per target chain)\n` +
      `Push Chain faucet: https://faucet.push.org/`
  );

  // Balance precheck — fail fast with a clear message rather than waiting for
  // the SDK's underfunded-swap error during outbound polling.
  const pushProvider = new ethers.JsonRpcProvider(RPC_PUSH);
  const ueaBalance = await pushProvider.getBalance(client.universal.account);
  console.log(`📊 UEA balance: ${ethers.formatEther(ueaBalance)} PC`);
  if (ueaBalance < ethers.parseEther('10')) {
    console.log('⚠️  UEA still has < 10 PC. Aborting before submission.');
    return;
  }

  // Read counter BEFORE so we can confirm the increment lands.
  const bnbProvider = new ethers.JsonRpcProvider(RPC_BNB);
  const bnbCounter = new ethers.Contract(COUNTER_BNB, COUNTER_ABI, bnbProvider);
  const before = await bnbCounter.count();
  console.log(`📊 BNB counter BEFORE: ${before.toString()}`);

  const calldata = PushChain.utils.helpers.encodeTxData({
    abi: COUNTER_ABI,
    functionName: 'increment',
  });

  console.log('\n🚀 Submitting Route 2 transaction...');
  try {
    // Route 2: target is { address, chain }, executes on BNB Testnet via CEA.
    const tx = await client.universal.sendTransaction({
      to: { address: COUNTER_BNB, chain: PushChain.CONSTANTS.CHAIN.BNB_TESTNET },
      value: BigInt(0),
      data: calldata,
    });
    console.log('   📤 initial Push tx:', tx.hash);
    console.log('   🔗 Push explorer: ', client.explorer.getTransactionUrl(tx.hash));

    // Register progressHook BEFORE wait() so we receive the route-specific
    // lifecycle events (SEND-TX-2xx series for Route 2 outbound polling).
    console.log('\n📡 Lifecycle events:');
    tx.progressHook(formatLifecycleProgress);

    const receipt = await tx.wait();
    console.log(`\n✅ Settled. status=${receipt.status === 1 ? 'success' : 'failed'} block=${receipt.blockNumber}`);
    if (receipt.externalTxHash) {
      console.log(`   BNB tx hash:        ${receipt.externalTxHash}`);
      console.log(`   BNB explorer:       ${receipt.externalExplorerUrl}`);
      console.log(`   external status:    ${receipt.externalStatus ?? 'n/a'}`);
    }

    if (receipt.status === 1 && receipt.externalStatus === 'success') {
      const after = await bnbCounter.count();
      console.log(`\n📊 BNB counter AFTER:  ${after.toString()}`);
    }
  } catch (err) {
    console.log(`\n❌ Route 2 failed: ${err instanceof Error ? err.message : String(err)}`);
    console.log('   Common cause: UEA on Push Chain has < 10 PC for gas + outbound swap.');
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Scenario 3 — Route 2 to Solana Devnet (SVM target)
// ──────────────────────────────────────────────────────────────────────────────

async function route2SolanaCounter() {
  console.log('\n── Scenario 3: Route 2 — call Solana program on Devnet ────────');

  const { client } = await buildPushClient();

  // Solana CEA — useful to print so the user can see where execution lands.
  // Gas on Solana is paid by the CEA on first activation; the SDK handles
  // that under the hood for typical Route 2 calls.
  const pushAccount = PushChain.utils.account.toUniversal(
    client.universal.account,
    { chain: PushChain.CONSTANTS.CHAIN.PUSH_TESTNET }
  );
  const solanaCEA = await PushChain.utils.account.deriveExecutorAccount(pushAccount, {
    chain: PushChain.CONSTANTS.CHAIN.SOLANA_DEVNET,
    skipNetworkCheck: true,
  });
  console.log(
    '📍 Solana Devnet CEA:',
    formatChainAddress(PushChain.CONSTANTS.CHAIN.SOLANA_DEVNET, solanaCEA.address)
  );

  await rl.question(
    `:::prompt:::Fund this account, then press Enter:\n` +
      `  • UEA ${client.universal.account} on Push Chain — at least 10 PC (covers gas + outbound swap; SVM outbound requires ~5.2 PC alone)\n` +
      `Push Chain faucet: https://faucet.push.org/`
  );

  // Balance precheck — fail fast with a clear message rather than waiting for
  // the SDK's underfunded-swap error ([R2_SVM:NATIVE]) during outbound polling.
  const pushProvider = new ethers.JsonRpcProvider(RPC_PUSH);
  const ueaBalance = await pushProvider.getBalance(client.universal.account);
  console.log(`📊 UEA balance: ${ethers.formatEther(ueaBalance)} PC`);
  if (ueaBalance < ethers.parseEther('10')) {
    console.log('⚠️  UEA still has < 10 PC. Aborting before submission.');
    return;
  }

  // Encode the Solana instruction with the Anchor IDL. The SDK auto-resolves
  // PDAs, the recipient, and the sender's CEA from the IDL definition.
  const solCalldata = PushChain.utils.helpers.encodeTxData({
    idl: TEST_COUNTER_IDL as any,
    functionName: 'receive_sol',
    args: [BigInt(0)],
  });

  console.log('\n🚀 Submitting Route 2 transaction...');
  try {
    const tx = await client.universal.sendTransaction({
      to: { address: SOL_TEST_PROGRAM, chain: PushChain.CONSTANTS.CHAIN.SOLANA_DEVNET },
      value: BigInt(0),
      data: solCalldata,
    });
    console.log('   📤 initial Push tx:', tx.hash);
    console.log('   🔗 Push explorer: ', client.explorer.getTransactionUrl(tx.hash));

    console.log('\n📡 Lifecycle events:');
    tx.progressHook(formatLifecycleProgress);

    const receipt = await tx.wait();
    console.log(`\n✅ Settled. status=${receipt.status === 1 ? 'success' : 'failed'} block=${receipt.blockNumber}`);
    if (receipt.externalTxHash) {
      console.log(`   Solana tx hash:     ${receipt.externalTxHash}`);
      console.log(`   Solana explorer:    ${receipt.externalExplorerUrl}`);
      console.log(`   external status:    ${receipt.externalStatus ?? 'n/a'}`);
    }
  } catch (err) {
    console.log(`\n❌ Route 2 failed: ${err instanceof Error ? err.message : String(err)}`);
    console.log('   Common cause: UEA on Push Chain has < 10 PC for gas + outbound swap.');
  }
}
