// Full Documentation: https://push.org/docs/chain/build/contract-initiated-multichain-execution
//
// Outbound With Funds — Push contract bridges PRC-20 + executes call on BNB
// =========================================================================
// Push contract dispatches an outbound that bridges pBNB tokens to the BNB
// CEA AND calls a target contract on BNB in the same outbound. The CEA
// receives the bridged native BNB and executes the multicall.
//
// Prerequisites:
//   1. The contract must hold pBNB (a PRC-20 on Push representing BNB Testnet).
//      Get pBNB by bridging BNB testnet → Push first — e.g. via the Push
//      bridge UI in apps/bridge, or via a Route 1 inbound from BNB.
//   2. The contract must hold PC for the UGPC outbound fee.
//
// What the script does:
//   1. Deploy (or reuse) PushOutboundWithFunds.
//   2. Top up its PC balance via fund() if low.
//   3. Verify the contract holds enough pBNB.
//   4. Derive the contract's CEA on BNB.
//   5. Call dispatchOutboundWithFunds — bridges pBNB + calls BNB counter.
//   6. Watch for: BNB CEA balance increase (bridge landed) AND BNB counter
//      increment (multicall executed).

import 'dotenv/config';
import { PushChain } from '@pushchain/core';
import { ethers } from 'ethers';
import * as fs from 'node:fs';
import * as path from 'node:path';

const RPC_PUSH = 'https://evm.donut.rpc.push.org/';
const RPC_BNB = 'https://bsc-testnet-rpc.publicnode.com';
const UGPC = '0x00000000000000000000000000000000000000C1';
const PBNB_ON_PUSH = '0x7a9082dA308f3fa005beA7dB0d203b3b86664E36';
const BNB_COUNTER = '0x7f0936bb90e7dcf3edb47199c2005e7184e44cf8';

const OUTBOUND_ABI = [
  'function fund() external payable',
  'function dispatchOutboundWithFunds(address destinationCEAAddr, address prc20Token, uint256 amount, address destinationContract, bytes destinationCalldata, uint256 destinationCallValue, uint256 protocolFeePc) external',
  'event OutboundWithFundsKicked(bytes recipient, address indexed token, uint256 amount, bytes payload)',
];

const ERC20_ABI = ['function balanceOf(address) view returns (uint256)'];

const COUNTER_ABI = [
  'function increment() external',
  'function count() view returns (uint256)',
];

async function main() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) {
    console.error('❌ Missing PRIVATE_KEY in .env. Copy .env.sample first.');
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Contract-Initiated Outbound With Funds — Push → BNB');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const pushProvider = new ethers.JsonRpcProvider(RPC_PUSH);
  const bnbProvider = new ethers.JsonRpcProvider(RPC_BNB);
  const pushWallet = new ethers.Wallet(pk, pushProvider);

  console.log('🔑 Push EOA:', pushWallet.address);
  const eoaBal = await pushProvider.getBalance(pushWallet.address);
  console.log(`💰 EOA balance: ${ethers.formatEther(eoaBal)} PC\n`);

  // 1) Deploy or reuse the dispatcher.
  const dispatcherAddress = await getOrDeployFoundry({
    envVar: 'PUSH_OUTBOUND_ADDRESS',
    artifactPath: 'out/PushOutboundWithFunds.sol/PushOutboundWithFunds.json',
    deployer: pushWallet,
    constructorArgs: [UGPC],
    label: 'PushOutboundWithFunds on Push Donut Testnet',
  });
  const dispatcher = new ethers.Contract(dispatcherAddress, OUTBOUND_ABI, pushWallet);
  console.log(`📦 Dispatcher: ${dispatcherAddress}`);

  // 2) Fund with PC for the UGPC fee.
  const protocolFee = ethers.parseEther(process.env.KICKOFF_PROTOCOL_FEE_PC || '8');
  const contractBal = await pushProvider.getBalance(dispatcherAddress);
  console.log(`📊 Dispatcher PC balance: ${ethers.formatEther(contractBal)} PC`);
  console.log(`📊 Protocol fee:          ${ethers.formatEther(protocolFee)} PC`);
  if (contractBal < protocolFee) {
    const topUp = protocolFee - contractBal;
    console.log(`💸 Funding contract with ${ethers.formatEther(topUp)} PC...`);
    const txFund = await dispatcher.fund({ value: topUp });
    await txFund.wait();
    console.log(`   ✅ now ${ethers.formatEther(await pushProvider.getBalance(dispatcherAddress))} PC\n`);
  } else {
    console.log('   ✅ already funded\n');
  }

  // 3) Verify the contract holds pBNB.
  const bridgeAmount = BigInt(process.env.BRIDGE_AMOUNT_WEI || '100000000000000'); // 0.0001 BNB
  const pbnb = new ethers.Contract(PBNB_ON_PUSH, ERC20_ABI, pushProvider);
  const pbnbBal: bigint = await pbnb.balanceOf(dispatcherAddress);
  console.log(`📊 Dispatcher pBNB balance: ${ethers.formatEther(pbnbBal)} pBNB`);
  console.log(`📊 Bridge amount:           ${ethers.formatEther(bridgeAmount)} pBNB`);
  if (pbnbBal < bridgeAmount) {
    console.error(`\n❌ Dispatcher needs ${ethers.formatEther(bridgeAmount)} pBNB but only has ${ethers.formatEther(pbnbBal)}.`);
    console.error(`   Bridge BNB testnet → Push to mint pBNB to the dispatcher (${dispatcherAddress}):`);
    console.error('   1. Use the Push bridge UI (apps/bridge) and send BNB → Push, recipient = dispatcher');
    console.error('   2. Or run a Route 1 inbound from BNB targeting the dispatcher with funds');
    process.exit(1);
  }
  console.log('   ✅ enough pBNB held\n');

  // 4) Derive the contract's CEA on BNB.
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
  console.log(`📍 Dispatcher's CEA on BNB: ${bnbCEA.address}\n`);

  // 5) Snapshot starting state on BNB.
  const bnbCounter = new ethers.Contract(BNB_COUNTER, COUNTER_ABI, bnbProvider);
  const startBnbCount: bigint = await bnbCounter.count();
  const startCeaBalance = await bnbProvider.getBalance(bnbCEA.address);
  console.log(`📊 Pre-call state:`);
  console.log(`   BNB counter:     ${startBnbCount}`);
  console.log(`   BNB CEA balance: ${ethers.formatEther(startCeaBalance)} BNB\n`);

  // 6) Dispatch.
  const incrementCalldata = new ethers.Interface(COUNTER_ABI).encodeFunctionData('increment', []);
  const destinationCallValue = BigInt(process.env.DESTINATION_CALL_VALUE_WEI || '0');

  console.log('🚀 Calling dispatchOutboundWithFunds(...)...');
  console.log(`   destinationCEA:        ${bnbCEA.address}`);
  console.log(`   prc20:                 pBNB (${PBNB_ON_PUSH})`);
  console.log(`   amount:                ${ethers.formatEther(bridgeAmount)} pBNB`);
  console.log(`   destinationContract:   ${BNB_COUNTER} (BNB counter)`);
  console.log(`   destinationCalldata:   ${incrementCalldata}`);
  console.log(`   destinationCallValue:  ${ethers.formatEther(destinationCallValue)} BNB`);
  console.log(`   protocolFee:           ${ethers.formatEther(protocolFee)} PC\n`);

  const txKick = await dispatcher.dispatchOutboundWithFunds(
    bnbCEA.address,
    PBNB_ON_PUSH,
    bridgeAmount,
    BNB_COUNTER,
    incrementCalldata,
    destinationCallValue,
    protocolFee
  );
  console.log(`   📤 Push tx: ${txKick.hash}`);
  console.log(`   🔗 ${pushChainClient.explorer.getTransactionUrl(txKick.hash)}`);
  const recK = await txKick.wait();
  console.log(`   ✅ Push leg settled. status=${recK?.status === 1 ? 'success' : 'failed'} block=${recK?.blockNumber}\n`);

  // 7) Poll for the BNB-side effects.
  console.log('📡 Watching for the BNB-side execution (bridged + counter incremented)...\n');
  const deadline = Date.now() + 6 * 60 * 1000;
  while (Date.now() < deadline) {
    const [curCount, curCeaBal] = await Promise.all([
      bnbCounter.count() as Promise<bigint>,
      bnbProvider.getBalance(bnbCEA.address),
    ]);
    if (curCount > startBnbCount) {
      console.log(`✅ Forward leg landed:`);
      console.log(`   BNB counter: ${startBnbCount} → ${curCount}`);
      console.log(`   BNB CEA balance change: ${ethers.formatEther(curCeaBal - startCeaBalance)} BNB`);
      console.log(`   🔗 https://testnet.bscscan.com/address/${bnbCEA.address}`);
      return;
    }
    await new Promise((r) => setTimeout(r, 6000));
  }

  console.log('⚠️  Did not observe BNB counter advance within 6 minutes.');
  console.log(`   Inspect: https://testnet.bscscan.com/address/${bnbCEA.address}`);
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
