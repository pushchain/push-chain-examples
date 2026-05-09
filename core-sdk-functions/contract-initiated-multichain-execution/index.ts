// Full Documentation: https://push.org/docs/chain/build/contract-initiated-multichain-execution
//
// Trigger an outbound cross-chain execution from a Push Chain contract
// (MinimalContractInitiatedExecutor.sol). The contract dispatches via UGPC and
// the contract's CEA executes the payload on the target external chain.
//
// Prerequisites:
//   - PUSH_PRIVATE_KEY in .env (Push native wallet with at least 10 PC for
//     deploy + dispatch).
//   - Optional: CONTRACT_ADDRESS in .env. If unset, the script will offer to
//     deploy MinimalContractInitiatedExecutor for you (requires `forge build`
//     to have been run first, so the artifact exists in ./out).
//
// What the script does:
//   1. If CONTRACT_ADDRESS is missing, prompts to deploy and persists the
//      resulting address back to .env for future runs.
//   2. Derives the contract's CEA on BNB Testnet via the documented helper —
//      this is the address that will execute on BNB.
//   3. Encodes `increment()` for the BNB counter and calls dispatchOutbound
//      on the Push contract with PC value covering the UGPC protocol fee.
//   4. Waits for the Push receipt and prints both Push + BNB explorer URLs.

import 'dotenv/config';
import { PushChain } from '@pushchain/core';
import { ethers } from 'ethers';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline/promises';

const RPC_PUSH = 'https://evm.donut.rpc.push.org/';

// Push Chain Donut Testnet predeploys (from the contract address book).
const UGPC = '0x00000000000000000000000000000000000000C1';
const UNIVERSAL_EXECUTOR_MODULE = '0x14191Ea54B4c176fCf86f51b0FAc7CB1E71Df7d7';

// 4-byte prefix the destination CEA looks for to recognize a multicall payload.
// Without this prefix, the CEA falls into the single-call path and reverts on
// `InvalidRecipient` since `recipient` is a dummy placeholder, not the target.
const UEA_MULTICALL_SELECTOR = '0x2cc2842d';

// Reuse the BNB Testnet counter from send-multichain-transactions as the demo target.
const BNB_COUNTER = '0x7f0936bb90e7dcf3edb47199c2005e7184e44cf8';

// Contract ABI for the deployed MinimalContractInitiatedExecutor.
const EXECUTOR_ABI = [
  'function dispatchOutbound(address token, uint256 amount, bytes recipient, uint256 gasLimit, bytes payload, address revertRecipient) external payable',
  'event OutboundDispatched(bytes indexed recipient, address indexed token, uint256 amount, bytes payload, address revertRecipient)',
];

// Counter ABI — what the contract's CEA will call on BNB Testnet.
const COUNTER_ABI = [
  { inputs: [], name: 'increment', outputs: [], stateMutability: 'nonpayable', type: 'function' },
];

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

async function main() {
  const privateKey = process.env.PUSH_PRIVATE_KEY;

  if (!privateKey) {
    console.error('❌ Missing PUSH_PRIVATE_KEY env var.');
    console.error('   Copy .env.sample to .env and fill it in. Fund the wallet with at least 10 PC.');
    rl.close();
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Contract-Initiated Multichain Execution — Outbound Demo');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const provider = new ethers.JsonRpcProvider(RPC_PUSH);
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log('🔑 Push native EOA:', wallet.address);

  // Resolve the executor contract — use CONTRACT_ADDRESS from .env, or
  // offer to deploy a fresh one and persist the address back to .env.
  const contractAddress = await getOrDeployContract(wallet);
  console.log('📦 Executor contract:', contractAddress);

  // Initialize the Push Chain client so we can read the contract's CEA via the
  // documented utility namespace.
  const universalSigner = await PushChain.utils.signer.toUniversal(wallet);
  const pushChainClient = await PushChain.initialize(universalSigner, {
    network: PushChain.CONSTANTS.PUSH_NETWORK.TESTNET,
  });

  // Derive the CONTRACT'S CEA on BNB Testnet. CEAs are deterministic from the
  // controlling Push account — for a contract, that's the contract address.
  const contractAccount = PushChain.utils.account.toUniversal(
    contractAddress,
    { chain: PushChain.CONSTANTS.CHAIN.PUSH_TESTNET }
  );
  const contractBnbCEA = await PushChain.utils.account.deriveExecutorAccount(contractAccount, {
    chain: PushChain.CONSTANTS.CHAIN.BNB_TESTNET,
    skipNetworkCheck: true,
  });
  console.log('📍 Contract CEA on BNB Testnet:', contractBnbCEA.address);
  console.log('   (this is the msg.sender the BNB counter will see)\n');

  // ─── Build the outbound request the way UGPC actually wants it ──────────
  //
  // 1) `token` must be the **PRC-20 on Push Chain** corresponding to the
  //    destination chain (pBnb for BNB Testnet). UGPC reads its
  //    SOURCE_CHAIN_NAMESPACE to determine where to relay. token = 0x0 is
  //    rejected even when amount = 0.
  //
  // 2) `payload` must be the multicall format the destination CEA expects:
  //    UEA_MULTICALL_SELECTOR (0x2cc2842d) + abi.encode(Multicall[]). Without
  //    the selector prefix the CEA tries the single-call path and reverts on
  //    `InvalidRecipient` (since `recipient` below is a placeholder).
  //
  // 3) `recipient` is a LEGACY/DUMMY field — UGPC keeps it for ABI compat
  //    but the relay does not use it. We pass the contract's CEA on BNB as
  //    a sensible non-zero placeholder.
  //
  // 4) `gasLimit` must be 0 (auto-floor) or ≥ each chain's floor (~500k for
  //    BNB / ETH). Values in between revert without data.
  const tokenAddress =
    (PushChain.CONSTANTS.MOVEABLE.TOKEN as any).PUSH_TESTNET_DONUT.pBnb.address as `0x${string}`;
  console.log(`💱 Routing token (pBnb on Push):  ${tokenAddress}`);
  console.log(`📍 Recipient (dummy = contract CEA): ${contractBnbCEA.address}`);

  const recipientBytes = ethers.getBytes(contractBnbCEA.address);

  // Build the inner multicall: a single call to BNB_COUNTER.increment().
  const counterIface = new ethers.Interface(COUNTER_ABI);
  const incrementCalldata = counterIface.encodeFunctionData('increment', []);
  const innerCalls = [{ to: BNB_COUNTER, value: BigInt(0), data: incrementCalldata }];
  const encodedMulticall = ethers.AbiCoder.defaultAbiCoder().encode(
    ['tuple(address to, uint256 value, bytes data)[]'],
    [innerCalls]
  );
  const payload = (UEA_MULTICALL_SELECTOR + encodedMulticall.slice(2)) as `0x${string}`;

  const executor = new ethers.Contract(contractAddress, EXECUTOR_ABI, wallet);

  // gasLimit=0 → UGPC uses its per-chain floor automatically.
  const externalGasLimit = BigInt(process.env.GAS_LIMIT || '0');

  // 8 PC has comfortable headroom over the actual fee (≪ 1 PC for BNB).
  // Surplus is refunded back to the contract via its receive() hook.
  const protocolFee = ethers.parseEther(process.env.PROTOCOL_FEE_PC || '8');

  // Pre-flight: show wallet balance and run a staticCall so any revert reason
  // (custom errors, plain reverts) surfaces BEFORE paying gas.
  const walletBalance = await provider.getBalance(wallet.address);
  console.log(`📊 Wallet balance: ${ethers.formatEther(walletBalance)} PC`);
  if (walletBalance < protocolFee + ethers.parseEther('0.5')) {
    console.error(`\n❌ Wallet has < ${ethers.formatEther(protocolFee + ethers.parseEther('0.5'))} PC (fee + gas headroom). Top it up and retry.`);
    rl.close();
    return;
  }

  console.log('\n🚀 Dispatching outbound from the contract...');
  console.log('   target chain:  BNB Testnet');
  console.log('   target call:   counter.increment() at', BNB_COUNTER);
  console.log('   bridging:      none (amount=0; token only selects destination chain)');
  console.log(`   msg.value:     ${ethers.formatEther(protocolFee)} PC (override via PROTOCOL_FEE_PC in .env; surplus is refunded)`);
  console.log(`   gas limit:     ${externalGasLimit === BigInt(0) ? '0 (UGPC auto-floor)' : externalGasLimit.toString()}`);
  console.log('');

  try {
    // Static-call first so a UGPC revert returns useful data (like a custom
    // error name) instead of "missing revert data" from gas estimation.
    try {
      await executor.dispatchOutbound.staticCall(
        tokenAddress,
        BigInt(0),
        recipientBytes,
        externalGasLimit,
        payload,
        wallet.address,
        { value: protocolFee }
      );
    } catch (simErr: any) {
      const reason =
        simErr?.revert?.name ??
        simErr?.shortMessage ??
        simErr?.message ??
        String(simErr);
      console.error('\n❌ Pre-flight (staticCall) reverted:', reason);
      console.error('   Most common cause is an insufficient protocol fee. Try bumping');
      console.error('   PROTOCOL_FEE_PC in .env (e.g., 10) and re-run.');
      rl.close();
      return;
    }

    const tx = await executor.dispatchOutbound(
      tokenAddress,                 // token (PRC20 selects destination chain)
      BigInt(0),                    // amount (0 = no bridge)
      recipientBytes,               // recipient (contract's BNB CEA, bytes-encoded)
      externalGasLimit,             // gasLimit on the destination chain
      payload,                      // payload (UEA_MULTICALL marker + Multicall[])
      wallet.address,               // revertRecipient (yourself)
      { value: protocolFee }
    );
    console.log('   📤 Push tx hash:', tx.hash);
    console.log('   🔗 Push explorer:', pushChainClient.explorer.getTransactionUrl(tx.hash));

    const receipt = await tx.wait();
    console.log(`\n✅ Push Chain settled. status=${receipt?.status === 1 ? 'success' : 'failed'} block=${receipt?.blockNumber}`);

    // Find the OutboundDispatched event on this receipt for clarity.
    const log = receipt?.logs.find((l: ethers.Log) => {
      try {
        return executor.interface.parseLog(l)?.name === 'OutboundDispatched';
      } catch {
        return false;
      }
    });
    if (log) {
      console.log('   📜 OutboundDispatched event emitted by the contract.');
    }

    console.log('\n📡 What happens next (off-chain, automatic):');
    console.log('   1. UGPC has emitted the outbound event the TSS network listens for.');
    console.log('   2. TSS validators will deploy the contract\'s CEA on BNB (if not already)');
    console.log('      and submit the encoded payload on its behalf.');
    console.log('   3. The BNB counter will see msg.sender =', contractBnbCEA.address);
    console.log('   4. Watch the CEA on the BNB explorer to see the outbound tx land:');
    console.log(`      https://testnet.bscscan.com/address/${contractBnbCEA.address}`);
  } catch (err: any) {
    console.error('\n❌ dispatchOutbound failed:', err?.shortMessage ?? err?.message ?? err);
    console.error('   Common causes: insufficient PC for protocol fee; ABI mismatch;');
    console.error('   the contract was not deployed at CONTRACT_ADDRESS.');
  } finally {
    rl.close();
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Contract resolver — read CONTRACT_ADDRESS or offer to deploy a fresh one.
// ──────────────────────────────────────────────────────────────────────────────

async function getOrDeployContract(wallet: ethers.Wallet): Promise<string> {
  if (process.env.CONTRACT_ADDRESS) {
    return process.env.CONTRACT_ADDRESS;
  }

  console.log('\n📦 No CONTRACT_ADDRESS found in .env.');
  const answer = (await rl.question('   Deploy MinimalContractInitiatedExecutor now? (y/n): ')).trim().toLowerCase();
  if (answer !== 'y' && answer !== 'yes') {
    console.error('\n❌ Aborted. Either set CONTRACT_ADDRESS in .env or re-run and choose "y".');
    rl.close();
    process.exit(1);
  }

  // Read the Foundry compilation artifact to grab ABI + creation bytecode.
  const artifactPath = path.join(
    __dirname,
    'out',
    'MinimalContractInitiatedExecutor.sol',
    'MinimalContractInitiatedExecutor.json'
  );
  if (!fs.existsSync(artifactPath)) {
    console.error('\n❌ Foundry artifact not found at', artifactPath);
    console.error('   Run `forge build` in this directory first, then re-run npm start.');
    rl.close();
    process.exit(1);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  const bytecode = artifact?.bytecode?.object as string | undefined;
  if (!bytecode || bytecode === '0x') {
    console.error('\n❌ Empty bytecode in artifact. Re-run `forge build` and try again.');
    rl.close();
    process.exit(1);
  }

  console.log('\n📦 Deploying MinimalContractInitiatedExecutor on Push Donut Testnet...');
  console.log('   ugpc:                   ', UGPC);
  console.log('   universalExecutorModule:', UNIVERSAL_EXECUTOR_MODULE);

  const factory = new ethers.ContractFactory(artifact.abi, bytecode, wallet);
  const deployment = await factory.deploy(UGPC, UNIVERSAL_EXECUTOR_MODULE);
  const deployTx = deployment.deploymentTransaction();
  if (deployTx) console.log('   📤 deploy tx:', deployTx.hash);

  await deployment.waitForDeployment();
  const address = await deployment.getAddress();
  console.log('   ✅ deployed at:', address);

  await persistContractAddress(address);
  return address;
}

// Persist CONTRACT_ADDRESS=... back to .env so future runs reuse it.
async function persistContractAddress(address: string): Promise<void> {
  const envPath = path.join(__dirname, '.env');
  let content = '';
  try {
    content = fs.readFileSync(envPath, 'utf8');
  } catch {
    // .env doesn't exist yet — fine, we'll create it.
  }

  if (/^CONTRACT_ADDRESS=.*/m.test(content)) {
    content = content.replace(/^CONTRACT_ADDRESS=.*/m, `CONTRACT_ADDRESS=${address}`);
  } else {
    if (content.length > 0 && !content.endsWith('\n')) content += '\n';
    content += `CONTRACT_ADDRESS=${address}\n`;
  }

  fs.writeFileSync(envPath, content);
  console.log(`   💾 Saved CONTRACT_ADDRESS=${address} to .env for future runs.`);
}

main().catch((err) => {
  console.error(err);
  rl.close();
});
