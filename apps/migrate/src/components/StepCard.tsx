import { Box, Text } from 'shared-components';
import type { ReactNode } from 'react';
import { css } from 'styled-components';
import StepPill from './StepPill';

type StepCardProps = {
	title: string;
	stepLabel: string;
	stepActive: boolean;
	description: string;
	children: ReactNode;
};

const StepCard = ({ title, stepLabel, stepActive, description, children }: StepCardProps) => {
	return (
		<Box
			border="none"
			borderRadius="radius-sm"
			padding="spacing-sm"
			minWidth="240px"
			display="flex"
			flexDirection="column"
			gap="spacing-xs"
			css={css`
				flex: 1;
				border: 1px solid rgba(255, 255, 255, 0.12);
				min-width: 240px;
			`}
		>
			<Box display="flex" alignItems="center" justifyContent="space-between" gap="spacing-xs">
				<Text as="div" variant="h5-bold">{title}</Text>
				<StepPill label={stepLabel} active={stepActive} />
			</Box>
			<Box display="flex" flexDirection="column" gap="spacing-xxs">
				<Text as="div" variant="bm-regular" css={css`opacity: 0.8;`}>{description}</Text>
				{children}
			</Box>
		</Box>
	);
};

export default StepCard;
