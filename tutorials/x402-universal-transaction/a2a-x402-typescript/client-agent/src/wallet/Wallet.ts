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
 * Push Chain wallet implementation for the client agent.
 *
 * This replaces the previous Base Sepolia ERC-20 flow with Push Chain
 * universal transactions. The wallet is responsible for:
 *  - Initialising the Push Chain SDK with a universal signer
 *  - Sending universal transactions (native or ERC-20 transfer)
 *  - Returning a PaymentPayload that encodes Push Chain context
 */

import { PushChain } from '@pushchain/core';
import { Keypair } from '@solana/web3.js';
import { ethers } from 'ethers';
import { createRequire } from 'module';
import {
  PaymentPayload,
  PaymentRequirements,
  x402PaymentRequiredResponse,
  PushPaymentPayload,
  PushUniversalCall,
} from 'a2a-x402';
import { logger } from '../logger';

const nodeRequire = createRequire(__filename);
type Bs58Lib = { decode: (value: string | Uint8Array) => Uint8Array; encode: (value: Uint8Array) => string };
// bs58@6 uses a default export for both ESM and CJS builds. When required from CJS,
// the value may be under the `default` property. Normalize it here.
const bs58Module = nodeRequire('bs58') as any;
const bs58: Bs58Lib = bs58Module && typeof bs58Module.decode === 'function' ? bs58Module : bs58Module.default;

const INFURA_API_KEY = process.env.INFURA_API_KEY;
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;

if (!INFURA_API_KEY && !HELIUS_API_KEY) {
  throw new Error('Missing INFURA_API_KEY or HELIUS_API_KEY. Set INFURA_API_KEY or HELIUS_API_KEY.');
}

const DEFAULT_SOURCE_RPC_URL = `https://sepolia.infura.io/v3/${INFURA_API_KEY}`;
// const DEFAULT_SOURCE_RPC_URL = `https://base-sepolia.infura.io/v3/${INFURA_API_KEY}`;
// const DEFAULT_SOURCE_RPC_URL = `https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

const DEFAULT_PUSH_RPC_URL = process.env.PUSH_RPC_URL ?? 'https://evm.donut.rpc.push.org/';

const DEFAULT_PUSH_NETWORK = process.env.PUSH_NETWORK ?? PushChain.CONSTANTS.PUSH_NETWORK.TESTNET;

const EXPLORER_BASE_ENV = process.env.PUSH_EXPLORER_BASE_URL;

type PushNetwork = (typeof PushChain.CONSTANTS.PUSH_NETWORK)[keyof typeof PushChain.CONSTANTS.PUSH_NETWORK];
type PushChainKey = (typeof PushChain.CONSTANTS.CHAIN)[keyof typeof PushChain.CONSTANTS.CHAIN];

type SourceContext =
  | {
      kind: 'evm';
      wallet: ethers.Wallet;
      provider: ethers.JsonRpcProvider;
      address: string;
      chain?: PushChainKey;
    }
  | {
      kind: 'solana';
      keypair: Keypair;
      address: string;
      chain: PushChainKey;
    };

export interface PaymentSubmissionResult {
  payload: PaymentPayload;
  transactionHash: string;
  explorerUrl?: string;
  receipt?: {
    status?: number;
    blockNumber?: string;
  };
}

export abstract class Wallet {
  abstract submitPayment(requirements: x402PaymentRequiredResponse): Promise<PaymentSubmissionResult>;

  abstract getAddress(): string;

  abstract getExplorerUrl(txHash: string): string | undefined;
}

export class PushWallet extends Wallet {
  private readonly sourceRpcUrl: string;
  private readonly pushRpcUrl: string;
  private readonly pushNetwork: PushNetwork;
  private explorerBase?: string;

  private readonly source: SourceContext;
  private pushClient?: PushChain;
  private originChain?: PushChainKey;

  constructor(options?: {
    privateKey?: string;
    sourceRpcUrl?: string;
    pushRpcUrl?: string;
    rpcUrl?: string;
    network?: string;
    solanaPrivateKey?: string;
  }) {
    super();

    this.sourceRpcUrl = options?.sourceRpcUrl ?? process.env.PUSH_SOURCE_RPC_URL ?? DEFAULT_SOURCE_RPC_URL;
    this.pushRpcUrl = options?.pushRpcUrl ?? options?.rpcUrl ?? DEFAULT_PUSH_RPC_URL;
    this.pushNetwork = resolvePushNetwork(options?.network ?? DEFAULT_PUSH_NETWORK);
    this.explorerBase = EXPLORER_BASE_ENV?.trim() || undefined;

    if (looksLikeSolanaRpc(this.sourceRpcUrl)) {
      const chain = detectSolanaChain(this.sourceRpcUrl);
      const solanaSecret = options?.solanaPrivateKey ?? process.env.SOLANA_PRIVATE_KEY;
      if (!solanaSecret) {
        throw new Error(
          'Missing SOLANA_PRIVATE_KEY. Provide a base58 or hex-encoded Solana secret key for Solana RPC usage.'
        );
      }

      const keypair = Keypair.fromSecretKey(decodeSolanaSecret(solanaSecret));
      this.source = {
        kind: 'solana',
        keypair,
        address: keypair.publicKey.toBase58(),
        chain,
      };

      logger.log(
        [
          '👛 Push wallet initialised',
          `  Address: ${this.source.address}`,
          `  Source RPC: ${this.sourceRpcUrl}`,
          `  Origin chain: ${chain}`,
          `  Push RPC: ${this.pushRpcUrl}`,
          `  Push network: ${this.pushNetwork}`,
          '⚠️ Generated a new Solana keypair for this session. Fund it before submitting payments.',
        ].join('\n')
      );
    } else {
      const privateKey = options?.privateKey ?? process.env.PUSH_WALLET_PRIVATE_KEY ?? process.env.WALLET_PRIVATE_KEY;
      if (!privateKey) {
        throw new Error('Missing wallet private key. Set PUSH_WALLET_PRIVATE_KEY or WALLET_PRIVATE_KEY.');
      }

      const provider = new ethers.JsonRpcProvider(this.sourceRpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);
      this.source = {
        kind: 'evm',
        wallet,
        provider,
        address: wallet.address,
      };

      logger.log(
        [
          '👛 Push wallet initialised',
          `  Address: ${wallet.address}`,
          `  Source RPC: ${this.sourceRpcUrl}`,
          '  Origin chain: auto-detect (EVM)',
          `  Push RPC: ${this.pushRpcUrl}`,
          `  Push network: ${this.pushNetwork}`,
        ].join('\n')
      );
    }
  }

  async submitPayment(requirements: x402PaymentRequiredResponse): Promise<PaymentSubmissionResult> {
    const requirement = selectPushRequirement(requirements);
    const client = await this.ensureClient();

    const { tx } = this.buildExecuteParams(requirement);
    logger.log(
      `\n💸 Sending Push Chain payment:\n  To: ${requirement.payTo}\n  Amount (atomic): ${requirement.maxAmountRequired}\n  Asset: ${requirement.asset}`
    );

    const txResponse = await client.universal.sendTransaction(tx);

    logger.log(`⏳ Universal transaction dispatched: ${txResponse.hash}`);

    const receipt = await txResponse.wait();
    if (receipt.status !== 1) {
      throw new Error(`Push Chain transaction reverted or failed (status=${receipt.status}). Hash: ${txResponse.hash}`);
    }

    logger.log(`✅ Push Chain payment confirmed in block ${receipt.blockNumber.toString()}`);

    const explorerUrl = this.computeExplorerUrl(txResponse.hash);
    const pushPayload = this.buildPushPayload(requirement, txResponse, receipt, tx);

    const payload: PaymentPayload = {
      x402Version: 1,
      scheme: requirement.scheme,
      network: requirement.network,
      payload: pushPayload,
    };

    return {
      payload,
      transactionHash: txResponse.hash,
      explorerUrl,
      receipt: pushPayload.receipt,
    };
  }

  getAddress(): string {
    return this.source.address;
  }

  getExplorerUrl(txHash: string): string | undefined {
    if (this.pushClient) {
      try {
        return this.pushClient.explorer.getTransactionUrl(txHash);
      } catch {
        // Fall through to base override if available
      }
    }
    if (this.explorerBase) {
      const base = this.explorerBase.endsWith('/') ? this.explorerBase.slice(0, -1) : this.explorerBase;
      return `${base}/tx/${txHash}`;
    }
    return undefined;
  }

  private async ensureClient(): Promise<PushChain> {
    if (this.pushClient) {
      return this.pushClient;
    }

    const universalSigner = await this.createUniversalSigner();
    const originChain = await this.resolveOriginChain();
    const rpcOverrides = this.buildRpcOverrides(originChain);
    const blockExplorers = this.buildExplorerOverrides();

    const client = await PushChain.initialize(universalSigner, {
      network: this.pushNetwork,
      ...(rpcOverrides ? { rpcUrls: rpcOverrides } : {}),
      ...(blockExplorers ? { blockExplorers } : {}),
    });

    // Cache explorer base for fallback usage
    if (!this.explorerBase) {
      const urls = client.explorer.listUrls().urls;
      if (urls.length > 0) {
        this.explorerBase = urls[0];
      }
    }

    this.pushClient = client;
    logger.log('🔗 Push Chain SDK initialised successfully');
    return client;
  }

  private async createUniversalSigner() {
    if (this.source.kind === 'solana') {
      return PushChain.utils.signer.toUniversalFromKeypair(this.source.keypair, {
        chain: this.source.chain,
        library: PushChain.CONSTANTS.LIBRARY.SOLANA_WEB3JS,
      });
    }

    return PushChain.utils.signer.toUniversal(this.source.wallet);
  }

  private async resolveOriginChain(): Promise<PushChainKey | undefined> {
    if (this.originChain) {
      return this.originChain;
    }

    if (this.source.kind === 'solana') {
      this.originChain = this.source.chain;
      return this.originChain;
    }

    try {
      const network = await this.source.provider.getNetwork();
      const namespace = `eip155:${network.chainId.toString()}` as PushChainKey;
      if (isKnownChain(namespace)) {
        this.source.chain = namespace;
        this.originChain = namespace;
      } else {
        logger.warn(`⚠️ Detected EVM chainId ${network.chainId}, which is not recognised by Push SDK.`);
      }
    } catch (error) {
      logger.warn(`⚠️ Unable to resolve origin chain: ${(error as Error).message}`);
    }

    return this.originChain;
  }

  private buildExecuteParams(requirement: PaymentRequirements): {
    tx: Parameters<PushChain['universal']['sendTransaction']>[0];
  } {
    const amount = BigInt(requirement.maxAmountRequired);
    const payTo = ensureHexAddress(requirement.payTo, 'payTo');

    return {
      tx: {
        to: payTo,
        value: amount,
      },
    };
  }

  private buildPushPayload(
    requirement: PaymentRequirements,
    txResponse: Awaited<ReturnType<PushChain['universal']['sendTransaction']>>,
    receipt: Awaited<ReturnType<typeof txResponse.wait>>,
    tx: Parameters<PushChain['universal']['sendTransaction']>[0]
  ): PushPaymentPayload {
    return {
      type: 'push-universal',
      payer: this.source.address,
      payerOrigin: txResponse.origin,
      ueaAddress: txResponse.from,
      amount: requirement.maxAmountRequired,
      asset: requirement.asset,
      transactionHash: txResponse.hash,
      explorerUrl: this.computeExplorerUrl(txResponse.hash),
      call: {
        to: tx.to,
        value: (tx.value ?? 0n).toString(),
        data: normaliseCallData(tx.data),
        chainId: txResponse.chainId,
      },
      receipt: {
        status: receipt.status,
        blockNumber: receipt.blockNumber?.toString(),
      },
      context: {
        origin: txResponse.origin,
        raw: txResponse.raw
          ? {
              from: txResponse.raw.from,
              to: txResponse.raw.to,
              nonce: txResponse.raw.nonce,
            }
          : undefined,
        requirementResource: requirement.resource,
        decimals: typeof requirement.extra?.decimals === 'number' ? requirement.extra.decimals : undefined,
      },
    };
  }

  private computeExplorerUrl(txHash: string): string | undefined {
    try {
      if (this.pushClient) {
        return this.pushClient.explorer.getTransactionUrl(txHash);
      }
    } catch {
      // ignore and fall back
    }
    return this.getExplorerUrl(txHash);
  }

  private buildRpcOverrides(originChain?: PushChainKey): Partial<Record<PushChainKey, string[]>> | undefined {
    const overrides: Partial<Record<PushChainKey, string[]>> = {};
    const chains = PushChain.CONSTANTS.CHAIN;

    switch (this.pushNetwork) {
      case PushChain.CONSTANTS.PUSH_NETWORK.MAINNET:
        overrides[chains.PUSH_MAINNET] = [this.pushRpcUrl];
        break;
      case PushChain.CONSTANTS.PUSH_NETWORK.TESTNET:
      case PushChain.CONSTANTS.PUSH_NETWORK.TESTNET:
        overrides[chains.PUSH_TESTNET] = [this.pushRpcUrl];
        overrides[chains.PUSH_TESTNET_DONUT] = [this.pushRpcUrl];
        break;
      case PushChain.CONSTANTS.PUSH_NETWORK.LOCALNET:
        overrides[chains.PUSH_LOCALNET] = [this.pushRpcUrl];
        break;
      default:
        overrides[chains.PUSH_TESTNET] = [this.pushRpcUrl];
    }

    if (originChain) {
      overrides[originChain] = [this.sourceRpcUrl];
    }

    if (Object.keys(overrides).length === 0) {
      return undefined;
    }

    return overrides;
  }

  private buildExplorerOverrides(): Partial<Record<PushChainKey, string[]>> | undefined {
    if (!this.explorerBase) {
      return undefined;
    }

    const base = this.explorerBase.endsWith('/') ? this.explorerBase.slice(0, -1) : this.explorerBase;

    const override: Partial<Record<PushChainKey, string[]>> = {};
    const chains = PushChain.CONSTANTS.CHAIN;

    switch (this.pushNetwork) {
      case PushChain.CONSTANTS.PUSH_NETWORK.MAINNET:
        override[chains.PUSH_MAINNET] = [base];
        break;
      case PushChain.CONSTANTS.PUSH_NETWORK.TESTNET:
      case PushChain.CONSTANTS.PUSH_NETWORK.TESTNET:
        override[chains.PUSH_TESTNET] = [base];
        override[chains.PUSH_TESTNET_DONUT] = [base];
        break;
      case PushChain.CONSTANTS.PUSH_NETWORK.LOCALNET:
        override[chains.PUSH_LOCALNET] = [base];
        break;
    }

    return override;
  }
}

function looksLikeSolanaRpc(rpcUrl: string): boolean {
  const lower = rpcUrl.toLowerCase();
  return (
    lower.startsWith('solana') || lower.includes('solana.com') || lower.includes('solana') || lower.includes('helius')
  );
}

function detectSolanaChain(rpcUrl: string): PushChainKey {
  const chains = PushChain.CONSTANTS.CHAIN;
  const lower = rpcUrl.toLowerCase();

  if (lower.includes('mainnet')) {
    return chains.SOLANA_MAINNET;
  }
  if (lower.includes('testnet')) {
    return chains.SOLANA_TESTNET;
  }
  return chains.SOLANA_DEVNET;
}

function isKnownChain(value: string): value is PushChainKey {
  return (Object.values(PushChain.CONSTANTS.CHAIN) as string[]).includes(value);
}

function decodeSolanaSecret(secret: string): Uint8Array {
  const trimmed = secret.trim();
  if (!trimmed) {
    throw new Error('Empty Solana private key value provided.');
  }

  if (trimmed.startsWith('0x')) {
    return ethers.getBytes(trimmed);
  }

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as number[];
      return Uint8Array.from(parsed);
    } catch (error) {
      throw new Error(`Unable to parse SOLANA_PRIVATE_KEY JSON: ${(error as Error).message}`);
    }
  }

  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0) {
    return ethers.getBytes(`0x${trimmed}`);
  }

  try {
    return bs58.decode(trimmed);
  } catch (error) {
    throw new Error(`Unable to decode SOLANA_PRIVATE_KEY as base58: ${(error as Error).message}`);
  }
}

function resolvePushNetwork(value: string): PushNetwork {
  const constants = PushChain.CONSTANTS.PUSH_NETWORK;
  const normalised = value.trim().toUpperCase();

  if (normalised === 'MAINNET' || normalised === 'PUSH_CHAIN_MAINNET' || normalised === constants.MAINNET) {
    return constants.MAINNET;
  }
  if (normalised === 'TESTNET' || normalised === 'PUSH_CHAIN_TESTNET' || normalised === constants.TESTNET) {
    return constants.TESTNET;
  }
  if (
    normalised === 'TESTNET_DONUT' ||
    normalised === 'PUSH_CHAIN_TESTNET_DONUT' ||
    normalised === 'DONUT' ||
    normalised === constants.TESTNET_DONUT
  ) {
    return constants.TESTNET_DONUT;
  }
  if (normalised === 'LOCALNET' || normalised === 'LOCAL' || normalised === constants.LOCALNET) {
    return constants.LOCALNET;
  }

  logger.warn(`⚠️ Unknown PUSH_NETWORK "${value}", defaulting to TESTNET_DONUT`);
  return constants.TESTNET_DONUT;
}

function selectPushRequirement(response: x402PaymentRequiredResponse): PaymentRequirements {
  if (!response.accepts || response.accepts.length === 0) {
    throw new Error('Payment requirements did not include any options.');
  }

  // Current demo always uses first option
  const requirement = response.accepts[0];

  if (!requirement.network.startsWith('push-chain')) {
    throw new Error(`PushWallet can only fulfil Push Chain requirements. Received network "${requirement.network}".`);
  }

  return requirement;
}

function ensureHexAddress(value: string, field: string): `0x${string}` {
  if (typeof value !== 'string' || !value.startsWith('0x')) {
    throw new Error(`Expected ${field} to be a hex address, received "${value}"`);
  }
  return value as `0x${string}`;
}

function normaliseCallData(
  data: Parameters<PushChain['universal']['sendTransaction']>[0]['data']
): string | PushUniversalCall[] | undefined {
  if (!data) {
    return undefined;
  }
  if (typeof data === 'string') {
    return data;
  }
  return data.map((call) => ({
    to: call.to,
    value: call.value.toString(),
    data: call.data,
  }));
}
