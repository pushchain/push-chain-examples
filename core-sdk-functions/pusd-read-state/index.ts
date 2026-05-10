// Full Documentation: https://pusd.push.org/docs
//
// Read PUSD Protocol State (no signer required)
// ==============================================
// A read-only inventory of the PUSD protocol on Push Chain Donut Testnet.
// Walks the manager's supported-token list and prints, for each reserve:
//
//   • per-token info (status, decimals, surplus haircut, chain namespace)
//   • reserve balance held by PUSDManager
//   • accrued surplus / fees per token
//
// And at the protocol level:
//
//   • PUSD totalSupply
//   • baseFee, preferredFeeMin, preferredFeeMax
//   • totalReserves vs totalSupply (the I-01 solvency invariant)
//
// Pure ethers reads — no signer, no PC, no env vars.

import { ethers } from 'ethers';

// ───────────────────────────────────────────────────────────────────────────
// Network constants
// ───────────────────────────────────────────────────────────────────────────

const PUSH_RPC_URL = 'https://evm.donut.rpc.push.org/';

// PUSD protocol — Donut Testnet (chain 42101). UUPS proxies; addresses stable.
const PUSD_ADDRESS = '0x488d080e16386379561a47A4955D22001d8A9D89';
const PUSD_MANAGER = '0x7A24Eea43a1095e9Dc652AB9Cba156a93Ed5Ed46';
const PUSD_PLUS_VAULT = '0xb55a5B36d82D3B7f18Afe42F390De565080A49a1';

// PUSDManager.TokenStatus enum (matches IPUSDManager.TokenStatus on-chain).
const TOKEN_STATUS_NAMES = ['REMOVED', 'ENABLED', 'REDEEM_ONLY', 'EMERGENCY_REDEEM'] as const;

// ───────────────────────────────────────────────────────────────────────────
// ABIs (read-only fragments)
// ───────────────────────────────────────────────────────────────────────────

const PUSD_READ_ABI = [
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
];

const PUSD_PLUS_READ_ABI = [
  'function totalSupply() view returns (uint256)',
  'function nav() view returns (uint256)',
  'function totalAssets() view returns (uint256)',
  'function nextQueueId() view returns (uint256)',
  'function totalQueuedPusd() view returns (uint256)',
];

const ERC20_BALANCE_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
];

// PUSDManager — only the reads we need. The TokenInfo struct unpacks as a
// tuple in ethers v6: [exists, status, decimals, surplusHaircutBps, name, chainNamespace]
const MANAGER_READ_ABI = [
  'function baseFee() view returns (uint256)',
  'function preferredFeeMin() view returns (uint256)',
  'function preferredFeeMax() view returns (uint256)',
  'function getSupportedTokensCount() view returns (uint256)',
  'function getSupportedTokenAt(uint256) view returns (address)',
  'function getTokenStatus(address) view returns (uint8)',
  'function getTokenInfo(address) view returns (tuple(bool exists, uint8 status, uint8 decimals, uint16 surplusHaircutBps, string name, string chainNamespace))',
  'function getAccruedSurplus(address) view returns (uint256)',
];

// ───────────────────────────────────────────────────────────────────────────
// Main
// ───────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌟 PUSD Protocol State — Donut Testnet (chain 42101)\n');
  console.log(`RPC:      ${PUSH_RPC_URL}`);
  console.log(`PUSD:     ${PUSD_ADDRESS}`);
  console.log(`Manager:  ${PUSD_MANAGER}`);
  console.log(`Vault:    ${PUSD_PLUS_VAULT}`);

  const provider = new ethers.JsonRpcProvider(PUSH_RPC_URL);
  const pusd = new ethers.Contract(PUSD_ADDRESS, PUSD_READ_ABI, provider);
  const manager = new ethers.Contract(PUSD_MANAGER, MANAGER_READ_ABI, provider);
  const vault = new ethers.Contract(PUSD_PLUS_VAULT, PUSD_PLUS_READ_ABI, provider);

  // ── 1. Protocol-level supplies and fee parameters ──────────────────────
  console.log('\n1️⃣  Protocol-level supplies + fees');

  const [totalSupply, baseFee, preferredFeeMin, preferredFeeMax] = await Promise.all([
    pusd.totalSupply() as Promise<bigint>,
    manager.baseFee() as Promise<bigint>,
    manager.preferredFeeMin() as Promise<bigint>,
    manager.preferredFeeMax() as Promise<bigint>,
  ]);

  console.log(`   PUSD totalSupply        : ${formatUnits6(totalSupply)} PUSD`);
  console.log(`   baseFee                 : ${baseFee.toString()} bps  (${(Number(baseFee) / 100).toFixed(2)}%)`);
  console.log(`   preferredFeeMin         : ${preferredFeeMin.toString()} bps`);
  console.log(`   preferredFeeMax         : ${preferredFeeMax.toString()} bps  (≤ 200)`);

  // ── 2. PUSD+ vault state ───────────────────────────────────────────────
  console.log('\n2️⃣  PUSD+ vault state');

  const [plusSupply, nav, totalAssets, nextQ, queuedPusd] = await Promise.all([
    vault.totalSupply() as Promise<bigint>,
    vault.nav() as Promise<bigint>,
    vault.totalAssets() as Promise<bigint>,
    vault.nextQueueId() as Promise<bigint>,
    vault.totalQueuedPusd() as Promise<bigint>,
  ]);

  console.log(`   PUSD+ totalSupply       : ${formatUnits6(plusSupply)} PUSD+`);
  console.log(`   NAV (1e18 fixed-point)  : ${nav.toString()}`);
  console.log(`   totalAssets             : ${formatUnits6(totalAssets)} PUSD-equiv`);
  console.log(`   nextQueueId             : ${nextQ.toString()}`);
  console.log(`   totalQueuedPusd         : ${formatUnits6(queuedPusd)} PUSD`);

  // ── 3. Walk each supported reserve token ───────────────────────────────
  console.log('\n3️⃣  Supported reserve tokens (enumerated on-chain)');

  const count = (await manager.getSupportedTokensCount()) as bigint;
  console.log(`   count: ${count.toString()}\n`);

  let totalReserves = BigInt(0);
  let totalSurplus = BigInt(0);

  // Header for the table
  console.log('   ' + pad('symbol', 14) + pad('status', 17) + pad('chain', 18) +
    pad('reserve', 16) + pad('surplus', 14) + pad('haircut', 9) + 'address');
  console.log('   ' + '─'.repeat(116));

  for (let i = BigInt(0); i < count; i = i + BigInt(1)) {
    const tokenAddr = (await manager.getSupportedTokenAt(i)) as string;
    const info = await manager.getTokenInfo(tokenAddr);
    // info: [exists, status, decimals, surplusHaircutBps, name, chainNamespace]
    const status = Number(info[1] ?? info.status);
    const haircut = Number(info[3] ?? info.surplusHaircutBps);
    const chainNs = (info[5] ?? info.chainNamespace) as string;

    const erc20 = new ethers.Contract(tokenAddr, ERC20_BALANCE_ABI, provider);
    const [reserveBal, accruedSurplus, symbol] = await Promise.all([
      erc20.balanceOf(PUSD_MANAGER) as Promise<bigint>,
      manager.getAccruedSurplus(tokenAddr) as Promise<bigint>,
      erc20.symbol().catch(() => '?') as Promise<string>,
    ]);

    totalReserves += reserveBal;
    totalSurplus += accruedSurplus;

    console.log('   ' +
      pad(symbol, 14) +
      pad(TOKEN_STATUS_NAMES[status] ?? `status ${status}`, 17) +
      pad(chainNs, 18) +
      pad(formatUnits6(reserveBal), 16) +
      pad(formatUnits6(accruedSurplus), 14) +
      pad(`${haircut} bps`, 9) +
      tokenAddr
    );
  }

  // ── 4. Solvency invariant (I-01) ───────────────────────────────────────
  console.log('\n4️⃣  Solvency invariant (I-01): totalReserves ≥ totalSupply');
  console.log(`   totalReserves  : ${formatUnits6(totalReserves)}`);
  console.log(`   PUSD supply    : ${formatUnits6(totalSupply)}`);
  console.log(`   accrued surplus: ${formatUnits6(totalSurplus)}`);

  if (totalReserves >= totalSupply) {
    const slack = totalReserves - totalSupply;
    console.log(`   ✅ Invariant holds (slack: ${formatUnits6(slack)})`);
  } else {
    const deficit = totalSupply - totalReserves;
    console.log(`   ❌ Invariant VIOLATED (deficit: ${formatUnits6(deficit)})`);
  }

  console.log('\n🎉 Done. All data read directly from the proxy contracts on Donut.');
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

function pad(s: string, n: number): string {
  if (s.length >= n) return s.slice(0, n - 1) + ' ';
  return s + ' '.repeat(n - s.length);
}
