import { Box, Text } from 'shared-components';
import { css } from 'styled-components';

type InfoRowProps = {
	label: string;
	value: string;
};

const InfoRow = ({ label, value }: InfoRowProps) => {
	return (
		<Box display="flex" alignItems="center" justifyContent="space-between" gap="spacing-xs">
			<Text as="div" variant="bs-regular" css={css`opacity: 0.75;`}>{label}</Text>
			<Text as="div" variant="bm-bold">{value}</Text>
		</Box>
	);
};

export default InfoRow;
