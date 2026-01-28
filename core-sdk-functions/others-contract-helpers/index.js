import { ethers } from 'ethers';

// ——— CONFIG ———
const RPC_URL = 'https://evm.donut.rpc.push.org/';
const FACTORY_ADDRESS = '0x00000000000000000000000000000000000000eA';

console.log('🚀 Starting PushChain Contract Helper');
console.log('📡 RPC URL:', RPC_URL);
console.log('🏭 Factory Address:', FACTORY_ADDRESS);

const FACTORY_V1 = [
  {
    type: 'function',
    name: 'getVMType',
    inputs: [
      {
        name: '_chainHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: 'vmHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'isRegistered',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getUEAForOrigin',
    inputs: [
      {
        name: '_id',
        type: 'tuple',
        internalType: 'struct UniversalAccountId',
        components: [
          {
            name: 'chainNamespace',
            type: 'string',
            internalType: 'string',
          },
          {
            name: 'chainId',
            type: 'string',
            internalType: 'string',
          },
          {
            name: 'owner',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
      },
    ],
    outputs: [
      {
        name: 'uea',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'isDeployed',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
];

async function main() {
  console.log('\n=== SETUP PHASE ===');

  // 1) set up
  console.log('🔧 Setting up provider and factory contract...');
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_V1, provider);
  console.log('✅ Provider and factory contract initialized');

  // 2) create UniversalAccountId struct
  console.log('\n=== UNIVERSAL ACCOUNT ID CREATION ===');
  const universalAccountId = {
    chainNamespace: 'eip155', // EVM chain
    chainId: '11155111', // Sepolia testnet (more likely to be registered on Push testnet)
    owner: '0xa96CaA79eb2312DbEb0B8E93c1Ce84C98b67bF11', // owner address in bytes format
  };

  console.log('📋 Universal Account ID created:');
  console.log('   • Chain Namespace:', universalAccountId.chainNamespace);
  console.log('   • Chain ID:', universalAccountId.chainId);
  console.log('   • Owner:', universalAccountId.owner);

  // 3) call getUEAForOrigin
  console.log('\n=== CALLING FACTORY CONTRACT ===');
  console.log('🔍 Calling getUEAForOrigin on PushChain...');

  try {
    const originResult = await factory.getUEAForOrigin(universalAccountId);
    console.log('✅ Contract call successful!');
    console.log('\n📊 RESULT:');
    console.log('   • UEA Address:', originResult[0]);
    console.log('   • Is Deployed:', originResult[1]);
    console.log('\n📄 Raw Result:', JSON.stringify(originResult, null, 2));
  } catch (error) {
    console.error('❌ Error calling getUEAForOrigin:');
    console.error('   • Error Message:', error.message);
    console.error('   • Error Code:', error.code);
    throw error;
  }

  console.log('\n🎉 Script completed successfully!');
}

console.log('\n=== EXECUTION START ===');
await main().catch((error) => {
  console.error('\n💥 Script failed with error:');
  console.error(error);
  process.exit(1);
});
