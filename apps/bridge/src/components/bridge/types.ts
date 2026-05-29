import type { MoveableToken } from '@pushchain/core/src/lib/constants';
import type { IconProps, IllustrationProps } from 'shared-components';

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

export type SourceType = 'UOA' | 'UEA' | 'CEA';

export type AddressPrefillType = 'uoa' | 'uea' | 'cea' | null;

export type QuotePreview = {
    amount: string;
    token?: MoveableToken;
    loading: boolean;
    error: string;
};

export type ResolvedHop = {
    txHash?: string;
    outboundDetails?: {
        externalTxHash?: string;
    };
};

export type CascadeCompletion = {
    success?: boolean;
    failedAt?: number | string;
    finalTxHash?: string;
    hops?: ResolvedHop[];
};

export type CascadeResponse = {
    initialTxHash?: string;
    finalTxHash?: string;
    hops?: ResolvedHop[];
    waitForAll?: () => Promise<CascadeCompletion>;
    wait?: () => Promise<CascadeCompletion>;
};
