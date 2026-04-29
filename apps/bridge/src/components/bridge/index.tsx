import { usePushChain, PushUI, usePushChainClient, usePushWalletContext } from '@pushchain/ui-kit';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, TextInput, Button, IconProps, Wallet, IllustrationProps, css } from 'shared-components';
import { enumKeyToDisplay, fetchErc20TokenBalance, fetchNativeTokenBalance, fetchPrc20TokenBalance, fetchSplTokenBalance, getCEAAddress, swapPushTokens } from '../../common/utils';
import Divider from './Divider';
import { CHAIN } from '@pushchain/core/src/lib/constants/enums';
import { MoveableToken } from '@pushchain/core/src/lib/constants';
import { isAddress } from 'viem';
import { PublicKey } from '@solana/web3.js';
import QuoteSummary from './Summary';
import TermsConsent from './TermsConsent';
import Select, { SelectOption } from '../../common/components/Select';
import { chainsIconList, TOKENS, tokensIconList } from '../../common/constants';
import Success from './Success';
import { sendBridgeEvent, createBridgeEventPayload } from '../../services/bridgeApi';

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

const Bridge = () => {
    const [amount, setAmount] = useState('');
    const [balance, setBalance] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [addressError, setAddressError] = useState('');
    const [address, setAddress] = useState('');
    const [fromChain, setFromChain] = useState<ChainOptions | null>(null);
    const [toChain, setToChain] = useState<ChainOptions | null>(null);
    const [supportedChainsList, setSupportedChainsList] = useState<ChainOptions[]>([]);
    const [fromToken, setFromToken] = useState<TokenOptions | null>(null);
    const [toToken, setToToken] = useState<TokenOptions | null>(null);
    const [movableTokensList, setMovableTokensList] = useState<TokenOptions[]>([]);
    const [txnHash, setTxnHash] = useState('');
    const [txnDuration, setTxnDuration] = useState<number | null>(null);
        const startRef = useRef<number | null>(null);

    const { PushChain } = usePushChain();
    const { pushChainClient } = usePushChainClient();
    const { handleConnectToPushWallet } = usePushWalletContext();

    const buttonText = useMemo(() => {
        if (!pushChainClient) return 'Connect Wallet';
        return 'Confirm Transaction';
    }, [pushChainClient, fromChain]);

    const handleSelectFromChain = (option: SelectOption) => {
        const chain = supportedChainsList.find((opt) => opt.value === option.value) || null;
        setFromChain(chain);
    };

    const handleSelectTOChain = (option: SelectOption) => {
        const chain = supportedChainsList.find((opt) => opt.value === option.value) || null;
        setToChain(chain);
        if (!pushChainClient) return;
    };

    const handleSelectToken = (option: SelectOption) => {
        const token = movableTokensList.find((opt) => opt.value === option.value) || null;
        setFromToken(token);
        setToToken(token);
    };

    const handleSelectToToken = (option: SelectOption) => {
        if (option.value === 'PC') {
            setToToken({value: 'PC', label: 'PC', token: {
                symbol: 'PC',
                decimals: 18,
                address: '',
                mechanism: 'approve'
            }});
            return;
        }
        const token = movableTokensList.find((opt) => opt.value === option.value) || null;
        setToToken(token);
    };

    const handleSwap = () => {
        const tempFromChain = fromChain;
        setFromChain(toChain);
        setToChain(tempFromChain);
    };

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value;
        const DECIMAL = /^\d*(?:\.\d*)?$/;
        if (v === "" || DECIMAL.test(v)) {
            setError('');
            setAmount(v);
        }
        if (balance !== '' && v > balance) {
            setError('Insufficient balance');
        } else {
            setError('');
        }
    }

    const getChainNamespace = (chainValue?: string): string => {
        if (!chainValue) return '';
        return chainValue.split(':')[0] || '';
    };

    const validateAddressForChain = (addr: string, chainValue?: string): string => {
        const trimmed = addr.trim();
        if (!trimmed) return '';

        const ns = getChainNamespace(chainValue);

        if (ns === 'solana') {
            try {
                const _pk = new PublicKey(trimmed);
                void _pk;
                return '';
            } catch {
                return 'Invalid Solana address for selected destination chain.';
            }
        }

        if (ns === 'eip155') {
            return isAddress(trimmed) ? '' : 'Invalid EVM address for selected destination chain.';
        }
        return '';
    };

    const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const next = e.target.value;
        setAddress(next);
        setAddressError(validateAddressForChain(next, toChain?.value));
    };

    const handleBridge = async () => {
        if (!pushChainClient || !fromToken || !fromChain || !address) return;

        const nextAddressError = validateAddressForChain(address, toChain?.value);
        if (nextAddressError) {
            setAddressError(nextAddressError);
            return;
        }

        if (!amount) {
            setError('Amount cannot be empty.');
            return;
        }
        setError('');
        setLoading(true);
        setTxnDuration(null);

        startRef.current = performance.now();
        setTxnDuration(null);

        try {
            let sourceTxHash: string | undefined;

            if (toChain?.value === CHAIN.PUSH_TESTNET_DONUT && toToken?.value === "PC") {
                const txnRes = await pushChainClient.universal.sendTransaction({
                    to: address as `0x${string}`,
                    value: PushChain.utils.helpers.parseUnits(amount, 18)
                });
                setTxnHash(txnRes.hash);
                sourceTxHash = txnRes.hash;
            } else if (toChain?.value === CHAIN.PUSH_TESTNET_DONUT) {
                const txnRes = await pushChainClient.universal.sendTransaction({
                    to: address as `0x${string}`,
                    funds: {
                        amount: PushChain.utils.helpers.parseUnits(amount, fromToken.token.decimals),
                        token: fromToken.token,
                    }
                });
                setTxnHash(txnRes.hash);
                sourceTxHash = txnRes.hash;
            }
            else if (fromChain?.value === CHAIN.PUSH_TESTNET_DONUT && toChain?.value !== CHAIN.PUSH_TESTNET_DONUT) {
                let outgoingToken = fromToken.token;

                const tokenInDetails = TOKENS.find((t) => t.address === fromToken.token.address);
                if (tokenInDetails?.address) {
                    const destinationChainName = (() => {
                        if (toChain?.value === CHAIN.ETHEREUM_SEPOLIA) return 'eth';
                        if (toChain?.value === CHAIN.BASE_SEPOLIA) return 'base';
                        if (toChain?.value === CHAIN.ARBITRUM_SEPOLIA) return 'arb';
                        if (toChain?.value === CHAIN.BNB_TESTNET) return 'bsc';
                        if (toChain?.value === CHAIN.SOLANA_DEVNET) return 'sol';
                        return '';
                    })();

                    const tokenFamily = tokenInDetails.symbol.split('_')[0] || tokenInDetails.symbol;
                    const tokenOutDetails = destinationChainName
                        ? TOKENS.find((t) => (t.symbol.split('_')[0] || t.symbol) === tokenFamily && t.chainName === destinationChainName)
                        : undefined;

                    if (tokenOutDetails?.address && tokenOutDetails.address !== tokenInDetails.address) {

                        const txn = await swapPushTokens({
                            pushChainClient,
                            tokenIn: tokenInDetails.address,
                            tokenOut: tokenOutDetails.address,
                            amountIn: PushChain.utils.helpers.parseUnits(amount, fromToken.token.decimals),
                        });

                        console.log(txn);

                        const tokenOption = movableTokensList.find((t) => t.token.address === tokenOutDetails.address) ?? null;
                        if (tokenOption?.token) {
                            outgoingToken = tokenOption.token;
                        }
                    }
                }

                const txnRes = await pushChainClient.universal.sendTransaction({
                    to: {
                        address: address as `0x${string}`,
                        chain: toChain?.value as CHAIN,
                    },
                    funds: {
                        amount: PushChain.utils.helpers.parseUnits(amount, fromToken.token.decimals),
                        token: outgoingToken,
                    }
                });
                setTxnHash(txnRes.hash);
                console.log(txnRes);
                sourceTxHash = txnRes.hash;
            }
            // else {
            //     // Case 4: Other chain to other chain via Push Chain UEA
            //     // Step 1: Send from source chain to Push Chain UEA address
            //     const preparedTx1 = await pushChainClient.universal.prepareTransaction({
            //         to: pushChainClient.universal.account as `0x${string}`,
            //         funds: {
            //             amount: PushChain.utils.helpers.parseUnits(amount, fromToken.token.decimals),
            //             token: fromToken.token,
            //         }
            //     });
                
            //     // Step 2: Swap from Push Chain to destination chain
            //     const preparedTx2 = await pushChainClient.universal.prepareTransaction({
            //         to: {
            //             address: address as `0x${string}`,
            //             chain: toChain?.value as CHAIN,
            //         },
            //         funds: {
            //             amount: PushChain.utils.helpers.parseUnits(amount, fromToken.token.decimals),
            //             token: fromToken.token,
            //         }
            //     });
                
            //     const res = await pushChainClient.universal.executeTransactions([preparedTx1, preparedTx2]);
            //     setTxnHash(res.initialTxHash);
            //     sourceTxHash = res.initialTxHash;
            // }

            const end = performance.now();
            setTxnDuration(Math.round((end - startRef.current) / 1000));
            startRef.current = null;

            try {
                const amountBaseUnits = PushChain.utils.helpers.parseUnits(amount, fromToken.token.decimals).toString();

                const completedEvent = createBridgeEventPayload({
                    status: 'COMPLETED',
                    fromAddress: pushChainClient.universal.origin.address,
                    fromChain: fromChain,
                    fromTokenSymbol: fromToken.token.symbol,
                    toAddress: address,
                    toChain: toChain ?? undefined,
                    toTokenSymbol: toToken?.token.symbol || fromToken.token.symbol,
                    amount: amountBaseUnits,
                    decimals: fromToken.token.decimals,
                    sourceTxHash: sourceTxHash,
                    destinationTxHash: sourceTxHash,
                    ueaWallet: pushChainClient.universal.account,
                });

                await sendBridgeEvent(completedEvent);
            } catch (apiError) {
                console.error('Failed to send COMPLETED bridge event:', apiError);
            }

        } catch (error) {
            console.log('Error in bridging:', error);
            setError('Transaction failed. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    const handleClick = async () => {
        if (!pushChainClient) handleConnectToPushWallet();
        handleBridge();
    }

    useEffect(() => {
        const handleFetchBalance = async () => {
            if (!pushChainClient || !fromToken || !fromChain) {
                setBalance('');
                return;
            };

            const wallet = pushChainClient.universal.origin;
            const ns = wallet.chain.split(":")[0];

            let balance = '0';

            try {
                if (ns === "solana") {
                    if (fromToken.token.mechanism === "native") {
                        balance = await fetchNativeTokenBalance({ wallet, token: fromToken.token });
                    } else if (fromChain.value === CHAIN.PUSH_TESTNET_DONUT) {
                        balance = await fetchPrc20TokenBalance({
                            walletAddress: pushChainClient.universal.account,
                            tokenAddress: fromToken.token.address as `0x${string}`,
                            decimals: fromToken.token.decimals,
                        });
                    } else {
                        balance = await fetchSplTokenBalance({
                            owner: wallet.address,
                            mint: fromToken.token.address,
                        });
                    }
                }

                if (ns === "eip155") {
                    if (fromToken.token.mechanism === "native") {
                        balance = await fetchNativeTokenBalance({ wallet, token: fromToken.token });
                    } else if (fromChain.value === CHAIN.PUSH_TESTNET_DONUT) {
                        balance = await fetchPrc20TokenBalance({
                            walletAddress: pushChainClient.universal.account,
                            tokenAddress: fromToken.token.address as `0x${string}`,
                            decimals: fromToken.token.decimals,
                        });
                    } else {
                        balance = await fetchErc20TokenBalance({
                            wallet,
                            token: fromToken.token,
                        });
                    }
                }

            } catch (error) {
                console.error("Error fetching balance:", error);
            }

            setBalance(balance);

            if (balance !== '' && amount && amount > balance) {
                setError('Insufficient balance');
            } else {
                setError('');
            }
        };
        handleFetchBalance();
        const interval = setInterval(() => {
            handleFetchBalance();
        }, 10_000);

        return () => clearInterval(interval);
    }, [pushChainClient, fromToken]);

    useEffect(() => {
        const chains = PushChain.utils.chains.getSupportedChains(PushUI.CONSTANTS.PUSH_NETWORK.TESTNET).chains;
        const options = chains.map((chain) => ({
            label: enumKeyToDisplay(PushChain.utils.chains.getChainName(chain) || ''),
            value: chain,
            icon: Object.keys(chainsIconList).includes(chain) ? chainsIconList[chain] : undefined,
        }));
        setSupportedChainsList(options);
        if (!pushChainClient) setFromChain(null);
    }, []);

    useEffect(() => {
        if (!fromChain) return;

        const tokens = PushChain.utils.tokens.getMoveableTokens(fromChain.value as CHAIN).tokens;
        const options = tokens.map((token) => {
            if (TOKENS.map(t => t.address).includes(token.address)) {
                const tokenDetails = TOKENS.find(t => t.address === token.address);
                return {
                    label: tokenDetails?.symbol || token.symbol,
                    displayName: tokenDetails?.name || token.symbol,
                    value: token.address,
                    token: token,
                    icon: Object.keys(tokensIconList).includes(tokenDetails?.logoKey || '') ? tokensIconList[tokenDetails?.logoKey || ''] : undefined,
                    badge: tokensIconList['PC'],
                }
            }
            return {
                label: token.symbol,
                value: token.address,
                token: token,
                icon: Object.keys(tokensIconList).includes(token.symbol) ? tokensIconList[token.symbol] : undefined
            };
        });

        setMovableTokensList(options);
        setFromToken(options[0] || null);
        setToToken(options[0] || null);
    }, [fromChain]);

    useEffect(() => {
        if (pushChainClient) {
            setAddress(pushChainClient.universal.account);
            const chain = pushChainClient.universal.origin.chain;
            setFromChain({
                label: enumKeyToDisplay(PushChain.utils.chains.getChainName(chain) || ''),
                value: chain,
                icon: Object.keys(chainsIconList).includes(chain) ? chainsIconList[chain] : undefined,
            });
            setToChain(supportedChainsList.find((chain) => chain.value === CHAIN.PUSH_TESTNET_DONUT) || null);
        }
    }, [pushChainClient]);

    useEffect(() => {
        if (!pushChainClient || !toChain?.value) return;

        const uoa = pushChainClient.universal.origin;

        if (toChain.value === CHAIN.PUSH_TESTNET_DONUT) {
            setAddress(pushChainClient.universal.account);
        } else if (toChain.value === uoa.chain) {
            setAddress(uoa.address);
        } else {
            getCEAAddress(uoa, toChain.value as CHAIN).then((cea) => {
                setAddress(cea);
            });
        }
    }, [pushChainClient, toChain?.value]);

    useEffect(() => {
        setAddressError(validateAddressForChain(address, toChain?.value));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [toChain]);

    return (
        <Box
            display='flex'
            flexDirection='column' 
            justifyContent='center' 
            alignItems='center' 
            gap='spacing-md'
            css={css`
                width: 500px;
                @media (max-width: 768px) {
                    width: 100%;
                    max-width: 500px;
                }
            `}
        >
            {(txnHash && fromToken && fromChain && toChain) ? (
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
                    }}
                />
            ) : (
                <Box
                    display='flex'
                    flexDirection='column'
                    padding='spacing-lg'
                    gap='spacing-xl'
                    borderRadius='radius-md'
                    border='border-sm solid stroke-secondary'
                    backgroundColor='surface-primary'
                    css={css`
                        width: 100%;
                        @media (max-width: 768px) {
                            width: calc(100% - 68px);
                            max-width: 
                        }
                    `}
                >
                    <Box display='flex' flexDirection='column' gap='spacing-md'>
                        <Box
                            display='flex'
                            gap='spacing-xxs'
                            alignItems={{ initial: 'center', tb: 'flex-start'}}
                            flexDirection={{ initial: 'row', tb: 'column'}}
                        >
                            <Box
                                width='64px'
                                display='flex'
                                justifyContent={{ initial: 'center', tb: 'flex-start'}}
                            >
                                <Text variant='bm-regular' color='text-secondary'>Send</Text>
                            </Box>
                            <Box width={{initial: 'calc(100% - 72px)', tb: '100%'}} position='relative'>
                                <Box
                                    display='flex'
                                    flexDirection='column'
                                    borderRadius='radius-xs'
                                    border='border-xmd solid stroke-secondary'
                                    backgroundColor='surface-secondary'
                                    padding='spacing-xs'
                                    gap='spacing-xs'
                                    css={css`
                                        &:hover {
                                            border-color: var(--stroke-tertiary);
                                        }
                                        &:focus-within {
                                            border-color: var(--stroke-brand-bold);
                                            outline: none;
                                        }
                                    `}
                                >
                                    <Box display='flex' gap='spacing-xs' alignItems='center'>
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
                                                placeholder='0'
                                                value={amount}
                                            />
                                        </Box>
                                        <Box width="30%" display={{ initial: 'block', tb: 'none'}}>
                                            <Select
                                                onChange={handleSelectToken} 
                                                selected={fromToken} 
                                                options={movableTokensList}
                                            />
                                        </Box>
                                    </Box>
                                    <Box display='flex' gap='spacing-xxs' alignItems='center' height='24px' justifyContent='flex-end'>
                                        <Text variant='bs-regular' color='text-tertiary'>{Number(balance).toFixed(1)}</Text>
                                        <Wallet size={18} color='icon-tertiary' style={{ width: '16px', color: 'var(--icon-tertiary)' }} />
                                        <Box
                                            display='flex'
                                            alignItems='center'
                                            height='100%'
                                            padding='spacing-none spacing-xxs'
                                            borderRadius='radius-xxs'
                                            cursor='pointer'
                                            border='border-sm solid stroke-tertiary'
                                            onClick={() => setAmount(balance)}
                                        >
                                            <Text
                                                variant='ol-regular'
                                                color='text-secondary'
                                                css={css`
                                                    :hover {
                                                        color: var(--text-tertiary);
                                                    }
                                                `}
                                            >
                                                Max
                                            </Text>
                                        </Box>
                                    </Box>
                                </Box>
                                <Box position='absolute' margin='spacing-none spacing-xs'>
                                    <Text variant='bes-regular' color='text-state-danger-subtle'>
                                        {error}
                                    </Text>
                                </Box>
                            </Box>
                            <Box width="100%" display={{ initial: 'none', tb: 'block'}}>
                                <Select
                                    onChange={handleSelectToken} 
                                    selected={fromToken} 
                                    options={movableTokensList}
                                    placeholder='Select Token'
                                    disabled={!fromChain}
                                />
                            </Box>
                        </Box>
                        <Box
                            key='from'
                            display='flex'
                            gap='spacing-xxs'
                            alignItems={{ initial: 'center', tb: 'flex-start'}}
                            flexDirection={{ initial: 'row', tb: 'column'}}
                            css={css`
                                transition: all 0.3s ease;
                            `}
                        >
                            <Box
                                width='64px'
                                display='flex'
                                justifyContent={{ initial: 'center', tb: 'flex-start'}}
                            >
                                <Text variant='bm-regular' color='text-secondary'>From</Text>
                            </Box>
                            <Box width={{initial: 'calc(100% - 72px)', tb: '100%'}}>
                                <Select 
                                    onChange={handleSelectFromChain} 
                                    selected={fromChain} 
                                    options={supportedChainsList}
                                    // disabled={!!pushChainClient && !!fromChain}
                                    placeholder='Select Chain'
                                />
                            </Box>  
                        </Box>
                        <Divider onSwap={handleSwap} />
                        <Box
                            key='to'
                            display='flex'
                            gap='spacing-xxs'
                            alignItems={{ initial: 'center', tb: 'flex-start'}}
                            flexDirection={{ initial: 'row', tb: 'column'}}
                            css={css`
                                transition: all 0.3s ease;
                            `}
                        >
                            <Box
                                width='64px'
                                display='flex'
                                justifyContent={{ initial: 'center', tb: 'flex-start'}}
                            >
                                <Text variant='bm-regular' color='text-secondary'>To</Text>
                            </Box>
                            <Box width={{initial: '60%', tb: '100%'}}>
                                <Select 
                                    onChange={handleSelectTOChain} 
                                    selected={toChain} 
                                    options={supportedChainsList.filter((chain) => {
                                        if (fromChain?.value !== CHAIN.PUSH_TESTNET_DONUT) {
                                            return chain.value === CHAIN.PUSH_TESTNET_DONUT;
                                        }
                                        return true;
                                    })}
                                    // disabled={!!pushChainClient && !!fromChain}
                                    placeholder='Select Chain'
                                />
                            </Box>
                            <Box width={{initial: 'calc(40% - 72px)', tb: '100%'}}>
                                <Select 
                                    disabled={fromToken?.token.symbol !== "ETH"}
                                    selected={toToken} 
                                    options={fromToken?.token.symbol === "ETH" ? [fromToken!, {label: 'PC', value: 'PC'}] : []}
                                    placeholder='Select Token'
                                    onChange={handleSelectToToken}
                                />
                            </Box>
                        </Box>   
                        {(
                            <Box
                                display='flex'
                                gap='spacing-xxs'
                                alignItems={{ initial: 'center', tb: 'flex-start'}}
                                flexDirection={{ initial: 'row', tb: 'column'}}
                                margin='spacing-none spacing-none spacing-xs spacing-none'
                            >
                                <Box
                                    width='64px'
                                    display='flex'
                                    justifyContent={{ initial: 'center', tb: 'flex-start'}}
                                >
                                    <Text variant='bm-regular' color='text-secondary'>Address</Text>
                                </Box>
                                <Box width={{initial: 'calc(100% - 72px)', tb: '100%'}}>
                                    <TextInput
                                        onChange={handleAddressChange}
                                        placeholder='Enter Address'
                                        value={address}
                                    />
                                    {addressError ? (
                                        <Box position='absolute' margin='spacing-none spacing-xs'>
                                            <Text variant='bes-regular' color='text-state-danger-subtle'>
                                                {addressError}
                                            </Text>
                                        </Box>
                                    ) : null}
                                </Box>
                            </Box>
                        )}
                        <QuoteSummary token={fromToken?.token} amount={amount} />
                        <Button
                            loading={loading}
                            onClick={handleClick}
                            disabled={!!pushChainClient && (!address || !!addressError)}
                        >
                            {buttonText}
                        </Button>
                        {pushChainClient && (pushChainClient.universal.origin.chain !== fromChain?.value && fromChain?.value !== PushChain.CONSTANTS.CHAIN.PUSH_TESTNET_DONUT) && (
                            <Text variant='bes-regular' color='text-tertiary'>
                                You’re currently connected to <strong>{enumKeyToDisplay(PushChain.utils.chains.getChainName(pushChainClient.universal.origin.chain) || '')}</strong>. 
                                To proceed with this transaction, you’ll need to switch your wallet to <strong>{fromChain?.label}</strong>.
                            </Text>
                        )}
                    </Box>
                </Box>
            )}
            <TermsConsent />
        </Box>
    );
}

export default Bridge;