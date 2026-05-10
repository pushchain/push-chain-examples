// Full Documentation: https://push.org/docs/chain/build/contract-initiated-multichain-execution
//
// Roundtrip With Result
// =====================
// Like `contract-initiated-roundtrip-execution/`, but the inbound callback
// drives real application state — fulfilling a "request" by id. The outbound
// includes a requestId in the inner multicall data; the callback decodes it
// and marks the request fulfilled.

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
  'function request(address destinationCEAAddr, address tokenForRouting, uint256 protocolFeePc, uint256 ueaNonce, bytes32 tag) external returns (bytes32)',
  'function nextRequestSeq() view returns (uint256)',
  'function requests(bytes32) view returns (uint8 status, bytes32 destinationTxOrTag, uint256 createdAt, uint256 fulfilledAt, bytes resultData)',
  'event Requested(bytes32 indexed requestId, address externalContract, bytes externalCalldata, bytes32 tag)',
  'event Fulfilled(bytes32 indexed requestId, bytes32 indexed inboundTxId, string sourceChainNamespace, bytes resultData)',
];

async function main() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) {
    console.error('❌ Missing PRIVATE_KEY in .env. Copy .env.sample first.');
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Contract-Initiated Roundtrip With Result — Push → BNB → Push');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const pushProvider = new ethers.JsonRpcProvider(RPC_PUSH);
  const bnbProvider = new ethers.JsonRpcProvider(RPC_BNB);
  const pushWallet = new ethers.Wallet(pk, pushProvider);

  console.log('🔑 Push EOA:', pushWallet.address);
  const eoaBal = await pushProvider.getBalance(pushWallet.address);
  console.log(`💰 EOA balance: ${ethers.formatEther(eoaBal)} PC\n`);

  // 1) Deploy or reuse.
  const dispatcherAddress = await getOrDeployFoundry({
    envVar: 'ROUNDTRIP_DISPATCHER_ADDRESS',
    artifactPath: 'out/RoundtripWithResult.sol/RoundtripWithResult.json',
    deployer: pushWallet,
    constructorArgs: [UGPC, UNIVERSAL_EXECUTOR_MODULE],
    label: 'RoundtripWithResult on Push Donut Testnet',
  });
  const dispatcher = new ethers.Contract(dispatcherAddress, DISPATCHER_ABI, pushWallet);

  // 2) Fund with PC.
  const protocolFee = ethers.parseEther(process.env.KICKOFF_PROTOCOL_FEE_PC || '8');
  const contractBal = await pushProvider.getBalance(dispatcherAddress);
  console.log(`📦 Dispatcher: ${dispatcherAddress}`);
  console.log(`📊 Dispatcher PC balance: ${ethers.formatEther(contractBal)} PC`);
  console.log(`📊 Protocol fee:          ${ethers.formatEther(protocolFee)} PC`);
  if (contractBal < protocolFee) {
    const topUp = protocolFee - contractBal;
    console.log(`💸 Funding contract with ${ethers.formatEther(topUp)} PC...`);
    const txFund = await dispatcher.fund({ value: topUp });
    await txFund.wait();
    console.log(`   ✅ funded\n`);
  } else {
    console.log('   ✅ already funded\n');
  }

  // 3) Derive BNB CEA + verify funded.
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
  const ceaBal = await bnbProvider.getBalance(bnbCEA.address);
  console.log(`📊 BNB CEA balance: ${ethers.formatEther(ceaBal)} BNB`);
  if (ceaBal < ethers.parseEther('0.001')) {
    console.error(`\n❌ The BNB CEA needs ≥ 0.001 BNB to dispatch the back-leg.`);
    console.error(`   Faucet to: ${bnbCEA.address}`);
    console.error('   https://www.bnbchain.org/en/testnet-faucet');
    process.exit(1);
  }
  console.log('   ✅ funded\n');

  // 4) Build a request.
  const tag = process.env.REQUEST_TAG || ethers.id('demo-tag');
  console.log(`📊 Request tag: ${tag}`);

  console.log('\n🚀 Calling request() on Push contract...');
  const txReq = await dispatcher.request(
    bnbCEA.address,
    PBNB_ON_PUSH,
    protocolFee,
    BigInt(0),
    tag
  );
  console.log(`   📤 Push tx: ${txReq.hash}`);
  console.log(`   🔗 ${pushChainClient.explorer.getTransactionUrl(txReq.hash)}`);
  const recR = await txReq.wait();
  console.log(`   ✅ Push leg settled. status=${recR?.status === 1 ? 'success' : 'failed'} block=${recR?.blockNumber}`);

  // Pull the requestId from the Requested event
  const iface = new ethers.Interface(DISPATCHER_ABI);
  let requestId: string | undefined;
  for (const log of recR?.logs ?? []) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === 'Requested') {
        requestId = parsed.args.requestId;
        break;
      }
    } catch {}
  }
  if (!requestId) {
    console.error('❌ Could not extract requestId from Requested event');
    process.exit(1);
  }
  console.log(`   📜 requestId = ${requestId}\n`);

  // 5) Poll for fulfillment.
  console.log('📡 Watching for the inbound callback to fulfill the request (1-3 min)...\n');
  const deadline = Date.now() + 8 * 60 * 1000;
  while (Date.now() < deadline) {
    const r = await dispatcher.requests(requestId);
    const status = Number(r.status);
    if (status === 2) { // Fulfilled
      console.log(`🎉 Request fulfilled!`);
      console.log(`   requestId:   ${requestId}`);
      console.log(`   fulfilledAt: ${r.fulfilledAt}`);
      console.log(`   resultData:  ${r.resultData.slice(0, 80)}... (${(r.resultData.length - 2) / 2} bytes)`);
      console.log(`   🔗 https://donut.push.network/address/${dispatcherAddress}`);
      return;
    }
    await new Promise((r) => setTimeout(r, 8000));
  }

  console.log('⚠️  Request not fulfilled within 8 minutes.');
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
