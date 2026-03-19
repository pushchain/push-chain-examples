import { useCallback, useEffect, useState } from 'react';
import type { Address } from 'viem';
import type { BalanceWei } from '../types/migrate';
import { viemClient } from '../utils/viem';

export type UseBalancesParams = {
	wallet1Address?: Address;
	wallet2Address?: Address;
};

export const useBalances = ({ wallet1Address, wallet2Address }: UseBalancesParams) => {
	const [wallet1BalanceWei, setWallet1BalanceWei] = useState<BalanceWei>(null);
	const [wallet2BalanceWei, setWallet2BalanceWei] = useState<BalanceWei>(null);

	const refreshBalances = useCallback(async () => {
		try {
			if (wallet1Address) {
				const b1 = await viemClient.getBalance({ address: wallet1Address });
				setWallet1BalanceWei(b1);
			} else {
				setWallet1BalanceWei(null);
			}

			if (wallet2Address) {
				const b2 = await viemClient.getBalance({ address: wallet2Address });
				setWallet2BalanceWei(b2);
			} else {
				setWallet2BalanceWei(null);
			}
		} catch (e) {
			console.error(e);
		}
	}, [wallet1Address, wallet2Address]);

	useEffect(() => {
		refreshBalances();
	}, [refreshBalances]);

	return {
		wallet1BalanceWei,
		wallet2BalanceWei,
		refreshBalances,
	};
};
