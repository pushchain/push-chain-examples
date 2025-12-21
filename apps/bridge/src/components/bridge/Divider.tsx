import { Box, Text, css } from 'shared-components';

const Divider = () => {
  return (
    <Box position="relative" display="flex" alignItems="center" justifyContent="center">
        <Box
            position="absolute"
            height="1px"
            backgroundColor='surface-tertiary'
            css={css`
                left: 0;
                right: 0;
                top: 50%;
                transform: translateY(-50%);
                mask-image:
                    linear-gradient(to right, transparent, black 12%, black 88%, transparent);
            `}
        />
        <Box
            width='88px'
            css={css`
                backdrop-filter: blur(6px);
            `}
        >
            <Box
                height="32px"
                width="40px"
                backgroundColor='surface-tertiary'
                borderRadius='radius-lg'
                border='border-sm solid stroke-tertiary'
                margin='spacing-none spacing-md'
            >
                <Box display="flex" alignItems="center" justifyContent="center" height="100%">
                    <Text color="text-secondary">↓</Text>
                </Box>
            </Box>
        </Box>
    </Box>
  );
};

export default Divider;