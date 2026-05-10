// Full Documentation: https://push.org/docs/chain/build/utility-functions
//
// This file is the runnable companion to the Utility Functions docs page.
// Every demo here corresponds 1:1 to a section in the docs and exercises
// only the public utility surface exposed by `@pushchain/core`.

import { PushChain } from '@pushchain/core';
import { ethers } from 'ethers';
import { Keypair } from '@solana/web3.js';
import { createWalletClient, http } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

// ⭐️ MAIN FUNCTION ⭐️
async function main() {
  console.log('\n\n\n🛠️  Helper Utilities');

  console.log('\n🏃 PushChain.utils.helpers.parseUnits');
  console.log('✅ Success:', JSON.stringify(parseUnitsDemo(), (_k, v) => typeof v === 'bigint' ? v.toString() : v, 2));

  console.log('\n🏃 PushChain.utils.helpers.formatUnits');
  console.log('✅ Success:', JSON.stringify(formatUnitsDemo(), null, 2));

  console.log('\n🏃 PushChain.utils.helpers.encodeTxData (EVM ABI)');
  console.log('✅ Success:', encodeTxDataEvmDemo());

  console.log('\n🏃 PushChain.utils.helpers.encodeTxData (Solana IDL)');
  console.log('✅ Success:', encodeTxDataSolanaDemo());

  console.log('\n\n\n🌐 Chain Utilities');

  console.log('\n🏃 PushChain.utils.chains.getChainNamespace');
  console.log('✅ Success:', getChainNamespaceDemo());

  console.log('\n🏃 PushChain.utils.chains.getChainName');
  console.log('✅ Success:', getChainNameDemo());

  console.log('\n🏃 PushChain.utils.chains.getSupportedChainsByName');
  console.log('✅ Success:', JSON.stringify(getSupportedChainsByNameDemo(), null, 2));

  console.log('\n🏃 PushChain.utils.chains.getSupportedChains');
  console.log('✅ Success:', JSON.stringify(getSupportedChainsDemo(), null, 2));

  console.log('\n\n\n🔑 Account Utilities');

  console.log('\n🏃 PushChain.utils.account.toUniversal');
  console.log('✅ Success:', JSON.stringify(toUniversalDemo(), null, 2));

  console.log('\n🏃 PushChain.utils.account.toChainAgnostic');
  console.log('✅ Success:', toChainAgnosticDemo());

  console.log('\n🏃 PushChain.utils.account.fromChainAgnostic');
  console.log('✅ Success:', JSON.stringify(fromChainAgnosticDemo(), null, 2));

  console.log('\n🏃 PushChain.utils.account.deriveExecutorAccount (UEA from Ethereum)');
  console.log('✅ Success:', JSON.stringify(await deriveUEAFromEthereum(), null, 2));

  console.log('\n🏃 PushChain.utils.account.deriveExecutorAccount (UEA from Solana)');
  console.log('✅ Success:', JSON.stringify(await deriveUEAFromSolana(), null, 2));

  console.log('\n🏃 PushChain.utils.account.deriveExecutorAccount (CEA from Push)');
  console.log('✅ Success:', JSON.stringify(await deriveCEAFromPush(), null, 2));

  console.log('\n🏃 PushChain.utils.account.deriveExecutorAccount (skipNetworkCheck)');
  console.log('✅ Success:', JSON.stringify(await deriveDeterministicOnly(), null, 2));

  console.log('\n🏃 PushChain.utils.account.resolveControllerAccount (from UEA)');
  console.log('✅ Success:', JSON.stringify(await resolveFromUEA(), null, 2));

  console.log('\n🏃 PushChain.utils.account.resolveControllerAccount (from CEA, with chain)');
  console.log('✅ Success:', JSON.stringify(await resolveFromCEA(), null, 2));

  console.log('\n\n\n✍️  Signer Utilities');

  console.log('\n🏃 PushChain.utils.signer.toUniversalFromKeypair (ethers v6)');
  const ethersSigner = await toUniversalFromKeypairEthers();
  console.log('✅ Success:', JSON.stringify(ethersSigner.account, null, 2));

  console.log('\n🏃 PushChain.utils.signer.toUniversalFromKeypair (viem)');
  const viemSigner = await toUniversalFromKeypairViem();
  console.log('✅ Success:', JSON.stringify(viemSigner.account, null, 2));

  console.log('\n🏃 PushChain.utils.signer.toUniversalFromKeypair (Solana web3.js)');
  const solanaSigner = await toUniversalFromKeypairSolana();
  console.log('✅ Success:', JSON.stringify(solanaSigner.account, null, 2));

  console.log('\n\n\n🪙 Token Utilities');

  console.log('\n🏃 PushChain.utils.tokens.getMoveableTokens (Sepolia)');
  console.log('✅ Success:', `${getMoveableTokensDemo().tokens.length} tokens`);

  console.log('\n🏃 PushChain.utils.tokens.getPayableTokens (Solana Devnet)');
  console.log('✅ Success:', `${getPayableTokensDemo().tokens.length} tokens`);

  console.log('\n🏃 PushChain.utils.tokens.getPRC20Address');
  console.log('✅ Success:', JSON.stringify(getPRC20AddressDemo(), null, 2));

  console.log('\n\n\n📐 Conversion Utilities');

  console.log('\n🏃 PushChain.utils.conversion.slippageToMinAmount');
  console.log('✅ Success:', slippageToMinAmountDemo());

  console.log('\n🏃 pushChainClient.funds.getConversionQuote (Sepolia → WETH→USDT)');
  console.log('✅ Success:', await getConversionQuoteDemo());

  console.log('\n\n\n🔍 Explorer Utilities');

  console.log('\n🏃 pushChainClient.explorer.getTransactionUrl');
  console.log('✅ Success:', await getTransactionUrlDemo());

  console.log('\n🏃 pushChainClient.explorer.listUrls');
  console.log('✅ Success:', JSON.stringify(await listUrlsDemo(), null, 2));

  console.log('\n🏃 pushChainClient.explorer.listAllUrls');
  console.log('✅ Success:', `${(await listAllUrlsDemo()).explorers.length} chains`);
}

main().catch(console.error);

// =====================================================================
// Helper Utilities — PushChain.utils.helpers.*
// =====================================================================

// PushChain.utils.helpers.parseUnits(value, exponent)
// Converts a human-readable token amount to its smallest-unit bigint.
function parseUnitsDemo() {
  return {
    PC_18_decimals: PushChain.utils.helpers.parseUnits('1.5', { decimals: 18 }),
    USDC_6_decimals: PushChain.utils.helpers.parseUnits('100.50', { decimals: 6 }),
    BTC_8_decimals: PushChain.utils.helpers.parseUnits('0.00000001', { decimals: 8 }),
    // Variation: pass `decimals` as a number directly
    PC_variation: PushChain.utils.helpers.parseUnits('1000.5', 18),
  };
}

// PushChain.utils.helpers.formatUnits(value, decimalsOrOptions)
// Converts a smallest-unit bigint back to a human-readable string.
function formatUnitsDemo() {
  return {
    PC: PushChain.utils.helpers.formatUnits('1500000000000000000', { decimals: 18 }),
    USDC: PushChain.utils.helpers.formatUnits('100500000', { decimals: 6 }),
    // With precision: round to N digits after the decimal
    integer_with_precision: PushChain.utils.helpers.formatUnits('420000000000', { decimals: 9, precision: 2 }),
    decimal_with_precision: PushChain.utils.helpers.formatUnits('123456', { decimals: 5, precision: 4 }),
    // Variation: pass `decimals` as a number directly
    PC_variation: PushChain.utils.helpers.formatUnits('1000500000000000000000', 18),
  };
}

// PushChain.utils.helpers.encodeTxData({ abi, functionName, args })
// EVM ABI encoding — produces a 4-byte selector + ABI-encoded args.
function encodeTxDataEvmDemo() {
  const counterAbi = [
    { inputs: [], stateMutability: 'nonpayable', type: 'constructor' },
    { inputs: [], name: 'increment', outputs: [], stateMutability: 'nonpayable', type: 'function' },
    {
      inputs: [],
      name: 'countPC',
      outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
      stateMutability: 'view',
      type: 'function',
    },
  ];
  return PushChain.utils.helpers.encodeTxData({
    abi: counterAbi,
    functionName: 'increment',
  });
}

// PushChain.utils.helpers.encodeTxData({ idl, functionName, args })
// Solana (Anchor) encoding — produces an 8-byte discriminator + Borsh args.
function encodeTxDataSolanaDemo() {
  // Trimmed Anchor IDL — only the receive_sol instruction we call below.
  // In a real app this comes from your Anchor program's target/idl/*.json.
  const testCounterIdl = {
    address: '8yNqjrMnFiFbVTVQcKij8tNWWTMdFkrDf9abCGgc2sgx',
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
  return PushChain.utils.helpers.encodeTxData({
    idl: testCounterIdl as any,
    functionName: 'receive_sol',
    args: [BigInt(0)],
  });
}

// =====================================================================
// Chain Utilities — PushChain.utils.chains.*
// =====================================================================

// PushChain.utils.chains.getChainNamespace(chainName)
function getChainNamespaceDemo() {
  return PushChain.utils.chains.getChainNamespace('PUSH_TESTNET_DONUT');
}

// PushChain.utils.chains.getChainName(chainNamespace)
function getChainNameDemo() {
  return PushChain.utils.chains.getChainName('eip155:42101');
}

// PushChain.utils.chains.getSupportedChainsByName(network)
function getSupportedChainsByNameDemo() {
  return PushChain.utils.chains.getSupportedChainsByName(PushChain.CONSTANTS.PUSH_NETWORK.TESTNET);
}

// PushChain.utils.chains.getSupportedChains(network)
function getSupportedChainsDemo() {
  return PushChain.utils.chains.getSupportedChains(PushChain.CONSTANTS.PUSH_NETWORK.TESTNET);
}

// =====================================================================
// Account Utilities — PushChain.utils.account.*
// =====================================================================

// PushChain.utils.account.toUniversal(address, { chain })
function toUniversalDemo() {
  return PushChain.utils.account.toUniversal(
    '0xD8d6aF611a17C236b13235B5318508FA61dE3Dba',
    { chain: PushChain.CONSTANTS.CHAIN.ETHEREUM_SEPOLIA }
  );
}

// PushChain.utils.account.toChainAgnostic(address, { chain })
function toChainAgnosticDemo() {
  return PushChain.utils.account.toChainAgnostic(
    '0xD8d6aF611a17C236b13235B5318508FA61dE3Dba',
    { chain: PushChain.CONSTANTS.CHAIN.ETHEREUM_SEPOLIA }
  );
}

// PushChain.utils.account.fromChainAgnostic(caip10)
function fromChainAgnosticDemo() {
  return PushChain.utils.account.fromChainAgnostic(
    'eip155:11155111:0xD8d6aF611a17C236b13235B5318508FA61dE3Dba'
  );
}

// PushChain.utils.account.deriveExecutorAccount(account)
// UOA → UEA: derive the user's UEA on Push Chain from an Ethereum origin.
async function deriveUEAFromEthereum() {
  const ethAccount = PushChain.utils.account.toUniversal(
    '0xe1ceea8efaf7fb973cb65653caa7dd3d59283f25',
    { chain: PushChain.CONSTANTS.CHAIN.ETHEREUM_SEPOLIA }
  );
  return PushChain.utils.account.deriveExecutorAccount(ethAccount);
}

// PushChain.utils.account.deriveExecutorAccount(account)
// Same call, but with a Solana origin account.
async function deriveUEAFromSolana() {
  const solanaAccount = PushChain.utils.account.toUniversal(
    '5BoLqCmrqbrqv2QwUnpccC62scUxDojpYw2UyM8aGpru',
    { chain: PushChain.CONSTANTS.CHAIN.SOLANA_DEVNET }
  );
  return PushChain.utils.account.deriveExecutorAccount(solanaAccount);
}

// PushChain.utils.account.deriveExecutorAccount(account, { chain })
// Push account → CEA on BNB Testnet: passing `chain` flips the call from
// "UEA on Push" to "CEA on that external chain".
async function deriveCEAFromPush() {
  const pushAccount = PushChain.utils.account.toUniversal(
    '0x3ee31c0C8b9888e267781b2FD73cDA1D7FfA46eE',
    { chain: PushChain.CONSTANTS.CHAIN.PUSH_TESTNET }
  );
  return PushChain.utils.account.deriveExecutorAccount(pushAccount, {
    chain: PushChain.CONSTANTS.CHAIN.BNB_TESTNET,
  });
}

// PushChain.utils.account.deriveExecutorAccount(account, { skipNetworkCheck: true })
// Deterministic derivation only — skips the on-chain deployment-status RPC.
async function deriveDeterministicOnly() {
  const ethAccount = PushChain.utils.account.toUniversal(
    '0xe1ceea8efaf7fb973cb65653caa7dd3d59283f25',
    { chain: PushChain.CONSTANTS.CHAIN.ETHEREUM_SEPOLIA }
  );
  return PushChain.utils.account.deriveExecutorAccount(ethAccount, {
    skipNetworkCheck: true,
  });
}

// PushChain.utils.account.resolveControllerAccount(executorAddress)
// Resolve the controller (UOA) behind a UEA on Push Chain.
async function resolveFromUEA() {
  const ueaAddress = '0x98cA97d2FB78B3C0597E2F78cd11868cACF423C5';
  return PushChain.utils.account.resolveControllerAccount(ueaAddress);
}

// PushChain.utils.account.resolveControllerAccount(ceaAddress, { chain })
// Resolve through a CEA → Push account → UOA. Chain context is required for CEA.
async function resolveFromCEA() {
  const ceaAddress = '0x5d71c70571789F0cd3bE84513523a9993740BDf6';
  return PushChain.utils.account.resolveControllerAccount(ceaAddress, {
    chain: PushChain.CONSTANTS.CHAIN.BNB_TESTNET,
  });
}

// =====================================================================
// Signer Utilities — PushChain.utils.signer.toUniversalFromKeypair
// =====================================================================

// PushChain.utils.signer.toUniversalFromKeypair(keypair, { chain, library })
// ethers v6 keypair variant.
async function toUniversalFromKeypairEthers() {
  const provider = new ethers.JsonRpcProvider('https://sepolia.gateway.tenderly.co');
  const wallet = ethers.Wallet.createRandom().connect(provider);
  return PushChain.utils.signer.toUniversalFromKeypair(wallet, {
    chain: PushChain.CONSTANTS.CHAIN.ETHEREUM_SEPOLIA,
    library: PushChain.CONSTANTS.LIBRARY.ETHEREUM_ETHERSV6,
  });
}

// viem WalletClient variant.
async function toUniversalFromKeypairViem() {
  const account = privateKeyToAccount(generatePrivateKey());
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(),
  });
  return PushChain.utils.signer.toUniversalFromKeypair(walletClient, {
    chain: PushChain.CONSTANTS.CHAIN.ETHEREUM_SEPOLIA,
    library: PushChain.CONSTANTS.LIBRARY.ETHEREUM_VIEM,
  });
}

// Solana web3.js Keypair variant.
async function toUniversalFromKeypairSolana() {
  const keypair = Keypair.generate();
  return PushChain.utils.signer.toUniversalFromKeypair(keypair, {
    chain: PushChain.CONSTANTS.CHAIN.SOLANA_DEVNET,
    library: PushChain.CONSTANTS.LIBRARY.SOLANA_WEB3JS,
  });
}

// =====================================================================
// Token Utilities — PushChain.utils.tokens.*
// =====================================================================

// PushChain.utils.tokens.getMoveableTokens(chainOrClient?)
// Filtered for a specific chain.
function getMoveableTokensDemo() {
  return PushChain.utils.tokens.getMoveableTokens(PushChain.CONSTANTS.CHAIN.ETHEREUM_SEPOLIA);
}

// PushChain.utils.tokens.getPayableTokens(chainOrClient?)
function getPayableTokensDemo() {
  return PushChain.utils.tokens.getPayableTokens(PushChain.CONSTANTS.CHAIN.SOLANA_DEVNET);
}

// PushChain.utils.tokens.getPRC20Address(token, options?)
// Resolves the Push Chain synthetic PRC20 address for a supported origin token.
// Demonstrated with both shapes: `{ chain, address }` and a `MoveableToken`.
function getPRC20AddressDemo() {
  // Variant 1: pass an explicit { chain, address } pair.
  const fromChainAddress = PushChain.utils.tokens.getPRC20Address({
    chain: PushChain.CONSTANTS.CHAIN.ETHEREUM_SEPOLIA,
    address: '0x97F477B7f970D47a87B42869ceeace218106152a',
  });

  // Variant 2: pass a MoveableToken object from getMoveableTokens.
  const { tokens: moveable } = PushChain.utils.tokens.getMoveableTokens(
    PushChain.CONSTANTS.CHAIN.ETHEREUM_SEPOLIA
  );
  const ethMoveable = moveable.find((t) => t.symbol === 'ETH');
  const fromMoveable = ethMoveable
    ? PushChain.utils.tokens.getPRC20Address(ethMoveable)
    : null;

  return { fromChainAddress, fromMoveable };
}

// =====================================================================
// Conversion Utilities
// =====================================================================

// PushChain.utils.conversion.slippageToMinAmount(amount, { slippageBps })
// 100000000 (100 USDC) with 1% slippage -> 99000000 (99 USDC)
function slippageToMinAmountDemo() {
  return PushChain.utils.conversion.slippageToMinAmount('100000000', {
    slippageBps: 100,
  });
}

// pushChainClient.funds.getConversionQuote(amount, { from, to })
// Quote pay-with-token vs move-as-token. Currently supported on Ethereum Sepolia.
async function getConversionQuoteDemo() {
  try {
    // Build a Sepolia-origin client (Ethereum Sepolia is required for this call).
    const account = privateKeyToAccount(generatePrivateKey());
    const walletClient = createWalletClient({ account, chain: sepolia, transport: http() });
    const universalSigner = await PushChain.utils.signer.toUniversalFromKeypair(walletClient, {
      chain: PushChain.CONSTANTS.CHAIN.ETHEREUM_SEPOLIA,
      library: PushChain.CONSTANTS.LIBRARY.ETHEREUM_VIEM,
    });
    const client = await PushChain.initialize(universalSigner, {
      network: PushChain.CONSTANTS.PUSH_NETWORK.TESTNET,
    });

    // 0.005 WETH (18 decimals)
    const amountIn = PushChain.utils.helpers.parseUnits('0.005', 18);
    const quote = await client.funds.getConversionQuote(amountIn, {
      from: PushChain.CONSTANTS.PAYABLE.TOKEN.ETHEREUM_SEPOLIA.WETH,
      to: PushChain.CONSTANTS.MOVEABLE.TOKEN.ETHEREUM_SEPOLIA.USDT,
    });
    return JSON.stringify(quote);
  } catch (err) {
    return `(quote unavailable: ${err instanceof Error ? err.message : String(err)})`;
  }
}

// =====================================================================
// Explorer Utilities — pushChainClient.explorer.*
// (require a Push Chain client to be initialized first)
// =====================================================================

async function buildPushClient() {
  const provider = new ethers.JsonRpcProvider('https://evm.donut.rpc.push.org/');
  const wallet = ethers.Wallet.createRandom().connect(provider);
  const universalSigner = await PushChain.utils.signer.toUniversalFromKeypair(wallet, {
    chain: PushChain.CONSTANTS.CHAIN.PUSH_TESTNET,
    library: PushChain.CONSTANTS.LIBRARY.ETHEREUM_ETHERSV6,
  });
  return PushChain.initialize(universalSigner, {
    network: PushChain.CONSTANTS.PUSH_NETWORK.TESTNET,
  });
}

// pushChainClient.explorer.getTransactionUrl(txHash, { chain? })
async function getTransactionUrlDemo() {
  const client = await buildPushClient();
  const txHash = '0x828911db033c65de8faab4906cfcb7d13ce225c3cd283534d110414a5b78cf87';
  const pushChainUrl = client.explorer.getTransactionUrl(txHash);
  const sepoliaUrl = client.explorer.getTransactionUrl(txHash, {
    chain: PushChain.CONSTANTS.CHAIN.ETHEREUM_SEPOLIA,
  });
  return JSON.stringify({ pushChainUrl, sepoliaUrl });
}

// pushChainClient.explorer.listUrls({ chain? })
async function listUrlsDemo() {
  const client = await buildPushClient();
  const pushChainExplorers = client.explorer.listUrls();
  const sepoliaExplorers = client.explorer.listUrls({
    chain: PushChain.CONSTANTS.CHAIN.ETHEREUM_SEPOLIA,
  });
  return { pushChainExplorers, sepoliaExplorers };
}

// pushChainClient.explorer.listAllUrls()
async function listAllUrlsDemo() {
  const client = await buildPushClient();
  return client.explorer.listAllUrls();
}
