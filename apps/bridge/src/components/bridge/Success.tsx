import { MoveableToken } from "@pushchain/core/src/lib/constants";
import { ArrowUpRight, Box, Button, css, IconProps, PlusSquare, PushMonotone, Text } from "shared-components";
import { chainsIconList } from "../../common/constants";
import { formatDuration, formatTxTime } from "../../common/utils";
import { usePushChainClient } from "@pushchain/ui-kit";

type SuccessProps = {
    token: MoveableToken;
    amount: string;
    chain?: string;
    duration: number;
    txnHash: string;
}

const Success: React.FC<SuccessProps> = ({
    chain,
    duration,
    amount,
    token,
    txnHash
}) => {
    const ChainIcon = chainsIconList[chain || ''];

    const { pushChainClient } = usePushChainClient();

    const time = formatTxTime(Date.now());  

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
                <IconWrapper Icon={ChainIcon} />
                <Text variant='h3-regular' color='text-brand-medium'>.......</Text>
                <img height={110} src="/Success.png" alt="Success" />
                <Text variant='h3-regular' color='text-brand-medium'>.......</Text>
                <IconWrapper Icon={PushMonotone} />
            </Box>
            <Box
                display='flex'
                flexDirection='column'
                gap='spacing-md'
                justifyContent='center'
                alignItems='center'
            >
                <Text variant='h3-semibold' color='text-brand-medium'>Bridged in {duration}secs</Text>
                <Box
                    display='flex'
                    flexDirection='column'
                    gap='spacing-xxxs'
                    justifyContent='center'
                    alignItems='center'
                >
                    <Text variant='h2-regular'>{amount} {token.symbol}</Text>
                    <Text variant='bl-regular' color='text-tertiary'>Transfer Successful!</Text>
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
                    onClick={() => pushChainClient?.explorer.getTransactionUrl(txnHash)}
                >
                    <Text variant='bm-regular' color='text-brand-medium'>View in Push Explorer</Text>
                    <ArrowUpRight size={16} color='icon-tertiary' />
                </Box>
            </Box>
            <Button variant='outline'><PlusSquare color='icon-brand-bold' />Bridge more tokens</Button>
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