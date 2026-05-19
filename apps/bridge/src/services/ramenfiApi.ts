import { PushChain } from '@pushchain/core';

// Types for RamenFi API
export type QuoteApiRequest = {
  sourceChain: string;
  destinationChain: string;
  fromToken: string;
  toToken: string;
  amountIn: string;
};

export type QuoteApiResponse = {
  success: boolean;
  amountOut?: string;
  gasEstimate?: number;
  liquidity?: {
    hasSufficientLiquidity: boolean;
    minimumLiquidity: string;
    pools: {
      address: string;
      liquidity: string;
      hasEnoughLiquidity: boolean;
    }[];
  } | null;
  poolResult?: {
    type: string;
    pools: {
      address: string;
      fee: number;
      token0: string;
      token1: string;
    }[];
  } | null;
  outbound?: {
    destinationChain: string;
    toToken: string;
  };
  error?: string;
  code?: string;
};

export type SwapApiRequest = {
  sourceChain: string;
  destinationChain: string;
  fromToken: string;
  toToken: string;
  amountIn: string;
  userAddress: string;
  recipient?: string;
  outboundRecipient?: string;
  poolResult: { type: string; pools: unknown[] } | null;
  maxSlippage?: string | number;
};

export type SwapApiResponse = {
  success: boolean;
  steps?: Array<{
    type: 'bridge' | 'swap' | 'outbound';
    [key: string]: unknown;
  }>;
  message?: string;
  error?: string;
  code?: string;
};

// RamenFi API base URL - adjust this to the actual RamenFi deployment URL
const RAMENFI_API_BASE = 'https://www.ramenfi.xyz/api'; // Update with actual URL
const RAMENFI_API_KEY = import.meta.env.VITE_RAMENFI_API_KEY || '';

export async function getRamenfiQuote(params: QuoteApiRequest): Promise<QuoteApiResponse> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': '*/*',
      'Referer': 'https://www.ramenfi.xyz/',
    };

    if (RAMENFI_API_KEY) {
      headers['x-api-key'] = RAMENFI_API_KEY;
    }

    const response = await fetch(`${RAMENFI_API_BASE}/quote`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error calling RamenFi quote API:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'API_ERROR',
    };
  }
}

export async function getRamenfiSwapRoute(params: SwapApiRequest): Promise<SwapApiResponse> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': '*/*',
      'Referer': 'https://www.ramenfi.xyz/',
    };

    if (RAMENFI_API_KEY) {
      headers['x-api-key'] = RAMENFI_API_KEY;
    }

    const response = await fetch(`${RAMENFI_API_BASE}/swap`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error calling RamenFi swap API:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'API_ERROR',
    };
  }
}

// Helper functions for token resolution using Push Chain SDK
export function resolvePrc20Token({
  chain,
  address,
}: {
  chain: string;
  address: string;
}) {
  return PushChain.utils.tokens.getPRC20Address({
    chain: chain.trim(),
    address: address.trim(),
  });
}

export function isPushChain(chain: string): boolean {
  return chain.trim().toLowerCase() === 'push' || 
         chain.trim().toLowerCase() === 'push chain' ||
         chain.trim().toLowerCase() === 'push testnet';
}

export function resolveFromTokenOnPushChain(sourceChain: string, fromToken: string): string {
  const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000';
  const WPC_ADDRESS = '0xE17DD2E0509f99E9ee9469Cf6634048Ec5a3ADe9';

  if (isPushChain(sourceChain)) {
    const trimmed = fromToken.trim();
    return trimmed.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()
      ? WPC_ADDRESS
      : trimmed;
  }

  return resolvePrc20Token({ chain: sourceChain, address: fromToken }).address;
}

export function resolveToTokenForOutbound(destinationChain: string, toToken: string): string {
  const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000';
  const WPC_ADDRESS = '0xE17DD2E0509f99E9ee9469Cf6634048Ec5a3ADe9';

  if (isPushChain(destinationChain)) {
    const trimmed = toToken.trim();
    return trimmed.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()
      ? WPC_ADDRESS
      : trimmed;
  }

  return resolvePrc20Token({ chain: destinationChain, address: toToken }).address;
}
