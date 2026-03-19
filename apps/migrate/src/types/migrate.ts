export type BalanceWei = bigint | null;

export type MigrationState = {
	isMigrating: boolean;
	error: string | null;
	success: string | null;
};
