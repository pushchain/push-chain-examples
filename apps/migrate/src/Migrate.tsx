import { PushUniversalAccountButton, usePushChainClient, usePushWalletContext } from "@pushchain/ui-kit";
import { Box, Button, Text } from "shared-components";
import { formatUnits } from "viem";
import { css } from "styled-components";
import type { Address } from "viem";
import { useBalances } from "./hooks/useBalances";
import { useMigrateFunds, type PushChainClientLike } from "./hooks/useMigrateFunds";
import { formatAddress } from "./utils/format";
import { InfoRow, MigrateLayout, StepCard } from "./components";

const Migrate = () => {
	const { universalAccount: universalAccount1 } = usePushWalletContext('wallet1');
	const { universalAccount: universalAccount2 } = usePushWalletContext('wallet2');
	const { pushChainClient } = usePushChainClient("wallet1");

	const wallet1Address = (universalAccount1?.address as Address | undefined);
	const wallet2Address = (universalAccount2?.address as Address | undefined);

	const { wallet1BalanceWei, wallet2BalanceWei, refreshBalances } = useBalances({
		wallet1Address,
		wallet2Address,
	});

	const { isMigrating, error: migrateError, success: migrateSuccess, migrate } = useMigrateFunds({
		from: wallet1Address,
		to: wallet2Address,
		wallet1BalanceWei,
		pushChainClient: (pushChainClient as unknown as PushChainClientLike | null) ?? null,
		refreshBalances,
	});

	const step1Complete = !!universalAccount1;
	const wallet1HasFunds = wallet1BalanceWei !== null && wallet1BalanceWei > 0n;
	const step2Available = step1Complete && wallet1HasFunds;
	const step2Complete = !!universalAccount2;
	const canMigrate = step2Available && step2Complete && !isMigrating;
	const noFunds = step1Complete && wallet1BalanceWei !== null && wallet1BalanceWei === 0n;

  return (
	<MigrateLayout>
		<Box width="100%" display="flex" flexDirection="column" justifyContent="center" gap="spacing-md">
			<Box>
				<Text as="div" variant="h3-bold">Migrate Funds</Text>
			</Box>

			<Box display="flex" flexDirection="row" gap="spacing-md" alignItems="stretch" css={css`flex-wrap: wrap;`}>
				<StepCard
					title="Old Push Account"
					stepLabel="Step 1"
					stepActive={!step1Complete}
					description="Connect the old account that currently holds your funds."
				>
					<PushUniversalAccountButton uid="wallet1" connectButtonText="Connect Old Push Account" />
					<InfoRow label="Address" value={formatAddress(universalAccount1?.address)} />
					<InfoRow
						label="Balance"
						value={wallet1BalanceWei === null ? '-' : `${formatUnits(wallet1BalanceWei, 18)} PUSH`}
					/>
					{noFunds ? (
						<Text as="div" variant="bm-regular" css={css`opacity: 0.8;`}>
							No funds to migrate or transfer.
						</Text>
					) : null}
				</StepCard>

				<StepCard
					title="New Push Account"
					stepLabel="Step 2"
					stepActive={!step2Complete}
					description="Connect the new account that will receive the migrated funds."
				>
					<PushUniversalAccountButton uid="wallet2" connectButtonText="Connect New Push Account" />
					<InfoRow label="Address" value={formatAddress(universalAccount2?.address)} />
					<InfoRow
						label="Balance"
						value={wallet2BalanceWei === null ? '-' : `${formatUnits(wallet2BalanceWei, 18)} PUSH`}
					/>
				</StepCard>

				<StepCard
					title="Migrate"
					stepLabel="Step 3"
					stepActive={!canMigrate}
					description="This will transfer the maximum possible amount from the old account to the new one after reserving gas fees."
				>
					<Box height="1px" width="100%" css={css`background: rgba(255, 255, 255, 0.08);`} />
					<Button disabled={!canMigrate} loading={isMigrating} onClick={migrate}>Migrate</Button>
					{migrateError !== null ? (
						<Text as="div" variant="bm-regular" css={css`color: #ff6b6b;`}>
							{migrateError}
						</Text>
					) : null}
					{migrateSuccess !== null ? (
						<Text as="div" variant="bm-regular" css={css`color: #6ee7b7;`}>
							{migrateSuccess}
						</Text>
					) : null}
				</StepCard>
			</Box>
		</Box>
	</MigrateLayout>
	);
};

export default Migrate;