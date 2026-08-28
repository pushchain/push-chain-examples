import type { PushChain } from '@pushchain/core';
import { DEFAULT_OUTBOUND_GAS_LIMIT } from '@pushchain/core/src/lib/constants';
import { CHAIN } from '@pushchain/core/src/lib/constants/enums';
import { useEffect, useState } from 'react';
import { formatUnits } from 'viem';
import { PC_TOKEN_OPTION, PUSH_CHAIN } from '../constants';
import type { TokenOptions } from '../types';
import {
    getDestinationTokenDetails,
    isPositiveAmount,
    normaliseAmount,
} from '../utils';
import {
    BRIDGE_FAILURE_EVENTS,
    getSafeErrorMessage,
    trackEvent,
} from '../../../services/analytics';

export type BridgeFeePreview = {
    netFee: string;
    bridgeFee: string;
    destinationGasFee: string;
    loading: boolean;
};

type OutboundGasFeeQuote = {
    gasToken: `0x${string}`;
    gasFee: bigint;
    protocolFee: bigint;
    nativeValueForGas: bigint;
    gasPrice: bigint;
    gasLimitUsed: bigint;
};

type QueryOutboundGasFee = (
    prc20Token: `0x${string}`,
    gasLimit: bigint,
    destinationChain?: CHAIN,
) => Promise<OutboundGasFeeQuote>;

type PushChainWithFeeQuery = {
    universal: PushChain['universal'] & {
        queryOutboundGasFee?: QueryOutboundGasFee;
    };
    orchestrator?: {
        queryOutboundGasFee?: QueryOutboundGasFee;
    };
};

const EMPTY_FEE_PREVIEW: BridgeFeePreview = {
    netFee: '--',
    bridgeFee: '--',
    destinationGasFee: '--',
    loading: false,
};

const NO_OUTBOUND_FEE_PREVIEW: BridgeFeePreview = {
    netFee: 'Wallet gas only',
    bridgeFee: 'N/A',
    destinationGasFee: 'N/A',
    loading: false,
};

const UNAVAILABLE_FEE_PREVIEW: BridgeFeePreview = {
    netFee: 'Unavailable',
    bridgeFee: 'Unavailable',
    destinationGasFee: 'Unavailable',
    loading: false,
};

const feeFormatter = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 6,
});

const formatTokenFee = (
    value: bigint,
    decimals: number,
    symbol: string,
) => {
    if (value === 0n) return `0 ${symbol}`;

    const formatted = formatUnits(value, decimals);
    const parsed = Number(formatted);

    if (!Number.isFinite(parsed)) return `~${formatted} ${symbol}`;
    if (parsed > 0 && parsed < 0.000001) return `<0.000001 ${symbol}`;

    return `~${feeFormatter.format(parsed)} ${symbol}`;
};

const formatPcFee = (value: bigint) =>
    formatTokenFee(value, PC_TOKEN_OPTION.token.decimals, 'PC');

const getOutboundGasFeeQuery = (
    pushChainClient: PushChain,
): QueryOutboundGasFee | undefined => {
    const feeClient = pushChainClient as unknown as PushChainWithFeeQuery;

    return (
        feeClient.universal.queryOutboundGasFee?.bind(feeClient.universal) ||
        feeClient.orchestrator?.queryOutboundGasFee?.bind(
            feeClient.orchestrator,
        )
    );
};

export const useBridgeFeePreview = ({
    amount,
    fromToken,
    pushChainClient,
    toChain,
}: {
    amount: string;
    fromToken: TokenOptions | null;
    pushChainClient: PushChain | null;
    toChain?: string;
}) => {
    const [feePreview, setFeePreview] =
        useState<BridgeFeePreview>(EMPTY_FEE_PREVIEW);
    const hasPositiveAmount = isPositiveAmount(normaliseAmount(amount));

    useEffect(() => {
        if (!pushChainClient || !fromToken || !toChain) {
            setFeePreview(EMPTY_FEE_PREVIEW);
            return;
        }

        if (toChain === PUSH_CHAIN) {
            setFeePreview(NO_OUTBOUND_FEE_PREVIEW);
            return;
        }

        if (!hasPositiveAmount) {
            setFeePreview(EMPTY_FEE_PREVIEW);
            return;
        }

        const destinationTokenDetails = getDestinationTokenDetails(
            fromToken.token,
            toChain,
        );

        // Each of these leaves the user confirming a bridge with no fee shown.
        const trackFeeFailure = (reason: string) =>
            trackEvent(BRIDGE_FAILURE_EVENTS.FEE_PREVIEW_FAILED, {
                to_chain: toChain,
                from_token: fromToken.token.symbol,
                reason: reason.slice(0, 100),
            });

        if (!destinationTokenDetails?.address) {
            trackFeeFailure('No destination token address');
            setFeePreview(UNAVAILABLE_FEE_PREVIEW);
            return;
        }

        const queryOutboundGasFee = getOutboundGasFeeQuery(pushChainClient);

        if (!queryOutboundGasFee) {
            trackFeeFailure('Fee query unavailable on client');
            setFeePreview(UNAVAILABLE_FEE_PREVIEW);
            return;
        }

        let cancelled = false;

        setFeePreview((current) => ({
            ...current,
            loading: true,
        }));

        const timeout = window.setTimeout(async () => {
            try {
                const quote = await queryOutboundGasFee(
                    destinationTokenDetails.address as `0x${string}`,
                    DEFAULT_OUTBOUND_GAS_LIMIT,
                    toChain as CHAIN,
                );

                if (cancelled) return;

                const destinationGasFeePc = quote.nativeValueForGas;
                const netFeePc = quote.protocolFee + destinationGasFeePc;

                setFeePreview({
                    netFee: formatPcFee(netFeePc),
                    bridgeFee: formatPcFee(quote.protocolFee),
                    destinationGasFee: formatPcFee(destinationGasFeePc),
                    loading: false,
                });
            } catch (error) {
                console.error('Failed to fetch bridge fee preview:', error);
                trackFeeFailure(
                    getSafeErrorMessage(error, 'Fee query failed'),
                );
                if (!cancelled) setFeePreview(UNAVAILABLE_FEE_PREVIEW);
            }
        }, 450);

        return () => {
            cancelled = true;
            window.clearTimeout(timeout);
        };
    }, [fromToken, hasPositiveAmount, pushChainClient, toChain]);

    return feePreview;
};
