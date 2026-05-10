// Full Documentation: https://push.org/docs/chain/build/contract-initiated-multichain-execution
//
// Recipient Bridge — Sepolia ETH → Push Chain Recipient
// =====================================================
// A Sepolia contract calls UniversalGateway.sendUniversalTx with funds-only
// semantics: token=0, amount=bridgeAmount, payload encodes a multicall whose
// only step is a native transfer to the recipient on Push.
//
// What the script does:
//   1. Deploy (or reuse) EthereumFundsBridge on Sepolia.
//   2. Read the bridge contract's UEA on Push (the address that holds the
//      bridged amount before forwarding to the recipient).
//   3. Call bridge.bridgeToPush(recipient, bridgeAmount, nonce) with
//      msg.value = bridgeAmount + fee.
//   4. Watch the recipient's balance on Push for the credit.

import 'dotenv/config';
import { PushChain } from '@pushchain/core';
import { ethers } from 'ethers';
import * as fs from 'node:fs';
import * as path from 'node:path';

const RPC_PUSH = 'https://evm.donut.rpc.push.org/';
const RPC_SEPOLIA = 'https://ethereum-sepolia-rpc.publicnode.com';
const SEPOLIA_GATEWAY = '0x05bD7a3D18324c1F7e216f7fBF2b15985aE5281A';

const BRIDGE_ABI = [
  'function bridgeToPush(address pushRecipient, uint256 bridgeAmount, uint256 nonce) external payable',
  'function gateway() view returns (address)',
  'event Bridged(address indexed pushRecipient, uint256 bridgeAmount, uint256 fee)',
];

async function main() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) {
    console.error('❌ Missing PRIVATE_KEY in .env. Copy .env.sample to .env first.');
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Contract-Initiated Recipient Bridge — Sepolia → Push EOA');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const pushProvider = new ethers.JsonRpcProvider(RPC_PUSH);
  const sepoliaProvider = new ethers.JsonRpcProvider(RPC_SEPOLIA);
  const sepoliaWallet = new ethers.Wallet(pk, sepoliaProvider);
  const pushReader = new ethers.Wallet(pk, pushProvider);

  console.log('🔑 Sepolia EOA:', sepoliaWallet.address);
  const recipient = process.env.PUSH_RECIPIENT || pushReader.address;
  console.log('🎯 Push recipient:', recipient);
  const sepBal = await sepoliaProvider.getBalance(sepoliaWallet.address);
  console.log(`💰 Sepolia balance: ${ethers.formatEther(sepBal)} ETH\n`);

  // 1) Deploy or reuse the bridge contract.
  const bridgeAddress = await getOrDeployFoundry({
    envVar: 'SEPOLIA_BRIDGE_ADDRESS',
    artifactPath: 'out/EthereumFundsBridge.sol/EthereumFundsBridge.json',
    deployer: sepoliaWallet,
    constructorArgs: [SEPOLIA_GATEWAY],
    label: 'EthereumFundsBridge on Sepolia',
  });
  const bridge = new ethers.Contract(bridgeAddress, BRIDGE_ABI, sepoliaWallet);

  // 2) Derive the bridge contract's UEA on Push (this is the address that
  // gets credited with the bridged ETH and then forwards it to the recipient
  // via the encoded multicall).
  const bridgeAccount = PushChain.utils.account.toUniversal(bridgeAddress, {
    chain: PushChain.CONSTANTS.CHAIN.ETHEREUM_SEPOLIA,
  });
  const bridgeUEA = await PushChain.utils.account.deriveExecutorAccount(
    bridgeAccount,
    { chain: PushChain.CONSTANTS.CHAIN.PUSH_TESTNET, skipNetworkCheck: true }
  );
  console.log(`📍 Bridge UEA on Push: ${bridgeUEA.address}`);

  // Read the UEA's nonce on Push (0 if undeployed).
  const ueaNonce = await getUEANonce(pushProvider, bridgeUEA.address);
  console.log(`📊 Bridge UEA nonce on Push: ${ueaNonce}`);

  // 3) Build the bridge tx.
  const bridgeAmount = BigInt(process.env.BRIDGE_AMOUNT_WEI || ethers.parseEther('0.0001').toString());
  const fee = BigInt(process.env.BRIDGE_FEE_WEI || ethers.parseEther('0.005').toString());
  const totalValue = bridgeAmount + fee;

  const recipientStartBal = await pushProvider.getBalance(recipient);
  console.log(`📊 Recipient start balance:  ${ethers.formatEther(recipientStartBal)} PC`);
  console.log(`💸 Bridging:                  ${ethers.formatEther(bridgeAmount)} ETH`);
  console.log(`💸 Fee budget:                ${ethers.formatEther(fee)} ETH`);
  console.log(`💸 Total msg.value:           ${ethers.formatEther(totalValue)} ETH\n`);

  console.log('🚀 Calling bridge.bridgeToPush(...)...');
  const tx = await bridge.bridgeToPush(recipient, bridgeAmount, ueaNonce, { value: totalValue });
  console.log(`   📤 Sepolia tx: ${tx.hash}`);
  console.log(`   🔗 https://sepolia.etherscan.io/tx/${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`✅ Sepolia leg settled. status=${receipt?.status === 1 ? 'success' : 'failed'} block=${receipt?.blockNumber}\n`);

  // 4) Poll the recipient's balance on Push for the credit.
  console.log('📡 Waiting for the TSS network to relay onto Push...\n');
  const deadline = Date.now() + 6 * 60 * 1000;
  while (Date.now() < deadline) {
    const cur = await pushProvider.getBalance(recipient);
    if (cur > recipientStartBal) {
      const credited = cur - recipientStartBal;
      console.log(`✅ Recipient credited:`);
      console.log(`   start: ${ethers.formatEther(recipientStartBal)} PC`);
      console.log(`   end:   ${ethers.formatEther(cur)} PC`);
      console.log(`   net:   +${ethers.formatEther(credited)} PC`);
      console.log(`   🔗 https://donut.push.network/address/${recipient}`);
      return;
    }
    await new Promise((r) => setTimeout(r, 8000));
  }

  console.log('⚠️  Did not observe the credit within 6 minutes.');
  console.log(`   Check the recipient: https://donut.push.network/address/${recipient}`);
  console.log(`   Check the bridge UEA: https://donut.push.network/address/${bridgeUEA.address}`);
}

async function getUEANonce(provider: ethers.Provider, addr: string): Promise<bigint> {
  const code = await provider.getCode(addr);
  if (!code || code === '0x') return BigInt(0);
  try {
    const c = new ethers.Contract(addr, ['function nonce() view returns (uint256)'], provider);
    return await c.nonce();
  } catch {
    return BigInt(0);
  }
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
