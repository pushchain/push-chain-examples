import { MoveableToken } from '@pushchain/core/src/lib/constants';
import { CHAIN } from '@pushchain/core/src/lib/constants/enums';
import { encodeFunctionData, erc20Abi } from 'viem';
import { enumKeyToDisplay } from '../../common/utils';
import { chainsIconList, TOKENS } from '../../common/constants';
import { PUSH_CHAIN } from './constants';
import type {
    CascadeResponse,
    ChainOptions,
    ResolvedHop,
    SourceType,
    TokenOptions,
} from './types';

export const normaliseAmount = (value: string) => value.replace(/,/g, '').trim();

export const toSafeNumber = (value: string) => {
    const parsed = Number(normaliseAmount(value));
    return Number.isFinite(parsed) ? parsed : 0;
};

export const isPositiveAmount = (value: string) => toSafeNumber(value) > 0;

export const getChainNamespace = (chainValue?: string): string => {
    if (!chainValue) return '';
    return chainValue.split(':')[0] || '';
};

export const createChainOption = (
    chain: CHAIN | string,
    getChainName: (chain: CHAIN) => string | undefined,
): ChainOptions => {
    const chainValue = String(chain);
    const chainIcon =
        chainsIconList[chainValue as keyof typeof chainsIconList];

    return {
        label: enumKeyToDisplay(getChainName(chain as CHAIN) || ''),
        value: chainValue,
        icon: chainIcon,
    };
};

export const getDestinationChainName = (chain?: string) => {
    const chainMap: Record<string, string> = {
        [CHAIN.ETHEREUM_SEPOLIA]: 'eth',
        [CHAIN.BASE_SEPOLIA]: 'base',
        [CHAIN.ARBITRUM_SEPOLIA]: 'arb',
        [CHAIN.BNB_TESTNET]: 'bsc',
        [CHAIN.SOLANA_DEVNET]: 'sol',
    };

    return chain ? chainMap[chain] || '' : '';
};

export const getTokenFamily = (symbol?: string) =>
    symbol?.split('_')[0] || symbol || '';

export const getExternalTokenSymbol = (symbol?: string) => {
    const family = getTokenFamily(symbol);

    if (family.startsWith('p') && family.length > 1) {
        return family.slice(1);
    }

    return family;
};

const getComparableTokenFamily = (symbol?: string) =>
    getExternalTokenSymbol(symbol).toLowerCase();

export const getTokenDetailsByAddress = (address?: string) => {
    if (!address) return undefined;
    return TOKENS.find(
        (token) => token.address?.toLowerCase() === address.toLowerCase(),
    );
};

export const getTokenDetailsForChain = (
    token: MoveableToken,
    chain?: string,
) => {
    const chainName = getDestinationChainName(chain);
    const tokenDetails = getTokenDetailsByAddress(token.address);

    if (tokenDetails && (!chainName || tokenDetails.chainName === chainName)) {
        return tokenDetails;
    }

    if (!chainName) return tokenDetails;

    const tokenFamily = getComparableTokenFamily(
        tokenDetails?.symbol || token.symbol,
    );

    return TOKENS.find(
        (candidate) =>
            candidate.chainName === chainName &&
            getComparableTokenFamily(candidate.symbol) === tokenFamily,
    );
};

export const getDestinationTokenDetails = (
    token: MoveableToken,
    destinationChain?: string,
) => {
    const tokenInDetails = getTokenDetailsByAddress(token.address);
    const destinationChainName = getDestinationChainName(destinationChain);

    if (!destinationChainName) return undefined;

    const tokenFamily = getComparableTokenFamily(
        tokenInDetails?.symbol || token.symbol,
    );

    return TOKENS.find(
        (candidate) =>
            getComparableTokenFamily(candidate.symbol) === tokenFamily &&
            candidate.chainName === destinationChainName,
    );
};

export const isSameAddress = (a?: string, b?: string) =>
    !!a && !!b && a.toLowerCase() === b.toLowerCase();

export const getMatchingTokenOption = (
    options: TokenOptions[],
    token?: TokenOptions | null,
) => {
    if (!token) return null;

    return (
        options.find(
            (option) =>
                option.value === token.value ||
                (!!option.token.address &&
                    isSameAddress(option.token.address, token.token.address)) ||
                (!option.token.address &&
                    !token.token.address &&
                    option.token.symbol === token.token.symbol),
        ) ?? null
    );
};

export const getSourceType = ({
    fromChain,
    originChain,
}: {
    fromChain: string;
    originChain: string;
}): SourceType => {
    if (fromChain === PUSH_CHAIN) return 'UEA';
    if (fromChain === originChain) return 'UOA';
    return 'CEA';
};

export const isExternalNativeLikeToken = (token: MoveableToken) => {
    const family = getTokenFamily(token.symbol).toUpperCase();

    return (
        token.mechanism === 'native' ||
        !token.address ||
        ['ETH', 'BNB', 'SOL', 'MATIC', 'AVAX'].includes(family)
    );
};

export const buildExternalTransferCalldata = ({
    token,
    recipient,
    amount,
}: {
    token: MoveableToken;
    recipient: string;
    amount: bigint;
}) => {
    if (!token.address) {
        throw new Error('Token address is required for ERC20/SPL transfer.');
    }

    return encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [recipient as `0x${string}`, amount],
    });
};

const getResolvedHopHash = (hop: ResolvedHop) =>
    hop.finalTxnHash ||
    hop.finalTxHash ||
    hop.outboundDetails?.externalTxHash ||
    hop.txHash ||
    '';

const getLastResolvedHopHash = (hops?: ResolvedHop[]) => {
    if (!Array.isArray(hops)) return '';

    for (let i = hops.length - 1; i >= 0; i -= 1) {
        const hash = getResolvedHopHash(hops[i]);
        if (hash) return hash;
    }

    return '';
};

export const resolveCascadeFinalHash = async (
    cascadeResponse: CascadeResponse,
) => {
    const completion =
        typeof cascadeResponse?.waitForAll === 'function'
            ? await cascadeResponse.waitForAll()
            : typeof cascadeResponse?.wait === 'function'
              ? await cascadeResponse.wait()
              : null;

    if (completion && completion.success === false) {
        throw new Error(
            `Multichain transaction failed at hop ${completion.failedAt ?? ''}`.trim(),
        );
    }

    const finalTxHash =
        completion?.finalTxnHash ||
        completion?.finalTxHash ||
        cascadeResponse?.finalTxnHash ||
        cascadeResponse?.finalTxHash ||
        getLastResolvedHopHash(completion?.hops) ||
        getLastResolvedHopHash(cascadeResponse?.hops);

    if (!finalTxHash) {
        throw new Error('Unable to resolve final transaction hash.');
    }

    return {
        finalTxHash,
        completion,
    };
};
