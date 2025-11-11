// Full Documentation: https://push.org/docs/sdk-functions/utility-functions

import { PushChain } from '@pushchain/core';
import { ethers } from 'ethers';
import { createWalletClient, http } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

// ⭐️ MAIN FUNCTION ⭐️
async function main() {
  console.log('\n\n\n🔑 Account Utilities');

  console.log('\n🏃 Trying to call PushChain.utils.account.convertOriginToExecutor');
  const executorResult = await convertOriginToExecutor();
  console.log('✅ Success:', JSON.stringify(executorResult, null, 2));

  console.log('\n🏃 Trying to call toChainAgnostic');
  const chainAgnosticResult = toChainAgnostic();
  console.log('✅ Success:', chainAgnosticResult);

  console.log('\n🏃 Trying to call toUniversalAccount');
  const universalAccountResult = toUniversalAccount();
  console.log('✅ Success:', JSON.stringify(universalAccountResult, null, 2));

  console.log('\n🏃 Trying to call fromChainAgnostic');
  const fromChainAgnosticResult = fromChainAgnostic();
  console.log('✅ Success:', JSON.stringify(fromChainAgnosticResult, null, 2));

  console.log('🏃 Trying to call toUniversalFromKeypair');
  const universalFromKeyPairResult = await toUniversalFromKeypair();
  console.log('✅ Success:', JSON.stringify(universalFromKeyPairResult, null, 2));

  console.log('🔍 Explorer Utilities\n\n\n');
  console.log('\n🏃 Trying to call pushChainClient.explorer.getTransactionUrl');
  const transactionUrlResult = await getTransactionUrl();
  console.log('✅ Success:', transactionUrlResult);

  console.log('\n🏃 Trying to call pushChainClient.explorer.listUrls');
  const listUrlsResult = await listUrls();
  console.log('✅ Success:', listUrlsResult);

  console.log('🛠️  Helper Utilities\n\n\n');
  console.log('\n🏃 Trying to call PushChain.utils.helpers.getChainName');
  const chainNameFromIdResult = await getChainName();
  console.log('✅ Success:', chainNameFromIdResult);

  console.log('\n🏃 Trying to call PushChain.utils.helpers.encodeTxData');
  const encodeTxDataResult = await encodeTxData();
  console.log('✅ Success:', encodeTxDataResult);

  console.log('\n🏃 Trying to call parseUnits');
  const parseUnitsResult = parseUnits();
  console.log('✅ Success:', parseUnitsResult);

  console.log('\n🏃 Trying to call formatUnits');
  const formatUnitsResult = formatUnits();
  console.log('✅ Success:', formatUnitsResult);

  console.log('\n🏃 Trying to call convertExecutorToOrigin');
  const convertExecutorToOriginResult = await convertExecutorToOriginAccount();
  console.log('✅ Success:', JSON.stringify(convertExecutorToOriginResult, null, 2));
}

main().catch(console.error);

// Account Utilities
// PushChain.utils.account.convertOriginToExecutor(account: string, { chain: string })
async function convertOriginToExecutor() {
  const account = PushChain.utils.account.toUniversal('0xD8d6aF611a17C236b13235B5318508FA61dE3Dba', {
    chain: PushChain.CONSTANTS.CHAIN.ETHEREUM_SEPOLIA,
  });

  const executorInfo = await PushChain.utils.account.convertOriginToExecutor(account, {
    onlyCompute: true,
  });

  const executorSimple = await PushChain.utils.account.convertOriginToExecutor(account, {
    onlyCompute: false,
  });

  return { executorInfo, executorSimple };
}

// PushChain.utils.account.toUniversal(address: string, { options: { chain: string }})
function toUniversalAccount() {
  const account = PushChain.utils.account.toUniversal('0xD8d6aF611a17C236b13235B5318508FA61dE3Dba', {
    chain: PushChain.CONSTANTS.CHAIN.ETHEREUM_SEPOLIA,
  });
  return account;
}

// PushChain.utils.account.toChainAgnostic(address: string, { chain: string })
function toChainAgnostic() {
  const chainAgnosticAddress = PushChain.utils.account.toChainAgnostic('0xD8d6aF611a17C236b13235B5318508FA61dE3Dba', {
    chain: PushChain.CONSTANTS.CHAIN.ETHEREUM_SEPOLIA,
  });
  return chainAgnosticAddress;
}

// PushChain.utils.account.fromChainAgnostic(address: string)
function fromChainAgnostic() {
  const account = PushChain.utils.account.fromChainAgnostic(
    'eip155:11155111:0xD8d6aF611a17C236b13235B5318508FA61dE3Dba'
  );
  return account;
}

// Signer Utilities
// PushChain.utils.signer.toUniversalFromKeypair(signer: Signer, { chain: string })
async function toUniversalFromKeypair() {
  // ethers
  const provider = new ethers.JsonRpcProvider('https://sepolia.drpc.org');
  const wallet = new ethers.Wallet(ethers.Wallet.createRandom().privateKey, provider);

  const universalSignerEthers = await PushChain.utils.signer.toUniversalFromKeypair(wallet, {
    chain: PushChain.CONSTANTS.CHAIN.ETHEREUM_SEPOLIA,
    library: PushChain.CONSTANTS.LIBRARY.ETHEREUM_ETHERSV6,
  });

  // viem
  const account = privateKeyToAccount(generatePrivateKey());
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(),
  });
  const viemSigner = await PushChain.utils.signer.toUniversal(walletClient);
  return { universalSignerEthers, viemSigner };
}

// Explorer Utilities
// pushChainClient.explorer.getTransactionUrl(txHash: string)
async function getTransactionUrl() {
  // ethers
  const provider = new ethers.JsonRpcProvider('https://evm.rpc-testnet-donut-node1.push.org/');
  const wallet = new ethers.Wallet(ethers.Wallet.createRandom().privateKey, provider);

  const universalSigner = await PushChain.utils.signer.toUniversal(wallet.connect(provider));

  const pushChainClient = await PushChain.initialize(universalSigner, {
    network: PushChain.CONSTANTS.PUSH_NETWORK.TESTNET,
  });
  const txHash = '0x4627fd2eca321d5fd007995c94af636e5e332760f50fbd8e3426ad0c67543dad';
  const url = pushChainClient.explorer.getTransactionUrl(txHash);
  return url;
}

// pushChainClient.explorer.listUrls()
async function listUrls() {
  // ethers
  const provider = new ethers.JsonRpcProvider('https://evm.rpc-testnet-donut-node1.push.org/');
  const wallet = new ethers.Wallet(ethers.Wallet.createRandom().privateKey, provider);

  const universalSigner = await PushChain.utils.signer.toUniversal(wallet.connect(provider));

  const pushChainClient = await PushChain.initialize(universalSigner, {
    network: PushChain.CONSTANTS.PUSH_NETWORK.TESTNET,
  });

  const explorerUrls = pushChainClient.explorer.listUrls();
  return explorerUrls;
}

// Helper Utilities
// PushChain.utils.helpers.getChainName(chainNamespace: string)
async function getChainName() {
  // ETHEREUM_SEPOLIA
  const chainName = PushChain.utils.helpers.getChainName('eip155:11155111');
  return chainName;
}

// PushChain.utils.helpers.encodeTxData(txData: string)
async function encodeTxData() {
  // Example ABI for a simple counter contract
  const testAbi = [
    {
      inputs: [],
      stateMutability: 'nonpayable',
      type: 'constructor',
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: 'uint256',
          name: 'newCount',
          type: 'uint256',
        },
        {
          indexed: true,
          internalType: 'address',
          name: 'caller',
          type: 'address',
        },
        {
          indexed: false,
          internalType: 'string',
          name: 'chainNamespace',
          type: 'string',
        },
        {
          indexed: false,
          internalType: 'string',
          name: 'chainId',
          type: 'string',
        },
      ],
      name: 'CountIncremented',
      type: 'event',
    },
    {
      inputs: [],
      name: 'increment',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [],
      name: 'reset',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [],
      name: 'countEth',
      outputs: [
        {
          internalType: 'uint256',
          name: '',
          type: 'uint256',
        },
      ],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [],
      name: 'countPC',
      outputs: [
        {
          internalType: 'uint256',
          name: '',
          type: 'uint256',
        },
      ],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [],
      name: 'countSol',
      outputs: [
        {
          internalType: 'uint256',
          name: '',
          type: 'uint256',
        },
      ],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [],
      name: 'getCount',
      outputs: [
        {
          internalType: 'uint256',
          name: '',
          type: 'uint256',
        },
      ],
      stateMutability: 'view',
      type: 'function',
    },
  ];

  // Encode transaction data for the increment function
  const result = PushChain.utils.helpers.encodeTxData({ abi: testAbi, functionName: 'increment' });

  return result;
}

// pushchain.utils.helpers.parseUnits('string', options: { decimals: number })
function parseUnits() {
  const results = {
    integerValue: PushChain.utils.helpers.parseUnits('420', { decimals: 9 }),
    decimalValue1: PushChain.utils.helpers.parseUnits('1.5', { decimals: 18 }),
    decimalValue2: PushChain.utils.helpers.parseUnits('0.1', { decimals: 6 }),
    decimalValue3: PushChain.utils.helpers.parseUnits('1.23', { decimals: 6 }),
  };

  return results;
}

// pushchain.utils.helpers.formatUnits(bigint, options: { decimals: number })
function formatUnits() {
  const results = {
    integerValue1: PushChain.utils.helpers.formatUnits(BigInt(420), { decimals: 9 }),
    integerValue2: PushChain.utils.helpers.formatUnits(BigInt(15), { decimals: 18 }),
    // For 0.1 with 6 decimals: 0.1 * 10^6 = 100000
    decimalValue1: PushChain.utils.helpers.formatUnits(BigInt(100000), { decimals: 6 }),
    // For 1.23 with 6 decimals: 1.23 * 10^6 = 1230000
    decimalValue2: PushChain.utils.helpers.formatUnits(BigInt(1230000), { decimals: 6 }),
  };

  return results;
}

async function convertExecutorToOriginAccount() {
  const testAddress = '0x2C592Cd90d9d485EB27eC30c718B8A3b63B32d78';
  const { account, exists } = await PushChain.utils.account.convertExecutorToOriginAccount(testAddress);
  return { account, exists };
}
