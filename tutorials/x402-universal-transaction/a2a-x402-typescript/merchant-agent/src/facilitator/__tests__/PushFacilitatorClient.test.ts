import { strict as assert } from 'assert';
import {
  PaymentPayload,
  PaymentRequirements,
  PushPaymentPayload,
} from 'a2a-x402';
import { ethers } from 'ethers';
import { PushFacilitatorClient } from '../PushFacilitatorClient';

type TxResponseLike = {
  hash: string;
  to: string | null;
  from: string;
  value: bigint;
  chainId: bigint;
  data: string;
};

type ReceiptLike = {
  status: number;
};

class StubProvider {
  constructor(
    private transactions: Record<string, TxResponseLike>,
    private receipts: Record<string, ReceiptLike | undefined>
  ) {}

  async getTransaction(hash: string): Promise<TxResponseLike | null> {
    return this.transactions[hash] ?? null;
  }

  async getTransactionReceipt(hash: string): Promise<ReceiptLike | null> {
    return this.receipts[hash] ?? null;
  }
}

async function testNativeVerification(): Promise<void> {
  const txHash = '0xabc123';
  const payTo = '0x0000000000000000000000000000000000042101';
  const amount = '1000';

  const provider = new StubProvider(
    {
      [txHash]: {
        hash: txHash,
        to: payTo,
        from: '0x1111111111111111111111111111111111111111',
        value: BigInt(amount),
        chainId: 42101n,
        data: '0x',
      },
    },
    {
      [txHash]: { status: 1 },
    }
  );

  const client = new PushFacilitatorClient({
    provider: provider as unknown as any,
  });

  const payload: PaymentPayload = {
    x402Version: 1,
    scheme: 'exact',
    network: 'push-chain-testnet',
    payload: {
      type: 'push-universal',
      payer: '0x9999999999999999999999999999999999999999',
      payerOrigin: 'eip155:42101:0x9999999999999999999999999999999999999999',
      ueaAddress: '0x1111111111111111111111111111111111111111',
      amount,
      asset: 'native',
      transactionHash: txHash,
      call: {
        to: payTo,
        value: amount,
        chainId: 'eip155:42101',
      },
    } as PushPaymentPayload,
  };

  const requirements: PaymentRequirements = {
    scheme: 'exact',
    network: 'push-chain-testnet',
    asset: 'native',
    payTo,
    maxAmountRequired: amount,
    description: '',
    resource: '',
    mimeType: 'application/json',
    maxTimeoutSeconds: 600,
  };

  const verify = await client.verify(payload, requirements);
  assert.equal(verify.isValid, true, 'native verification should pass');

  const settle = await client.settle(payload, requirements);
  assert.equal(settle.success, true, 'native settlement should pass');
}

async function testTokenVerification(): Promise<void> {
  const txHash = '0xdef456';
  const token = '0x0000000000000000000000000000000000000005';
  const payTo = '0x0000000000000000000000000000000000042101';
  const amount = '2500';

  const erc20 = new ethers.Interface([
    'function transfer(address to, uint256 amount) returns (bool)',
  ]);
  const transferData = erc20.encodeFunctionData('transfer', [
    payTo,
    BigInt(amount),
  ]);

  const provider = new StubProvider(
    {
      [txHash]: {
        hash: txHash,
        to: token,
        from: '0x2222222222222222222222222222222222222222',
        value: 0n,
        chainId: 42101n,
        data: transferData,
      },
    },
    {
      [txHash]: { status: 1 },
    }
  );

  const client = new PushFacilitatorClient({
    provider: provider as unknown as any,
  });

  const payload: PaymentPayload = {
    x402Version: 1,
    scheme: 'exact',
    network: 'push-chain-testnet',
    payload: {
      type: 'push-universal',
      payer: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      payerOrigin: 'eip155:42101:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      ueaAddress: '0x2222222222222222222222222222222222222222',
      amount,
      asset: token,
      transactionHash: txHash,
      call: {
        to: token,
        value: '0',
        data: transferData,
        chainId: 'eip155:42101',
      },
    } as PushPaymentPayload,
  };

  const requirements: PaymentRequirements = {
    scheme: 'exact',
    network: 'push-chain-testnet',
    asset: token,
    payTo,
    maxAmountRequired: amount,
    description: '',
    resource: '',
    mimeType: 'application/json',
    maxTimeoutSeconds: 600,
  };

  const verify = await client.verify(payload, requirements);
  assert.equal(verify.isValid, true, 'token verification should pass');

  const settle = await client.settle(payload, requirements);
  assert.equal(settle.success, true, 'token settlement should pass');
}

async function run(): Promise<void> {
  await testNativeVerification();
  await testTokenVerification();
  console.log('✅ PushFacilitatorClient tests passed');
}

run().catch((error) => {
  console.error('❌ PushFacilitatorClient tests failed', error);
  process.exitCode = 1;
});
