import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatUnits } from 'viem';
import {
    parseAmountOutFromUnknownShape,
    toBaseUnits,
} from '../../../common/utils';
import { getRamenfiQuote } from '../../../services/ramenfiApi';
import {
    BRIDGE_FAILURE_EVENTS,
    BRIDGE_SIGNAL_EVENTS,
    getLatencyBucket,
    getSafeErrorMessage,
    getTokenPair,
    trackEvent,
} from '../../../services/analytics';
import { PC_TOKEN_OPTION, PUSH_CHAIN } from '../constants';
import type { QuotePreview, TokenOptions } from '../types';
import {
    getDestinationTokenDetails,
    getExternalTokenSymbol,
    getTokenDetailsForChain,
    isPositiveAmount,
    isSameAddress,
    normaliseAmount,
} from '../utils';

const EMPTY_QUOTE: QuotePreview = {
    amount: '',
    loading: false,
    error: '',
};

export const useBridgeQuote = ({
    amount,
    fromChain,
    fromToken,
    toToken,
    toChain,
}: {
    amount: string;
    fromChain?: string;
    fromToken: TokenOptions | null;
    toToken: TokenOptions | null;
    toChain?: string;
}) => {
    const quoteTarget = useMemo(() => {
        if (!fromToken) return null;

        if (toToken?.value === PC_TOKEN_OPTION.value) {
            return {
                token: PC_TOKEN_OPTION.token,
                requiresQuote: false,
            };
        }

        const tokenInDetails = getTokenDetailsForChain(
            fromToken.token,
            fromChain,
        );
        const tokenOutDetails = getDestinationTokenDetails(
            fromToken.token,
            toChain,
        );

        if (!tokenInDetails?.address || !tokenOutDetails?.address) {
            return {
                token: toToken?.token ?? fromToken.token,
                requiresQuote: false,
            };
        }

        return {
            token: {
                ...fromToken.token,
                symbol: getExternalTokenSymbol(tokenOutDetails.symbol),
                address: tokenOutDetails.address,
                decimals: tokenOutDetails.decimals ?? fromToken.token.decimals,
            },
            tokenInAddress: tokenInDetails.address,
            tokenOutAddress: tokenOutDetails.address,
            requiresQuote: !isSameAddress(
                tokenInDetails.address,
                tokenOutDetails.address,
            ),
        };
    }, [fromChain, fromToken, toChain, toToken]);

    const [quote, setQuote] = useState<QuotePreview>(EMPTY_QUOTE);
    // Reports a priced route the user cannot complete, once per attempt.
    // Memoised on the same inputs `quoteTarget` already derives from, so adding
    // it to the effect below does not cause an extra quote fetch.
    const trackQuoteFailure = useCallback(
        (reason: string) =>
            trackEvent(BRIDGE_FAILURE_EVENTS.QUOTE_FAILED, {
                from_chain: fromChain,
                to_chain: toChain,
                from_token: fromToken?.token.symbol,
                to_token: quoteTarget?.token.symbol,
                token_pair: getTokenPair(
                    fromToken?.token.symbol,
                    quoteTarget?.token.symbol,
                ),
                reason: reason.slice(0, 100),
            }),
        [fromChain, fromToken, quoteTarget, toChain],
    );

    // Sampled once per route rather than per keystroke. Quotes refetch on every
    // debounced amount change, so reporting them all would put this event near
    // the top of the property by count and give it a per-user rate high enough
    // to trip the dashboard's "people are hunting" callout - a UX finding that
    // would be an artefact of the instrumentation, not the product. One sample
    // per route still gives a latency distribution across routes and users.
    const quoteLatencyRouteRef = useRef('');

    const trackQuoteLatency = useCallback(
        (latencyMs: number) => {
            const routeKey = `${fromChain}|${toChain}|${fromToken?.value}|${quoteTarget?.token.symbol}`;
            if (quoteLatencyRouteRef.current === routeKey) return;
            quoteLatencyRouteRef.current = routeKey;

            trackEvent(BRIDGE_SIGNAL_EVENTS.QUOTE_RECEIVED, {
                from_chain: fromChain,
                to_chain: toChain,
                token_pair: getTokenPair(
                    fromToken?.token.symbol,
                    quoteTarget?.token.symbol,
                ),
                latency_ms: latencyMs,
                latency_bucket: getLatencyBucket(latencyMs),
            });
        },
        [fromChain, fromToken, quoteTarget, toChain],
    );

    useEffect(() => {
        if (!fromToken || !quoteTarget) {
            setQuote(EMPTY_QUOTE);
            return;
        }

        const amountIn = normaliseAmount(amount);
        const baseQuote = {
            token: quoteTarget.token,
            amount: '',
            loading: false,
            error: '',
        };

        if (!amountIn || !isPositiveAmount(amountIn)) {
            setQuote(baseQuote);
            return;
        }

        if (!quoteTarget.requiresQuote) {
            setQuote({
                ...baseQuote,
                amount: amountIn,
            });
            return;
        }

        if (!quoteTarget.tokenInAddress || !quoteTarget.tokenOutAddress) {
            setQuote({
                ...baseQuote,
                error: 'Quote unavailable',
            });
            return;
        }

        let cancelled = false;
        setQuote({
            ...baseQuote,
            loading: true,
        });

        const timeout = window.setTimeout(async () => {
            const requestedAt = performance.now();

            try {
                const response = await getRamenfiQuote({
                    sourceChain: PUSH_CHAIN,
                    destinationChain: PUSH_CHAIN,
                    fromToken: quoteTarget.tokenInAddress!,
                    toToken: quoteTarget.tokenOutAddress!,
                    amountIn,
                });

                if (cancelled) return;

                if (!response.success) {
                    trackQuoteFailure(response.error || 'Quote unavailable');
                    setQuote({
                        ...baseQuote,
                        error: response.error || 'Quote unavailable',
                    });
                    return;
                }

                const rawAmountOut =
                    parseAmountOutFromUnknownShape(response) ??
                    parseAmountOutFromUnknownShape(response.poolResult);
                const amountOut = rawAmountOut
                    ? toBaseUnits(rawAmountOut, quoteTarget.token.decimals)
                    : undefined;
                const hasAmountOut = amountOut !== undefined;

                if (hasAmountOut) {
                    trackQuoteLatency(
                        Math.round(performance.now() - requestedAt),
                    );
                } else {
                    trackQuoteFailure('Unparseable quote shape');
                }

                setQuote({
                    ...baseQuote,
                    amount: hasAmountOut
                        ? formatUnits(amountOut, quoteTarget.token.decimals)
                        : '',
                    error: hasAmountOut ? '' : 'Quote unavailable',
                });
            } catch (error) {
                if (cancelled) return;
                trackQuoteFailure(getSafeErrorMessage(error, 'Quote unavailable'));
                setQuote({
                    ...baseQuote,
                    error:
                        error instanceof Error
                            ? error.message
                            : 'Quote unavailable',
                });
            }
        }, 450);

        return () => {
            cancelled = true;
            window.clearTimeout(timeout);
        };
    }, [
        amount,
        fromToken,
        quoteTarget,
        trackQuoteFailure,
        trackQuoteLatency,
    ]);

    return quote;
};
