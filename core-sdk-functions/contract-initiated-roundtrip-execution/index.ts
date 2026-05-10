// Full Documentation: https://push.org/docs/chain/build/contract-initiated-multichain-execution
//
// Round-Trip Multichain Execution — Dual Inbound Probe
// ====================================================
// Push contract → UGPC → BNB CEA → CEA self-calls sendUniversalTxToUEA →
// gateway.sendUniversalTxFromCEA → TSS dispatches inbound to Push contract
// (= the CEA's pushAccount).
//
// The contract implements BOTH `executeUniversalTx` overloads so we can
// see empirically which one TSS dispatches to:
//   - UEA-style: `executeUniversalTx(UniversalPayload, bytes)`
//   - Docs-style: `executeUniversalTx(string, bytes, bytes, uint256, address, bytes32)`
// On Donut Testnet, only the docs-style 6-arg version fires for Push-native
// contracts (`docsStyleCallbacks` advances; `ueaStyleCallbacks` stays at 0).

import 'dotenv/config';
import { PushChain } from '@pushchain/core';
import { ethers } from 'ethers';
import * as fs from 'node:fs';
import * as path from 'node:path';

const RPC_PUSH = 'https://evm.donut.rpc.push.org/';
const RPC_BNB = 'https://bsc-testnet-rpc.publicnode.com';

const UGPC = '0x00000000000000000000000000000000000000C1';
const UNIVERSAL_EXECUTOR_MODULE = '0x14191Ea54B4c176fCf86f51b0FAc7CB1E71Df7d7';
const PBNB_ON_PUSH = '0x7a9082dA308f3fa005beA7dB0d203b3b86664E36';

const DISPATCHER_ABI = [
  'function fund() external payable',
  'function kickOff(address destinationCEAAddr, address tokenForRouting, uint256 protocolFeePc, uint256 ueaNonce) external',
  'function outboundCount() view returns (uint256)',
  'function ueaStyleCallbacks() view returns (uint256)',
  'function docsStyleCallbacks() view returns (uint256)',
  'function lastUeaPayloadNonce() view returns (uint256)',
  'function lastDocsTxId() view returns (bytes32)',
  'event OutboundKicked(uint256 outboundCount, bytes payload)',
  'event UeaStyleCallback(uint256 sequence, uint256 payloadNonce, uint8 vType, bytes payloadData)',
  'event DocsStyleCallback(uint256 sequence, bytes32 indexed txId, string sourceChainNamespace, bytes ceaAddress, address prc20, uint256 amount)',
];

async function main() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) {
    console.error('❌ Missing PRIVATE_KEY in .env. Copy .env.sample to .env first.');
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Contract-Initiated Round-Trip — Dual Inbound Probe');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const pushProvider = new ethers.JsonRpcProvider(RPC_PUSH);
  const bnbProvider = new ethers.JsonRpcProvider(RPC_BNB);
  const pushWallet = new ethers.Wallet(pk, pushProvider);

  console.log('🔑 Push EOA:', pushWallet.address);
  const eoaBal = await pushProvider.getBalance(pushWallet.address);
  console.log(`💰 EOA balance: ${ethers.formatEther(eoaBal)} PC\n`);

  // 1) Deploy or reuse the dispatcher.
  const dispatcherAddress = await getOrDeployFoundry({
    envVar: 'ROUNDTRIP_DISPATCHER_ADDRESS',
    artifactPath: 'out/RoundtripDispatcher.sol/RoundtripDispatcher.json',
    deployer: pushWallet,
    constructorArgs: [UGPC, UNIVERSAL_EXECUTOR_MODULE],
    label: 'RoundtripDispatcher on Push Donut Testnet',
  });
  const dispatcher = new ethers.Contract(dispatcherAddress, DISPATCHER_ABI, pushWallet);
  console.log(`📦 Dispatcher: ${dispatcherAddress}`);

  // 2) Top up contract balance if needed.
  const protocolFee = ethers.parseEther(process.env.KICKOFF_PROTOCOL_FEE_PC || '8');
  const contractBal = await pushProvider.getBalance(dispatcherAddress);
  console.log(`📊 Dispatcher balance: ${ethers.formatEther(contractBal)} PC`);
  console.log(`📊 Protocol fee:       ${ethers.formatEther(protocolFee)} PC`);
  if (contractBal < protocolFee) {
    const topUp = protocolFee - contractBal;
    console.log(`💸 Funding contract with ${ethers.formatEther(topUp)} PC...`);
    const txFund = await dispatcher.fund({ value: topUp });
    console.log(`   📤 fund tx: ${txFund.hash}`);
    await txFund.wait();
    console.log(`   ✅ Dispatcher balance now: ${ethers.formatEther(await pushProvider.getBalance(dispatcherAddress))} PC\n`);
  } else {
    console.log('   ✅ Dispatcher already has enough PC\n');
  }

  // 3) Derive the dispatcher's CEA on BNB.
  const universalSigner = await PushChain.utils.signer.toUniversal(pushWallet);
  const pushChainClient = await PushChain.initialize(universalSigner, {
    network: PushChain.CONSTANTS.PUSH_NETWORK.TESTNET,
  });
  const dispatcherAccount = PushChain.utils.account.toUniversal(
    dispatcherAddress,
    { chain: PushChain.CONSTANTS.CHAIN.PUSH_TESTNET }
  );
  const bnbCEA = await PushChain.utils.account.deriveExecutorAccount(
    dispatcherAccount,
    { chain: PushChain.CONSTANTS.CHAIN.BNB_TESTNET, skipNetworkCheck: true }
  );
  console.log(`📍 Dispatcher's CEA on BNB: ${bnbCEA.address}`);

  const bnbCEABal = await bnbProvider.getBalance(bnbCEA.address);
  const bnbCEACode = await bnbProvider.getCode(bnbCEA.address);
  console.log(`📊 CEA balance:  ${ethers.formatEther(bnbCEABal)} BNB`);
  console.log(`📊 CEA bytecode: ${(bnbCEACode.length - 2) / 2} bytes ${bnbCEACode === '0x' ? '(undeployed — TSS will deploy)' : '(deployed)'}\n`);

  // 4) Snapshot starting state.
  const startOutbound: bigint = await dispatcher.outboundCount();
  const startUea: bigint = await dispatcher.ueaStyleCallbacks();
  const startDocs: bigint = await dispatcher.docsStyleCallbacks();
  console.log(`📊 Pre-kick state:`);
  console.log(`   outboundCount:       ${startOutbound}`);
  console.log(`   ueaStyleCallbacks:   ${startUea}`);
  console.log(`   docsStyleCallbacks:  ${startDocs}`);

  // 5) Kick off — pass ueaNonce=0 (Push-native contract has no UEA proxy nonce).
  console.log('\n🚀 Calling kickOff() on Push contract...');
  console.log(`   target chain:       BNB Testnet`);
  console.log(`   bnb CEA target:     ${bnbCEA.address}`);
  console.log(`   routing token:      ${PBNB_ON_PUSH} (pBNB)`);
  console.log(`   protocol fee:       ${ethers.formatEther(protocolFee)} PC (from contract balance)\n`);

  const txKick = await dispatcher.kickOff(
    bnbCEA.address,
    PBNB_ON_PUSH,
    protocolFee,
    BigInt(0)
  );
  console.log(`   📤 Push kickOff tx: ${txKick.hash}`);
  console.log(`   🔗 ${pushChainClient.explorer.getTransactionUrl(txKick.hash)}`);
  const recK = await txKick.wait();
  console.log(`   ✅ Push leg settled. status=${recK?.status === 1 ? 'success' : 'failed'} block=${recK?.blockNumber}`);

  // 6) Poll for the back-leg via either path.
  console.log('\n📡 Watching for both inbound paths to fire (typically 1-3 min total)...');
  console.log('   Whichever counter advances tells us which signature TSS uses.\n');

  const deadline = Date.now() + 8 * 60 * 1000;
  let bnbDeployed = false;
  while (Date.now() < deadline) {
    const [code, ueaC, docsC] = await Promise.all([
      bnbProvider.getCode(bnbCEA.address),
      dispatcher.ueaStyleCallbacks() as Promise<bigint>,
      dispatcher.docsStyleCallbacks() as Promise<bigint>,
    ]);
    const isDeployed = code !== '0x';
    if (isDeployed && !bnbDeployed) {
      bnbDeployed = true;
      console.log(`✅ BNB CEA deployed by TSS (forward leg landed)`);
    }
    if (ueaC > startUea) {
      const lastNonce = await dispatcher.lastUeaPayloadNonce();
      console.log(`\n🎉 UEA-STYLE inbound fired!`);
      console.log(`   ueaStyleCallbacks: ${startUea} → ${ueaC}`);
      console.log(`   lastUeaPayloadNonce: ${lastNonce}`);
      console.log(`   ▶ TSS dispatches via executeUniversalTx(UniversalPayload, bytes)`);
      return;
    }
    if (docsC > startDocs) {
      const lastTx = await dispatcher.lastDocsTxId();
      console.log(`\n🎉 DOCS-STYLE inbound fired!`);
      console.log(`   docsStyleCallbacks: ${startDocs} → ${docsC}`);
      console.log(`   lastDocsTxId: ${lastTx}`);
      console.log(`   ▶ TSS dispatches via executeUniversalTx(string,bytes,bytes,uint256,address,bytes32)`);
      return;
    }
    await new Promise((r) => setTimeout(r, 8000));
  }

  console.log('\n⚠️  Did not observe either inbound path within 8 minutes.');
  console.log(`   Forward leg deployed CEA: ${bnbDeployed ? 'yes' : 'no'}`);
  console.log(`   ueaStyleCallbacks:   ${await dispatcher.ueaStyleCallbacks()}`);
  console.log(`   docsStyleCallbacks:  ${await dispatcher.docsStyleCallbacks()}`);
  console.log(`   Watch ${dispatcherAddress} on https://donut.push.network/ for either event.`);
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
