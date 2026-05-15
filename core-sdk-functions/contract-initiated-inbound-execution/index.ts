// Full Documentation: https://push.org/docs/chain/build/contract-initiated-multichain-execution
//
// Drive a contract on **Sepolia** that triggers an action on **Push Chain**
// from its own deterministic UEA. The Sepolia contract calls the per-chain
// UniversalGateway directly; Push Chain's TSS picks up the gateway event and
// delivers the call from the contract's UEA on Push.
//
// Prerequisites:
//   - PRIVATE_KEY in .env (Sepolia wallet with ≥ 0.05 ETH AND ≥ 1 PC on Push)
//   - Optional: SEPOLIA_DISPATCHER_ADDRESS / PUSH_COUNTER_ADDRESS to skip
//     deployment if you've already deployed.
//
// What the script does:
//   1. Deploys (or reuses) PushCounter on Push Chain.
//   2. Deploys (or reuses) EthereumInboundDispatcher on Sepolia.
//   3. Computes the dispatcher's UEA on Push (this is the address the counter
//      will see as `msg.sender`).
//   4. Calls dispatcher.triggerOnPush(pushCounter, increment(), revertRecipient).
//   5. Polls the Push counter until it increments — proving the inbound legged.

import 'dotenv/config';
import { PushChain } from '@pushchain/core';
import { ethers } from 'ethers';
import * as fs from 'node:fs';
import * as path from 'node:path';

const RPC_PUSH = 'https://evm.donut.rpc.push.org/';
const RPC_SEPOLIA = 'https://ethereum-sepolia-rpc.publicnode.com';

// Per-chain UniversalGateway — sourced from the SDK's chain constants
// (`CHAIN_INFO[ETHEREUM_SEPOLIA].lockerContract`). Hardcoded here for clarity.
const SEPOLIA_GATEWAY = '0x05bD7a3D18324c1F7e216f7fBF2b15985aE5281A';

// ABIs the script needs.
const DISPATCHER_ABI = [
  'function triggerOnPush(address pushTarget, bytes pushCalldata, uint256 nonce, address revertRecipient) external payable',
  'function gateway() view returns (address)',
  'event InboundDispatched(address indexed pushTarget, bytes pushCalldata, uint256 nonce, uint256 fee)',
];
const COUNTER_ABI = [
  'function increment() external',
  'function count() view returns (uint256)',
  'function lastCaller() view returns (address)',
  'event Incremented(address indexed caller, uint256 newCount)',
];

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ Missing PRIVATE_KEY env var. Copy .env.sample to .env and fill it in.');
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Contract-Initiated Inbound Execution — Sepolia → Push Chain');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const pushProvider = new ethers.JsonRpcProvider(RPC_PUSH);
  const sepoliaProvider = new ethers.JsonRpcProvider(RPC_SEPOLIA);
  const pushWallet = new ethers.Wallet(privateKey, pushProvider);
  const sepoliaWallet = new ethers.Wallet(privateKey, sepoliaProvider);

  console.log('🔑 EOA (used on both chains):', pushWallet.address);

  const [pushBal, sepBal] = await Promise.all([
    pushProvider.getBalance(pushWallet.address),
    sepoliaProvider.getBalance(sepoliaWallet.address),
  ]);
  console.log(`💰 Push balance:    ${ethers.formatEther(pushBal)} PC`);
  console.log(`💰 Sepolia balance: ${ethers.formatEther(sepBal)} ETH\n`);

  // 1) Push counter — deploy or reuse from .env.
  const counterAddress = await getOrDeployFoundry({
    envVar: 'PUSH_COUNTER_ADDRESS',
    artifactPath: 'out/PushCounter.sol/PushCounter.json',
    deployer: pushWallet,
    constructorArgs: [],
    label: 'PushCounter on Push Donut Testnet',
  });
  const counter = new ethers.Contract(counterAddress, COUNTER_ABI, pushProvider);

  // 2) Sepolia dispatcher — deploy or reuse from .env.
  const dispatcherAddress = await getOrDeployFoundry({
    envVar: 'SEPOLIA_DISPATCHER_ADDRESS',
    artifactPath: 'out/EthereumInboundDispatcher.sol/EthereumInboundDispatcher.json',
    deployer: sepoliaWallet,
    constructorArgs: [SEPOLIA_GATEWAY],
    label: 'EthereumInboundDispatcher on Sepolia',
  });
  const dispatcher = new ethers.Contract(dispatcherAddress, DISPATCHER_ABI, sepoliaWallet);

  // 3) Show the dispatcher's UEA on Push — this is what the counter will see.
  // We initialize a Push Chain client just to use `deriveExecutorAccount`.
  const universalSigner = await PushChain.utils.signer.toUniversal(pushWallet);
  const pushChainClient = await PushChain.initialize(universalSigner, {
    network: PushChain.CONSTANTS.PUSH_NETWORK.TESTNET,
  });

  const dispatcherOriginAccount = PushChain.utils.account.toUniversal(
    dispatcherAddress,
    { chain: PushChain.CONSTANTS.CHAIN.ETHEREUM_SEPOLIA }
  );
  const dispatcherUEA = await PushChain.utils.account.deriveExecutorAccount(
    dispatcherOriginAccount,
    { chain: PushChain.CONSTANTS.CHAIN.PUSH_TESTNET, skipNetworkCheck: true }
  );
  console.log(`📍 Dispatcher's UEA on Push: ${dispatcherUEA.address}`);
  console.log('   (this is the msg.sender PushCounter will record)\n');

  // 4) Build calldata + dispatch.
  const incrementCalldata = new ethers.Interface(COUNTER_ABI).encodeFunctionData(
    'increment',
    []
  );

  const fee = ethers.parseEther(process.env.INBOUND_FEE_ETH || '0.005');
  console.log('🚀 Dispatching inbound from Sepolia...');
  console.log(`   Sepolia gateway:    ${SEPOLIA_GATEWAY}`);
  console.log(`   target on Push:     ${counterAddress} (PushCounter)`);
  console.log(`   payload:            increment()  [${incrementCalldata}]`);
  console.log(`   revertRecipient:    ${sepoliaWallet.address} (yourself on Sepolia)`);
  console.log(`   msg.value:          ${ethers.formatEther(fee)} ETH (gateway fee + Push gas)\n`);

  const startCount: bigint = await counter.count();
  console.log(`📊 PushCounter.count() before: ${startCount}`);

  // Read the dispatcher's UEA nonce on Push (the SDK passes this to prevent
  // replay; for the first inbound call to a freshly-derived UEA it's 0).
  const ueaNonce = await getUEANonce(pushProvider, dispatcherUEA.address);
  console.log(`📊 Dispatcher UEA nonce on Push: ${ueaNonce}`);

  const tx = await dispatcher.triggerOnPush(
    counterAddress,
    incrementCalldata,
    ueaNonce,
    sepoliaWallet.address,
    { value: fee }
  );
  console.log(`   📤 Sepolia tx:      ${tx.hash}`);
  console.log(`   🔗 Etherscan:       https://sepolia.etherscan.io/tx/${tx.hash}`);

  const receipt = await tx.wait();
  console.log(
    `\n✅ Sepolia leg settled. status=${receipt?.status === 1 ? 'success' : 'failed'} block=${receipt?.blockNumber}\n`
  );

  // 5) Poll Push counter for the relayed increment.
  console.log('📡 Waiting for the TSS network to relay onto Push Chain...');
  console.log('   (typically settles within 30-90s — polling every 6s)\n');

  const deadline = Date.now() + 300_000;
  let landed = false;
  while (Date.now() < deadline) {
    const cur: bigint = await counter.count();
    if (cur > startCount) {
      landed = true;
      const last: string = await counter.lastCaller();
      console.log(`✅ Push counter incremented: ${startCount} → ${cur}`);
      console.log(`   lastCaller (UEA on Push): ${last}`);
      console.log(`   matches dispatcher UEA?:  ${last.toLowerCase() === dispatcherUEA.address.toLowerCase()}`);
      console.log(`   🔗 Push explorer:         https://donut.push.network/address/${counterAddress}`);
      break;
    }
    await new Promise((r) => setTimeout(r, 6000));
  }

  if (!landed) {
    console.log('⚠️  Did not observe the increment within 5 minutes.');
    console.log('   Check the Sepolia tx events and the Push explorer manually.');
  }

  console.log('\nDone.');
}

// ──────────────────────────────────────────────────────────────────────────────
// UEA nonce reader — the UEA has a `nonce()` view; for an undeployed UEA
// (no bytecode at the address yet) ethers reads back to 0, which is correct.
// ──────────────────────────────────────────────────────────────────────────────

async function getUEANonce(provider: ethers.Provider, ueaAddress: string): Promise<bigint> {
  const code = await provider.getCode(ueaAddress);
  if (!code || code === '0x') return BigInt(0);
  try {
    const uea = new ethers.Contract(
      ueaAddress,
      ['function nonce() view returns (uint256)'],
      provider
    );
    return await uea.nonce();
  } catch {
    return BigInt(0);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Foundry artifact deployer — reads compilation output and deploys via ethers.
// Persists the resulting address back to .env so subsequent runs reuse it.
// ──────────────────────────────────────────────────────────────────────────────

async function getOrDeployFoundry(args: {
  envVar: string;
  artifactPath: string;
  deployer: ethers.Wallet;
  constructorArgs: any[];
  label: string;
}): Promise<string> {
  const existing = process.env[args.envVar];
  if (existing) {
    console.log(`📦 ${args.label}: reusing ${existing} from .env (${args.envVar})`);
    return existing;
  }

  const artifactPath = path.join(__dirname, args.artifactPath);
  if (!fs.existsSync(artifactPath)) {
    console.error(`\n❌ Foundry artifact not found at ${artifactPath}`);
    console.error('   Run `forge build` in this directory first, then re-run npm start.');
    process.exit(1);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  const bytecode = artifact?.bytecode?.object as string | undefined;
  if (!bytecode || bytecode === '0x') {
    console.error(`\n❌ Empty bytecode in ${artifactPath}`);
    process.exit(1);
  }

  console.log(`📦 Deploying ${args.label}...`);
  const factory = new ethers.ContractFactory(artifact.abi, bytecode, args.deployer);
  const deployment = await factory.deploy(...args.constructorArgs);
  const deployTx = deployment.deploymentTransaction();
  if (deployTx) console.log(`   📤 deploy tx: ${deployTx.hash}`);
  await deployment.waitForDeployment();
  const address = await deployment.getAddress();
  console.log(`   ✅ deployed at: ${address}`);

  await persistEnv(args.envVar, address);
  return address;
}

async function persistEnv(key: string, value: string) {
  const envPath = path.join(__dirname, '.env');
  let content = '';
  try {
    content = fs.readFileSync(envPath, 'utf8');
  } catch {
    /* .env doesn't exist yet — fine */
  }

  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(content)) {
    content = content.replace(re, `${key}=${value}`);
  } else {
    if (content.length > 0 && !content.endsWith('\n')) content += '\n';
    content += `${key}=${value}\n`;
  }
  fs.writeFileSync(envPath, content);
  console.log(`   💾 Saved ${key}=${value} to .env`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
