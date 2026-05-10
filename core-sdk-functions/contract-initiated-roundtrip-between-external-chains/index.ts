// Full Documentation: https://push.org/docs/chain/build/contract-initiated-multichain-execution
//
// Multi-Chain Cascade — Push → BNB → (back-leg) → Solana
// =======================================================
// One Push tx triggers a 3-chain cascade:
//   1. Push contract dispatches outbound to BNB CEA — BNB counter increments.
//   2. BNB CEA's multicall self-calls sendUniversalTxToUEA — back-leg fires.
//   3. TSS delivers back-leg to this contract on Push (via executeUniversalTx).
//   4. The contract's executeUniversalTx fires a NEW outbound to Solana CEA.
//   5. Solana CEA executes the test_counter program — Solana counter increments.

import 'dotenv/config';
import { PushChain } from '@pushchain/core';
import { ethers } from 'ethers';
import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import * as fs from 'node:fs';
import * as path from 'node:path';

const RPC_PUSH = 'https://evm.donut.rpc.push.org/';
const RPC_BNB = 'https://bsc-testnet-rpc.publicnode.com';

const UGPC = '0x00000000000000000000000000000000000000C1';
const UNIVERSAL_EXECUTOR_MODULE = '0x14191Ea54B4c176fCf86f51b0FAc7CB1E71Df7d7';

// BNB-side target — the same counter all the BNB examples use.
const BNB_COUNTER = '0x7f0936bb90e7dcf3edb47199c2005e7184e44cf8';

// Solana-side target — the test_counter program from
// `send-universal-transaction-to-external-chains/`. Its IDL is inlined
// below so the runner is self-contained.
const SOL_TEST_PROGRAM = '8yNqjrMnFiFbVTVQcKij8tNWWTMdFkrDf9abCGgc2sgx';

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

const CASCADE_ABI = [
  'function fund() external payable',
  'function configureBnbTarget(address bnbDestinationContract, bytes bnbDestinationCalldata) external',
  'function configureSolanaTarget(bytes solanaCEABytes, bytes solanaPayload) external',
  'function configureSolanaOutboundValue(uint256 valuePc) external',
  'function kickOff(address bnbCEAAddr, uint256 protocolFeePc, uint256 ueaNonce) external',
  'function dispatchSolanaManually() external',
  'function bnbDestinationContract() view returns (address)',
  'function solanaCEABytes() view returns (bytes)',
  'function solanaPayload() view returns (bytes)',
  'function solanaOutboundValuePc() view returns (uint256)',
  'function kickOffCount() view returns (uint256)',
  'function bnbBackLegCount() view returns (uint256)',
  'function solanaDispatchCount() view returns (uint256)',
  'function lastInboundTxId() view returns (bytes32)',
  'event KickedOff(uint256 kickOffCount, bytes outboundPayload)',
  'event BnbBackLegLanded(bytes32 indexed txId, uint256 bnbBackLegCount)',
  'event SolanaDispatched(uint256 solanaDispatchCount, uint256 valuePc)',
];

const PSOL_ON_PUSH = '0x5D525Df2bD99a6e7ec58b76aF2fd95F39874EBed';

const UGPC_ABI = ['function UNIVERSAL_CORE() view returns (address)'];
const UNIVERSAL_CORE_ABI = [
  'function getOutboundTxGasAndFees(address prc20Token, uint256 gasLimit) view returns (address gasToken, uint256 gasFee, uint256 protocolFee, uint256 gasPrice)',
  'function WPC() view returns (address)',
  'function uniswapV3Factory() view returns (address)',
  'function defaultFeeTier(address) view returns (uint24)',
];
const UNI_FACTORY_ABI = ['function getPool(address, address, uint24) view returns (address)'];
const UNI_POOL_ABI = ['function slot0() view returns (uint160 sqrtPriceX96, int24, uint16, uint16, uint16, uint8, bool)'];

/**
 * Mirrors the SDK's `estimateNativeValueForSwap` (in
 * `@pushchain/core/src/lib/orchestrator/internals/gas-calculator.js`) plus the
 * outer 10% buffer applied in `executeUoaToCeaSvm`. Returns the PC value to
 * pass as `msg.value` when calling UGPC.sendUniversalTxOutbound for a Solana
 * destination so the on-chain PC→pSOL Uniswap V3 swap can clear current pool
 * depth without reverting `STF` (SafeTransferFrom).
 */
async function computeSolanaOutboundValue(
  pushProvider: ethers.Provider,
  prc20Token: string,
  gasLimit: bigint
): Promise<{ valuePc: bigint; debug: Record<string, string> }> {
  const ugpc = new ethers.Contract(UGPC, UGPC_ABI, pushProvider);
  const universalCoreAddr: string = await ugpc.UNIVERSAL_CORE();
  const universalCore = new ethers.Contract(universalCoreAddr, UNIVERSAL_CORE_ABI, pushProvider);

  const [gasToken, gasFee] = await universalCore.getOutboundTxGasAndFees(prc20Token, gasLimit);
  const [wpcAddress, factoryAddress, feeTier] = await Promise.all([
    universalCore.WPC(),
    universalCore.uniswapV3Factory(),
    universalCore.defaultFeeTier(gasToken),
  ]);
  const factory = new ethers.Contract(factoryAddress, UNI_FACTORY_ABI, pushProvider);
  const poolAddress: string = await factory.getPool(wpcAddress, gasToken, feeTier);
  if (poolAddress === ethers.ZeroAddress) {
    throw new Error(`No PC↔gasToken pool for ${gasToken} with feeTier ${feeTier}`);
  }
  const pool = new ethers.Contract(poolAddress, UNI_POOL_ABI, pushProvider);
  const [sqrtPriceX96] = await pool.slot0();

  const Q192 = 1n << 192n;
  const priceNum = (sqrtPriceX96 as bigint) * (sqrtPriceX96 as bigint);
  const isGasTokenToken0 =
    (gasToken as string).toLowerCase() < (wpcAddress as string).toLowerCase();
  const wpcNeeded: bigint = isGasTokenToken0
    ? ((gasFee as bigint) * priceNum) / Q192
    : ((gasFee as bigint) * Q192) / priceNum;
  const swapBuffered = wpcNeeded * 2n;          // SDK SWAP_BUFFER
  const withTenPct = (swapBuffered * 110n) / 100n; // SDK +10% executor buffer

  return {
    valuePc: withTenPct,
    debug: {
      gasToken,
      gasFee: ethers.formatEther(gasFee as bigint) + ' (raw)',
      gasFeeRaw: (gasFee as bigint).toString(),
      pool: poolAddress,
      sqrtPriceX96: (sqrtPriceX96 as bigint).toString(),
      wpcNeeded: ethers.formatEther(wpcNeeded),
      withSwapBuffer: ethers.formatEther(swapBuffered),
      with10PctBuffer: ethers.formatEther(withTenPct),
    },
  };
}

const COUNTER_ABI = [
  { inputs: [], name: 'increment', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'count', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
];

async function main() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) {
    console.error('❌ Missing PRIVATE_KEY in .env. Copy .env.sample first.');
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Multi-Chain Cascade — Push → BNB → Push → Solana');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const pushProvider = new ethers.JsonRpcProvider(RPC_PUSH);
  const bnbProvider = new ethers.JsonRpcProvider(RPC_BNB);
  const pushWallet = new ethers.Wallet(pk, pushProvider);

  console.log('🔑 Push EOA:', pushWallet.address);
  const eoaBal = await pushProvider.getBalance(pushWallet.address);
  console.log(`💰 EOA balance: ${ethers.formatEther(eoaBal)} PC\n`);

  // 1) Deploy or reuse the cascade dispatcher.
  const dispatcherAddress = await getOrDeployFoundry({
    envVar: 'CASCADE_CONTRACT_ADDRESS',
    artifactPath: 'out/MultiChainCascade.sol/MultiChainCascade.json',
    deployer: pushWallet,
    constructorArgs: [UGPC, UNIVERSAL_EXECUTOR_MODULE],
    label: 'MultiChainCascade on Push Donut Testnet',
  });
  const dispatcher = new ethers.Contract(dispatcherAddress, CASCADE_ABI, pushWallet);
  console.log(`📦 Dispatcher: ${dispatcherAddress}`);

  // 2) Top up PC.
  const protocolFee = ethers.parseEther(process.env.KICKOFF_PROTOCOL_FEE_PC || '8');
  const contractBal = await pushProvider.getBalance(dispatcherAddress);
  console.log(`📊 Dispatcher PC balance: ${ethers.formatEther(contractBal)} PC`);
  if (contractBal < protocolFee) {
    const topUp = protocolFee - contractBal;
    console.log(`💸 Funding contract with ${ethers.formatEther(topUp)} PC...`);
    const txFund = await dispatcher.fund({ value: topUp });
    await txFund.wait();
    console.log(`   ✅ funded\n`);
  } else {
    console.log('   ✅ already funded\n');
  }

  // 3) Initialize the SDK (we only use it for derive + encodeTxData).
  const universalSigner = await PushChain.utils.signer.toUniversal(pushWallet);
  const pushChainClient = await PushChain.initialize(universalSigner, {
    network: PushChain.CONSTANTS.PUSH_NETWORK.TESTNET,
  });
  const dispatcherAccount = PushChain.utils.account.toUniversal(
    dispatcherAddress,
    { chain: PushChain.CONSTANTS.CHAIN.PUSH_TESTNET }
  );

  // 4) Derive the dispatcher's CEA on BNB and on Solana.
  const bnbCEA = await PushChain.utils.account.deriveExecutorAccount(
    dispatcherAccount,
    { chain: PushChain.CONSTANTS.CHAIN.BNB_TESTNET, skipNetworkCheck: true }
  );
  console.log(`📍 Dispatcher's CEA on BNB:    ${bnbCEA.address}`);
  const ceaBnbBal = await bnbProvider.getBalance(bnbCEA.address);
  console.log(`📊 BNB CEA balance: ${ethers.formatEther(ceaBnbBal)} BNB`);
  if (ceaBnbBal < ethers.parseEther('0.001')) {
    console.error(`\n❌ The BNB CEA needs ≥ 0.001 BNB to dispatch the back-leg.`);
    console.error(`   Faucet to: ${bnbCEA.address}`);
    console.error('   https://www.bnbchain.org/en/testnet-faucet');
    process.exit(1);
  }

  const solanaCEA = await PushChain.utils.account.deriveExecutorAccount(
    dispatcherAccount,
    { chain: PushChain.CONSTANTS.CHAIN.SOLANA_DEVNET, skipNetworkCheck: true }
  );
  // The SDK returns Solana CEA addresses in 0x-prefixed hex form (32 raw bytes
  // of the Solana program-derived account). Convert to base58 for display,
  // pass the hex as-is to the contract.
  const solanaCEABytesHex: string = solanaCEA.address.startsWith('0x')
    ? solanaCEA.address
    : '0x' + Buffer.from(bs58.decode(solanaCEA.address)).toString('hex');
  const solanaCEABase58 = solanaCEA.address.startsWith('0x')
    ? bs58.encode(Buffer.from(solanaCEA.address.slice(2), 'hex'))
    : solanaCEA.address;
  console.log(`📍 Dispatcher's CEA on Solana: ${solanaCEABase58}`);
  console.log(`   (bytes form: ${solanaCEABytesHex})\n`);

  // 5) Configure BNB target on the contract.
  const incrementCalldata = new ethers.Interface(COUNTER_ABI).encodeFunctionData('increment', []);
  const onChainBnbTarget = await dispatcher.bnbDestinationContract();
  if (onChainBnbTarget.toLowerCase() !== BNB_COUNTER.toLowerCase()) {
    console.log('🔧 Configuring BNB target on the contract...');
    const txCfg = await dispatcher.configureBnbTarget(BNB_COUNTER, incrementCalldata);
    await txCfg.wait();
    console.log(`   ✅ BNB target set: ${BNB_COUNTER} -> increment()\n`);
  } else {
    console.log('🔧 BNB target already configured\n');
  }

  // 6) Build Solana payload (Anchor-encoded receive_sol(0)) and configure.
  const solanaPayload = PushChain.utils.helpers.encodeTxData({
    idl: TEST_COUNTER_IDL as any,
    functionName: 'receive_sol',
    args: [BigInt(0)],
  });
  const onChainSolanaPayload = await dispatcher.solanaPayload();
  if (
    onChainSolanaPayload.toLowerCase() !== solanaPayload.toLowerCase() ||
    (await dispatcher.solanaCEABytes()).toLowerCase() !== solanaCEABytesHex.toLowerCase()
  ) {
    console.log('Configuring Solana target on the contract...');
    const txCfg = await dispatcher.configureSolanaTarget(solanaCEABytesHex, solanaPayload);
    await txCfg.wait();
    console.log(`   Solana target set: program ${SOL_TEST_PROGRAM} -> receive_sol(0)\n`);
  } else {
    console.log('Solana target already configured\n');
  }

  // 6b) Compute the precise PC value the cascade should forward to UGPC for
  // the Solana outbound. Mirrors the SDK's pool-slot0 swap-sizing logic so the
  // PC->pSOL swap clears current Uniswap V3 pool depth without reverting STF.
  console.log('Computing Solana outbound PC value (mirrors SDK estimateNativeValueForSwap)...');
  const { valuePc: solanaValueComputed, debug } = await computeSolanaOutboundValue(
    pushProvider,
    PSOL_ON_PUSH,
    BigInt(2_000_000)
  );
  console.log(`   gasToken:           ${debug.gasToken}`);
  console.log(`   gasFee (pSOL):      ${debug.gasFeeRaw}`);
  console.log(`   pool:               ${debug.pool}`);
  console.log(`   sqrtPriceX96:       ${debug.sqrtPriceX96}`);
  console.log(`   wpcNeeded:          ${debug.wpcNeeded} PC`);
  console.log(`   x2 swap buffer:     ${debug.withSwapBuffer} PC`);
  console.log(`   +10% safety buffer: ${debug.with10PctBuffer} PC  <- value`);

  const onChainSolValue: bigint = await dispatcher.solanaOutboundValuePc();
  if (onChainSolValue !== solanaValueComputed) {
    console.log('Configuring Solana outbound value on the contract...');
    const txCfg = await dispatcher.configureSolanaOutboundValue(solanaValueComputed);
    await txCfg.wait();
    console.log(`   set solanaOutboundValuePc = ${ethers.formatEther(solanaValueComputed)} PC\n`);
  } else {
    console.log('Solana outbound value already configured\n');
  }

  // 6c) Re-check funding: the contract needs enough PC to cover the BNB
  // outbound (protocolFee) AND the Solana outbound (solanaValueComputed).
  // Top up if short.
  const requiredPc = protocolFee + solanaValueComputed;
  const currentBal = await pushProvider.getBalance(dispatcherAddress);
  if (currentBal < requiredPc) {
    const topUp = requiredPc - currentBal;
    console.log(`Topping up to cover both outbound legs (need ${ethers.formatEther(requiredPc)} PC, have ${ethers.formatEther(currentBal)} PC)...`);
    const txTop = await dispatcher.fund({ value: topUp });
    await txTop.wait();
    console.log(`   topped up by ${ethers.formatEther(topUp)} PC\n`);
  }

  // 7) Snapshot starting state.
  const startKickOff: bigint = await dispatcher.kickOffCount();
  const startBackLeg: bigint = await dispatcher.bnbBackLegCount();
  const startSolanaDisp: bigint = await dispatcher.solanaDispatchCount();
  const bnbCounter = new ethers.Contract(BNB_COUNTER, COUNTER_ABI, bnbProvider);
  const startBnbCount: bigint = await bnbCounter.count();
  console.log(`📊 Pre-kick state:`);
  console.log(`   kickOffCount:        ${startKickOff}`);
  console.log(`   bnbBackLegCount:     ${startBackLeg}`);
  console.log(`   solanaDispatchCount: ${startSolanaDisp}`);
  console.log(`   BNB counter:         ${startBnbCount}\n`);

  // 8) Kick off.
  console.log('🚀 Calling kickOff() on Push contract...');
  const txKick = await dispatcher.kickOff(bnbCEA.address, protocolFee, BigInt(0));
  console.log(`   📤 Push tx: ${txKick.hash}`);
  console.log(`   🔗 ${pushChainClient.explorer.getTransactionUrl(txKick.hash)}`);
  const recK = await txKick.wait();
  console.log(`   ✅ Push leg settled. status=${recK?.status === 1 ? 'success' : 'failed'} block=${recK?.blockNumber}`);

  // 9) Watch the cascade.
  console.log('\n📡 Watching the cascade unfold...');
  console.log('   1) BNB CEA executes outbound → BNB counter increments');
  console.log('   2) BNB back-leg lands on Push → bnbBackLegCount advances');
  console.log('   3) executeUniversalTx fires Solana outbound → solanaDispatchCount advances');
  console.log('   4) Solana CEA executes test_counter program (visible on Solscan)');
  console.log('   Polling every 8s for up to 10 minutes.\n');

  const deadline = Date.now() + 10 * 60 * 1000;
  let bnbDone = false;
  let backlegDone = false;
  let solanaDone = false;
  while (Date.now() < deadline) {
    const [curBnb, curBackLeg, curSolDisp] = await Promise.all([
      bnbCounter.count() as Promise<bigint>,
      dispatcher.bnbBackLegCount() as Promise<bigint>,
      dispatcher.solanaDispatchCount() as Promise<bigint>,
    ]);
    if (!bnbDone && curBnb > startBnbCount) {
      bnbDone = true;
      console.log(`✅ BNB leg landed: counter ${startBnbCount} → ${curBnb}`);
    }
    if (!backlegDone && curBackLeg > startBackLeg) {
      backlegDone = true;
      console.log(`✅ BNB back-leg arrived on Push: bnbBackLegCount ${startBackLeg} → ${curBackLeg}`);
    }
    if (!solanaDone && curSolDisp > startSolanaDisp) {
      solanaDone = true;
      console.log(`✅ Solana outbound dispatched: solanaDispatchCount ${startSolanaDisp} → ${curSolDisp}`);
      console.log(`   🔗 https://explorer.solana.com/address/${solanaCEABase58}?cluster=devnet`);
      console.log(`   (the Solana CEA's tx history will show the test_counter call)`);
      console.log(`\n🎉 Three-chain cascade observable on-chain.`);
      return;
    }
    await new Promise((r) => setTimeout(r, 8000));
  }

  console.log('\n⚠️  Cascade incomplete within 10 minutes.');
  console.log(`   bnbBackLegCount:    ${await dispatcher.bnbBackLegCount()}`);
  console.log(`   solanaDispatchCount: ${await dispatcher.solanaDispatchCount()}`);
  console.log(`   Watch ${dispatcherAddress} on https://donut.push.network/`);
}

async function getOrDeployFoundry(args: {
  envVar: string;
  artifactPath: string;
  deployer: ethers.Wallet;
  constructorArgs: any[];
  label: string;
}): Promise<string> {
  const existing = process.env[args.envVar];
  if (existing) {
    console.log(`📦 ${args.label}: reusing ${existing} from .env`);
    return existing;
  }
  const artifactPath = path.join(__dirname, args.artifactPath);
  if (!fs.existsSync(artifactPath)) {
    console.error(`\n❌ Foundry artifact not found at ${artifactPath}. Run \`forge build\` first.`);
    process.exit(1);
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  const bytecode = artifact?.bytecode?.object as string | undefined;
  if (!bytecode || bytecode === '0x') {
    console.error(`\n❌ Empty bytecode in ${artifactPath}.`);
    process.exit(1);
  }
  console.log(`📦 Deploying ${args.label}...`);
  const factory = new ethers.ContractFactory(artifact.abi, bytecode, args.deployer);
  const deployment = await factory.deploy(...args.constructorArgs);
  const tx = deployment.deploymentTransaction();
  if (tx) console.log(`   📤 deploy tx: ${tx.hash}`);
  await deployment.waitForDeployment();
  const address = await deployment.getAddress();
  console.log(`   ✅ deployed at: ${address}`);
  await persistEnv(args.envVar, address);
  return address;
}

async function persistEnv(key: string, value: string) {
  const envPath = path.join(__dirname, '.env');
  let content = '';
  try { content = fs.readFileSync(envPath, 'utf8'); } catch {}
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(content)) content = content.replace(re, `${key}=${value}`);
  else { if (content && !content.endsWith('\n')) content += '\n'; content += `${key}=${value}\n`; }
  fs.writeFileSync(envPath, content);
  console.log(`   💾 Saved ${key}=${value} to .env`);
}

main().catch((err) => { console.error(err); process.exit(1); });
