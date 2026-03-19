import { useCallback, useState } from 'react';
import type { Address } from 'viem';
import type { MigrationState } from '../types/migrate';
import { viemClient } from '../utils/viem';

export type PushChainClientLike = {
	universal: {
		sendTransaction: (params: { to: Address; value: bigint; data: `0x${string}` }) => Promise<unknown>;
	};
};

export type UseMigrateFundsParams = {
	from?: Address;
	to?: Address;
	wallet1BalanceWei: bigint | null;
	pushChainClient: PushChainClientLike | null | undefined;
	refreshBalances: () => Promise<void>;
};

export const useMigrateFunds = ({ from, to, wallet1BalanceWei, pushChainClient, refreshBalances }: UseMigrateFundsParams) => {
	const [state, setState] = useState<MigrationState>({
		isMigrating: false,
		error: null,
		success: null,
	});

	const migrate = useCallback(async () => {
		if (!from || !to || !pushChainClient) return;
		if (!wallet1BalanceWei) return;

		setState({ isMigrating: true, error: null, success: null });

		try {
			const estimatedGas = await viemClient.estimateGas({
				account: from,
				to,
				value: 0n,
				data: '0x',
			});
			const gasPrice = await viemClient.getGasPrice();
			const estimatedFee = estimatedGas * gasPrice;
			const feeBuffer = estimatedFee / 5n;
			const sendable = wallet1BalanceWei - estimatedFee - feeBuffer;

			if (sendable <= 0n) {
				setState({ isMigrating: false, error: 'No funds available to migrate after accounting for gas fees.', success: null });
				return;
			}

			await pushChainClient.universal.sendTransaction({
				to,
				value: sendable,
				data: '0x',
			});

			setState({ isMigrating: true, error: null, success: 'Transfer submitted successfully. Refreshing balances...' });
			await refreshBalances();
			setState({ isMigrating: false, error: null, success: 'Transfer submitted successfully.' });
		} catch (error) {
			console.error(error);
			setState({
				isMigrating: false,
				error: 'Migration failed. This can happen if you try to send full balance without enough gas buffer.',
				success: null,
			});
		}
	}, [from, to, pushChainClient, wallet1BalanceWei, refreshBalances]);

	return {
		...state,
		migrate,
		setState,
	};
};
