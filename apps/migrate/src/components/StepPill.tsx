import { Box } from 'shared-components';
import { css } from 'styled-components';

type StepPillProps = {
	label: string;
	active: boolean;
};

const StepPill = ({ label, active }: StepPillProps) => {
	return (
		<Box
			as="span"
			css={css`
				font-size: 12px;
				font-weight: 600;
				padding: 6px 10px;
				border-radius: 999px;
				background: ${active ? 'rgba(213, 72, 236, 0.18)' : 'rgba(255, 255, 255, 0.08)'};
				color: ${active ? '#D548EC' : 'rgba(255, 255, 255, 0.75)'};
				border: 1px solid ${active ? 'rgba(213, 72, 236, 0.35)' : 'rgba(255, 255, 255, 0.12)'};
			`}
		>
			{label}
		</Box>
	);
};

export default StepPill;
