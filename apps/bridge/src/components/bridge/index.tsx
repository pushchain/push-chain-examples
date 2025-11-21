import { usePushChain, PushUI, usePushChainClient, usePushWalletContext } from '@pushchain/ui-kit';
import { useEffect, useState } from 'react';
import { Box, Text, TextInput, Button, PushMonotone, IconProps, Wallet, css, IllustrationProps } from 'shared-components';
import { enumKeyToDisplay, fetchTokenBalance } from '../../common/utils';
import Divider from './Divider';
import { CHAIN } from '@pushchain/core/src/lib/constants/enums';
import { MoveableToken } from '@pushchain/core/src/lib/constants';
import QuoteSummary from './Summary';
import TermsConsent from './TermsConsent';
import Select, { SelectOption } from '../../common/components/Select';
import { chainsIconList, tokensIconList } from '../../common/constants';
import Success from './Success';

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

    const { PushChain } = usePushChain();
    const { pushChainClient } = usePushChainClient();
    const { handleConnectToPushWallet } = usePushWalletContext();

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

        const start = performance.now();
    
        try {
            const txnRes = await pushChainClient.universal.sendTransaction({
                to: address as `0x${string}`,
                funds: {
                    amount: PushChain.utils.helpers.parseUnits(amount, selectedToken.token.decimals),
                    token: selectedToken.token,
                }
            });

            const end = performance.now();
            const durationSec = (end - start) / 1000;
            setTxnDuration(Math.round(durationSec));
            setTxnHash(txnRes.hash);
        } catch (error) {
            console.log('Error in bridging:', error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        const handleFetchBalance = async () => {
            if (pushChainClient && selectedToken) {
                console.log(pushChainClient.universal.origin.address, selectedToken);
                const tokenBalance = await fetchTokenBalance({
                    walletAddress: pushChainClient.universal.origin.address as `0x${string}`,
                    tokenAddress: selectedToken.token.address as `0x${string}`,
                    decimals: selectedToken.token.decimals,
                })
                console.log(tokenBalance);
                setBalance(tokenBalance);
            }
        };
        handleFetchBalance();
    }, [pushChainClient, selectedToken])

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
        if (selectedChain) {
            const tokens = PushChain.utils.tokens.getMoveableTokens(selectedChain.value as CHAIN).tokens;
            const options = tokens.map((token) => ({
                label: token.symbol,
                value: token.address,
                decimals: token.decimals,
                token: token,
                icon: Object.keys(tokensIconList).includes(token.symbol) ? tokensIconList[token.symbol] : undefined
            }));
            setMovableTokensList(options);
            setSelectedToken(options[0] || null);
        }
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
                                        <Wallet height={16} color='icon-secondary' />
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