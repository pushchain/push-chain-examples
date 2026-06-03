import { useEffect, useMemo, useState } from 'react';
import { formatUnits } from 'viem';
import {
    parseAmountOutFromUnknownShape,
    toBaseUnits,
} from '../../../common/utils';
import { getRamenfiQuote } from '../../../services/ramenfiApi';
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

                setQuote({
                    ...baseQuote,
                    amount: hasAmountOut
                        ? formatUnits(amountOut, quoteTarget.token.decimals)
                        : '',
                    error: hasAmountOut ? '' : 'Quote unavailable',
                });
            } catch (error) {
                if (cancelled) return;
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
    }, [amount, fromToken, quoteTarget]);

    return quote;
};
