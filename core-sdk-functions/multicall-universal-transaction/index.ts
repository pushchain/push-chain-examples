// Full Documentation: https://push.org/docs/chain/build/send-universal-transaction

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

// Counter contract address used in examples/tests
const COUNTER_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3' as `0x${string}`;

// Shape for a single multicall item
type MulticallCall = {
  to: `0x${string}`;
  value: bigint;
  data: `0x${string}`;
};

// ⭐️ MAIN FUNCTION ⭐️
async function main() {
  console.log('\n🌟 Viem Multicall Example - Sepolia Origin → Push Chain Target');
  await viemMulticallExample();
}

// Run main
main().catch(console.error);

// --- Viem Multicall Example ---
// ------------------------------
async function viemMulticallExample() {
  // We will originate the universal transaction from Ethereum Sepolia
  // and execute a multicall against a Counter contract on Push Chain.

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
    // Using testnet to route universal transactions to Push Testnet
    network: PushChain.CONSTANTS.PUSH_NETWORK.TESTNET,
  });
  console.log('🚀 Got push chain client');

  // 3) Prompt to fund the Sepolia account before sending (required to originate the universal tx)
  console.log('\n3. Fund the Sepolia account to cover the origin transaction');
  await rl.question(
    `:::prompt:::Please send funds to ${account.address} on Ethereum Sepolia and Press Enter to continue.`
  );

  // 4) Build and send a Multicall universal transaction
  // We will perform two consecutive "increment" calls on the Counter contract.
  console.log('\n4. Build and Send Multicall Universal Transaction');

  // Encode the function call data for Counter.increment()
  const incrementData = PushChain.utils.helpers.encodeTxData({
    abi: CounterABI as unknown as any[],
    functionName: 'increment',
  }) as `0x${string}`;

  // Create an array of calls to be executed atomically on Push Chain
  const calls: MulticallCall[] = [
    { to: COUNTER_ADDRESS, value: BigInt(0), data: incrementData },
    { to: COUNTER_ADDRESS, value: BigInt(0), data: incrementData },
  ];

  try {
    // Create a public client to read the Counter on Push Chain
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

    // Important: When using multicall, `to` must be a 0x-prefixed address.
    // `data` is the array of calls constructed above.
    const txResponse = await pushChainClient.universal.sendTransaction({
      to: COUNTER_ADDRESS,
      value: BigInt(0),
      data: calls,
    });

    console.log('📤 Transaction hash:', txResponse.hash);
    // Wait for confirmation like in the spec tests
    await txResponse.wait();

    // Read counter AFTER
    const after = (await publicClientPush.readContract({
      address: COUNTER_ADDRESS,
      abi: CounterABI as unknown as any[],
      functionName: 'countPC',
      args: [],
    })) as unknown as bigint;

    console.log('\n🎉 Congrats! You just sent a universal multicall transaction!');
    console.log('1️⃣  You sent a Sepolia-origin transaction to the Universal Gateway');
    console.log('2️⃣  Push Chain Validators handled settlement and executed the calls on Push Chain');
    console.log('3️⃣  Two increments were executed on the Counter contract, atomically');
    console.log(`\n📊 Counter on Push Chain → before: ${before.toString()} | after: ${after.toString()}`);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.log('💡 Note: This example requires Sepolia testnet funds to execute');
  }
}
