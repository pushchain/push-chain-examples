// Full Documentation: https://pusd.push.org/docs
//
// Mint PUSD from a Native Push EOA (Path B — two sequential signatures)
// ======================================================================
// A Push native externally-owned account (Push Wallet, or any private key
// signing directly against the Donut RPC) is a regular EVM EOA — no multicall.
// So minting PUSD here takes TWO separate transactions:
//
//   1) approve(PUSDManager, amount)        on USDT (already sitting on Donut)
//   2) deposit(USDT, amount, recipient)    on PUSDManager → mints PUSD
//
// Path B assumes the reserve token is already on Donut. If the user holds
// USDT on Sepolia (or any other origin chain) instead, use Path A — see
// ../pusd-mint-from-external-chain. Path A bridges in via `funds` and packs
// approve + deposit into one multicall.
//
// Persistent signer
// -----------------
// Set PUSH_PRIVATE_KEY in `.env` so re-runs reuse the same account (and the
// same Donut USDT balance). On first run the script generates one and prints
// the key so you can save it.

import 'dotenv/config';
import { PushChain } from '@pushchain/core';
import { ethers } from 'ethers';

// ───────────────────────────────────────────────────────────────────────────
// Network constants
// ───────────────────────────────────────────────────────────────────────────

const PUSH_RPC_URL = 'https://evm.donut.rpc.push.org/';

// PUSD protocol — Donut Testnet (chain 42101). UUPS proxies; addresses stable
// across upgrades. Always interact with these proxy addresses.
const PUSD_ADDRESS = '0x488d080e16386379561a47A4955D22001d8A9D89';
const PUSD_MANAGER = '0x7A24Eea43a1095e9Dc652AB9Cba156a93Ed5Ed46';

// USDT (origin = Sepolia) on Donut. Path B assumes the user already holds
// this token here — no bridging on this path.
const USDT_DONUT = '0xCA0C5E6F002A389E1580F0DB7cd06e4549B5F9d3';

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

const ERC20_BALANCE_ABI = ['function balanceOf(address) view returns (uint256)'];

// ───────────────────────────────────────────────────────────────────────────
// Main
// ───────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌟 Mint PUSD from Native Push EOA — two sequential signatures');

  // 1) Build a Push native signer. PUSH_PRIVATE_KEY persists across runs.
  console.log('\n1. Build Push native signer');
  const provider = new ethers.JsonRpcProvider(PUSH_RPC_URL);
  let wallet: ethers.Wallet;
  if (process.env.PUSH_PRIVATE_KEY) {
    wallet = new ethers.Wallet(process.env.PUSH_PRIVATE_KEY, provider);
    console.log('🔑 Using PUSH_PRIVATE_KEY from environment.');
  } else {
    const random = ethers.Wallet.createRandom();
    wallet = new ethers.Wallet(random.privateKey, provider);
    console.log('🔑 No PUSH_PRIVATE_KEY env var found — generated a fresh wallet.');
    console.log('   To re-run with the same Push account (and same balances), save:');
    console.log(`   PUSH_PRIVATE_KEY=${random.privateKey}`);
  }
  console.log('📍 Push EOA:', wallet.address);

  // 2) Initialize the Push Chain client. The signer is the EOA itself, so
  //    this client uses Path B semantics — no relay multicall.
  const universalSigner = await PushChain.utils.signer.toUniversal(wallet);
  const pushChainClient = await PushChain.initialize(universalSigner, {
    network: PushChain.CONSTANTS.PUSH_NETWORK.TESTNET,
  });
  const recipient = wallet.address as `0x${string}`;
  console.log('🚀 Got push chain client');

  // 3) Sanity-check the wallet has PC for gas and USDT to deposit. Fail fast
  //    with a clear message rather than letting `approve` revert anonymously.
  console.log('\n2. Pre-flight balance check');
  const amount = PushChain.utils.helpers.parseUnits('1', 6); // 1 USDT (6 decimals)
  const pcBalance = await provider.getBalance(wallet.address);
  const usdt = new ethers.Contract(USDT_DONUT, ERC20_BALANCE_ABI, provider);
  const usdtBalance = (await usdt.balanceOf(wallet.address)) as bigint;

  console.log(`📊 PC  balance: ${ethers.formatEther(pcBalance)} PC (need some for gas)`);
  console.log(`📊 USDT balance: ${formatUnits6(usdtBalance)} USDT (need ≥ 1 to mint 1 PUSD)`);

  if (pcBalance === BigInt(0)) {
    console.log('\n⚠️  Wallet has 0 PC — fund this address from the Push faucet:');
    console.log('   https://faucet.push.org/');
    return;
  }
  if (usdtBalance < amount) {
    console.log('\n⚠️  Wallet does not hold enough USDT on Donut to mint 1 PUSD.');
    console.log('   The easiest way to get USDT (or any reserve token) onto Donut is the');
    console.log('   official Push Bridge UI — drop in your origin-chain USDT.eth / USDT.sol /');
    console.log('   USDT.bsc / etc. and it lands on Donut at this address as the matching');
    console.log('   reserve token.');
    console.log('   👉 https://bridge.push.org/');
    console.log('   (Alternatively: programmatic path — run ../pusd-mint-from-external-chain.)');
    return;
  }

  // 4) Read PUSD balance BEFORE so the mint effect is visible.
  const pusd = new ethers.Contract(PUSD_ADDRESS, ERC20_BALANCE_ABI, provider);
  const pusdBefore = (await pusd.balanceOf(wallet.address)) as bigint;
  console.log(`\n💰 PUSD balance BEFORE: ${formatUnits6(pusdBefore)} PUSD`);

  // 5) Tx 1 — approve PUSDManager to pull USDT from the wallet.
  console.log('\n3. Tx 1 of 2 — approve(PUSDManager, amount)');
  const approveData = PushChain.utils.helpers.encodeTxData({
    abi: APPROVE_ABI as unknown as any[],
    functionName: 'approve',
    args: [PUSD_MANAGER, amount],
  }) as `0x${string}`;

  const approveTx = await pushChainClient.universal.sendTransaction({
    to: USDT_DONUT,
    value: BigInt(0),
    data: approveData,
  });
  console.log('📤 approve hash:', approveTx.hash);
  console.log('🔗 explorer:    ', pushChainClient.explorer.getTransactionUrl(approveTx.hash));
  await approveTx.wait();
  console.log('✅ approve confirmed');

  // 6) Tx 2 — deposit, mint PUSD straight to `recipient`.
  console.log('\n4. Tx 2 of 2 — deposit(USDT, amount, recipient)');
  const depositData = PushChain.utils.helpers.encodeTxData({
    abi: DEPOSIT_ABI as unknown as any[],
    functionName: 'deposit',
    args: [USDT_DONUT, amount, recipient],
  }) as `0x${string}`;

  const depositTx = await pushChainClient.universal.sendTransaction({
    to: PUSD_MANAGER,
    value: BigInt(0),
    data: depositData,
  });
  console.log('📤 deposit hash:', depositTx.hash);
  console.log('🔗 explorer:    ', pushChainClient.explorer.getTransactionUrl(depositTx.hash));
  await depositTx.wait();
  console.log('✅ deposit confirmed');

  // 7) Read PUSD balance AFTER and confirm the mint
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const pusdAfter = (await pusd.balanceOf(wallet.address)) as bigint;
  console.log(`\n💰 PUSD balance AFTER:  ${formatUnits6(pusdAfter)} PUSD`);

  console.log('\n🎉 Congrats! You minted PUSD from a native Push EOA.');
  console.log('1️⃣  Tx 1 approved PUSDManager to spend your USDT on Donut');
  console.log('2️⃣  Tx 2 called PUSDManager.deposit, which minted PUSD 1:1 to the recipient');
  console.log(`📊 PUSD balance change: ${formatUnits6(pusdBefore)} → ${formatUnits6(pusdAfter)}`);
}

main().catch(console.error);

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

// PUSD, PUSD+, and every reserve token use 6 decimals on Donut.
function formatUnits6(amount: bigint): string {
  const ONE_M = BigInt(1_000_000);
  const whole = amount / ONE_M;
  const frac = (amount % ONE_M).toString().padStart(6, '0').replace(/0+$/, '');
  return frac.length > 0 ? `${whole}.${frac}` : `${whole}`;
}
