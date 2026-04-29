import { useState } from 'react';
import { Box, Text, css } from 'shared-components';

interface DividerProps {
    onSwap?: () => void;
}

const Divider = ({ onSwap }: DividerProps) => {
    const [isAnimating, setIsAnimating] = useState(false);

    const handleClick = () => {
        setIsAnimating(true);
        onSwap?.();
        setTimeout(() => setIsAnimating(false), 400);
    };

  return (
    <Box 
        position="relative" 
        display="flex" 
        alignItems="center" 
        justifyContent="center"
        css={css`
            cursor: pointer;
            ${isAnimating ? `
                .swap-icon {
                    animation: swapRotate 0.4s ease-in-out;
                }
            ` : ''}
            @keyframes swapRotate {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(180deg); }
            }
        `}
    >
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
                className="swap-container"
                css={css`
                    transition: all 0.2s ease;
                    &:hover {
                        border-color: var(--stroke-brand-bold);
                        background-color: var(--surface-tertiary-hover);
                    }
                `}
            >
                <Box 
                    display="flex" 
                    alignItems="center" 
                    justifyContent="center" 
                    height="100%"
                    className="swap-icon"
                    onClick={handleClick}
                >
                    <Text color="text-secondary">↓↑</Text>
                </Box>
            </Box>
        </Box>
    </Box>
  );
};

export default Divider;