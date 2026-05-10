// Full Documentation: https://push.org/docs/chain/build/sign-universal-message
//
// Sign Universal Message
// ======================
// Sign arbitrary data with your universal signer:
//
//   pushChainClient.universal.signMessage(bytes)        — any chain
//   pushChainClient.universal.signTypedData({ ... })    — EVM only (EIP-712)
//
// No on-chain submission, no funding required. Pick a scenario:
//
//   1. signMessage — plain bytes (works on EVM and Solana)
//   2. signTypedData — EIP-712 typed data (EVM only)
//   3. Run both
//
// The script uses a throwaway ethers.js signer so signTypedData (EVM) works.
// Swap the signer for a Solana keypair to demo the SVM signMessage path.

import { PushChain } from '@pushchain/core';
import { ethers } from 'ethers';
import * as readline from 'node:readline/promises';

const RPC_PUSH = 'https://evm.donut.rpc.push.org/';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Sign Universal Message — Interactive Scenarios');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('Pick a scenario (no funding required):');
  console.log('  1) signMessage — sign plain bytes');
  console.log('  2) signTypedData — sign EIP-712 typed data (EVM only)');
  console.log('  3) Run both');
  console.log('');

  const choice = (await rl.question('Choice (1/2/3): ')).trim();
  const client = await buildPushClient();

  switch (choice) {
    case '1':
      await signMessageDemo(client);
      break;
    case '2':
      await signTypedDataDemo(client);
      break;
    case '3':
      await signMessageDemo(client);
      console.log('');
      await signTypedDataDemo(client);
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
// Build a Push Chain client backed by a throwaway ethers signer.
// ──────────────────────────────────────────────────────────────────────────────

async function buildPushClient() {
  const wallet = ethers.Wallet.createRandom();
  const provider = new ethers.JsonRpcProvider(RPC_PUSH);
  const signer = wallet.connect(provider);
  const universalSigner = await PushChain.utils.signer.toUniversal(signer);
  const client = await PushChain.initialize(universalSigner, {
    network: PushChain.CONSTANTS.PUSH_NETWORK.TESTNET,
  });
  console.log('🔑 Push Chain client ready.');
  console.log('📍 Origin wallet:', client.universal.origin.address);
  console.log('📍 UEA on Push: ', client.universal.account);
  return client;
}

// ──────────────────────────────────────────────────────────────────────────────
// Scenario 1 — signMessage
// ──────────────────────────────────────────────────────────────────────────────

async function signMessageDemo(client: Awaited<ReturnType<typeof buildPushClient>>) {
  console.log('\n── Scenario: signMessage ──────────────────────────────────────');

  const messageText = 'Hello, Push Chain!';
  const message = new TextEncoder().encode(messageText);
  console.log(`✍️  Message: "${messageText}" (${message.length} bytes)`);

  const signature = await client.universal.signMessage(message);
  // signMessage returns a hex string for EVM signers and a base58/hex variant
  // for Solana signers. The docs example treats it as a string — print it.
  console.log('✅ Signature:', signature);
}

// ──────────────────────────────────────────────────────────────────────────────
// Scenario 2 — signTypedData (EIP-712, EVM only)
// ──────────────────────────────────────────────────────────────────────────────

async function signTypedDataDemo(client: Awaited<ReturnType<typeof buildPushClient>>) {
  console.log('\n── Scenario: signTypedData (EIP-712) ──────────────────────────');

  const domain = {
    name: 'Push Chain',
    version: '1',
    chainId: 42101, // Push Donut Testnet
    verifyingContract: '0x1234567890123456789012345678901234567890' as `0x${string}`,
  };

  const types = {
    Person: [
      { name: 'name', type: 'string' },
      { name: 'wallet', type: 'address' },
    ],
  };

  const message = {
    name: 'Alice',
    wallet: '0x9821655B609186a9296261638FA74e1DFBA4AC88',
  };

  console.log('✍️  domain:    ', JSON.stringify(domain));
  console.log('✍️  primaryType: Person');
  console.log('✍️  message:   ', JSON.stringify(message));

  try {
    const signature = await client.universal.signTypedData({
      domain,
      types,
      primaryType: 'Person',
      message,
    });
    console.log('✅ Signature:', signature);
  } catch (err) {
    console.log(`❌ signTypedData failed: ${err instanceof Error ? err.message : String(err)}`);
    console.log('   Note: signTypedData is supported only on EVM-compatible signers.');
  }
}
