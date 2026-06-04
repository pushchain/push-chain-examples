import { MoveableToken } from "@pushchain/core/src/lib/constants";
import { CHAIN } from "@pushchain/core/src/lib/constants/enums";
import { ArrowUpRight, Box, Button, css, IconProps, PlusSquare, Text } from "shared-components";
import { chainsIconList } from "../../common/constants";
import { formatDuration, formatTxTime } from "../../common/utils";
import { usePushChainClient } from "@pushchain/ui-kit";

type SuccessProps = {
    fromToken: MoveableToken;
    fromAmount: string;
    fromChain?: string;
    toToken: MoveableToken;
    toAmount: string;
    toChain?: string;
    toChainLabel?: string;
    duration: number;
    txnHash: string;
    handleBack: () => void;
}

const Success: React.FC<SuccessProps> = ({
    fromChain,
    fromAmount,
    fromToken,
    toChain,
    toChainLabel,
    toAmount,
    toToken,
    duration,
    txnHash,
    handleBack,
}) => {
    const FromChainIcon = chainsIconList[fromChain || ''];
    const ToChainIcon = chainsIconList[toChain || ''];

    const { pushChainClient } = usePushChainClient();

    const time = formatTxTime(Date.now());  
    const explorerLabel =
        toChain && toChain !== CHAIN.PUSH_TESTNET_DONUT
            ? toChainLabel || 'Destination'
            : 'Push';
    const receivedAmount = toAmount || fromAmount;

    return (
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
                @media (max-width: 600px) {
                    width: calc(100% - 68px);
                }
            `}
        >
            <Box
                display='flex'
                gap='spacing-xxs'
                alignItems='center'
                justifyContent='center'
            >
                <IconWrapper Icon={FromChainIcon} />
                <Text display={{ ml: 'none' }} variant='h3-regular' color='text-brand-medium'>.......</Text>
                <img height={110} src="/Success.png" alt="Success" />
                <Text display={{ ml: 'none' }} variant='h3-regular' color='text-brand-medium'>.......</Text>
                <IconWrapper Icon={ToChainIcon} />
            </Box>
            <Box
                display='flex'
                flexDirection='column'
                gap='spacing-md'
                justifyContent='center'
                alignItems='center'
            >
                <Text variant='h3-semibold' color='text-brand-medium'>Bridged in {duration} secs</Text>
                <Box
                    display='flex'
                    flexDirection='column'
                    gap='spacing-xxxs'
                    justifyContent='center'
                    alignItems='center'
                >
                    <Text variant='h2-regular'>{receivedAmount} {toToken.symbol}</Text>
                    <Text variant='bl-regular' color='text-tertiary'>Transfer Successful!</Text>
                    <Text variant='bm-regular' color='text-tertiary'>Sent {fromAmount} {fromToken.symbol}</Text>
                </Box>
            </Box>
            <Box display='flex' flexDirection='column' gap='spacing-xs'>
                <Box
                    display='flex'
                    flexDirection='column'
                    gap='spacing-sm'
                    backgroundColor='surface-brand-subtle'
                    borderRadius='radius-sm'
                    border='border-sm solid stroke-brand-bold'
                    padding='spacing-sm'
                >
                    <Box display='flex' justifyContent='space-between' alignItems='center'>
                        <Text variant='bm-regular' color='text-brand-bold'>Received:</Text>
                        <Text variant='h5-semibold' color='text-brand-bold'>{receivedAmount} {toToken.symbol}</Text>
                    </Box>
                    <Box display='flex' justifyContent='space-between' alignItems='center'>
                        <Text variant='bm-regular' color='text-brand-bold'>Deposit time:</Text>
                        <Text variant='h5-semibold' color='text-brand-bold'>{time}</Text>
                    </Box>
                    <Box display='flex' justifyContent='space-between' alignItems='center'>
                        <Text variant='bm-regular' color='text-brand-bold'>Fill time:</Text>
                        <Text variant='h5-semibold' color='text-brand-bold'>{formatDuration(duration)}</Text>
                    </Box>
                </Box>
                <Box
                    display='flex'
                    justifyContent='space-between'
                    alignItems='center'
                    borderRadius='radius-xs'
                    border='border-sm solid stroke-secondary'
                    padding='spacing-xs'
                    cursor='pointer'
                    onClick={() => {
                        const explorerUrl =
                            pushChainClient?.explorer.getTransactionUrl(
                                txnHash,
                                toChain
                                    ? {
                                          chain: toChain as CHAIN,
                                      }
                                    : undefined,
                            );

                        if (explorerUrl) {
                            window.open(explorerUrl, '_blank')
                        }
                    }}
                >
                    <Text variant='bm-regular' color='text-brand-medium'>View in {explorerLabel} Explorer</Text>
                    <ArrowUpRight size={16} color='icon-tertiary' />
                </Box>
            </Box>
            <Button
                variant='outline'
                onClick={handleBack}
            >
                <PlusSquare color='icon-brand-bold' />
                Bridge more tokens
            </Button>
        </Box>
    );
}

const IconWrapper = ({Icon}: {Icon: React.FC<IconProps> | undefined}) => {
    if (!Icon) return;
    return (
        <Box
            borderRadius='radius-md'
            border='border-xl solid stroke-secondary'
            padding='spacing-xxs'
            backgroundColor='surface-secondary'
        >
            <Box
                borderRadius='radius-sm'
                border='border-sm solid stroke-brand-bold'
                height='48px'
                width='48px'
            >
                <Icon size={48} />
            </Box>
        </Box>
    );
}

export default Success;
