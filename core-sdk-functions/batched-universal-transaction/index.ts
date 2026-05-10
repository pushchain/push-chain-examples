// Full Documentation: https://push.org/docs/chain/build/send-universal-transaction#send-batch-transactions-multicall
//
// Batched Universal Transaction
// ==============================
// Batches multiple contract calls into a single universal transaction by passing
// an array of `{ to, value, data }` items as `tx.data`. The single tx.to must be
// the zero address — that's the SDK's signal that this is a batched call.
//
// Note: this is for batching multiple calls into one universal transaction
// (single route). To compose multiple universal transactions across different
// routes / chains in one signature, see ../send-multichain-transactions/.

// Import Push Chain Core
import { PushChain } from '@pushchain/core';

// Import viem for wallet/public client
import { createPublicClient, createWalletClient, http } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

// Readline for input
import * as readline from 'node:readline/promises';

// Enable User Input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Simple Counter ABI on Push Chain (used in tests) with an increment function
const CounterABI = [
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

// Counter contract address on Push Chain Donut Testnet
const COUNTER_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3' as `0x${string}`;

// Zero address — required as `tx.to` to signal batched mode to the SDK.
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as `0x${string}`;

// Shape for a single batched call item
type BatchedCall = {
  to: `0x${string}`;
  value: bigint;
  data: `0x${string}`;
};

// ⭐️ MAIN FUNCTION ⭐️
async function main() {
  console.log('\n🌟 Batched Universal Transaction Example - Sepolia Origin → Push Chain Target');
  await batchedExample();
}

// Run main
main().catch(console.error);

// --- Batched Universal Transaction Example ---
async function batchedExample() {
  // We will originate the universal transaction from Ethereum Sepolia and
  // execute two `increment()` calls on a Counter contract on Push Chain in a
  // single batched universal transaction.

  // 1) Create a fresh Sepolia account using viem
  const RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com';
  console.log('\n1. Create Universal Signer (Sepolia)');
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  console.log('🔑 Got account: ', account.address);

  const walletClient = createWalletClient({
    account,
    transport: http(RPC_URL),
  });

  // Convert to Universal Signer (origin = Sepolia, target = Push Chain)
  const universalSigner = await PushChain.utils.signer.toUniversal(walletClient);
  console.log('🔑 Got universal signer');

  // 2) Initialize Push Chain Client (Testnet)
  console.log('\n2. Initialize Push Chain Client');
  const pushChainClient = await PushChain.initialize(universalSigner, {
    network: PushChain.CONSTANTS.PUSH_NETWORK.TESTNET,
  });
  console.log('🚀 Got push chain client');

  // 3) Prompt to fund the Sepolia account before sending
  console.log('\n3. Fund the Sepolia account to cover the origin transaction');
  await rl.question(
    `:::prompt:::Please send Sepolia ETH to ${account.address} and press Enter to continue.\nSepolia faucet: https://cloud.google.com/application/web3/faucet/ethereum/sepolia`
  );

  // 4) Build and send a batched universal transaction
  console.log('\n4. Build and Send Batched Universal Transaction');

  // Encode Counter.increment() once — used for both calls in the batch
  const incrementData = PushChain.utils.helpers.encodeTxData({
    abi: CounterABI as unknown as any[],
    functionName: 'increment',
  }) as `0x${string}`;

  // Two calls into a single batch — both increments execute atomically on Push Chain
  const calls: BatchedCall[] = [
    { to: COUNTER_ADDRESS, value: BigInt(0), data: incrementData },
    { to: COUNTER_ADDRESS, value: BigInt(0), data: incrementData },
  ];

  try {
    // Public client to read the Counter on Push Chain before/after
    const publicClientPush = createPublicClient({
      transport: http('https://evm.donut.rpc.push.org/'),
    });

    // Read counter BEFORE
    const before = (await publicClientPush.readContract({
      address: COUNTER_ADDRESS,
      abi: CounterABI as unknown as any[],
      functionName: 'countPC',
      args: [],
    })) as unknown as bigint;

    // Important: tx.to must be the ZERO address for batched mode.
    // The SDK uses that as the signal to interpret tx.data as an array of calls.
    const txResponse = await pushChainClient.universal.sendTransaction({
      to: ZERO_ADDRESS,
      value: BigInt(0),
      data: calls,
    });

    console.log('📤 Transaction hash:', txResponse.hash);
    await txResponse.wait();

    // Read counter AFTER
    const after = (await publicClientPush.readContract({
      address: COUNTER_ADDRESS,
      abi: CounterABI as unknown as any[],
      functionName: 'countPC',
      args: [],
    })) as unknown as bigint;

    console.log('\n🎉 Congrats! You just sent a batched universal transaction!');
    console.log('1️⃣  You sent a Sepolia-origin transaction to the Universal Gateway');
    console.log('2️⃣  Push Chain Validators settled it and executed the calls on Push Chain');
    console.log('3️⃣  Both increments executed atomically against the Counter');
    console.log(`\n📊 Counter on Push Chain → before: ${before.toString()} | after: ${after.toString()}`);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.log('💡 Note: this example needs Sepolia ETH on the generated account to originate the tx');
  } finally {
    rl.close();
  }
}
