import {
    usePushChain,
    PushUI,
    usePushChainClient,
    usePushWalletContext,
} from '@pushchain/ui-kit';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Box,
    Text,
    Button,
    Wallet,
    css,
} from 'shared-components';
import {
    fetchErc20TokenBalance,
    fetchNativeTokenBalance,
    fetchPrc20TokenBalance,
    fetchSplTokenBalance,
    getCEAAddress,
    swapPushTokens,
} from '../../common/utils';
import Divider from './Divider';
import { CHAIN } from '@pushchain/core/src/lib/constants/enums';
import { MoveableToken } from '@pushchain/core/src/lib/constants';
import { isAddress } from 'viem';
import { PublicKey } from '@solana/web3.js';
import QuoteSummary from './Summary';
import TermsConsent from './TermsConsent';
import Select, { SelectOption } from '../../common/components/Select';
import { tokensIconList } from '../../common/constants';
import Success from './Success';
import {
    sendBridgeEvent,
    createBridgeEventPayload,
} from '../../services/bridgeApi';
import {
    BRIDGE_FAILURE_EVENTS,
    BRIDGE_FUNNEL_EVENTS,
    BRIDGE_SIGNAL_EVENTS,
    getAmountBucket,
    getDurationBucket,
    getPercentOfBalanceBucket,
    getRouteLabel,
    getSafeAmount,
    getSafeErrorMessage,
    getTokenPair,
    trackEvent,
    type AnalyticsMetadata,
} from '../../services/analytics';
import AddressField from './AddressField';
import { DECIMAL_INPUT, PC_TOKEN_OPTION, PUSH_CHAIN } from './constants';
import { useBridgeFeePreview } from './hooks/useBridgeFeePreview';
import { useBridgeQuote } from './hooks/useBridgeQuote';
import type { AddressPrefillType, ChainOptions, TokenOptions } from './types';
import {
    buildExternalTransferCalldata,
    createChainOption,
    getChainNamespace,
    getDestinationTokenDetails,
    getMatchingTokenOption,
    getSourceType,
    getTokenDetailsByAddress,
    getTokenDetailsForChain,
    isExternalNativeLikeToken,
    isPositiveAmount,
    isSameAddress,
    normaliseAmount,
    resolveCascadeFinalHash,
    toSafeNumber,
} from './utils';

export type { ChainOptions, TokenOptions } from './types';

type TransactionResponseWithFinalHash = {
    hash: string;
    finalTxHash?: string;
    finalTxnHash?: string;
    externalTxHash?: string;
    pushInboundTxHash?: string;
    externalStatus?: 'success' | 'failed' | 'timeout';
    externalError?: string;
    status?: 0 | 1;
    wait?: () => Promise<TransactionResponseWithFinalHash>;
};

const getFinalTransactionHash = (response: TransactionResponseWithFinalHash) =>
    response.finalTxnHash ||
    response.finalTxHash ||
    response.pushInboundTxHash ||
    response.externalTxHash ||
    response.hash;

const waitForFinalTransactionHash = async (
    response: TransactionResponseWithFinalHash,
) => {
    const receipt =
        typeof response.wait === 'function' ? await response.wait() : response;

    if (receipt.status === 0) {
        throw new Error('Transaction failed.');
    }

    if (receipt.externalStatus && receipt.externalStatus !== 'success') {
        throw new Error(
            receipt.externalError ||
                `External transaction ${receipt.externalStatus}.`,
        );
    }

    return getFinalTransactionHash(receipt);
};

const Bridge = () => {
    const [amount, setAmount] = useState('');
    const [balance, setBalance] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [addressError, setAddressError] = useState('');
    const [address, setAddress] = useState('');
    const [addressLoading, setAddressLoading] = useState(false);
    const [suggestedAddress, setSuggestedAddress] = useState('');
    const [suggestedAddressType, setSuggestedAddressType] =
        useState<AddressPrefillType>(null);
    const [fromChain, setFromChain] = useState<ChainOptions | null>(null);
    const [toChain, setToChain] = useState<ChainOptions | null>(null);
    const [userEnteredAddress, setUserEnteredAddress] = useState(false);
    const [userSelectedFromChain, setUserSelectedFromChain] = useState(false);
    const [userSelectedToChain, setUserSelectedToChain] = useState(false);
    const [supportedChainsList, setSupportedChainsList] = useState<
        ChainOptions[]
    >([]);
    const [fromToken, setFromToken] = useState<TokenOptions | null>(null);
    const [toToken, setToToken] = useState<TokenOptions | null>(null);
    const [movableTokensList, setMovableTokensList] = useState<TokenOptions[]>(
        [],
    );
    const [txnHash, setTxnHash] = useState('');
    const [txnDuration, setTxnDuration] = useState<number | null>(null);

    const startRef = useRef<number | null>(null);
    // Analytics guards: each keeps a high-frequency handler from re-firing the
    // same event for the same route while the user is still typing.
    const connectedAccountRef = useRef('');
    const amountTrackedRouteRef = useRef('');
    const addressEditedRouteRef = useRef('');
    const addressErrorRef = useRef('');
    const insufficientBalanceRef = useRef('');
    // Route details captured at submit, so the success and failure events
    // report the same route even after state has moved on.
    const txnMetaRef = useRef<AnalyticsMetadata | null>(null);
    // Timestamps behind the two "how long did that take" parameters.
    const mountedAtRef = useRef(performance.now());
    const connectedAtRef = useRef<number | null>(null);
    const routeReadyRef = useRef('');
    const zeroBalanceRef = useRef('');
    const balanceFetchFailedRef = useRef('');
    const prefillShownRef = useRef('');

    const { PushChain } = usePushChain();
    const { pushChainClient } = usePushChainClient();
    const { handleConnectToPushWallet } = usePushWalletContext();

    const fromChainValue = fromChain?.value;
    const toChainValue = toChain?.value;
    const isToPushChain = toChainValue === PUSH_CHAIN;

    // The shared parameter vocabulary every bridge event carries. `token_pair`
    // and `route` are pre-joined so a dashboard breakdown is one query, not two.
    const routeMeta = useMemo<AnalyticsMetadata>(
        () => ({
            from_chain: fromChainValue,
            from_chain_name: fromChain?.label,
            to_chain: toChainValue,
            to_chain_name: toChain?.label,
            from_token: fromToken?.token.symbol,
            to_token: toToken?.token.symbol,
            token_pair: getTokenPair(
                fromToken?.token.symbol,
                toToken?.token.symbol,
            ),
            route: getRouteLabel(fromChain?.label, toChain?.label),
        }),
        [
            fromChain?.label,
            fromChainValue,
            fromToken,
            toChain?.label,
            toChainValue,
            toToken,
        ],
    );

    const supportedFromChainsList = useMemo(
        () =>
            supportedChainsList.filter(
                (chain) => chain.value !== toChainValue,
            ),
        [supportedChainsList, toChainValue],
    );

    const supportedToChainsList = useMemo(
        () =>
            supportedChainsList.filter(
                (chain) => chain.value !== fromChainValue,
            ),
        [fromChainValue, supportedChainsList],
    );

    const toTokenOptions = useMemo(() => {
        if (!fromToken) return [];

        // Only expose PC as an explicit receive token when bridging ETH-like native flow into Push Chain.
        if (isToPushChain && fromToken.token.symbol === 'ETH') {
            return [fromToken, PC_TOKEN_OPTION];
        }

        return [fromToken];
    }, [fromToken, isToPushChain]);

    const quotePreview = useBridgeQuote({
        amount,
        fromChain: fromChainValue,
        fromToken,
        toToken,
        toChain: toChainValue,
    });
    const feePreview = useBridgeFeePreview({
        amount,
        fromToken,
        pushChainClient,
        toChain: toChainValue,
    });

    const buttonText = useMemo(() => {
        if (!pushChainClient) return 'Connect Wallet';
        return 'Confirm Transaction';
    }, [pushChainClient]);

    const buildChainOption = useCallback(
        (chain: CHAIN | string): ChainOptions =>
            createChainOption(chain, (chainId) =>
                PushChain.utils.chains.getChainName(chainId),
            ),
        [PushChain.utils.chains],
    );

    const selectedAddressIsSuggested =
        !!suggestedAddress && address.trim() === suggestedAddress;

    const addressPrefillNote = useMemo(() => {
        if (!selectedAddressIsSuggested) return '';

        if (suggestedAddressType === 'uea') {
            return 'Pre filled with your Push Chain account linked to the connected wallet.';
        }

        if (suggestedAddressType === 'cea') {
            return `Pre filled with your ${toChain?.label || 'destination chain'} sub-account linked to your Push Wallet.`;
        }

        return '';
    }, [selectedAddressIsSuggested, suggestedAddressType, toChain?.label]);

    const showUseMyAddress =
        userEnteredAddress &&
        !!suggestedAddress &&
        address.trim() !== suggestedAddress;

    const validateAddressForChain = useCallback(
        (addr: string, chainValue?: string): string => {
            const trimmed = addr.trim();
            if (!trimmed) return '';

            const ns = getChainNamespace(chainValue);

            if (ns === 'solana') {
                try {
                    const publicKey = new PublicKey(trimmed);
                    void publicKey;
                    return '';
                } catch {
                    return 'Invalid Solana address for selected destination chain.';
                }
            }

            if (ns === 'eip155') {
                return isAddress(trimmed)
                    ? ''
                    : 'Invalid EVM address for selected destination chain.';
            }

            return '';
        },
        [],
    );

    const validateBridgeForm = useCallback(() => {
        if (!pushChainClient) return '';
        if (!fromChain) return 'Please select source chain.';
        if (!toChain) return 'Please select destination chain.';
        if (fromChain.value === toChain.value)
            return 'Source and destination chains must be different.';
        if (!fromToken) return 'Please select token.';
        if (!toToken) return 'Please select destination token.';
        if (!amount || !isPositiveAmount(amount))
            return 'Amount should be greater than 0.';
        if (!address.trim()) return 'Please enter destination address.';
        const nextAddressError = validateAddressForChain(
            address,
            toChain.value,
        );
        if (nextAddressError) return nextAddressError;

        if (balance && toSafeNumber(amount) > toSafeNumber(balance)) {
            return 'Insufficient balance';
        }

        return '';
    }, [
        address,
        amount,
        balance,
        fromChain,
        fromToken,
        pushChainClient,
        toChain,
        toToken,
        validateAddressForChain,
    ]);

    const getTokenOptionByAddress = useCallback(
        (tokenAddress?: string) => {
            if (!tokenAddress) return null;
            return (
                movableTokensList.find((token) =>
                    isSameAddress(token.token.address, tokenAddress),
                ) ?? null
            );
        },
        [movableTokensList],
    );

    const buildSwapAndResolveOutgoingToken = useCallback(
        async ({
            tokenIn,
            sourceChain,
            destinationChain,
            prepareTransactions = true,
        }: {
            tokenIn: TokenOptions;
            sourceChain: CHAIN | string;
            destinationChain: CHAIN;
            prepareTransactions?: boolean;
        }) => {
            let outgoingToken = tokenIn.token;
            let outgoingAmount = PushChain.utils.helpers.parseUnits(
                amount,
                tokenIn.token.decimals,
            );
            const tokenInDetails = getTokenDetailsForChain(
                tokenIn.token,
                sourceChain,
            );
            const tokenOutDetails = getDestinationTokenDetails(
                tokenIn.token,
                destinationChain,
            );

            if (!tokenInDetails?.address || !tokenOutDetails?.address) {
                return {
                    transactions: [],
                    directTransactions: [],
                    outgoingToken,
                    outgoingAmount,
                };
            }

            if (
                isSameAddress(tokenInDetails.address, tokenOutDetails.address)
            ) {
                return {
                    transactions: [],
                    directTransactions: [],
                    outgoingToken,
                    outgoingAmount,
                };
            }

            const tokenOption = getTokenOptionByAddress(
                tokenOutDetails.address,
            );
            const pushToken = PushChain.utils.tokens
                .getMoveableTokens(PUSH_CHAIN)
                .tokens.find((token) =>
                    isSameAddress(token.address, tokenOutDetails.address),
                );
            const resolvedOutgoingToken =
                pushToken ??
                tokenOption?.token ??
                ({
                    ...tokenIn.token,
                    symbol: tokenOutDetails.symbol,
                    address: tokenOutDetails.address,
                    decimals:
                        tokenOutDetails.decimals ?? tokenIn.token.decimals,
                } as MoveableToken);

            const swapResult = await swapPushTokens({
                pushChainClient: pushChainClient!,
                tokenIn: tokenInDetails.address,
                tokenOut: tokenOutDetails.address,
                amountIn: outgoingAmount,
                tokenInDecimals: tokenIn.token.decimals,
                tokenOutDecimals: resolvedOutgoingToken.decimals,
                maxSlippagePercent: 0.5,
                prepareTransactions,
            });

            if (!swapResult.expectedAmountOut) {
                throw new Error(
                    'Unable to determine the minimum swap output amount.',
                );
            }

            outgoingToken = resolvedOutgoingToken;
            outgoingAmount = swapResult.expectedAmountOut;

            return {
                transactions: swapResult.transactions,
                directTransactions: swapResult.directTransactions,
                outgoingToken,
                outgoingAmount,
            };
        },
        [
            PushChain.utils.helpers,
            PushChain.utils.tokens,
            amount,
            getTokenOptionByAddress,
            pushChainClient,
        ],
    );

    const handleSelectFromChain = (option: SelectOption) => {
        const chain =
            supportedChainsList.find((opt) => opt.value === option.value) ||
            null;
        setFromChain(chain);
        setUserSelectedFromChain(true);
        setFromToken(null);
        setToToken(null);
        setMovableTokensList([]);
        setAmount('');
        setBalance('');
        setError('');
        setAddressError('');
        setUserEnteredAddress(false);
        amountTrackedRouteRef.current = '';
        addressEditedRouteRef.current = '';
        insufficientBalanceRef.current = '';

        trackEvent(BRIDGE_SIGNAL_EVENTS.FROM_CHAIN_SELECTED, {
            from_chain: chain?.value,
            from_chain_name: chain?.label,
            to_chain: toChainValue,
            to_chain_name: toChain?.label,
        });
    };

    const handleSelectTOChain = (option: SelectOption) => {
        const chain =
            supportedChainsList.find((opt) => opt.value === option.value) ||
            null;
        setToChain(chain);
        setUserSelectedToChain(true);
        setAddressError('');
        setUserEnteredAddress(false);
        amountTrackedRouteRef.current = '';
        addressEditedRouteRef.current = '';

        trackEvent(BRIDGE_SIGNAL_EVENTS.TO_CHAIN_SELECTED, {
            from_chain: fromChainValue,
            from_chain_name: fromChain?.label,
            to_chain: chain?.value,
            to_chain_name: chain?.label,
        });
    };

    const handleSelectToken = (option: SelectOption) => {
        const token =
            movableTokensList.find((opt) => opt.value === option.value) || null;
        setFromToken(token);
        setToToken(token);
        setAmount('');
        setBalance('');
        setError('');
        amountTrackedRouteRef.current = '';
        insufficientBalanceRef.current = '';

        trackEvent(BRIDGE_SIGNAL_EVENTS.FROM_TOKEN_SELECTED, {
            ...routeMeta,
            from_token: token?.token.symbol,
            to_token: token?.token.symbol,
            token_pair: getTokenPair(
                token?.token.symbol,
                token?.token.symbol,
            ),
        });
    };

    const handleSelectToToken = (option: SelectOption) => {
        const trackToTokenSelected = (selected: TokenOptions | null) =>
            trackEvent(BRIDGE_SIGNAL_EVENTS.TO_TOKEN_SELECTED, {
                ...routeMeta,
                to_token: selected?.token.symbol,
                token_pair: getTokenPair(
                    fromToken?.token.symbol,
                    selected?.token.symbol,
                ),
                is_pc: selected?.value === PC_TOKEN_OPTION.value,
            });

        if (option.value === 'PC') {
            setToToken(PC_TOKEN_OPTION);
            trackToTokenSelected(PC_TOKEN_OPTION);
            return;
        }

        const token =
            toTokenOptions.find((opt) => opt.value === option.value) || null;
        setToToken(token);
        trackToTokenSelected(token);
    };

    const handleSwap = () => {
        setFromChain(toChain);
        setToChain(fromChain);
        setUserSelectedFromChain(true);
        setUserSelectedToChain(true);
        setFromToken(null);
        setToToken(null);
        setMovableTokensList([]);
        setAmount('');
        setBalance('');
        setError('');
        setAddressError('');
        setUserEnteredAddress(false);
        amountTrackedRouteRef.current = '';
        addressEditedRouteRef.current = '';
        insufficientBalanceRef.current = '';

        // Chains are swapped, so report the direction the user is moving to.
        trackEvent(BRIDGE_SIGNAL_EVENTS.DIRECTION_FLIPPED, {
            from_chain: toChainValue,
            from_chain_name: toChain?.label,
            to_chain: fromChainValue,
            to_chain_name: fromChain?.label,
            route: getRouteLabel(toChain?.label, fromChain?.label),
        });
    };

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (value !== '' && !DECIMAL_INPUT.test(value)) return;

        setAmount(value);

        if (!value) {
            setError('');
            return;
        }

        if (balance && toSafeNumber(value) > toSafeNumber(balance)) {
            setError('Insufficient balance');

            // Once per route: the 10s balance refresh would otherwise repeat this.
            const balanceKey = `${fromChainValue}|${fromToken?.value}`;
            if (insufficientBalanceRef.current !== balanceKey) {
                insufficientBalanceRef.current = balanceKey;
                trackEvent(BRIDGE_FAILURE_EVENTS.INSUFFICIENT_BALANCE, {
                    from_chain: fromChainValue,
                    from_chain_name: fromChain?.label,
                    from_token: fromToken?.token.symbol,
                    amount_bucket: getAmountBucket(value),
                });
            }
            return;
        }

        setError('');
    };

    const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const next = e.target.value;
        setAddress(next);
        setUserEnteredAddress(next.trim() !== suggestedAddress);
        setAddressError(validateAddressForChain(next, toChain?.value));
    };

    const handleUseSuggestedAddress = () => {
        setAddress(suggestedAddress);
        setUserEnteredAddress(false);
        setAddressError(validateAddressForChain(suggestedAddress, toChainValue));

        trackEvent(BRIDGE_SIGNAL_EVENTS.USE_MY_ADDRESS_CLICKED, {
            to_chain: toChainValue,
            to_chain_name: toChain?.label,
            prefill_type: suggestedAddressType || undefined,
        });
    };

    const handleBridge = async () => {
        if (
            !pushChainClient ||
            !fromToken ||
            !fromChain ||
            !toChain ||
            !toToken ||
            !address
        )
            return;

        const formError = validateBridgeForm();
        if (formError) {
            if (
                formError.includes('address') ||
                formError.includes('EVM') ||
                formError.includes('Solana')
            ) {
                setAddressError(formError);
            } else {
                setError(formError);
            }
            return;
        }

        setError('');
        setAddressError('');
        setLoading(true);
        setTxnDuration(null);
        startRef.current = performance.now();
        // Cleared up front: anything that throws before the route is resolved
        // would otherwise be reported against the previous bridge's route.
        txnMetaRef.current = null;

        try {
            let sourceTxHash: string | undefined;
            let destinationTxHash: string | undefined;
            const parsedInputAmount = PushChain.utils.helpers.parseUnits(
                amount,
                fromToken.token.decimals,
            );
            const parsedPcAmount = PushChain.utils.helpers.parseUnits(
                amount,
                PC_TOKEN_OPTION.token.decimals,
            );
            const sourceType = getSourceType({
                fromChain: fromChain.value,
                originChain: pushChainClient.universal.origin.chain,
            });
            const isSameChain = fromChain.value === toChain.value;
            const ceaSource =
                sourceType === 'CEA'
                    ? {
                          from: {
                              chain: fromChain.value as CHAIN,
                          },
                      }
                    : {};

            const sendPushTransfer = async () => {
                const txnRes = await pushChainClient.universal.sendTransaction(
                    toToken.value === 'PC'
                        ? {
                              ...ceaSource,
                              to: address as `0x${string}`,
                              value: parsedPcAmount,
                          }
                        : {
                              ...ceaSource,
                              to: address as `0x${string}`,
                              funds: {
                                  amount: parsedInputAmount,
                                  token: fromToken.token,
                              },
                          },
                );

                sourceTxHash = txnRes.hash;
                const finalTxHash = await waitForFinalTransactionHash(txnRes);

                setTxnHash(finalTxHash);
                destinationTxHash = finalTxHash;
            };

            const sendExternalDirectTransfer = async (sourceChain: CHAIN) => {
                if (isExternalNativeLikeToken(fromToken.token)) {
                    const txnRes = await pushChainClient.universal.sendTransaction({
                        ...ceaSource,
                        to: {
                            address: address as `0x${string}`,
                            chain: sourceChain,
                        },
                        value: parsedInputAmount,
                    });

                    sourceTxHash = txnRes.hash;
                    const finalTxHash =
                        await waitForFinalTransactionHash(txnRes);

                    setTxnHash(finalTxHash);
                    destinationTxHash = finalTxHash;
                    return;
                }

                const txnRes = await pushChainClient.universal.sendTransaction({
                    ...ceaSource,
                    to: {
                        address: fromToken.token.address as `0x${string}`,
                        chain: sourceChain,
                    },
                    data: buildExternalTransferCalldata({
                        token: fromToken.token,
                        recipient: address,
                        amount: parsedInputAmount,
                    }),
                });

                sourceTxHash = txnRes.hash;
                const finalTxHash = await waitForFinalTransactionHash(txnRes);

                setTxnHash(finalTxHash);
                destinationTxHash = finalTxHash;
            };

            const buildBridgeOutTx = async ({
                token,
                bridgeAmount,
                destinationChain,
            }: {
                token: MoveableToken;
                bridgeAmount: bigint;
                destinationChain: CHAIN;
            }) =>
                pushChainClient.universal.prepareTransaction({
                    to: {
                        address: address as `0x${string}`,
                        chain: destinationChain,
                    },
                    ...(isExternalNativeLikeToken(token)
                        ? {
                              value: bridgeAmount,
                          }
                        : {}),
                    funds: {
                        amount: bridgeAmount,
                        token,
                    },
                });

            const sendPushToExternal = async () => {
                const {
                    directTransactions,
                    outgoingToken,
                    outgoingAmount,
                } = await buildSwapAndResolveOutgoingToken({
                    tokenIn: fromToken,
                    sourceChain: fromChain.value,
                    destinationChain: toChain.value as CHAIN,
                    prepareTransactions: false,
                });

                if (directTransactions.length === 0) {
                    const txnRes = await pushChainClient.universal.sendTransaction({
                        to: {
                            address: address as `0x${string}`,
                            chain: toChain.value as CHAIN,
                        },
                        ...(isExternalNativeLikeToken(outgoingToken)
                            ? {
                                  value: outgoingAmount,
                              }
                            : {}),
                        funds: {
                            amount: outgoingAmount,
                            token: outgoingToken,
                        },
                    });

                    sourceTxHash = txnRes.hash;
                    const finalTxHash =
                        await waitForFinalTransactionHash(txnRes);

                    setTxnHash(finalTxHash);
                    destinationTxHash = finalTxHash;
                    return;
                }

                const swapResponse =
                    await pushChainClient.universal.sendTransaction({
                        to: directTransactions[0].to,
                        value: BigInt(0),
                        data: directTransactions,
                    });
                sourceTxHash = swapResponse.hash;
                await waitForFinalTransactionHash(swapResponse);

                const outboundResponse =
                    await pushChainClient.universal.sendTransaction({
                        to: {
                            address: address as `0x${string}`,
                            chain: toChain.value as CHAIN,
                        },
                        ...(isExternalNativeLikeToken(outgoingToken)
                            ? { value: outgoingAmount }
                            : {}),
                        funds: {
                            amount: outgoingAmount,
                            token: outgoingToken,
                        },
                    });
                const finalTxHash =
                    await waitForFinalTransactionHash(outboundResponse);
                setTxnHash(finalTxHash);
                sourceTxHash ??= outboundResponse.hash;
                destinationTxHash = finalTxHash;
            };

            const sendExternalToExternal = async () => {
                const bridgeInTx = await pushChainClient.universal.prepareTransaction({
                    ...ceaSource,
                    to: pushChainClient.universal.account as `0x${string}`,
                    funds: {
                        amount: parsedInputAmount,
                        token: fromToken.token,
                    },
                });

                const {
                    transactions: swapTransactions,
                    outgoingToken,
                    outgoingAmount,
                } = await buildSwapAndResolveOutgoingToken({
                    tokenIn: fromToken,
                    sourceChain: fromChain.value,
                    destinationChain: toChain.value as CHAIN,
                });

                const bridgeOutTx = await buildBridgeOutTx({
                    token: outgoingToken,
                    bridgeAmount: outgoingAmount,
                    destinationChain: toChain.value as CHAIN,
                });

                const txnRes = await pushChainClient.universal.executeTransactions([
                    bridgeInTx,
                    ...swapTransactions,
                    bridgeOutTx,
                ]);
                const { finalTxHash } = await resolveCascadeFinalHash(txnRes);

                setTxnHash(finalTxHash);
                sourceTxHash = txnRes.initialTxHash;
                destinationTxHash = finalTxHash;
            };

            // Which branch runs is the single most useful thing to know when a
            // bridge fails, so it is resolved before dispatch and reported on
            // every transaction event.
            let flowCase: string;
            let send: () => Promise<void>;

            if (sourceType === 'UOA' && isToPushChain) {
                // Case 1: Connected chain A -> Push.
                flowCase = 'uoa_to_push';
                send = sendPushTransfer;
            } else if (sourceType === 'UOA' && isSameChain) {
                // Case 2: Connected chain A -> same chain A.
                flowCase = 'uoa_to_same_chain';
                send = () => sendExternalDirectTransfer(fromChain.value as CHAIN);
            } else if (sourceType === 'UOA') {
                // Case 3: Connected chain A -> another external chain.
                flowCase = 'uoa_to_external';
                send = sendExternalToExternal;
            } else if (sourceType === 'UEA' && isToPushChain) {
                // Case 4: Push UEA -> Push.
                flowCase = 'uea_to_push';
                send = sendPushTransfer;
            } else if (sourceType === 'UEA') {
                // Cases 5/6: Push UEA -> connected chain A / other external chain.
                flowCase = 'uea_to_external';
                send = sendPushToExternal;
            } else if (sourceType === 'CEA' && isToPushChain) {
                // Case 7: Other chain CEA -> Push.
                flowCase = 'cea_to_push';
                send = sendPushTransfer;
            } else if (sourceType === 'CEA' && isSameChain) {
                // Case 8: Other chain CEA -> same external chain.
                flowCase = 'cea_to_same_chain';
                send = () => sendExternalDirectTransfer(fromChain.value as CHAIN);
            } else {
                // Case 9: Other chain CEA -> connected chain A / another external chain.
                flowCase = 'cea_to_external';
                send = sendExternalToExternal;
            }

            // True for the branches that route through the RamenFi swap leg.
            const requiresSwap = flowCase.endsWith('_to_external');

            txnMetaRef.current = {
                ...routeMeta,
                route_type: sourceType,
                flow_case: flowCase,
                requires_swap: requiresSwap,
                amount: getSafeAmount(amount),
                amount_bucket: getAmountBucket(amount),
                amount_pct_of_balance: getPercentOfBalanceBucket(
                    amount,
                    balance,
                ),
                time_to_submit_sec: connectedAtRef.current
                    ? Math.round(
                          (performance.now() - connectedAtRef.current) / 1000,
                      )
                    : undefined,
            };

            trackEvent(
                BRIDGE_FUNNEL_EVENTS.TRANSACTION_SUBMITTED,
                txnMetaRef.current,
            );

            await send();

            const end = performance.now();
            const durationSec = Math.round(
                (end - (startRef.current ?? end)) / 1000,
            );
            setTxnDuration(durationSec);
            startRef.current = null;

            trackEvent(BRIDGE_FUNNEL_EVENTS.TRANSACTION_SUCCEEDED, {
                ...txnMetaRef.current,
                duration_sec: durationSec,
                duration_bucket: getDurationBucket(durationSec),
            });

            try {
                const amountBaseUnits = parsedInputAmount.toString();
                const completedEvent = createBridgeEventPayload({
                    status: 'COMPLETED',
                    fromAddress:
                        sourceType === 'CEA'
                            ? await getCEAAddress(
                                  pushChainClient.universal.origin,
                                  fromChain.value as CHAIN,
                              )
                            : sourceType === 'UEA'
                              ? pushChainClient.universal.account
                              : pushChainClient.universal.origin.address,
                    fromChain,
                    fromTokenSymbol: fromToken.token.symbol,
                    toAddress: address,
                    toChain,
                    toTokenSymbol:
                        toToken.token.symbol || fromToken.token.symbol,
                    amount: amountBaseUnits,
                    decimals: fromToken.token.decimals,
                    sourceTxHash,
                    destinationTxHash: destinationTxHash || sourceTxHash,
                    ueaWallet: pushChainClient.universal.account,
                });

                await sendBridgeEvent(completedEvent);
            } catch (apiError) {
                console.error(
                    'Failed to send COMPLETED bridge event:',
                    apiError,
                );

                // The bridge landed but the points event did not - the user
                // earned nothing and nothing else records that today.
                trackEvent(BRIDGE_FAILURE_EVENTS.POINTS_EVENT_FAILED, {
                    ...txnMetaRef.current,
                    status: 'COMPLETED',
                    error_message: getSafeErrorMessage(
                        apiError,
                        'Points event rejected',
                    ),
                });
            }
        } catch (err) {
            console.error('Error in bridging:', err);

            trackEvent(BRIDGE_FAILURE_EVENTS.TRANSACTION_FAILED, {
                ...(txnMetaRef.current ?? routeMeta),
                error_message: getSafeErrorMessage(err),
            });
        } finally {
            setLoading(false);
        }
    };

    const handleClick = async () => {
        if (!pushChainClient) {
            trackEvent(BRIDGE_FUNNEL_EVENTS.WALLET_CONNECT_CLICKED);
            handleConnectToPushWallet();
            return;
        }

        await handleBridge();
    };

    useEffect(() => {
        const chains = PushChain.utils.chains.getSupportedChains(
            PushUI.CONSTANTS.PUSH_NETWORK.TESTNET,
        ).chains;
        const options = chains.map((chain) => buildChainOption(chain));

        setSupportedChainsList((current) =>
            current.length === options.length &&
            current.every((chain, index) => chain.value === options[index].value)
                ? current
                : options,
        );
    }, [PushChain.utils.chains, buildChainOption]);

    useEffect(() => {
        if (!pushChainClient) {
            setFromChain(null);
            setToChain(null);
            setFromToken(null);
            setToToken(null);
            setAddress('');
            setSuggestedAddress('');
            setSuggestedAddressType(null);
            setBalance('');
            return;
        }

        if (!userSelectedFromChain) {
            const originChain = pushChainClient.universal.origin.chain;
            setFromChain((current) =>
                current?.value === originChain
                    ? current
                    : buildChainOption(originChain),
            );
        }

        if (!userSelectedToChain && supportedToChainsList.length) {
            const defaultToChain =
                supportedToChainsList.find(
                    (chain) =>
                        chain.value === PUSH_CHAIN &&
                        chain.value !== pushChainClient.universal.origin.chain,
                ) ||
                supportedToChainsList.find(
                    (chain) =>
                        chain.value !== pushChainClient.universal.origin.chain,
                ) ||
                null;
            setToChain((current) =>
                current?.value === defaultToChain?.value
                    ? current
                    : defaultToChain,
            );
        }
    }, [
        buildChainOption,
        pushChainClient,
        supportedToChainsList,
        userSelectedFromChain,
        userSelectedToChain,
    ]);

    useEffect(() => {
        if (!fromChainValue || !toChainValue || fromChainValue !== toChainValue)
            return;

        setToChain(
            supportedChainsList.find((chain) => chain.value !== fromChainValue) ||
                null,
        );
    }, [fromChainValue, supportedChainsList, toChainValue]);

    useEffect(() => {
        if (!fromChainValue) {
            setMovableTokensList([]);
            setFromToken(null);
            return;
        }

        const tokens = PushChain.utils.tokens.getMoveableTokens(
            fromChainValue as CHAIN,
        ).tokens;
        const options: TokenOptions[] = tokens.map((token) => {
            const tokenDetails = getTokenDetailsByAddress(token.address);

            if (tokenDetails) {
                return {
                    label: tokenDetails.symbol || token.symbol,
                    displayName: tokenDetails.name || token.symbol,
                    value: token.address || token.symbol,
                    token,
                    icon: Object.keys(tokensIconList).includes(
                        tokenDetails.logoKey || '',
                    )
                        ? tokensIconList[tokenDetails.logoKey || '']
                        : undefined,
                    badge: tokensIconList['PC'],
                };
            }

            return {
                label: token.symbol,
                value: token.address || token.symbol,
                token,
                icon: Object.keys(tokensIconList).includes(token.symbol)
                    ? tokensIconList[token.symbol]
                    : undefined,
            };
        });

        setMovableTokensList(options);
        setFromToken(
            (current) =>
                getMatchingTokenOption(options, current) || options[0] || null,
        );
    }, [PushChain.utils.tokens, fromChainValue]);

    useEffect(() => {
        if (!fromToken) {
            setToToken(null);
            return;
        }

        setToToken(
            (current) =>
                getMatchingTokenOption(toTokenOptions, current) ||
                toTokenOptions[0] ||
                null,
        );
    }, [fromToken, toTokenOptions]);

    useEffect(() => {
        let cancelled = false;

        const handleFetchBalance = async () => {
            if (!pushChainClient || !fromToken || !fromChain) {
                if (!cancelled) setBalance('');
                return;
            }

            const wallet = pushChainClient.universal.origin;
            const isPushSource = fromChain.value === PUSH_CHAIN;

            // if (!isPushSource && wallet.chain !== fromChain.value) {
            //     if (!cancelled) setBalance('');
            //     return;
            // }

            let nextBalance = '0';
            let fetchFailed = false;

            try {
                if (isPushSource) {
                    nextBalance = await fetchPrc20TokenBalance({
                        walletAddress: pushChainClient.universal
                            .account as `0x${string}`,
                        tokenAddress:
                            fromToken.token.mechanism === 'native'
                                ? undefined
                                : (fromToken.token.address as `0x${string}`),
                        decimals: fromToken.token.decimals,
                    });
                } else if (getChainNamespace(fromChain.value) === 'solana') {
                    const sourceWallet =
                        pushChainClient.universal.origin.chain ===
                        fromChain.value
                            ? wallet
                            : {
                                  chain: fromChain.value as CHAIN,
                                  address: await getCEAAddress(
                                      pushChainClient.universal.origin,
                                      fromChain.value as CHAIN,
                                  ),
                              };

                    if (fromToken.token.mechanism === 'native') {
                        nextBalance = await fetchNativeTokenBalance({
                            wallet: sourceWallet,
                            token: fromToken.token,
                        });
                    } else {
                        nextBalance = await fetchSplTokenBalance({
                            owner: sourceWallet.address,
                            mint: fromToken.token.address,
                        });
                    }
                } else if (getChainNamespace(fromChain.value) === 'eip155') {
                    const sourceWallet =
                        pushChainClient.universal.origin.chain ===
                        fromChain.value
                            ? wallet
                            : {
                                  chain: fromChain.value as CHAIN,
                                  address: await getCEAAddress(
                                      pushChainClient.universal.origin,
                                      fromChain.value as CHAIN,
                                  ),
                              };

                    if (fromToken.token.mechanism === 'native') {
                        nextBalance = await fetchNativeTokenBalance({
                            wallet: sourceWallet,
                            token: fromToken.token,
                        });
                    } else {
                        nextBalance = await fetchErc20TokenBalance({
                            wallet: sourceWallet,
                            token: fromToken.token,
                        });
                    }
                }
            } catch (fetchError) {
                console.error('Error fetching balance:', fetchError);
                fetchFailed = true;

                // Once per token: this effect also runs on a 10s interval.
                const failKey = `${fromChain.value}|${fromToken.value}`;
                if (balanceFetchFailedRef.current !== failKey) {
                    balanceFetchFailedRef.current = failKey;
                    trackEvent(BRIDGE_FAILURE_EVENTS.BALANCE_FETCH_FAILED, {
                        from_chain: fromChain.value,
                        from_chain_name: fromChain.label,
                        from_token: fromToken.token.symbol,
                        error_message: getSafeErrorMessage(
                            fetchError,
                            'Balance lookup failed',
                        ),
                    });
                }
            }

            if (cancelled) return;

            setBalance(nextBalance);

            // A connected user with nothing to send. Distinct from insufficient
            // balance, which needs them to have typed an amount first - and the
            // strongest argument for putting a faucet link in this app.
            // Guarded on the same condition the branches above use: an
            // unsupported namespace leaves nextBalance at its '0' default
            // without ever querying, which is unknown, not empty.
            const namespace = getChainNamespace(fromChain.value);
            const queriedBalance =
                isPushSource || namespace === 'solana' || namespace === 'eip155';
            const zeroKey = `${fromChain.value}|${fromToken.value}`;
            if (
                queriedBalance &&
                !fetchFailed &&
                toSafeNumber(nextBalance) === 0 &&
                zeroBalanceRef.current !== zeroKey
            ) {
                zeroBalanceRef.current = zeroKey;
                trackEvent(BRIDGE_FAILURE_EVENTS.ZERO_BALANCE, {
                    from_chain: fromChain.value,
                    from_chain_name: fromChain.label,
                    from_token: fromToken.token.symbol,
                });
            }

            if (amount && toSafeNumber(amount) > toSafeNumber(nextBalance)) {
                setError('Insufficient balance');
            } else if (error === 'Insufficient balance') {
                setError('');
            }
        };

        handleFetchBalance();
        const interval = setInterval(handleFetchBalance, 10_000);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [amount, error, fromChain, fromToken, pushChainClient]);

    useEffect(() => {
        let cancelled = false;

        const resolveSuggestedAddress = async () => {
            setAddressLoading(false);
            setSuggestedAddress('');
            setSuggestedAddressType(null);

            if (!pushChainClient || !toChainValue) {
                return;
            }

            const uoa = pushChainClient.universal.origin;

            // Reported once per destination so the edit rate has a denominator.
            const trackPrefill = (type: AddressPrefillType) => {
                const key = `${toChainValue}|${type}`;
                if (prefillShownRef.current === key) return;
                prefillShownRef.current = key;
                trackEvent(BRIDGE_SIGNAL_EVENTS.ADDRESS_PREFILL_SHOWN, {
                    to_chain: toChainValue,
                    prefill_type: type || 'none',
                });
            };

            if (toChainValue === PUSH_CHAIN) {
                setSuggestedAddress(pushChainClient.universal.account);
                setSuggestedAddressType('uea');
                trackPrefill('uea');
                return;
            }

            if (toChainValue === uoa.chain) {
                setSuggestedAddress(uoa.address);
                setSuggestedAddressType('uoa');
                trackPrefill('uoa');
                return;
            }

            setAddressLoading(true);

            try {
                const cea = await getCEAAddress(uoa, toChainValue as CHAIN);
                if (cancelled) return;
                setSuggestedAddress(cea);
                setSuggestedAddressType('cea');
                trackPrefill('cea');
            } catch (ceaError) {
                console.error('Failed to derive CEA address:', ceaError);

                // No address gets pre-filled, so the user has to find one.
                trackEvent(BRIDGE_FAILURE_EVENTS.ADDRESS_DERIVATION_FAILED, {
                    to_chain: toChainValue,
                    error_message: getSafeErrorMessage(
                        ceaError,
                        'Sub-account lookup failed',
                    ),
                });

                if (!cancelled) {
                    setSuggestedAddress('');
                    setSuggestedAddressType(null);
                }
            } finally {
                if (!cancelled) setAddressLoading(false);
            }
        };

        resolveSuggestedAddress();

        return () => {
            cancelled = true;
        };
    }, [pushChainClient, toChainValue]);

    useEffect(() => {
        if (!userEnteredAddress) {
            setAddress(suggestedAddress);
        }
    }, [suggestedAddress, userEnteredAddress]);

    useEffect(() => {
        setAddressError(validateAddressForChain(address, toChain?.value));
    }, [address, toChain?.value, validateAddressForChain]);

    // Fires once per connected account, not on every client re-render.
    useEffect(() => {
        if (!pushChainClient) {
            connectedAccountRef.current = '';
            return;
        }

        const account = pushChainClient.universal.account;
        if (connectedAccountRef.current === account) return;
        connectedAccountRef.current = account;

        connectedAtRef.current = performance.now();

        const originChain = pushChainClient.universal.origin.chain;
        trackEvent(BRIDGE_FUNNEL_EVENTS.WALLET_CONNECTED, {
            from_chain: originChain,
            from_chain_name: buildChainOption(originChain).label,
            namespace: getChainNamespace(originChain),
            time_to_connect_sec: Math.round(
                (performance.now() - mountedAtRef.current) / 1000,
            ),
        });
    }, [buildChainOption, pushChainClient]);

    // Debounced so a typed amount reports once per route, not per keystroke.
    useEffect(() => {
        if (!amount || !isPositiveAmount(amount)) return;

        const routeKey = `${fromChainValue}|${toChainValue}|${fromToken?.value}|${toToken?.value}`;
        if (amountTrackedRouteRef.current === routeKey) return;

        const timer = window.setTimeout(() => {
            amountTrackedRouteRef.current = routeKey;
            trackEvent(BRIDGE_FUNNEL_EVENTS.AMOUNT_ENTERED, {
                ...routeMeta,
                amount: getSafeAmount(amount),
                amount_bucket: getAmountBucket(amount),
                amount_pct_of_balance: getPercentOfBalanceBucket(
                    amount,
                    balance,
                ),
            });
        }, 800);

        return () => window.clearTimeout(timer);
    }, [
        amount,
        balance,
        fromChainValue,
        fromToken?.value,
        routeMeta,
        toChainValue,
        toToken?.value,
    ]);

    // Only counts as an edit once the user has actually replaced the prefill.
    useEffect(() => {
        if (!userEnteredAddress || !address.trim()) return;

        const routeKey = `${toChainValue}|${suggestedAddressType}`;
        if (addressEditedRouteRef.current === routeKey) return;

        const timer = window.setTimeout(() => {
            addressEditedRouteRef.current = routeKey;
            trackEvent(BRIDGE_SIGNAL_EVENTS.DESTINATION_ADDRESS_EDITED, {
                to_chain: toChainValue,
                to_chain_name: toChain?.label,
                prefill_type: suggestedAddressType || 'none',
            });
        }, 900);

        return () => window.clearTimeout(timer);
    }, [
        address,
        suggestedAddressType,
        toChain?.label,
        toChainValue,
        userEnteredAddress,
    ]);

    // Debounced so half-typed addresses do not each report as a failure.
    useEffect(() => {
        if (!addressError) {
            addressErrorRef.current = '';
            return;
        }

        const errorKey = `${toChainValue}|${addressError}`;
        if (addressErrorRef.current === errorKey) return;

        const timer = window.setTimeout(() => {
            addressErrorRef.current = errorKey;
            trackEvent(BRIDGE_FAILURE_EVENTS.ADDRESS_VALIDATION, {
                to_chain: toChainValue,
                to_chain_name: toChain?.label,
                namespace: getChainNamespace(toChainValue),
            });
        }, 900);

        return () => window.clearTimeout(timer);
    }, [addressError, toChain?.label, toChainValue]);

    const disabled = useMemo(() => {
        if (!pushChainClient) return false;
        return !!validateBridgeForm();
    }, [pushChainClient, validateBridgeForm]);

    // The button just went live. The gap between this and
    // bridge_transaction_submitted is people who could bridge and chose not to -
    // fee shock, second thoughts - which no other event can show.
    useEffect(() => {
        if (!pushChainClient || disabled) return;

        const routeKey = `${fromChainValue}|${toChainValue}|${fromToken?.value}|${toToken?.value}`;
        if (routeReadyRef.current === routeKey) return;
        routeReadyRef.current = routeKey;

        trackEvent(BRIDGE_FUNNEL_EVENTS.ROUTE_READY, {
            ...routeMeta,
            amount: getSafeAmount(amount),
            amount_bucket: getAmountBucket(amount),
            amount_pct_of_balance: getPercentOfBalanceBucket(amount, balance),
        });
    }, [
        amount,
        balance,
        disabled,
        fromChainValue,
        fromToken?.value,
        pushChainClient,
        routeMeta,
        toChainValue,
        toToken?.value,
    ]);

    return (
        <Box
            display="flex"
            flexDirection="column"
            justifyContent="center"
            alignItems="center"
            gap="spacing-md"
            css={css`
                width: 500px;
                @media (max-width: 768px) {
                    width: 100%;
                    max-width: 500px;
                }
            `}
        >
            {txnHash && fromToken && fromChain && toChain ? (
                <Success
                    fromChain={fromChain.value}
                    fromAmount={amount}
                    fromToken={fromToken.token}
                    toChain={toChain.value}
                    toChainLabel={toChain.label}
                    toAmount={quotePreview.amount || amount}
                    toToken={quotePreview.token || toToken?.token || fromToken.token}
                    duration={txnDuration || 0}
                    txnHash={txnHash}
                    handleBack={() => {
                        trackEvent(BRIDGE_SIGNAL_EVENTS.MORE_TOKENS_CLICKED, {
                            ...(txnMetaRef.current ?? routeMeta),
                        });
                        setTxnHash('');
                        setAmount('');
                        setTxnDuration(null);
                        setError('');
                        amountTrackedRouteRef.current = '';
                        routeReadyRef.current = '';
                    }}
                />
            ) : (
                <Box
                    display="flex"
                    flexDirection="column"
                    padding="spacing-lg"
                    gap="spacing-xl"
                    borderRadius="radius-md"
                    border="border-sm solid stroke-secondary"
                    backgroundColor="surface-primary"
                    css={css`
                        width: 100%;
                        @media (max-width: 768px) {
                            width: calc(100% - 68px);
                            max-width: 500px;
                        }
                    `}
                >
                    <Box display="flex" flexDirection="column" gap="spacing-md">
                        <Box
                            display="flex"
                            gap="spacing-xxs"
                            alignItems={{ initial: 'center', tb: 'flex-start' }}
                            flexDirection={{ initial: 'row', tb: 'column' }}
                        >
                            <Box
                                width="64px"
                                display="flex"
                                justifyContent={{
                                    initial: 'center',
                                    tb: 'flex-start',
                                }}
                            >
                                <Text
                                    variant="bm-regular"
                                    color="text-secondary"
                                >
                                    Send
                                </Text>
                            </Box>
                            <Box
                                width={{
                                    initial: 'calc(100% - 72px)',
                                    tb: '100%',
                                }}
                                position="relative"
                            >
                                <Box
                                    display="flex"
                                    flexDirection="column"
                                    borderRadius="radius-xs"
                                    border="border-xmd solid stroke-secondary"
                                    backgroundColor="surface-secondary"
                                    padding="spacing-xs"
                                    gap="spacing-xs"
                                    css={css`
                                        &:hover {
                                            border-color: var(
                                                --stroke-tertiary
                                            );
                                        }
                                        &:focus-within {
                                            border-color: var(
                                                --stroke-brand-bold
                                            );
                                            outline: none;
                                        }
                                    `}
                                >
                                    <Box
                                        display="flex"
                                        gap="spacing-xs"
                                        alignItems="center"
                                    >
                                        <Box
                                            css={css`
                                                input::placeholder {
                                                    color: var(--text-tertiary);
                                                }
                                            `}
                                        >
                                            <input
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: 'var(--text-primary)',
                                                    outline: 'none',
                                                    width: '100%',
                                                    fontSize: '34px',
                                                    lineHeight: '42px',
                                                }}
                                                onChange={handleAmountChange}
                                                placeholder="0"
                                                value={amount}
                                            />
                                        </Box>
                                        <Box
                                            width="30%"
                                            display={{
                                                initial: 'block',
                                                tb: 'none',
                                            }}
                                        >
                                            <Select
                                                onChange={handleSelectToken}
                                                selected={fromToken}
                                                options={movableTokensList}
                                                placeholder="Select Token"
                                                disabled={!fromChain}
                                            />
                                        </Box>
                                    </Box>
                                    <Box
                                        display="flex"
                                        gap="spacing-xxs"
                                        alignItems="center"
                                        height="24px"
                                        justifyContent="flex-end"
                                    >
                                        <Text
                                            variant="bs-regular"
                                            color="text-tertiary"
                                        >
                                            {balance
                                                ? toSafeNumber(balance).toFixed(
                                                      4,
                                                  )
                                                : '0'}
                                        </Text>
                                        <Wallet
                                            size={18}
                                            color="icon-tertiary"
                                            style={{
                                                width: '16px',
                                                color: 'var(--icon-tertiary)',
                                            }}
                                        />
                                        <Box
                                            display="flex"
                                            alignItems="center"
                                            height="100%"
                                            padding="spacing-none spacing-xxs"
                                            borderRadius="radius-xxs"
                                            cursor="pointer"
                                            border="border-sm solid stroke-tertiary"
                                            onClick={() => {
                                                setAmount(
                                                    normaliseAmount(balance),
                                                );
                                                setError('');
                                                trackEvent(
                                                    BRIDGE_SIGNAL_EVENTS.MAX_AMOUNT_CLICKED,
                                                    {
                                                        ...routeMeta,
                                                        amount_bucket:
                                                            getAmountBucket(
                                                                balance,
                                                            ),
                                                    },
                                                );
                                            }}
                                        >
                                            <Text
                                                variant="ol-regular"
                                                color="text-secondary"
                                                css={css`
                                                    :hover {
                                                        color: var(
                                                            --text-tertiary
                                                        );
                                                    }
                                                `}
                                            >
                                                Max
                                            </Text>
                                        </Box>
                                    </Box>
                                </Box>
                                <Box
                                    position="absolute"
                                    margin="spacing-none spacing-xs"
                                >
                                    <Text
                                        variant="bes-regular"
                                        color="text-state-danger-subtle"
                                    >
                                        {error}
                                    </Text>
                                </Box>
                            </Box>
                            <Box
                                width="100%"
                                display={{ initial: 'none', tb: 'block' }}
                            >
                                <Select
                                    onChange={handleSelectToken}
                                    selected={fromToken}
                                    options={movableTokensList}
                                    placeholder="Select Token"
                                    disabled={!fromChain}
                                />
                            </Box>
                        </Box>

                        <Box
                            key="from"
                            display="flex"
                            gap="spacing-xxs"
                            alignItems={{ initial: 'center', tb: 'flex-start' }}
                            flexDirection={{ initial: 'row', tb: 'column' }}
                            css={css`
                                transition: all 0.3s ease;
                            `}
                        >
                            <Box
                                width="64px"
                                display="flex"
                                justifyContent={{
                                    initial: 'center',
                                    tb: 'flex-start',
                                }}
                            >
                                <Text
                                    variant="bm-regular"
                                    color="text-secondary"
                                >
                                    From
                                </Text>
                            </Box>
                            <Box
                                width={{
                                    initial: 'calc(100% - 72px)',
                                    tb: '100%',
                                }}
                            >
                                <Select
                                    onChange={handleSelectFromChain}
                                    selected={fromChain}
                                    options={supportedFromChainsList}
                                    placeholder="Select Chain"
                                />
                            </Box>
                        </Box>

                        <Divider onSwap={handleSwap} />

                        <Box
                            key="to"
                            display="flex"
                            gap="spacing-xxs"
                            alignItems={{ initial: 'center', tb: 'flex-start' }}
                            flexDirection={{ initial: 'row', tb: 'column' }}
                            css={css`
                                transition: all 0.3s ease;
                            `}
                        >
                            <Box
                                width="64px"
                                display="flex"
                                justifyContent={{
                                    initial: 'center',
                                    tb: 'flex-start',
                                }}
                            >
                                <Text
                                    variant="bm-regular"
                                    color="text-secondary"
                                >
                                    To
                                </Text>
                            </Box>
                            <Box width={{ initial: '60%', tb: '100%' }}>
                                <Select
                                    onChange={handleSelectTOChain}
                                    selected={toChain}
                                    options={supportedToChainsList}
                                    placeholder="Select Chain"
                                />
                            </Box>
                            <Box
                                width={{
                                    initial: 'calc(40% - 72px)',
                                    tb: '100%',
                                }}
                            >
                                <Select
                                    disabled={toTokenOptions.length <= 1}
                                    selected={toToken}
                                    options={toTokenOptions}
                                    placeholder="Select Token"
                                    onChange={handleSelectToToken}
                                />
                            </Box>
                        </Box>

                        <AddressField
                            address={address}
                            addressError={addressError}
                            loading={addressLoading}
                            prefillNote={addressPrefillNote}
                            showUseMyAddress={showUseMyAddress}
                            onAddressChange={handleAddressChange}
                            onUseMyAddress={handleUseSuggestedAddress}
                        />

                        <QuoteSummary
                            fromAmount={amount}
                            fromToken={fromToken?.token}
                            toToken={quotePreview.token}
                            toAmount={quotePreview.amount}
                            loading={quotePreview.loading}
                            error={quotePreview.error}
                            netFee={feePreview.netFee}
                            bridgeFee={feePreview.bridgeFee}
                            destinationGasFee={feePreview.destinationGasFee}
                            feeLoading={feePreview.loading}
                            disabled
                        />

                        <Button
                            loading={loading}
                            onClick={handleClick}
                            disabled={disabled}
                        >
                            {buttonText}
                        </Button>
                    </Box>
                </Box>
            )}
            <TermsConsent />
        </Box>
    );
};

export default Bridge;
