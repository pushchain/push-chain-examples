// Full Documentation: https://push.org/docs/chain/build/track-universal-transaction
//
// Track Universal Transaction
// ===========================
// Re-check the status of any universal transaction by passing its origin-chain
// hash. Works for transactions submitted on Push Chain or any external chain,
// and lets you resume tracking after a page refresh, from a backend poller, or
// across sessions — all without sending anything new.
//
//   const response = await pushChainClient.universal.trackTransaction(hash, {
//     chain,                  // origin chain (defaults to Push Chain)
//     progressHook,           // per-step lifecycle callback
//     waitForCompletion,      // true (default) blocks until confirmed
//     advanced: { pollingIntervalMs, timeout, rpcUrls },
//   });
//
// Pick a scenario at the prompt:
//
//   1. Track three sample transactions from Push, Ethereum Sepolia, and Solana
//      Devnet (no funding, no input — uses the hashes from the docs playground).
//   2. Track your own transaction — prompts for the hash + origin chain.

import { PushChain } from '@pushchain/core';
import { ethers } from 'ethers';
import * as readline from 'node:readline/promises';

const RPC_PUSH = 'https://evm.donut.rpc.push.org/';

// Sample transaction hashes from the docs playground. These are real testnet
// transactions you can also click through to on the explorers.
const SAMPLE_PUSH_TX = '0x169929f61574baf62b84ce68b944e09faf566129d0175b2ee1e020c76ae7bd2f';
const SAMPLE_SEPOLIA_TX = '0x9b4743376689eb6f90f3aeb9eea58381b3bcc033e1de4709281fd58a77b85098';
const SAMPLE_SOLANA_TX = '22SirqSwhcSjgyb3wdrW9Zis19dxcLHD5yy3BtRbRoLmykrv8eCzKnPaRGxrrZ7a4A7yKGRMGMehqKpTcdF2ByFR';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Track Universal Transaction — Interactive Scenarios');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('Pick a scenario:');
  console.log('  1) Track three sample transactions (Push / Sepolia / Solana)');
  console.log('  2) Track your own transaction (you supply hash + origin chain)');
  console.log('');

  const choice = (await rl.question('Choice (1/2): ')).trim();
  switch (choice) {
    case '1':
      await trackSampleTransactions();
      break;
    case '2':
      await trackUserTransaction();
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

// Build a Push Chain client. trackTransaction does not send anything, so a
// throwaway random wallet is fine — no funding required.
async function buildPushClient() {
  const wallet = ethers.Wallet.createRandom();
  const provider = new ethers.JsonRpcProvider(RPC_PUSH);
  const signer = wallet.connect(provider);
  const universalSigner = await PushChain.utils.signer.toUniversal(signer);
  return PushChain.initialize(universalSigner, {
    network: PushChain.CONSTANTS.PUSH_NETWORK.TESTNET,
  });
}

// Pretty-print the per-step ProgressEvent fired by trackTransaction's
// progressHook. Same shape as the SEND-TX-* events emitted during a live tx.
function progressLine(label: string) {
  return (p: { id: string; title: string; level: 'INFO' | 'SUCCESS' | 'ERROR'; timestamp: string }) => {
    const emoji = p.level === 'SUCCESS' ? '✅' : p.level === 'ERROR' ? '❌' : 'ℹ️ ';
    console.log(`   ${emoji} [${label}] ${p.id} — ${p.title} @ ${p.timestamp}`);
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Scenario 1 — Track three sample transactions
// Mirrors the docs playground at
// https://push.org/docs/chain/build/track-universal-transaction
// ──────────────────────────────────────────────────────────────────────────────

async function trackSampleTransactions() {
  console.log('\n── Scenario 1: Track sample transactions ──────────────────────');

  const client = await buildPushClient();
  console.log('🔑 Push Chain client ready (read-only — no signing required).\n');

  const samples: Array<{
    label: string;
    hash: string;
    chain: typeof PushChain.CONSTANTS.CHAIN[keyof typeof PushChain.CONSTANTS.CHAIN] | undefined;
  }> = [
    { label: 'Push Chain', hash: SAMPLE_PUSH_TX, chain: undefined }, // defaults to Push Chain
    { label: 'Ethereum Sepolia', hash: SAMPLE_SEPOLIA_TX, chain: PushChain.CONSTANTS.CHAIN.ETHEREUM_SEPOLIA },
    { label: 'Solana Devnet', hash: SAMPLE_SOLANA_TX, chain: PushChain.CONSTANTS.CHAIN.SOLANA_DEVNET },
  ];

  for (const sample of samples) {
    console.log(`\n📡 Tracking ${sample.label} tx: ${sample.hash}`);
    try {
      const response = await client.universal.trackTransaction(sample.hash, {
        ...(sample.chain ? { chain: sample.chain } : {}),
        progressHook: progressLine(sample.label),
        advanced: { timeout: 30_000 },
      });
      console.log(`✅ Resolved. hash=${response.hash} from=${response.from} chain=${response.chainNamespace ?? 'n/a'}`);
      if (response.route) console.log(`   route: ${response.route}`);
      console.log('   explorer:', client.explorer.getTransactionUrl(response.hash));
    } catch (err) {
      console.log(`❌ Failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Scenario 2 — Track a tx supplied by the user
// ──────────────────────────────────────────────────────────────────────────────

async function trackUserTransaction() {
  console.log('\n── Scenario 2: Track your own transaction ─────────────────────');

  const client = await buildPushClient();
  console.log('🔑 Push Chain client ready.\n');

  const hash = (await rl.question('Tx hash (origin-chain hash or signature): ')).trim();
  if (!hash) {
    console.log('No hash provided.');
    return;
  }

  console.log('\nOrigin chain (where the tx was originally submitted):');
  console.log('  1) Push Chain (default)');
  console.log('  2) Ethereum Sepolia');
  console.log('  3) Solana Devnet');
  console.log('  4) Other supported chain (you type the CHAIN name)');
  const chainChoice = (await rl.question('Choice (1/2/3/4): ')).trim();

  let chain: typeof PushChain.CONSTANTS.CHAIN[keyof typeof PushChain.CONSTANTS.CHAIN] | undefined;
  if (chainChoice === '2') chain = PushChain.CONSTANTS.CHAIN.ETHEREUM_SEPOLIA;
  else if (chainChoice === '3') chain = PushChain.CONSTANTS.CHAIN.SOLANA_DEVNET;
  else if (chainChoice === '4') {
    const name = (await rl.question('CHAIN constant name (e.g. BNB_TESTNET): ')).trim();
    const candidate = (PushChain.CONSTANTS.CHAIN as Record<string, string>)[name];
    if (!candidate) {
      console.log(`Unknown chain "${name}".`);
      return;
    }
    chain = candidate as typeof chain;
  }

  console.log(`\n📡 Tracking ${hash} on ${chain ?? 'Push Chain'}`);
  try {
    const response = await client.universal.trackTransaction(hash, {
      ...(chain ? { chain } : {}),
      progressHook: progressLine('user-tx'),
      advanced: { timeout: 60_000 },
    });
    console.log(`\n✅ Resolved.`);
    console.log(`   hash:   ${response.hash}`);
    console.log(`   from:   ${response.from}`);
    console.log(`   chain:  ${response.chainNamespace ?? 'n/a'}`);
    if (response.route) console.log(`   route:  ${response.route}`);
    console.log(`   block:  ${response.blockNumber?.toString?.() ?? 'n/a'}`);
    console.log('   explorer:', client.explorer.getTransactionUrl(response.hash));
  } catch (err) {
    console.log(`\n❌ Failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
