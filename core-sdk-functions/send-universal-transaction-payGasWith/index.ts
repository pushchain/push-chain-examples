// Import Push Chain Core
import { PushChain } from '@pushchain/core';

// Import viem for wallet/public client
import { createWalletClient, createPublicClient, http, parseAbi, PublicClient, Abi } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

// Readline for input
import * as readline from 'node:readline/promises';
import { COUNTER_ABI } from './counter-abi';
import 'dotenv/config';

// Enable User Input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Counter contract address used in examples/tests
const COUNTER_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3' as `0x${string}`;
const USDT_ETH_ADDRESS = '0xCA0C5E6F002A389E1580F0DB7cd06e4549B5F9d3';

// ⭐️ MAIN FUNCTION ⭐️
async function main() {
  console.log('🌟 Viem Example - Send Universal Transaction with Funds');
  await viemSendTxWithFundsExample();
}

// Run main
main().catch(console.error);

// --- Viem: Send Transaction with Funds ---
// ----------------------------------------
async function viemSendTxWithFundsExample() {
  // We will originate the universal transaction from Ethereum Sepolia
  // and execute a function call on Push Chain, funding the call with USDT.

  // 1) Create a fresh Sepolia account using viem
  const SEPOLIA_RPC_URL = 'https://gateway.tenderly.co/public/sepolia';
  const PUSH_RPC_URL = 'https://evm.rpc-testnet-donut-node1.push.org/';
  console.log('1. Create Universal Signer (Sepolia)');
  const privateKey = generatePrivateKey();
  if (!privateKey) {
    throw new Error('PRIVATE_KEY is not set');
  }
  const account = privateKeyToAccount(privateKey);
  console.log('🔑 Got account: ', account.address);

  const walletClient = createWalletClient({
    account,
    transport: http(SEPOLIA_RPC_URL),
  });

  // Convert to Universal Signer (origin = Sepolia, target = Push Chain)
  const universalSigner = await PushChain.utils.signer.toUniversal(walletClient);
  console.log('🔑 Got universal signer');

  // 2) Initialize Push Chain Client (Testnet)
  console.log('2. Initialize Push Chain Client');
  const pushChainClient = await PushChain.initialize(universalSigner, {
    network: PushChain.CONSTANTS.PUSH_NETWORK.TESTNET,
    progressHook: (progress) => {
      console.log(progress);
    },
  });
  console.log('🚀 Got push chain client');

  // 3) Prompt to fund the Sepolia account before sending (required to originate the universal tx)
  console.log('3. Fund the Sepolia account to cover the origin transaction');
  await rl.question(
    `:::prompt:::Please send ETH to ${account.address} on Ethereum Sepolia and Press Enter to continue.`
  );

  await rl.question(
    `:::prompt:::Please send 0.1 USDT to ${account.address} on Ethereum Sepolia and Press Enter to continue.`
  );
  await rl.question(
    `:::prompt:::Please send USDC to ${account.address} on Ethereum Sepolia and Press Enter to continue.`
  );

  // 4) Prepare call data for Counter.increment() on Push Chain
  console.log('4. Prepare call data for Counter.increment on Push Chain');
  const data = PushChain.utils.helpers.encodeTxData({
    abi: COUNTER_ABI as unknown as any[],
    functionName: 'increment',
  }) as `0x${string}`;

  // 5) Create a public client to read the Counter on Push Chain
  const publicClientPush = createPublicClient({
    transport: http(PUSH_RPC_URL),
  });

  // Read counter BEFORE
  const beforeCount = await publicClientPush.readContract({
    abi: COUNTER_ABI as unknown as any[],
    address: COUNTER_ADDRESS,
    functionName: 'countPC',
    args: [],
  });

  const balanceBefore = await getErc20Balance({
    publicClientPush,
    tokenAddress: USDT_ETH_ADDRESS,
    ownerAddress: pushChainClient.universal.account,
  });

  // 6) Build and send a universal transaction
  console.log('5. Send universal transaction');

  try {
    const txResponse = await pushChainClient.universal.sendTransaction({
      to: COUNTER_ADDRESS,
      value: BigInt(0),
      data,
      funds: {
        amount: PushChain.utils.helpers.parseUnits('1', 6), // 1 USDT
        token: pushChainClient.moveable.token.USDT, // move USDT to Push Chain
      },
      payGasWith: {
        token: pushChainClient.payable.token.USDC, // pay gas with USDC instead of native ETH
      },
    });

    console.log('📤 Transaction hash:', txResponse.hash);
    await txResponse.wait();

    await new Promise((resolve) => setTimeout(resolve, 5000)); // wait for 5 seconds

    // Read counter AFTER
    const afterCount = await publicClientPush.readContract({
      abi: COUNTER_ABI as unknown as any[],
      address: COUNTER_ADDRESS,
      functionName: 'countPC',
      args: [],
    });

    const balanceAfter = await getErc20Balance({
      publicClientPush,
      tokenAddress: USDT_ETH_ADDRESS,
      ownerAddress: pushChainClient.universal.account,
    });
    console.log('💰 Balance before: ', balanceBefore.toString());
    console.log('💰 Balance after: ', balanceAfter.toString());

    console.log('🎉 Congrats! You just sent a universal transaction with funds!');
    console.log('1️⃣  You sent Sepolia-origin funds (USDT) to the Universal Gateway');
    console.log('2️⃣  Validators settled and executed your function call on Push Chain');
    console.log(`📊 Counter on Push Chain → before: ${beforeCount.toString()} | after: ${afterCount.toString()}`);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.log('💡 Note: This example requires Sepolia testnet funds and a valid moveable token.');
  }
}

async function getErc20Balance({
  publicClientPush,
  tokenAddress,
  ownerAddress,
}: {
  publicClientPush: PublicClient;
  tokenAddress: `0x${string}`;
  ownerAddress: `0x${string}`;
}): Promise<bigint> {
  const erc20Abi = parseAbi(['function balanceOf(address) view returns (uint256)']);
  return publicClientPush.readContract({
    abi: erc20Abi as unknown as Abi,
    address: tokenAddress,
    functionName: 'balanceOf',
    args: [ownerAddress],
  }) as unknown as bigint;
}
