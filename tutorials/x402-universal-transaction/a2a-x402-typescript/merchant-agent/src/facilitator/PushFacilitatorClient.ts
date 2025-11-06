//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * Push Chain facilitator client.
 *
 * Verifies submitted Push Chain universal transactions and confirms
 * settlement by inspecting the transaction receipt on-chain.
 */

import {
  FacilitatorClient,
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
  VerifyResponse,
  isPushPaymentPayload,
} from 'a2a-x402';
import { ethers } from 'ethers';

const ERC20_TRANSFER_INTERFACE = new ethers.Interface([
  'function transfer(address to, uint256 amount) returns (bool)',
]);

export interface PushFacilitatorConfig {
  rpcUrl?: string;
  explorerBaseUrl?: string;
  provider?: ethers.JsonRpcProvider;
}

export class PushFacilitatorClient implements FacilitatorClient {
  private provider: ethers.JsonRpcProvider;
  private explorerBaseUrl?: string;

  constructor(config?: PushFacilitatorConfig) {
    const rpcUrl =
      config?.rpcUrl ||
      process.env.PUSH_RPC_URL ||
      'https://evm.donut.rpc.push.org/';

    this.provider = config?.provider || new ethers.JsonRpcProvider(rpcUrl);
    this.explorerBaseUrl =
      config?.explorerBaseUrl ?? process.env.PUSH_EXPLORER_BASE_URL;

    if (config?.provider) {
      console.log('🌐 PushFacilitatorClient using injected provider');
    } else {
      console.log(`🌐 PushFacilitatorClient using RPC: ${rpcUrl}`);
    }
  }

  async verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<VerifyResponse> {
    if (!isPushPaymentPayload(payload.payload)) {
      return {
        isValid: false,
        invalidReason: 'Unsupported payment payload type for Push Chain facilitator.',
      };
    }

    const pushPayload = payload.payload;

    if (payload.network !== requirements.network) {
      return {
        isValid: false,
        invalidReason: `Payment network mismatch. Expected ${requirements.network}, received ${payload.network}.`,
      };
    }

    const txHash = pushPayload.transactionHash;
    if (!txHash) {
      return {
        isValid: false,
        invalidReason: 'Missing transaction hash in Push payment payload.',
      };
    }

    const transaction = await this.provider.getTransaction(txHash);
    if (!transaction) {
      return {
        isValid: false,
        invalidReason: `Transaction ${txHash} not found on Push Chain RPC.`,
      };
    }

    const expectedChainId = resolveChainId(requirements.network);
    if (
      expectedChainId !== undefined &&
      Number(transaction.chainId) !== expectedChainId
    ) {
      return {
        isValid: false,
        invalidReason: `Transaction found on unexpected chain (chainId=${transaction.chainId}). Expected ${expectedChainId}.`,
      };
    }

    const requirementPayTo = requirementAddress(requirements.payTo, 'payTo');
    const assetAddress = requirements.asset;

    if (isNativeAsset(assetAddress)) {
      const toAddress = transaction.to
        ? requirementAddress(transaction.to, 'transaction.to')
        : undefined;

      if (!toAddress || toAddress !== requirementPayTo) {
        return {
          isValid: false,
          invalidReason: `Native payment destination mismatch. Expected ${requirementPayTo}, saw ${transaction.to}.`,
        };
      }

      const valueMatches =
        transaction.value === BigInt(requirements.maxAmountRequired);
      if (!valueMatches) {
        return {
          isValid: false,
          invalidReason: `Native payment amount mismatch. Expected ${requirements.maxAmountRequired}, saw ${transaction.value.toString()}.`,
        };
      }
    } else {
      const tokenAddress = requirementAddress(assetAddress, 'asset');
      const toAddress = transaction.to
        ? requirementAddress(transaction.to, 'transaction.to')
        : undefined;

      if (!toAddress || toAddress !== tokenAddress) {
        return {
          isValid: false,
          invalidReason: `ERC-20 payment target mismatch. Expected token contract ${tokenAddress}, saw ${transaction.to}.`,
        };
      }

      if (transaction.value !== 0n) {
        return {
          isValid: false,
          invalidReason: `ERC-20 transfer should not send native value, but value=${transaction.value.toString()} detected.`,
        };
      }

      const decoded = tryDecodeTransfer(transaction.data);
      if (!decoded) {
        return {
          isValid: false,
          invalidReason: 'Unable to decode ERC-20 transfer data.',
        };
      }

      if (requirementAddress(decoded.to, 'transfer.to') !== requirementPayTo) {
        return {
          isValid: false,
          invalidReason: `ERC-20 transfer recipient mismatch. Expected ${requirementPayTo}, saw ${decoded.to}.`,
        };
      }

      if (decoded.amount !== requirements.maxAmountRequired) {
        return {
          isValid: false,
          invalidReason: `ERC-20 transfer amount mismatch. Expected ${requirements.maxAmountRequired}, saw ${decoded.amount}.`,
        };
      }
    }

    const payerOrigin = pushPayload.payer || pushPayload.payerOrigin;
    return {
      isValid: true,
      payer: payerOrigin,
    };
  }

  async settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<SettleResponse> {
    if (!isPushPaymentPayload(payload.payload)) {
      return {
        success: false,
        network: requirements.network,
        errorReason: 'Unsupported payment payload type for Push Chain facilitator.',
      };
    }

    const pushPayload = payload.payload;
    const txHash = pushPayload.transactionHash;

    const receipt = await this.provider.getTransactionReceipt(txHash);
    if (!receipt) {
      return {
        success: false,
        network: requirements.network,
        errorReason: `Transaction ${txHash} not yet confirmed on-chain.`,
      };
    }

    if (receipt.status !== 1) {
      return {
        success: false,
        network: requirements.network,
        errorReason: `Transaction ${txHash} failed (status=${receipt.status}).`,
      };
    }

    return {
      success: true,
      transaction: txHash,
      network: requirements.network,
      payer: pushPayload.payer,
    };
  }
}

function resolveChainId(network: string): number | undefined {
  switch (network) {
    case 'push-chain':
    case 'push-chain-testnet':
      return 42101;
    case 'push-chain-mainnet':
      return 9;
    default:
      return undefined;
  }
}

function isNativeAsset(asset: string): boolean {
  if (!asset) {
    return true;
  }
  const lowered = asset.toLowerCase();
  return lowered === 'native' || lowered === 'pc' || lowered === 'push';
}

function tryDecodeTransfer(data: string):
  | { to: string; amount: string }
  | null {
  try {
    const decoded = ERC20_TRANSFER_INTERFACE.decodeFunctionData(
      'transfer',
      data
    );
    const to = decoded[0] as string;
    const amount = decoded[1] as bigint;
    return {
      to,
      amount: amount.toString(),
    };
  } catch {
    return null;
  }
}

function requirementAddress(address: string, label: string): string {
  try {
    return ethers.getAddress(address);
  } catch (error) {
    throw new Error(`Invalid address for ${label}: ${address}`);
  }
}
