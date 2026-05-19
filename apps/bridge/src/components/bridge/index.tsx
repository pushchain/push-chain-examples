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
    TextInput,
    Button,
    IconProps,
    Wallet,
    IllustrationProps,
    css,
} from 'shared-components';
import {
    enumKeyToDisplay,
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
import { encodeFunctionData, erc20Abi, isAddress } from 'viem';
import { PublicKey } from '@solana/web3.js';
import QuoteSummary from './Summary';
import TermsConsent from './TermsConsent';
import Select, { SelectOption } from '../../common/components/Select';
import { chainsIconList, TOKENS, tokensIconList } from '../../common/constants';
import Success from './Success';
import {
    sendBridgeEvent,
    createBridgeEventPayload,
} from '../../services/bridgeApi';

export type ChainOptions = {
    icon?: React.FC<IconProps>;
    label: string;
    value: string;
};

export type TokenOptions = {
    icon?: React.FC<IllustrationProps>;
    label: string;
    displayName?: string;
    badge?: React.FC<IllustrationProps>;
    value: string;
    token: MoveableToken;
};

const PUSH_CHAIN = CHAIN.PUSH_TESTNET_DONUT;
const PC_TOKEN_OPTION: TokenOptions = {
    value: 'PC',
    label: 'PC',
    displayName: 'Push Chain Native Token',
    token: {
        symbol: 'PC',
        decimals: 18,
        address: '',
        mechanism: 'native',
    } as MoveableToken,
    icon: tokensIconList['PC'],
};

const DECIMAL_INPUT = /^\d*(?:\.\d*)?$/;

const normaliseAmount = (value: string) => value.replace(/,/g, '').trim();
const toSafeNumber = (value: string) => {
    const parsed = Number(normaliseAmount(value));
    return Number.isFinite(parsed) ? parsed : 0;
};

const isPositiveAmount = (value: string) => toSafeNumber(value) > 0;

const getChainNamespace = (chainValue?: string): string => {
    if (!chainValue) return '';
    return chainValue.split(':')[0] || '';
};

const getDestinationChainName = (chain?: string) => {
    const chainMap: Record<string, string> = {
        [CHAIN.ETHEREUM_SEPOLIA]: 'eth',
        [CHAIN.BASE_SEPOLIA]: 'base',
        [CHAIN.ARBITRUM_SEPOLIA]: 'arb',
        [CHAIN.BNB_TESTNET]: 'bsc',
        [CHAIN.SOLANA_DEVNET]: 'sol',
    };

    return chain ? chainMap[chain] || '' : '';
};

const getTokenFamily = (symbol?: string) =>
    symbol?.split('_')[0] || symbol || '';

const getTokenDetailsByAddress = (address?: string) => {
    if (!address) return undefined;
    return TOKENS.find(
        (token) => token.address?.toLowerCase() === address.toLowerCase(),
    );
};

const getDestinationTokenDetails = (
    token: MoveableToken,
    destinationChain?: string,
) => {
    const tokenInDetails = getTokenDetailsByAddress(token.address);
    const destinationChainName = getDestinationChainName(destinationChain);

    if (!tokenInDetails || !destinationChainName) return undefined;

    const tokenFamily = getTokenFamily(tokenInDetails.symbol);

    return TOKENS.find(
        (candidate) =>
            getTokenFamily(candidate.symbol) === tokenFamily &&
            candidate.chainName === destinationChainName,
    );
};

const isSameAddress = (a?: string, b?: string) =>
    !!a && !!b && a.toLowerCase() === b.toLowerCase();


type SourceType = 'UOA' | 'UEA' | 'CEA';

const getSourceType = ({
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

const isExternalNativeLikeToken = (token: MoveableToken) => {
    const family = getTokenFamily(token.symbol).toUpperCase();

    return (
        token.mechanism === 'native' ||
        !token.address ||
        ['ETH', 'BNB', 'SOL', 'MATIC', 'AVAX'].includes(family)
    );
};

const buildExternalTransferCalldata = ({
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

type ResolvedHop = {
    txHash?: string;
    outboundDetails?: {
        externalTxHash?: string;
    };
};

type CascadeCompletion = {
    success?: boolean;
    failedAt?: number | string;
    finalTxHash?: string;
    hops?: ResolvedHop[];
};

type CascadeResponse = {
    initialTxHash?: string;
    finalTxHash?: string;
    hops?: ResolvedHop[];
    waitForAll?: () => Promise<CascadeCompletion>;
    wait?: () => Promise<CascadeCompletion>;
};

const getResolvedHopHash = (hop: ResolvedHop) =>
    hop.txHash || hop.outboundDetails?.externalTxHash || '';

const getLastResolvedHopHash = (hops?: ResolvedHop[]) => {
    if (!Array.isArray(hops)) return '';

    for (let i = hops.length - 1; i >= 0; i -= 1) {
        const hash = getResolvedHopHash(hops[i]);
        if (hash) return hash;
    }

    return '';
};

const resolveCascadeFinalHash = async (cascadeResponse: CascadeResponse) => {
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
        completion?.finalTxHash ||
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

const Bridge = () => {
    const [amount, setAmount] = useState('');
    const [balance, setBalance] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [addressError, setAddressError] = useState('');
    const [address, setAddress] = useState('');
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

    const { PushChain } = usePushChain();
    const { pushChainClient } = usePushChainClient();
    const { handleConnectToPushWallet } = usePushWalletContext();

    const isToPushChain = toChain?.value === PUSH_CHAIN;

    const supportedToChainsList = useMemo(
        () => supportedChainsList,
        [supportedChainsList],
    );

    const toTokenOptions = useMemo(() => {
        if (!fromToken) return [];

        // Only expose PC as an explicit receive token when bridging ETH-like native flow into Push Chain.
        if (isToPushChain && fromToken.token.symbol === 'ETH') {
            return [fromToken, PC_TOKEN_OPTION];
        }

        return [fromToken];
    }, [fromToken, isToPushChain]);

    const buttonText = useMemo(() => {
        if (!pushChainClient) return 'Connect Wallet';
        return 'Confirm Transaction';
    }, [pushChainClient]);

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
            destinationChain,
        }: {
            tokenIn: TokenOptions;
            destinationChain: CHAIN;
        }) => {
            let outgoingToken = tokenIn.token;
            let outgoingAmount = PushChain.utils.helpers.parseUnits(
                amount,
                tokenIn.token.decimals,
            );
            const tokenInDetails = getTokenDetailsByAddress(
                tokenIn.token.address,
            );
            const tokenOutDetails = getDestinationTokenDetails(
                tokenIn.token,
                destinationChain,
            );

            if (!tokenInDetails?.address || !tokenOutDetails?.address) {
                return { transactions: [], outgoingToken, outgoingAmount };
            }

            if (
                isSameAddress(tokenInDetails.address, tokenOutDetails.address)
            ) {
                return { transactions: [], outgoingToken, outgoingAmount };
            }

            const tokenOption = getTokenOptionByAddress(
                tokenOutDetails.address,
            );
            const resolvedOutgoingToken =
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
            });

            outgoingToken = resolvedOutgoingToken;
            outgoingAmount =
                swapResult.expectedAmountOut ??
                PushChain.utils.helpers.parseUnits(
                    amount,
                    outgoingToken.decimals,
                );

            return {
                transactions: swapResult.transactions,
                outgoingToken,
                outgoingAmount,
            };
        },
        [
            PushChain.utils.helpers,
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
    };

    const handleSelectTOChain = (option: SelectOption) => {
        const chain =
            supportedChainsList.find((opt) => opt.value === option.value) ||
            null;
        setToChain(chain);
        setUserSelectedToChain(true);
        setAddressError('');
        setUserEnteredAddress(false);
    };

    const handleSelectToken = (option: SelectOption) => {
        const token =
            movableTokensList.find((opt) => opt.value === option.value) || null;
        setFromToken(token);
        setToToken(token);
        setAmount('');
        setBalance('');
        setError('');
    };

    const handleSelectToToken = (option: SelectOption) => {
        if (option.value === 'PC') {
            setToToken(PC_TOKEN_OPTION);
            return;
        }

        const token =
            toTokenOptions.find((opt) => opt.value === option.value) || null;
        setToToken(token);
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
            return;
        }

        setError('');
    };

    const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const next = e.target.value;
        setAddress(next);
        setUserEnteredAddress(next.length > 0);
        setAddressError(validateAddressForChain(next, toChain?.value));
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

            const sendPushTransfer = async () => {
                const txnRes = await pushChainClient.universal.sendTransaction(
                    toToken.value === 'PC'
                        ? {
                              to: address as `0x${string}`,
                              value: parsedPcAmount,
                          }
                        : {
                              to: address as `0x${string}`,
                              funds: {
                                  amount: parsedInputAmount,
                                  token: fromToken.token,
                              },
                          },
                );

                setTxnHash(txnRes.hash);
                sourceTxHash = txnRes.hash;
                destinationTxHash = txnRes.hash;
            };

            const sendExternalDirectTransfer = async (sourceChain: CHAIN) => {
                if (isExternalNativeLikeToken(fromToken.token)) {
                    const txnRes = await pushChainClient.universal.sendTransaction({
                        to: {
                            address: address as `0x${string}`,
                            chain: sourceChain,
                        },
                        value: parsedInputAmount,
                    });

                    setTxnHash(txnRes.hash);
                    sourceTxHash = txnRes.hash;
                    destinationTxHash = txnRes.hash;
                    return;
                }

                const txnRes = await pushChainClient.universal.sendTransaction({
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

                setTxnHash(txnRes.hash);
                sourceTxHash = txnRes.hash;
                destinationTxHash = txnRes.hash;
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
                    transactions: swapTransactions,
                    outgoingToken,
                    outgoingAmount,
                } = await buildSwapAndResolveOutgoingToken({
                    tokenIn: fromToken,
                    destinationChain: toChain.value as CHAIN,
                });

                if (swapTransactions.length === 0) {
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

                    setTxnHash(txnRes.hash);
                    sourceTxHash = txnRes.hash;
                    destinationTxHash = txnRes.hash;
                    return;
                }

                const bridgeOutTx = await buildBridgeOutTx({
                    token: outgoingToken,
                    bridgeAmount: outgoingAmount,
                    destinationChain: toChain.value as CHAIN,
                });
                const txnRes = await pushChainClient.universal.executeTransactions([
                    ...swapTransactions,
                    bridgeOutTx,
                ]);
                const { finalTxHash } = await resolveCascadeFinalHash(txnRes);

                setTxnHash(finalTxHash);
                sourceTxHash = txnRes.initialTxHash;
                destinationTxHash = finalTxHash;
            };

            const sendExternalToExternal = async () => {
                const bridgeInTx = await pushChainClient.universal.prepareTransaction({
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

            if (sourceType === 'UOA' && isToPushChain) {
                // Case 1: Connected chain A -> Push.
                await sendPushTransfer();
            } else if (sourceType === 'UOA' && isSameChain) {
                // Case 2: Connected chain A -> same chain A.
                await sendExternalDirectTransfer(fromChain.value as CHAIN);
            } else if (sourceType === 'UOA') {
                // Case 3: Connected chain A -> another external chain.
                await sendExternalToExternal();
            } else if (sourceType === 'UEA' && isToPushChain) {
                // Case 4: Push UEA -> Push.
                await sendPushTransfer();
            } else if (sourceType === 'UEA') {
                // Cases 5/6: Push UEA -> connected chain A / other external chain.
                await sendPushToExternal();
            } else if (sourceType === 'CEA' && isToPushChain) {
                // Case 7: Other chain CEA -> Push.
                await sendPushTransfer();
            } else if (sourceType === 'CEA' && isSameChain) {
                // Case 8: Other chain CEA -> same external chain.
                await sendExternalDirectTransfer(fromChain.value as CHAIN);
            } else {
                // Case 9: Other chain CEA -> connected chain A / another external chain.
                await sendExternalToExternal();
            }

            const end = performance.now();
            setTxnDuration(
                Math.round((end - (startRef.current ?? end)) / 1000),
            );
            startRef.current = null;

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
            }
        } catch (err) {
            console.error('Error in bridging:', err);
            const message =
                err instanceof Error
                    ? err.message
                    : 'Transaction failed. Please try again.';
            setError(message || 'Transaction failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleClick = async () => {
        if (!pushChainClient) {
            handleConnectToPushWallet();
            return;
        }

        await handleBridge();
    };

    useEffect(() => {
        const chains = PushChain.utils.chains.getSupportedChains(
            PushUI.CONSTANTS.PUSH_NETWORK.TESTNET,
        ).chains;
        const options = chains.map((chain) => ({
            label: enumKeyToDisplay(
                PushChain.utils.chains.getChainName(chain) || '',
            ),
            value: chain,
            icon: Object.keys(chainsIconList).includes(chain)
                ? chainsIconList[chain]
                : undefined,
        }));

        setSupportedChainsList(options);
    }, [PushChain.utils.chains]);

    useEffect(() => {
        if (!pushChainClient) {
            setFromChain(null);
            setToChain(null);
            setFromToken(null);
            setToToken(null);
            setAddress('');
            setBalance('');
            return;
        }

        if (!userSelectedFromChain) {
            const originChain = pushChainClient.universal.origin.chain;
            setFromChain({
                label: enumKeyToDisplay(
                    PushChain.utils.chains.getChainName(originChain) || '',
                ),
                value: originChain,
                icon: Object.keys(chainsIconList).includes(originChain)
                    ? chainsIconList[originChain]
                    : undefined,
            });
        }

        if (!userSelectedToChain && supportedChainsList.length) {
            const defaultToChain =
                supportedChainsList.find(
                    (chain) =>
                        chain.value === PUSH_CHAIN &&
                        chain.value !== pushChainClient.universal.origin.chain,
                ) ||
                supportedChainsList.find(
                    (chain) =>
                        chain.value !== pushChainClient.universal.origin.chain,
                ) ||
                null;
            setToChain(defaultToChain);
        }
    }, [
        PushChain.utils.chains,
        pushChainClient,
        supportedChainsList,
        userSelectedFromChain,
        userSelectedToChain,
    ]);

    useEffect(() => {
        if (!fromChain) return;

        const tokens = PushChain.utils.tokens.getMoveableTokens(
            fromChain.value as CHAIN,
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
        setFromToken(options[0] || null);
        setToToken(options[0] || null);
    }, [PushChain.utils.tokens, fromChain]);

    useEffect(() => {
        if (!fromToken) {
            setToToken(null);
            return;
        }

        if (!toTokenOptions.some((option) => option.value === toToken?.value)) {
            setToToken(toTokenOptions[0] || null);
        }
    }, [fromToken, toToken?.value, toTokenOptions]);

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
                    if (fromToken.token.mechanism === 'native') {
                        nextBalance = await fetchNativeTokenBalance({
                            wallet,
                            token: fromToken.token,
                        });
                    } else if (pushChainClient.universal.origin.chain === fromChain.value) {
                        nextBalance = await fetchSplTokenBalance({
                            owner: wallet.address,
                            mint: fromToken.token.address,
                        });
                    } else {
						const cea = await getCEAAddress(pushChainClient.universal.origin, fromChain.value as CHAIN);
						nextBalance = await fetchSplTokenBalance({
							owner: cea,
							mint: fromToken.token.address,
						});
					}
                } else if (getChainNamespace(fromChain.value) === 'eip155') {
					if (pushChainClient.universal.origin.chain === fromChain.value) {
						if (fromToken.token.mechanism === 'native') {
							nextBalance = await fetchNativeTokenBalance({
								wallet,
								token: fromToken.token,
							});
						} else {
							nextBalance = await fetchErc20TokenBalance({
								wallet,
								token: fromToken.token,
							});
						}
					} else {
						const cea = await getCEAAddress(pushChainClient.universal.origin, fromChain.value as CHAIN);
						if (fromToken.token.mechanism === 'native') {
							nextBalance = await fetchNativeTokenBalance({
								wallet: {
									chain: fromChain.value as CHAIN,
									address: cea,
								},
								token: fromToken.token,
							});
						} else {
							nextBalance = await fetchErc20TokenBalance({
								wallet: {
									chain: fromChain.value as CHAIN,
									address: cea,
								},
								token: fromToken.token,
							});
						}
					}
                }
            } catch (fetchError) {
                console.error('Error fetching balance:', fetchError);
            }

            if (cancelled) return;

            setBalance(nextBalance);

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

        const populateAddress = async () => {
            if (!pushChainClient || !toChain?.value || userEnteredAddress)
                return;

            const uoa = pushChainClient.universal.origin;

            if (toChain.value === PUSH_CHAIN) {
                setAddress(pushChainClient.universal.account);
                return;
            }

            if (toChain.value === uoa.chain) {
                setAddress(uoa.address);
                return;
            }

            try {
                const cea = await getCEAAddress(uoa, toChain.value as CHAIN);
                if (!cancelled) setAddress(cea);
            } catch (ceaError) {
                console.error('Failed to derive CEA address:', ceaError);
                if (!cancelled) setAddress('');
            }
        };

        populateAddress();

        return () => {
            cancelled = true;
        };
    }, [pushChainClient, toChain?.value, userEnteredAddress]);

    useEffect(() => {
        setAddressError(validateAddressForChain(address, toChain?.value));
    }, [address, toChain?.value, validateAddressForChain]);

    const disabled = useMemo(() => {
        if (!pushChainClient) return false;
        return !!validateBridgeForm();
    }, [pushChainClient, validateBridgeForm]);

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
                    chain={toChain.value}
                    amount={amount}
                    token={fromToken.token}
                    duration={txnDuration || 0}
                    txnHash={txnHash}
                    handleBack={() => {
                        setTxnHash('');
                        setAmount('');
                        setTxnDuration(null);
                        setError('');
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
                                    options={supportedChainsList}
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

                        <Box
                            display="flex"
                            gap="spacing-xxs"
                            alignItems={{ initial: 'center', tb: 'flex-start' }}
                            flexDirection={{ initial: 'row', tb: 'column' }}
                            margin="spacing-none spacing-none spacing-xs spacing-none"
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
                                    Address
                                </Text>
                            </Box>
                            <Box
                                width={{
                                    initial: 'calc(100% - 72px)',
                                    tb: '100%',
                                }}
                            >
                                <TextInput
                                    onChange={handleAddressChange}
                                    placeholder="Enter Address"
                                    value={address}
                                />
                                {addressError ? (
                                    <Box
                                        position="absolute"
                                        margin="spacing-none spacing-xs"
                                    >
                                        <Text
                                            variant="bes-regular"
                                            color="text-state-danger-subtle"
                                        >
                                            {addressError}
                                        </Text>
                                    </Box>
                                ) : null}
                            </Box>
                        </Box>

                        <QuoteSummary
                            token={fromToken?.token}
                            amount={amount}
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
