import type { ReactNode } from 'react';
import { Box } from 'shared-components';
import { css } from 'styled-components';

type MigrateLayoutProps = {
	children: ReactNode;
};

const MigrateLayout = ({ children }: MigrateLayoutProps) => {
	return (
		<Box
			minHeight="100vh"
			width="100%"
			padding="spacing-md"
			display="flex"
			flexDirection="column"
			gap="spacing-md"
			css={css`
				box-sizing: border-box;
				overflow-x: hidden;
			`}
		>
			<Box
				width="100%"
				display="flex"
				justifyContent="flex-start"
				css={css`
					margin: 0 auto;
				`}
			>
				<img width='200px' src="/PushLogo.png" alt="Logo" />
			</Box>
			<Box width="100%" display="flex" alignItems="center" justifyContent="center" css={css`flex: 1;`}>
				<Box
					width="100%"
					maxWidth="760px"
					css={css`
						margin: 0 auto;
					`}
				>
					{children}
				</Box>
			</Box>
		</Box>
	);
};

export default MigrateLayout;
