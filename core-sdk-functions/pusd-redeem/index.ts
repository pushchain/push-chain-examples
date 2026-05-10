// Full Documentation: https://pusd.push.org/docs
//
// Redeem PUSD — interactive scenarios
// ===================================
// PUSDManager.redeem(pusdAmount, preferredAsset, allowBasket, recipient)
// burns PUSD from `msg.sender` directly (BURNER_ROLE) — NO PUSD approval
// required. Both scenarios sign from the same native Push EOA (PATH B):
//
//   1) Local redeem — burn on Push, USDT.eth (Donut rep) lands on the same
//      Push EOA. Single signature, one tx.
//
//   2) Cross-chain redeem to Ethereum Sepolia — 2-hop cascade under one
//      signature on Push:
//        hop 1: PUSDManager.redeem(...) — recipient = the Push EOA itself
//        hop 2: bridge the resulting USDT.eth from the Push EOA → user's
//               Sepolia EOA via `funds`. (Same private key works on both
//               EVM chains, so the destination defaults to that same address
//               on Sepolia — no Sepolia wallet setup required.)
//
//   Both scenarios pay gas in PC. No Sepolia ETH is needed for either flow.
//
// Routing inside PUSDManager.redeem is automatic:
//
//   Preferred asset    → preferredAsset ENABLED + sufficient liquidity
//                        Fee: baseFee + preferredFee
//   Basket             → preferred unavailable + allowBasket = true
//                        Fee: baseFee only (proportional payout)
//   Emergency          → any token in EMERGENCY_REDEEM status
//                        forced proportional drain, status-driven
//
// Always pass `allowBasket = true` in production. If the preferred token runs
// dry the basket route activates and the call won't revert.

import 'dotenv/config';
import { PushChain } from '@pushchain/core';
import { ethers } from 'ethers';
import * as readline from 'node:readline/promises';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// ───────────────────────────────────────────────────────────────────────────
// Network constants
// ───────────────────────────────────────────────────────────────────────────

const PUSH_RPC_URL = 'https://evm.donut.rpc.push.org/';
const SEPOLIA_RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com';

// PUSD protocol — Donut Testnet (chain 42101). UUPS proxies; addresses stable.
const PUSD_ADDRESS = '0x488d080e16386379561a47A4955D22001d8A9D89';
const PUSD_MANAGER = '0x7A24Eea43a1095e9Dc652AB9Cba156a93Ed5Ed46';

// USDT.eth — Donut representation of Sepolia USDT. Hop 1 returns this on
// Donut; hop 2 bridges it back to Sepolia USDT
// (`0x7169D38820dfd117C3FA1f22a697dBA58d90BA06`) via `funds`.
const USDT_DONUT = '0xCA0C5E6F002A389E1580F0DB7cd06e4549B5F9d3';

// USDT on Ethereum Sepolia — only used for reading the destination balance
// before/after to demonstrate the cross-chain delivery.
const USDT_SEPOLIA = '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06';

// Default amount to redeem in both scenarios (6 decimals → 1 PUSD).
const PUSD_AMOUNT_HUMAN = '1';

// Minimum PC balance recommended for the Scenario 2 cascade (gas + outbound
// swap to Sepolia). Tune up if the cascade reverts at hop 2.
const SCENARIO_2_MIN_PC = ethers.parseEther('5');

// ───────────────────────────────────────────────────────────────────────────
// ABI fragments
// ───────────────────────────────────────────────────────────────────────────

const REDEEM_ABI = [
  {
    type: 'function',
    name: 'redeem',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'pusdAmount', type: 'uint256' },
      { name: 'preferredAsset', type: 'address' },
      { name: 'allowBasket', type: 'bool' },
      { name: 'recipient', type: 'address' },
    ],
    outputs: [],
  },
] as const;

const ERC20_BALANCE_ABI = ['function balanceOf(address) view returns (uint256)'];

// ───────────────────────────────────────────────────────────────────────────
// Main — interactive scenario picker
// ───────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Redeem PUSD — Interactive Scenarios');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('Pick a scenario:');
  console.log('  1) Local redeem on Push                        — burn PUSD, USDT.eth lands on same Push EOA');
  console.log('  2) Cross-chain redeem to Ethereum Sepolia      — burn on Push, USDT lands on your Sepolia wallet');
  console.log('');
  console.log('Both scenarios sign from a native Push EOA. Gas is paid in PC. No Sepolia ETH needed.');
  console.log('');

  const choice = (await rl.question('Choice (1/2): ')).trim();

  switch (choice) {
    case '1':
      await localRedeemOnPush();
      break;
    case '2':
      await crossChainRedeemToSepolia();
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

// ───────────────────────────────────────────────────────────────────────────
// Scenario 1 — Local redeem on Push
// ───────────────────────────────────────────────────────────────────────────

async function localRedeemOnPush() {
  console.log('\n── Scenario 1: Local redeem on Push ───────────────────────────');

  // 1) Build a Push native signer.
  const provider = new ethers.JsonRpcProvider(PUSH_RPC_URL);
  const wallet = await loadOrGenerateWallet(provider, 'PUSH_PRIVATE_KEY');
  console.log('📍 Push EOA:', wallet.address);

  const universalSigner = await PushChain.utils.signer.toUniversal(wallet);
  const pushChainClient = await PushChain.initialize(universalSigner, {
    network: PushChain.CONSTANTS.PUSH_NETWORK.TESTNET,
  });

  // 2) Pre-flight balance check — needs PC for gas and PUSD to redeem.
  const pusdAmount = PushChain.utils.helpers.parseUnits(PUSD_AMOUNT_HUMAN, 6);
  const pcBalance = await provider.getBalance(wallet.address);
  const pusd = new ethers.Contract(PUSD_ADDRESS, ERC20_BALANCE_ABI, provider);
  const reserve = new ethers.Contract(USDT_DONUT, ERC20_BALANCE_ABI, provider);
  const pusdBalance = (await pusd.balanceOf(wallet.address)) as bigint;

  console.log(`📊 PC   balance: ${ethers.formatEther(pcBalance)} PC (need some for gas)`);
  console.log(`📊 PUSD balance: ${formatUnits6(pusdBalance)} PUSD (need ≥ ${PUSD_AMOUNT_HUMAN})`);

  if (pcBalance === BigInt(0)) {
    console.log('\n⚠️  Wallet has 0 PC — fund this address from the Push faucet:');
    console.log('   https://faucet.push.org/');
    return;
  }
  if (pusdBalance < pusdAmount) {
    console.log(`\n⚠️  This Push EOA does not hold ≥ ${PUSD_AMOUNT_HUMAN} PUSD. Mint some first:`);
    console.log('   • ../pusd-mint-from-push-eoa     (native Push EOA, two txs — uses the same key)');
    console.log('   • ../pusd-mint-from-external-chain (external chain → mints into your UEA, NOT this EOA)');
    return;
  }

  // 3) Read balances BEFORE so the redeem effect is visible.
  const reserveBefore = (await reserve.balanceOf(wallet.address)) as bigint;
  console.log(`\n💰 PUSD balance BEFORE:        ${formatUnits6(pusdBalance)} PUSD`);
  console.log(`💰 USDT.eth (Donut) BEFORE:    ${formatUnits6(reserveBefore)} USDT.eth`);

  // 4) Redeem in one signed call. allowBasket=true → no revert if preferred
  //    token short on liquidity. PUSDManager burns msg.sender via BURNER_ROLE,
  //    so no PUSD approve is needed.
  console.log(`\n🚀 Redeeming ${PUSD_AMOUNT_HUMAN} PUSD → preferred USDT.eth (basket fallback enabled)`);
  const data = PushChain.utils.helpers.encodeTxData({
    abi: REDEEM_ABI as unknown as any[],
    functionName: 'redeem',
    args: [pusdAmount, USDT_DONUT, true, wallet.address],
  }) as `0x${string}`;

  const tx = await pushChainClient.universal.sendTransaction({
    to: PUSD_MANAGER,
    value: BigInt(0),
    data,
  });
  console.log('📤 redeem hash:', tx.hash);
  console.log('🔗 explorer:   ', pushChainClient.explorer.getTransactionUrl(tx.hash));
  await tx.wait();
  console.log('✅ redeem confirmed');

  // 5) Read balances AFTER and confirm the burn + payout.
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const pusdAfter = (await pusd.balanceOf(wallet.address)) as bigint;
  const reserveAfter = (await reserve.balanceOf(wallet.address)) as bigint;
  const burned = pusdBalance - pusdAfter;
  const received = reserveAfter - reserveBefore;

  console.log(`\n💰 PUSD balance AFTER:         ${formatUnits6(pusdAfter)} PUSD`);
  console.log(`💰 USDT.eth (Donut) AFTER:     ${formatUnits6(reserveAfter)} USDT.eth`);
  console.log(`\n📊 PUSD burned:   ${formatUnits6(burned)}`);
  console.log(`📊 USDT received: ${formatUnits6(received)} (after baseFee + preferredFee)`);

  console.log('\n🎉 Done. PUSD burned and reserve token paid out on Push.');
}

// ───────────────────────────────────────────────────────────────────────────
// Scenario 2 — Cross-chain redeem to Ethereum Sepolia (Push EOA, two txs)
// ───────────────────────────────────────────────────────────────────────────
//
// SDK constraint: native Push EOAs cannot use `prepareTransaction` for hops
// that target Push Chain — that path is reserved for UEAs (external-chain
// origins). The redeem hop targets Push, so this flow uses two separate
// `sendTransaction` calls (two signatures) instead of one cascade signature.
//
//   Tx 1: PUSDManager.redeem(...) on Push — recipient = Push EOA itself.
//         USDT.eth (Donut rep) lands on the EOA.
//   Tx 2: outbound bridge of USDT.eth from the EOA → user's Sepolia EOA via
//         `funds`. The destination defaults to the same 0x… address on
//         Sepolia, since the Push EOA's private key produces the same
//         address on every EVM chain.
//
// Bonus over a one-shot cascade: between Tx 1 and Tx 2 we read the EOA's
// actual USDT.eth balance and bridge that exact amount — no conservative
// fee estimation needed. The user pays gas in PC. No Sepolia ETH required.
//
// (For a one-signature cross-chain redeem you would sign from a Sepolia
// wallet — Path A — so the cascade runs through your UEA on Push. That
// requires Sepolia ETH for the cascade signature. Not implemented here
// because the user explicitly asked to avoid Sepolia ETH; if you want it,
// initialize PushChain from a Sepolia signer and use prepareTransaction +
// executeTransactions.)
async function crossChainRedeemToSepolia() {
  console.log('\n── Scenario 2: Cross-chain redeem → Ethereum Sepolia ──────────');

  // 1) Build a Push native signer. Same key plays both roles — Push signer
  //    AND default Sepolia destination address (both EVM chains share the
  //    same EOA derivation from a private key).
  const pushProvider = new ethers.JsonRpcProvider(PUSH_RPC_URL);
  const wallet = await loadOrGenerateWallet(pushProvider, 'PUSH_PRIVATE_KEY');
  console.log('📍 Push EOA (signer + holds PUSD):', wallet.address);
  console.log('📍 Sepolia EOA (payout target):   ', wallet.address, '(same key, same address)');

  const universalSigner = await PushChain.utils.signer.toUniversal(wallet);
  const pushChainClient = await PushChain.initialize(universalSigner, {
    network: PushChain.CONSTANTS.PUSH_NETWORK.TESTNET,
  });

  // 2) Pre-flight checks. Need PC for gas (both txs) + outbound swap (Tx 2),
  //    and PUSD on the Push EOA. No Sepolia ETH required.
  const pusdAmount = PushChain.utils.helpers.parseUnits(PUSD_AMOUNT_HUMAN, 6);
  const pcBalance = await pushProvider.getBalance(wallet.address);
  const pusd = new ethers.Contract(PUSD_ADDRESS, ERC20_BALANCE_ABI, pushProvider);
  const reserve = new ethers.Contract(USDT_DONUT, ERC20_BALANCE_ABI, pushProvider);
  const pusdBalance = (await pusd.balanceOf(wallet.address)) as bigint;

  console.log(`\n📊 PC   balance: ${ethers.formatEther(pcBalance)} PC (need ≥ ${ethers.formatEther(SCENARIO_2_MIN_PC)} for both txs + outbound swap)`);
  console.log(`📊 PUSD balance: ${formatUnits6(pusdBalance)} PUSD (need ≥ ${PUSD_AMOUNT_HUMAN})`);

  if (pcBalance < SCENARIO_2_MIN_PC) {
    console.log(`\n⚠️  PC balance below ${ethers.formatEther(SCENARIO_2_MIN_PC)} PC — top up at https://faucet.push.org/`);
    return;
  }
  if (pusdBalance < pusdAmount) {
    console.log(`\n⚠️  This Push EOA does not hold ≥ ${PUSD_AMOUNT_HUMAN} PUSD. Mint some first:`);
    console.log('   • ../pusd-mint-from-push-eoa     (native Push EOA, two txs — uses the same key)');
    return;
  }

  // 3) Read recipient balances BEFORE so the effect is visible.
  const sepoliaProvider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
  const sepoliaUsdt = new ethers.Contract(USDT_SEPOLIA, ERC20_BALANCE_ABI, sepoliaProvider);
  const reserveBeforeEoa = (await reserve.balanceOf(wallet.address)) as bigint;
  const usdtBeforeSepolia = (await sepoliaUsdt.balanceOf(wallet.address)) as bigint;
  console.log(`\n💰 PUSD on Push EOA BEFORE:        ${formatUnits6(pusdBalance)} PUSD`);
  console.log(`💰 USDT.eth on Push EOA BEFORE:    ${formatUnits6(reserveBeforeEoa)} USDT.eth`);
  console.log(`💰 USDT on Sepolia BEFORE:         ${formatUnits6(usdtBeforeSepolia)} USDT`);

  // 4) Tx 1 — burn PUSD on Push. USDT.eth (Donut rep) lands on the EOA.
  console.log(`\n🚀 Tx 1 of 2 — Redeeming ${PUSD_AMOUNT_HUMAN} PUSD → USDT.eth on Push (basket fallback enabled)`);
  const redeemData = PushChain.utils.helpers.encodeTxData({
    abi: REDEEM_ABI as unknown as any[],
    functionName: 'redeem',
    args: [pusdAmount, USDT_DONUT, true, wallet.address], // recipient = Push EOA
  }) as `0x${string}`;

  const burnTx = await pushChainClient.universal.sendTransaction({
    to: PUSD_MANAGER,
    value: BigInt(0),
    data: redeemData,
  });
  console.log('   📤 redeem hash:', burnTx.hash);
  console.log('   🔗 explorer:   ', pushChainClient.explorer.getTransactionUrl(burnTx.hash));
  await burnTx.wait();
  console.log('   ✅ redeem confirmed');

  // 5) Read the actual USDT.eth balance now — bridge exactly what landed on
  //    the EOA from this redeem (no conservative estimation needed).
  await new Promise((resolve) => setTimeout(resolve, 2000));
  const reserveAfterRedeem = (await reserve.balanceOf(wallet.address)) as bigint;
  const justReceived = reserveAfterRedeem - reserveBeforeEoa;
  console.log(`   💰 USDT.eth received on EOA: ${formatUnits6(justReceived)} USDT.eth (after baseFee + preferredFee)`);

  if (justReceived === BigInt(0)) {
    console.log('\n⚠️  Redeem succeeded but no USDT.eth landed on the EOA. Aborting bridge.');
    return;
  }

  // 6) Tx 2 — bridge USDT.eth from the Push EOA out to the same address on
  //    Sepolia. `data: '0x'` means "no contract call" — the relay just
  //    delivers funds to the destination wallet on the destination chain.
  console.log(`\n🚀 Tx 2 of 2 — Bridging ${formatUnits6(justReceived)} USDT.eth → Sepolia`);
  const bridgeTx = await pushChainClient.universal.sendTransaction({
    to: { address: wallet.address, chain: PushChain.CONSTANTS.CHAIN.ETHEREUM_SEPOLIA },
    value: BigInt(0),
    data: '0x',
    funds: {
      amount: justReceived,
      token: PushChain.CONSTANTS.MOVEABLE.TOKEN.ETHEREUM_SEPOLIA.USDT,
    },
  });
  console.log('   📤 bridge hash:', bridgeTx.hash);
  console.log('   🔗 explorer:   ', pushChainClient.explorer.getTransactionUrl(bridgeTx.hash));

  // 7) Read post-state to confirm. The Sepolia balance update follows after
  //    the relay settles — this poll waits up to ~60 s for it to land.
  console.log('\n⏳ Waiting for cross-chain delivery to Sepolia (poll every 5 s, up to ~60 s)…');
  let usdtAfterSepolia = usdtBeforeSepolia;
  for (let attempt = 0; attempt < 12; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    usdtAfterSepolia = (await sepoliaUsdt.balanceOf(wallet.address)) as bigint;
    if (usdtAfterSepolia > usdtBeforeSepolia) break;
    process.stdout.write('.');
  }
  console.log('');

  const pusdAfter = (await pusd.balanceOf(wallet.address)) as bigint;
  const reserveAfterEoa = (await reserve.balanceOf(wallet.address)) as bigint;
  console.log(`\n💰 PUSD on Push EOA AFTER:         ${formatUnits6(pusdAfter)} PUSD`);
  console.log(`💰 USDT.eth on Push EOA AFTER:     ${formatUnits6(reserveAfterEoa)} USDT.eth`);
  console.log(`💰 USDT on Sepolia AFTER:          ${formatUnits6(usdtAfterSepolia)} USDT`);
  console.log(`\n📊 PUSD burned:        ${formatUnits6(pusdBalance - pusdAfter)}`);
  console.log(`📊 USDT.eth residual:  ${formatUnits6(reserveAfterEoa - reserveBeforeEoa)} (anything left on the EOA)`);
  console.log(`📊 USDT on Sepolia:    ${formatUnits6(usdtAfterSepolia - usdtBeforeSepolia)} (delivered cross-chain)`);

  if (usdtAfterSepolia > usdtBeforeSepolia) {
    console.log('\n🎉 PUSD redeemed on Push and USDT delivered to your Sepolia wallet (two signatures from one Push EOA).');
  } else {
    console.log('\n⏳ Sepolia delivery not yet observed. Track with `track-universal-transaction` against the bridge tx hash above; the relay typically settles within a few minutes.');
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

// Read a private key from one of the env vars (in order); generate a fresh
// one and print it if none are set. Returns a connected ethers.Wallet.
async function loadOrGenerateWallet(
  provider: ethers.JsonRpcProvider,
  ...envVarNames: string[]
): Promise<ethers.Wallet> {
  for (const name of envVarNames) {
    const value = process.env[name];
    if (value) {
      console.log(`🔑 Using ${name} from environment.`);
      return new ethers.Wallet(value, provider);
    }
  }
  const random = ethers.Wallet.createRandom();
  const wallet = new ethers.Wallet(random.privateKey, provider);
  console.log(`🔑 No ${envVarNames.join('/')} env var found — generated a fresh wallet.`);
  console.log('   To re-run with the same address (and same balances), save:');
  console.log(`   ${envVarNames[0]}=${random.privateKey}`);
  return wallet;
}

// PUSD, PUSD+, and every reserve token use 6 decimals on Donut.
function formatUnits6(amount: bigint): string {
  const ONE_M = BigInt(1_000_000);
  const whole = amount / ONE_M;
  const frac = (amount % ONE_M).toString().padStart(6, '0').replace(/0+$/, '');
  return frac.length > 0 ? `${whole}.${frac}` : `${whole}`;
}
