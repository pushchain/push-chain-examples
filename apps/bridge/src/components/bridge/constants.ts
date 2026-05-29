import { CHAIN } from '@pushchain/core/src/lib/constants/enums';
import { MoveableToken } from '@pushchain/core/src/lib/constants';
import { tokensIconList } from '../../common/constants';
import type { TokenOptions } from './types';

export const PUSH_CHAIN = CHAIN.PUSH_TESTNET_DONUT;

export const PC_TOKEN_OPTION: TokenOptions = {
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

export const DECIMAL_INPUT = /^\d*(?:\.\d*)?$/;
