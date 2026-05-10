// Full Documentation: https://push.org/docs/chain/build/contract-initiated-multichain-execution
//
// Inbound With Funds — Sepolia ETH bridge + contract call on Push
// ===============================================================
// Combines the patterns from:
//   - contract-initiated-recipient-bridge/  (funds-only bridge)
//   - contract-initiated-inbound-execution/ (calldata-only inbound)
//
// A Sepolia contract bridges native ETH AND triggers `PushVault.deposit(beneficiary)`
// on Push, with the bridged amount as msg.value of the inner call. The Push UEA
// receives the ETH and forwards it to PushVault, which credits the beneficiary.

import 'dotenv/config';
import { PushChain } from '@pushchain/core';
import { ethers } from 'ethers';
import * as fs from 'node:fs';
import * as path from 'node:path';

const RPC_PUSH = 'https://evm.donut.rpc.push.org/';
const RPC_SEPOLIA = 'https://ethereum-sepolia-rpc.publicnode.com';
const SEPOLIA_GATEWAY = '0x05bD7a3D18324c1F7e216f7fBF2b15985aE5281A';

const INBOUND_ABI = [
  'function bridgeAndCall(address pushTarget, bytes pushCalldata, uint256 bridgeAmount, uint256 nonce) external payable',
  'function gateway() view returns (address)',
  'event InboundWithFundsDispatched(address indexed pushTarget, bytes pushCalldata, uint256 bridgeAmount, uint256 fee, uint256 nonce)',
];

const VAULT_ABI = [
  'function deposit(address beneficiary) external payable',
  'function depositOf(address) view returns (uint256)',
  'function totalDeposits() view returns (uint256)',
  'function lastDepositor() view returns (address)',
  'event Deposited(address indexed depositor, address indexed beneficiary, uint256 amount, uint256 newBalance)',
];

async function main() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) {
    console.error('❌ Missing PRIVATE_KEY in .env. Copy .env.sample first.');
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Contract-Initiated Inbound With Funds — Sepolia → Push');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const pushProvider = new ethers.JsonRpcProvider(RPC_PUSH);
  const sepoliaProvider = new ethers.JsonRpcProvider(RPC_SEPOLIA);
  const pushWallet = new ethers.Wallet(pk, pushProvider);
  const sepoliaWallet = new ethers.Wallet(pk, sepoliaProvider);

  console.log('🔑 EOA:', pushWallet.address);
  const beneficiary = process.env.BENEFICIARY || pushWallet.address;
  console.log('🎯 Beneficiary on Push:', beneficiary);
  const sepBal = await sepoliaProvider.getBalance(sepoliaWallet.address);
  const pushBal = await pushProvider.getBalance(pushWallet.address);
  console.log(`💰 Sepolia: ${ethers.formatEther(sepBal)} ETH`);
  console.log(`💰 Push:    ${ethers.formatEther(pushBal)} PC\n`);

  // 1) Deploy Push vault.
  const vaultAddress = await getOrDeployFoundry({
    envVar: 'PUSH_VAULT_ADDRESS',
    artifactPath: 'out/PushVault.sol/PushVault.json',
    deployer: pushWallet,
    constructorArgs: [],
    label: 'PushVault on Push Donut Testnet',
  });
  const vault = new ethers.Contract(vaultAddress, VAULT_ABI, pushProvider);

  // 2) Deploy Sepolia inbound dispatcher.
  const inboundAddress = await getOrDeployFoundry({
    envVar: 'SEPOLIA_INBOUND_ADDRESS',
    artifactPath: 'out/EthereumInboundWithFunds.sol/EthereumInboundWithFunds.json',
    deployer: sepoliaWallet,
    constructorArgs: [SEPOLIA_GATEWAY],
    label: 'EthereumInboundWithFunds on Sepolia',
  });
  const inbound = new ethers.Contract(inboundAddress, INBOUND_ABI, sepoliaWallet);

  // 3) Derive the inbound contract's UEA on Push.
  const inboundAccount = PushChain.utils.account.toUniversal(
    inboundAddress,
    { chain: PushChain.CONSTANTS.CHAIN.ETHEREUM_SEPOLIA }
  );
  const inboundUEA = await PushChain.utils.account.deriveExecutorAccount(
    inboundAccount,
    { chain: PushChain.CONSTANTS.CHAIN.PUSH_TESTNET, skipNetworkCheck: true }
  );
  console.log(`📍 Inbound contract UEA on Push: ${inboundUEA.address}`);
  console.log(`   (the address that will call PushVault.deposit)\n`);

  // 4) Read UEA nonce (0 if undeployed).
  const ueaNonce = await getUEANonce(pushProvider, inboundUEA.address);
  console.log(`📊 UEA nonce on Push: ${ueaNonce}`);

  // 5) Build the bridge tx.
  const bridgeAmount = BigInt(process.env.BRIDGE_AMOUNT_WEI || ethers.parseEther('0.0001').toString());
  const fee = BigInt(process.env.BRIDGE_FEE_WEI || ethers.parseEther('0.005').toString());
  const totalValue = bridgeAmount + fee;

  // The Push-side calldata: vault.deposit(beneficiary).
  const depositCalldata = new ethers.Interface(VAULT_ABI).encodeFunctionData(
    'deposit',
    [beneficiary]
  );

  const startBalance: bigint = await vault.depositOf(beneficiary);
  console.log(`📊 Pre-call vault state:`);
  console.log(`   depositOf(${beneficiary}): ${ethers.formatEther(startBalance)} PC`);
  console.log(`   bridgeAmount (becomes msg.value of vault.deposit): ${ethers.formatEther(bridgeAmount)} ETH`);
  console.log(`   fee budget:    ${ethers.formatEther(fee)} ETH`);
  console.log(`   total msg.value: ${ethers.formatEther(totalValue)} ETH\n`);

  console.log('🚀 Calling inbound.bridgeAndCall(...)...');
  const tx = await inbound.bridgeAndCall(
    vaultAddress,
    depositCalldata,
    bridgeAmount,
    ueaNonce,
    { value: totalValue }
  );
  console.log(`   📤 Sepolia tx: ${tx.hash}`);
  console.log(`   🔗 https://sepolia.etherscan.io/tx/${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`✅ Sepolia leg settled. status=${receipt?.status === 1 ? 'success' : 'failed'} block=${receipt?.blockNumber}\n`);

  // 6) Poll for vault balance change.
  console.log('📡 Waiting for the TSS to relay onto Push (typically 30-90s)...\n');
  const deadline = Date.now() + 6 * 60 * 1000;
  while (Date.now() < deadline) {
    const cur: bigint = await vault.depositOf(beneficiary);
    if (cur > startBalance) {
      const credited = cur - startBalance;
      const lastDepositor: string = await vault.lastDepositor();
      console.log(`✅ PushVault credited beneficiary:`);
      console.log(`   depositOf(${beneficiary}): ${ethers.formatEther(startBalance)} → ${ethers.formatEther(cur)} PC`);
      console.log(`   delta: +${ethers.formatEther(credited)} PC`);
      console.log(`   lastDepositor (UEA on Push): ${lastDepositor}`);
      console.log(`   matches inbound UEA?: ${lastDepositor.toLowerCase() === inboundUEA.address.toLowerCase()}`);
      console.log(`   🔗 https://donut.push.network/address/${vaultAddress}`);
      return;
    }
    await new Promise((r) => setTimeout(r, 6000));
  }

  console.log('⚠️  Did not observe vault deposit within 6 minutes.');
  console.log(`   Inspect: https://sepolia.etherscan.io/tx/${receipt?.hash} (Sepolia)`);
  console.log(`   And:     https://donut.push.network/address/${vaultAddress}`);
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
