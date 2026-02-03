import { usePushChain, PushUI, usePushChainClient, usePushWalletContext } from '@pushchain/ui-kit';
import { useEffect, useRef, useState } from 'react';
import { Box, Text, TextInput, Button, PushMonotone, IconProps, Wallet, css, IllustrationProps } from 'shared-components';
import { enumKeyToDisplay, fetchErc20TokenBalance, fetchNativeTokenBalance, fetchSplTokenBalance } from '../../common/utils';
import Divider from './Divider';
import { CHAIN } from '@pushchain/core/src/lib/constants/enums';
import { MoveableToken } from '@pushchain/core/src/lib/constants';
import QuoteSummary from './Summary';
import TermsConsent from './TermsConsent';
import Select, { SelectOption } from '../../common/components/Select';
import { chainsIconList, tokensIconList } from '../../common/constants';
import Success from './Success';
import { PROGRESS_HOOK } from '@pushchain/core/src/lib/progress-hook/progress-hook.types';

export type ChainOptions = {
  icon?: React.FC<IconProps>;
  label: string;
  value: string;
};

export type TokenOptions = {
  icon?: React.FC<IllustrationProps>;
  label: string;
  value: string;
  token: MoveableToken;
};

const Bridge = () => {
    const [amount, setAmount] = useState('');
    const [balance, setBalance] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [address, setAddress] = useState('');
    const [selectedChain, setSelectedChain] = useState<ChainOptions | null>(null);
    const [supportedChainsList, setSupportedChainsList] = useState<ChainOptions[]>([]);
    const [selectedToken, setSelectedToken] = useState<TokenOptions | null>(null);
    const [movableTokensList, setMovableTokensList] = useState<TokenOptions[]>([]);
    const [txnHash, setTxnHash] = useState('');
    const [txnDuration, setTxnDuration] = useState<number | null>(null);
    const startRef = useRef<number | null>(null);

    const { PushChain } = usePushChain();
    const { pushChainClient } = usePushChainClient();
    const { handleConnectToPushWallet, progress } = usePushWalletContext();

    const handleSelectChain = (option: SelectOption) => {
        const chain = supportedChainsList.find((opt) => opt.value === option.value) || null;
        setSelectedChain(chain);
    };

    const handleSelectToken = (option: SelectOption) => {
        const token = movableTokensList.find((opt) => opt.value === option.value) || null;
        setSelectedToken(token);
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

    const handleBridge = async () => {
        if (!pushChainClient || !selectedToken || !selectedChain || !address) return;
        if (!amount) {
            setError('Amount cannot be empty.');
            return;
        }
        setError('');
        setLoading(true);
        setTxnDuration(null);
    
        try {
            const txnRes = await pushChainClient.universal.sendTransaction({
                to: address as `0x${string}`,
                funds: {
                    amount: PushChain.utils.helpers.parseUnits(amount, selectedToken.token.decimals),
                    token: selectedToken.token,
                }
            });
            setTxnHash(txnRes.hash);
        } catch (error) {
            console.log('Error in bridging:', error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (!progress) return;
        if (progress.id === PROGRESS_HOOK.SEND_TX_06_02) {
            startRef.current = performance.now();
            setTxnDuration(null);
            return;
        }
        if (progress.id === PROGRESS_HOOK.SEND_TX_06_05 && startRef.current !== null) {
            const end = performance.now();
            setTxnDuration(Math.round((end - startRef.current) / 1000));
            startRef.current = null;
        }
    }, [progress]);

    useEffect(() => {
        const handleFetchBalance = async () => {
            if (!pushChainClient || !selectedToken || !selectedChain) {
                setBalance('');
                return;
            };

            const wallet = pushChainClient.universal.origin;
            const ns = wallet.chain.split(":")[0];

            let balance = '0';

            try {
                if (ns === "solana") {
                    if (selectedToken.token.mechanism === "native") {
                        balance = await fetchNativeTokenBalance({ wallet, token: selectedToken.token });
                    } else {
                        balance = await fetchSplTokenBalance({
                            owner: wallet.address,
                            mint: selectedToken.token.address,
                        });
                    }
                }

                if (ns === "eip155") {
                    if (selectedToken.token.mechanism === "native") {
                        balance = await fetchNativeTokenBalance({ wallet, token: selectedToken.token });
                    } else {
                        balance = await fetchErc20TokenBalance({
                            wallet,
                            token: selectedToken.token,
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
    }, [pushChainClient, selectedToken, selectedChain]);

    useEffect(() => {
        const chains = PushChain.utils.chains.getSupportedChains(PushUI.CONSTANTS.PUSH_NETWORK.TESTNET).chains;
        const options = chains.map((chain) => ({
            label: enumKeyToDisplay(PushChain.utils.chains.getChainName(chain) || ''),
            value: chain,
            icon: Object.keys(chainsIconList).includes(chain) ? chainsIconList[chain] : undefined,
        }));
        setSupportedChainsList(options);
        if (!pushChainClient) setSelectedChain(options[0] || null);
    }, []);

    useEffect(() => {
        if (!selectedChain) return;

        const tokens = PushChain.utils.tokens.getMoveableTokens(selectedChain.value as CHAIN).tokens;
        const options = tokens.map((token) => ({
            label: token.symbol,
            value: token.address,
            token: token,
            icon: Object.keys(tokensIconList).includes(token.symbol) ? tokensIconList[token.symbol] : undefined
        }));

        setMovableTokensList(options);
        setSelectedToken(options[0] || null);
    }, [selectedChain]);

    useEffect(() => {
        if (pushChainClient) {
            setAddress(pushChainClient.universal.account);
            const chain = pushChainClient.universal.origin.chain;
            setSelectedChain({
                label: enumKeyToDisplay(PushChain.utils.chains.getChainName(chain) || ''),
                value: chain,
                icon: Object.keys(chainsIconList).includes(chain) ? chainsIconList[chain] : undefined,
            })
        }
    }, [pushChainClient]);

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
            {(txnHash && selectedToken && selectedChain) ? (
                <Success
                    chain={selectedChain.value}
                    amount={amount}
                    token={selectedToken.token}
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
                            <Box width={{initial: '60%', tb: '100%'}} position='relative'>
                                <TextInput
                                    onChange={handleAmountChange}
                                    placeholder='Enter Amount'
                                    value={amount}
                                    trailingIcon={
                                        <Box display='flex' gap='spacing-xxs' alignItems='center' height='24px'>
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
                                    }
                                />
                                <Box position='absolute' margin='spacing-none spacing-xs'>
                                    <Text variant='bes-regular' color='text-state-danger-subtle'>
                                        {error}
                                    </Text>
                                </Box>
                            </Box>
                            <Box width={{initial: 'calc(40% - 72px)', tb: '100%'}}>
                                <Select
                                    onChange={handleSelectToken} 
                                    selected={selectedToken} 
                                    options={movableTokensList}
                                />
                            </Box>
                        </Box>
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
                                <Text variant='bm-regular' color='text-secondary'>From</Text>
                            </Box>
                            <Box width={{initial: 'calc(100% - 72px)', tb: '100%'}}>
                                <Select 
                                    onChange={handleSelectChain} 
                                    selected={selectedChain} 
                                    options={supportedChainsList}
                                    disabled={!!pushChainClient && !!selectedChain}
                                />
                            </Box>  
                        </Box>
                        <Divider />
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
                                <Text variant='bm-regular' color='text-secondary'>To</Text>
                            </Box>
                            <Box width={{initial: '60%', tb: '100%'}}>
                                <Box
                                    display='flex'
                                    borderRadius='radius-xs'
                                    border='border-xmd solid stroke-secondary'
                                    backgroundColor='surface-secondary'
                                    padding='spacing-xs'
                                >
                                    <Box display='flex' gap='spacing-xs' alignItems='center'>
                                        <PushMonotone size={24} />
                                        <Text variant='bm-regular' color='text-secondary'>
                                            Push Chain
                                        </Text>
                                    </Box>
                                </Box>
                            </Box>
                            <Box width={{initial: 'calc(40% - 72px)', tb: '100%'}}>
                                <Select 
                                    disabled 
                                    selected={selectedToken} 
                                    options={movableTokensList}
                                />
                            </Box>
                        </Box>   
                        {pushChainClient && (
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
                                        onChange={(e) => setAddress(e.target.value)}
                                        placeholder='Enter Address'
                                        value={address}
                                    />
                                    <Box position='absolute' margin='spacing-none spacing-xs'>
                                        <Text variant='bes-regular' color='text-tertiary'>
                                            Only Push Chain addresses are valid
                                        </Text>
                                    </Box>
                                </Box>
                            </Box>
                        )}
                        <QuoteSummary token={selectedToken?.token} amount={amount} />
                        <Button
                            loading={loading}
                            onClick={pushChainClient ? handleBridge : handleConnectToPushWallet}
                        >
                            {pushChainClient ? 'Confirm Transaction' : 'Connect Wallet'}
                        </Button>   
                    </Box>
                </Box>
            )}
            <TermsConsent />
        </Box>
    );
}

export default Bridge;