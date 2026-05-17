// Full Documentation: https://pusd.push.org/docs
//
// Mint PUSD from an External Chain (Path A — multicall + bridge)
// ===============================================================
// Originates a universal transaction from Ethereum Sepolia and mints PUSD on
// Push Chain in ONE signature. The relay:
//
//   1) Bridges the user's Sepolia USDT into the user's Push Chain account
//      (driven by the `funds` parameter on the universal tx).
//   2) Walks the multicall passed in `data`:
//        a) approve(PUSDManager, amount)        on USDT (Donut representation)
//        b) deposit(USDT, amount, recipient)    on PUSDManager → mints PUSD
//
// The outer `to` is the zero address — that's the relay's signal to interpret
// `data` as an array of legs and walk each leg against its own `to`.
//
// Path A is the recommended pattern for any external-chain wallet
// (MetaMask, viem, ethers signer on Sepolia, Phantom on Solana, etc.).

import 'dotenv/config';
import { PushChain } from '@pushchain/core';
import { createPublicClient, createWalletClient, http, parseAbi, type Abi, type PublicClient } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import * as readline from 'node:readline/promises';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// ───────────────────────────────────────────────────────────────────────────
// Network constants
// ───────────────────────────────────────────────────────────────────────────

const SEPOLIA_RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com';
const PUSH_RPC_URL = 'https://evm.donut.rpc.push.org/';

// PUSD protocol — Donut Testnet (chain 42101). UUPS proxies; addresses stable
// across upgrades. Always interact with these proxy addresses.
const PUSD_ADDRESS = '0x488d080e16386379561a47A4955D22001d8A9D89' as `0x${string}`;
const PUSD_MANAGER = '0x7A24Eea43a1095e9Dc652AB9Cba156a93Ed5Ed46' as `0x${string}`;

// USDT (origin = Sepolia) on Donut. The relay bridges Sepolia USDT into this
// representation; the multicall approves + deposits against this address.
const USDT_DONUT = '0xCA0C5E6F002A389E1580F0DB7cd06e4549B5F9d3' as `0x${string}`;

// USDT on Ethereum Sepolia (the test ERC-20 the user actually holds before
// the relay bridges it to Donut). Mint test USDT from the contract's `mint`
// function on Sepolia Etherscan. Source: @pushchain/core token registry —
// `pushChainClient.moveable.token.USDT` resolves to this on a Sepolia origin.
const USDT_SEPOLIA = '0xC4230aEaFcF6b8B49a7b4e53886420f00ff71876' as `0x${string}`;

// Sentinel for multicall mode on the universal transaction layer.
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as `0x${string}`;

// ───────────────────────────────────────────────────────────────────────────
// ABI fragments
// ───────────────────────────────────────────────────────────────────────────

const APPROVE_ABI = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

const DEPOSIT_ABI = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'recipient', type: 'address' },
    ],
    outputs: [],
  },
] as const;

const BALANCE_OF_ABI = parseAbi(['function balanceOf(address) view returns (uint256)']);

// ───────────────────────────────────────────────────────────────────────────
// Main
// ───────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌟 Mint PUSD from External Chain — Sepolia origin → PUSD on Push Chain');
  await mintPusdFromSepolia();
}

main().catch((err) => {
  console.error(err);
  rl.close();
});

async function mintPusdFromSepolia() {
  // 1) Build the Sepolia signer. SEPOLIA_PRIVATE_KEY persists across runs so
  //    the UEA on Push (where PUSD lands) stays the same — useful when
  //    chaining into pusd-redeem Scenario 2 with the same key.
  console.log('\n1. Create Universal Signer (Sepolia)');
  let privateKey = process.env.SEPOLIA_PRIVATE_KEY as `0x${string}` | undefined;
  if (privateKey) {
    console.log('🔑 Using SEPOLIA_PRIVATE_KEY from environment.');
  } else {
    privateKey = generatePrivateKey();
    console.log('🔑 No SEPOLIA_PRIVATE_KEY env var found — generated a fresh wallet.');
    console.log('   To re-run with the same address (and same UEA on Push), save:');
    console.log(`   SEPOLIA_PRIVATE_KEY=${privateKey}`);
  }
  const account = privateKeyToAccount(privateKey);
  console.log('🔑 Got account:', account.address);

  const walletClient = createWalletClient({
    account,
    transport: http(SEPOLIA_RPC_URL),
  });

  const universalSigner = await PushChain.utils.signer.toUniversal(walletClient);
  console.log('🔑 Got universal signer');

  // 2) Initialize Push Chain Client (Donut Testnet)
  console.log('\n2. Initialize Push Chain Client');
  const pushChainClient = await PushChain.initialize(universalSigner, {
    network: PushChain.CONSTANTS.PUSH_NETWORK.TESTNET,
  });
  const recipient = pushChainClient.universal.account;
  console.log('🚀 Got push chain client');
  console.log('📍 Recipient (Push UEA):', recipient);

  // 3) Prompt to fund the Sepolia account
  console.log('\n3. Fund the Sepolia account to cover the origin transaction');
  await rl.question(
    `:::prompt:::Please send Sepolia ETH to ${account.address} and press Enter to continue.\nSepolia faucet: https://cloud.google.com/application/web3/faucet/ethereum/sepolia`
  );
  await rl.question(
    `:::prompt:::Please send at least 1 USDT (Sepolia) to ${account.address} and press Enter to continue.\nMint test USDT on Sepolia: https://sepolia.etherscan.io/address/${USDT_SEPOLIA}#writeContract (call mint with at least 1000000 — 1 USDT, 6 decimals).`
  );

  // 4) Pre-flight: check the wallet actually got funded. The gateway pulls USDT
  //    via `transferFrom` and reverts with a generic error if balance/allowance
  //    is short — much friendlier to fail here with a clear reason.
  const sepoliaPublic = createPublicClient({ transport: http(SEPOLIA_RPC_URL) });
  const ethBalance = await sepoliaPublic.getBalance({ address: account.address });
  const usdtBalance = await getErc20Balance(sepoliaPublic, USDT_SEPOLIA, account.address);
  console.log(`\n📊 Sepolia ETH  balance: ${(Number(ethBalance) / 1e18).toFixed(6)} ETH`);
  console.log(`📊 Sepolia USDT balance: ${formatUnits6(usdtBalance)} USDT`);

  const amount = PushChain.utils.helpers.parseUnits('1', 6); // 1 USDT (6 decimals)
  if (ethBalance === BigInt(0)) {
    console.log('\n⚠️  Sepolia ETH balance is 0. Fund the wallet and re-run.');
    rl.close();
    return;
  }
  if (usdtBalance < amount) {
    console.log(`\n⚠️  Sepolia USDT balance (${formatUnits6(usdtBalance)}) is less than the deposit amount (${formatUnits6(amount)}).`);
    console.log(`   Mint test USDT on Sepolia: https://sepolia.etherscan.io/address/${USDT_SEPOLIA}#writeContract (call mint).`);
    rl.close();
    return;
  }

  // 5) Read PUSD balance BEFORE so the mint effect is visible
  const pushPublic = createPublicClient({ transport: http(PUSH_RPC_URL) });
  const pusdBefore = await getErc20Balance(pushPublic, PUSD_ADDRESS, recipient);
  console.log(`\n💰 PUSD balance BEFORE: ${formatUnits6(pusdBefore)} PUSD`);

  // 6) Build the multicall — approve PUSDManager, then deposit. PUSD mints to
  //    `recipient` (the user's Push UEA in this example).
  console.log('\n4. Build the multicall (approve + deposit)');

  const approveData = PushChain.utils.helpers.encodeTxData({
    abi: APPROVE_ABI as unknown as any[],
    functionName: 'approve',
    args: [PUSD_MANAGER, amount],
  }) as `0x${string}`;

  const depositData = PushChain.utils.helpers.encodeTxData({
    abi: DEPOSIT_ABI as unknown as any[],
    functionName: 'deposit',
    args: [USDT_DONUT, amount, recipient],
  }) as `0x${string}`;

  const multicall = [
    { to: USDT_DONUT, value: BigInt(0), data: approveData },
    { to: PUSD_MANAGER, value: BigInt(0), data: depositData },
  ];

  // 7) Send the universal transaction with `funds` (bridge USDT in) and the
  //    multicall in `data`. Outer `to` is the zero sentinel.
  console.log('\n5. Send universal transaction (multicall + bridge)');

  try {
    const txResponse = await pushChainClient.universal.sendTransaction({
      to: ZERO_ADDRESS,
      value: BigInt(0),
      data: multicall,
      funds: {
        amount,
        token: pushChainClient.moveable.token.USDT, // bridges Sepolia USDT in
      },
    });

    console.log('📤 Transaction hash:', txResponse.hash);
    console.log('🔗 Push explorer:   ', pushChainClient.explorer.getTransactionUrl(txResponse.hash));
    await txResponse.wait();

    // Brief pause to let the indexer reflect the post-state
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 8) Read PUSD balance AFTER and confirm the mint
    const pusdAfter = await getErc20Balance(pushPublic, PUSD_ADDRESS, recipient);
    console.log(`\n💰 PUSD balance AFTER:  ${formatUnits6(pusdAfter)} PUSD`);

    console.log('\n🎉 Congrats! You minted PUSD from an external chain in one signature.');
    console.log('1️⃣  USDT on Sepolia → bridged into your Push UEA via `funds`');
    console.log('2️⃣  Multicall approved PUSDManager and called deposit(USDT, amount, recipient)');
    console.log('3️⃣  PUSDManager minted PUSD 1:1 to the recipient (minus surplus haircut, default 0%)');
    console.log(`📊 PUSD balance change: ${formatUnits6(pusdBefore)} → ${formatUnits6(pusdAfter)}`);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.log('💡 Common causes:');
    console.log('   • Sepolia ETH too low to cover the gateway call (need ETH for gas + the relay\'s native bridging value).');
    console.log('   • USDT balance on Sepolia got spent or transferred between the prompt and this call.');
    console.log('   • Pending allowance — first run on a wallet sets the gateway allowance; if the approve tx hasn\'t confirmed, the gateway revert. Wait a few seconds and re-run.');
  } finally {
    rl.close();
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

async function getErc20Balance(
  client: PublicClient,
  token: `0x${string}`,
  owner: `0x${string}`
): Promise<bigint> {
  return (await client.readContract({
    abi: BALANCE_OF_ABI as unknown as Abi,
    address: token,
    functionName: 'balanceOf',
    args: [owner],
  })) as unknown as bigint;
}

// PUSD, PUSD+, and every reserve token use 6 decimals on Donut.
function formatUnits6(amount: bigint): string {
  const ONE_M = BigInt(1_000_000);
  const whole = amount / ONE_M;
  const frac = (amount % ONE_M).toString().padStart(6, '0').replace(/0+$/, '');
  return frac.length > 0 ? `${whole}.${frac}` : `${whole}`;
}
