import { ethers } from 'ethers';
import {
    Address,
    createPublicClient,
    defineChain,
    erc20Abi,
    formatUnits,
    http,
} from 'viem';
import { Contract, JsonRpcProvider } from 'ethers';
import { EVM_CHAIN_CONFIGS, TOKENS } from './constants';
import { CHAIN } from '@pushchain/core/src/lib/constants/enums';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { UniversalAccount } from '@pushchain/ui-kit';
import { MoveableToken } from '@pushchain/core/src/lib/constants';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { PushChain } from '@pushchain/core';
import { getRamenfiQuote, getRamenfiSwapRoute } from '../services/ramenfiApi';

const provider = new JsonRpcProvider('https://evm.donut.rpc.push.org/');

const ERC20_ABI = ['function symbol() view returns (string)'];

const titleCase = (s: string) =>
    s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

export function enumKeyToDisplay(key: string): string {
    const parts = key.split('_');
    const last = parts[parts.length - 1];

    if (parts.length > 2) {
        parts.pop();
        return `${titleCase(parts.join(' '))} (${titleCase(last)})`;
    }

    return titleCase(parts.join(' '));
}

export async function fetchNativeBalance(address: string) {
    const RPC = 'https://evm.donut.rpc.push.org/';
    const rpcProvider = new ethers.JsonRpcProvider(RPC);

    if (!ethers.isAddress(address)) throw new Error('Invalid address');

    const balance = await rpcProvider.getBalance(address);
    return ethers.formatEther(balance);
}

type FetchTokenBalanceProps = {
    walletAddress: Address;
    tokenAddress?: Address;
    decimals: number;
};

type FetchNativeTokenBalanceProps = {
    wallet: UniversalAccount;
    token: MoveableToken;
};

export const pushTestnetChain = defineChain({
    id: 42101,
    name: 'Push Testnet',
    nativeCurrency: {
        decimals: 18,
        name: 'PUSH',
        symbol: 'PUSH',
    },
    rpcUrls: {
        default: {
            http: ['https://evm.donut.rpc.push.org/'],
            webSocket: ['wss://evm.pn1.dev.push.org'],
        },
    },
    blockExplorers: {
        default: { name: 'Explorer', url: 'https://donut.push.network/' },
    },
});

export const getChainIdFromChain = (chain?: CHAIN | string): number | null => {
    if (!chain) return null;

    const [namespace, reference] = chain.split(':');

    if (namespace === 'eip155') {
        const id = Number(reference);
        return Number.isFinite(id) ? id : null;
    }

    return null;
};

type PreparedUniversalTransaction = Awaited<
    ReturnType<PushChain['universal']['prepareTransaction']>
>;

type SwapPushTokensParams = {
    pushChainClient: PushChain;
    tokenIn: string;
    tokenOut: string;
    amountIn: bigint;
    tokenInDecimals: number;
    tokenOutDecimals?: number;
    sourceChain?: string;
    destinationChain?: string;
    maxSlippagePercent?: number;
    prepareTransactions?: boolean;
};

export type DirectPushTransaction = {
    to: `0x${string}`;
    value: bigint;
    data: `0x${string}`;
};

type SwapPushTokensResult = {
    transactions: PreparedUniversalTransaction[];
    directTransactions: DirectPushTransaction[];
    expectedAmountOut?: bigint;
};

const isAddressLike = (value?: string | null) =>
    !!value && ethers.isAddress(value);

const resolveTokenAddress = (token: string) => {
    if (isAddressLike(token)) return token;

    const tokenDetails = TOKENS.find(
        (item) => item.symbol === token || item.address === token,
    );
    return tokenDetails?.address ?? null;
};

export const parseAmountOutFromUnknownShape = (
    value: unknown,
): string | undefined => {
    if (!value || typeof value !== 'object') return undefined;

    const stack: unknown[] = [value];
    const candidateKeys = [
        'amountOut',
        'expectedAmountOut',
        'minAmountOut',
        'toAmount',
        'outputAmount',
        'buyAmount',
        'returnAmount',
    ];

    while (stack.length) {
        const current = stack.pop();
        if (!current || typeof current !== 'object') continue;

        const record = current as Record<string, unknown>;

        for (const key of candidateKeys) {
            const candidate = record[key];
            if (typeof candidate === 'string' && candidate.trim())
                return candidate;
            if (typeof candidate === 'number' && Number.isFinite(candidate))
                return String(candidate);
            if (typeof candidate === 'bigint') return candidate.toString();
        }

        for (const nested of Object.values(record)) {
            if (nested && typeof nested === 'object') stack.push(nested);
        }
    }

    return undefined;
};

export const toBaseUnits = (amount: string, decimals: number) => {
    const normalized = amount.trim();
    if (!normalized) return undefined;

    // If the API already returns an integer base-unit string, keep it as bigint.
    if (/^\d+$/.test(normalized) && normalized.length > decimals) {
        return BigInt(normalized);
    }

    try {
        return ethers.parseUnits(normalized, decimals);
    } catch {
        return undefined;
    }
};

export const swapPushTokens = async ({
    pushChainClient,
    tokenIn,
    tokenOut,
    amountIn,
    tokenInDecimals,
    tokenOutDecimals = tokenInDecimals,
    sourceChain = 'eip155:42101',
    destinationChain = 'eip155:42101',
    maxSlippagePercent = 0.5,
    prepareTransactions = true,
}: SwapPushTokensParams): Promise<SwapPushTokensResult> => {
    const tokenInAddress = resolveTokenAddress(tokenIn);
    const tokenOutAddress = resolveTokenAddress(tokenOut);

    if (!tokenInAddress)
        throw new Error(`Token not found in TOKENS: ${tokenIn}`);
    if (!tokenOutAddress)
        throw new Error(`Token not found in TOKENS: ${tokenOut}`);

    const userAddress = pushChainClient.universal.account as string;
    const amountInFormatted = ethers.formatUnits(amountIn, tokenInDecimals);

    const quoteResponse = await getRamenfiQuote({
        sourceChain,
        destinationChain,
        fromToken: tokenInAddress,
        toToken: tokenOutAddress,
        amountIn: amountInFormatted,
    });

    if (!quoteResponse.success || !quoteResponse.poolResult) {
        throw new Error(
            quoteResponse.error || 'Failed to get quote from RamenFi API',
        );
    }

    const swapResponse = await getRamenfiSwapRoute({
        sourceChain,
        destinationChain,
        fromToken: tokenInAddress,
        toToken: tokenOutAddress,
        amountIn: amountInFormatted,
        userAddress,
        poolResult: quoteResponse.poolResult,
        maxSlippage: maxSlippagePercent,
    });

    if (!swapResponse.success || !swapResponse.steps?.length) {
        throw new Error(
            swapResponse.error || 'Failed to get swap route from RamenFi API',
        );
    }

    const transactions: PreparedUniversalTransaction[] = [];
    const directTransactions: DirectPushTransaction[] = [];

    for (const step of swapResponse.steps) {
        if (step.type === 'swap') {
            if (!step.to || !step.data) {
                throw new Error('Invalid swap step returned by RamenFi API');
            }

            const transaction = {
                to: step.to as `0x${string}`,
                value: BigInt(String(step.value || '0')),
                data: step.data as `0x${string}`,
            };

            if (prepareTransactions) {
                transactions.push(
                    await pushChainClient.universal.prepareTransaction(
                        transaction,
                    ),
                );
            } else {
                directTransactions.push(transaction);
            }
        }

        // The bridge/outbound steps are intentionally not executed here because the bridge app
        // prepares its own Push universal bridge transaction after resolving the output token.
    }

    if (!transactions.length && !directTransactions.length) {
        throw new Error('No swap transactions to execute');
    }

    const rawAmountOut =
        parseAmountOutFromUnknownShape(swapResponse) ??
        parseAmountOutFromUnknownShape(quoteResponse);
    const quotedAmountOut = rawAmountOut
        ? toBaseUnits(rawAmountOut, tokenOutDecimals)
        : undefined;
    const slippageBps = BigInt(
        Math.min(
            10_000,
            Math.max(0, Math.ceil(maxSlippagePercent * 100)),
        ),
    );
    const expectedAmountOut = quotedAmountOut
        ? (quotedAmountOut * (BigInt(10_000) - slippageBps)) / BigInt(10_000)
        : undefined;

    return {
        transactions,
        directTransactions,
        expectedAmountOut,
    };
};

const hexToBytes = (hex: string) => {
    const clean = hex.replace(/^0x/, '');

    if (!clean || clean.length % 2 !== 0 || !/^[\da-f]+$/i.test(clean)) {
        return null;
    }

    const bytes = new Uint8Array(clean.length / 2);

    for (let i = 0; i < bytes.length; i += 1) {
        bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    }

    return bytes;
};

export const formatChainAddress = (chain: CHAIN | string, address: string) => {
    if (!String(chain).startsWith('solana:') || !address) return address;

    const bytes = hexToBytes(address);

    if (!bytes || bytes.length !== 32) return address;

    try {
        return new PublicKey(bytes).toBase58();
    } catch {
        return address;
    }
};

export const getCEAAddress = async (uoa: UniversalAccount, chain: CHAIN) => {
    const cea = await PushChain.utils.account.deriveExecutorAccount(uoa, {
        chain,
        skipNetworkCheck: true,
    });

    return formatChainAddress(chain, cea.address);
};

export const fetchNativeTokenBalance = async ({
    wallet,
}: FetchNativeTokenBalanceProps) => {
    if (!wallet) return '0';

    try {
        if (wallet.chain === CHAIN.SOLANA_DEVNET || !wallet.chain) {
            const connection = new Connection(clusterApiUrl('devnet'));
            const publicKey = new PublicKey(wallet.address);
            const lamports = await connection.getBalance(publicKey);
            return String(lamports / 1e9);
        }

        const chainId = getChainIdFromChain(wallet.chain);
        if (!chainId) return '0';

        const chain =
            EVM_CHAIN_CONFIGS[chainId as keyof typeof EVM_CHAIN_CONFIGS];
        if (!chain) return '0';

        const client = createPublicClient({ chain, transport: http() });
        const wei = await client.getBalance({
            address: wallet.address as `0x${string}`,
        });

        return formatUnits(wei, 18);
    } catch (err) {
        console.error('Error fetching native token balance:', err);
        return '0';
    }
};

export const fetchErc20TokenBalance = async ({
    wallet,
    token,
}: FetchNativeTokenBalanceProps) => {
    const chainId = getChainIdFromChain(wallet.chain);
    if (!chainId) return '0';

    const chain = EVM_CHAIN_CONFIGS[chainId as keyof typeof EVM_CHAIN_CONFIGS];
    if (!chain) return '0';

    const client = createPublicClient({ chain, transport: http() });

    const [raw, decimals] = await Promise.all([
        client.readContract({
            address: token.address as `0x${string}`,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [wallet.address as `0x${string}`],
        }),
        token.decimals ??
            client.readContract({
                address: token.address as `0x${string}`,
                abi: erc20Abi,
                functionName: 'decimals',
            }),
    ]);

    return formatUnits(raw, Number(decimals));
};

export const fetchSplTokenBalance = async ({
    owner,
    mint,
    rpcUrl = 'https://api.devnet.solana.com',
}: {
    owner: string;
    mint: string;
    rpcUrl?: string;
}) => {
    try {
        const conn = new Connection(rpcUrl);
        const ownerPk = new PublicKey(owner);
        const mintPk = new PublicKey(mint);
        const ata = await getAssociatedTokenAddress(mintPk, ownerPk);
        const res = await conn.getTokenAccountBalance(ata).catch(() => null);

        return res?.value?.uiAmountString ?? '0';
    } catch (error) {
        console.error('Error fetching SPL token balance:', error);
        return '0';
    }
};

export const fetchPrc20TokenBalance = async ({
    walletAddress,
    tokenAddress,
    decimals,
}: FetchTokenBalanceProps) => {
    const publicClient = createPublicClient({
        chain: pushTestnetChain,
        transport: http(),
    });

    try {
        if (!tokenAddress) {
            const nativeBalance = await publicClient.getBalance({
                address: walletAddress,
            });
            return formatUnits(nativeBalance, decimals);
        }

        const balance = await publicClient.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [walletAddress],
        });

        return formatUnits(balance as bigint, decimals);
    } catch (error) {
        console.error('Error fetching token balance:', error);
        return '0';
    }
};

export function formatTxTime(
    dateLike: number | string | Date,
    timeZone?: string,
) {
    const d = new Date(dateLike);
    const fmt = new Intl.DateTimeFormat('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone,
    });

    const parts = Object.fromEntries(
        fmt.formatToParts(d).map((p) => [p.type, p.value]),
    );

    return `${parts.day} ${parts.month} ${parts.year} - ${parts.hour}:${parts.minute} ${parts.dayPeriod}`;
}

export function formatDuration(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
}

export const getTokenSymbol = async (tokenAddress: string) => {
    try {
        const contract = new Contract(tokenAddress, ERC20_ABI, provider);
        return await contract.symbol();
    } catch (e) {
        console.error('symbol() failed', e);
        return null;
    }
};
