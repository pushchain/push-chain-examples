import { MoveableToken } from "@pushchain/core/src/lib/constants";
import { useState } from "react";
import { Box, CaretDown, css, Text } from "shared-components";

type QuoteSummaryProps = {
  amount: string;
  token?: MoveableToken;
};

const QuoteSummary: React.FC<QuoteSummaryProps> = ({token, amount}) => {
  const [open, setOpen] = useState(false);

  return (
    <Box
        display='flex'
        flexDirection='column'
        border="border-sm solid stroke-secondary"
        borderRadius="radius-xs"
        padding='spacing-xs'
        gap='spacing-xs'
    >
        <Box
            width="100%"
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            css={css`
                box-sizing: border-box;
                cursor: pointer;
                user-select: none;
            `}
            onClick={() => setOpen((s) => !s)}
        >
            <Box display="flex" alignItems="center" gap="spacing-xs">

                {/* <Box
                    display="inline-flex"
                    alignItems="center"
                    justifyContent="center"
                    height="24px"
                    minWidth="24px"
                >
                    {icon}
                </Box> */}

                <Box display="flex" gap="spacing-xxs" alignItems="baseline">
                    <Text variant="bm-regular">{Number(amount)} {token?.symbol}</Text>
                    <Text variant="bm-regular" color="text-tertiary">in</Text>
                    <Text variant="bm-regular">~20 secs</Text>
                </Box>
            </Box>

            <CaretDown size={20} color="icon-primary" />
        </Box>

        {open && (
            <Box display="flex" flexDirection="column" gap="spacing-sm">

                <Row label="Net fee" value='$0.00' />

                <Box height="1px" backgroundColor='surface-tertiary' />

                <Box
                    display='flex'
                    flexDirection='column'
                    gap='spacing-md'
                    position='relative'
                    padding='spacing-xs spacing-none spacing-none spacing-lg'
                    width='100%'
                    alignItems='flex-start'
                    css={css`
                        box-sizing: border-box;
                    `}
                >

                    <Box
                        position="absolute"
                        css={css`
                            left: 0;
                            top: 8px;
                            bottom: 8px;    
                        `}
                    >
                        <FeeBracket />
                    </Box>

                    <Box display="flex" flexDirection="column" width='100%' gap="spacing-sm">
                        <Row label="Bridge fee" value="$0.00" />
                        <Row label="Destination gas fee" value="$0.00" />
                    </Box>
                </Box>
            </Box>
        )}
    </Box>
  );
}

const Row = ({ label, value, info = false }: { label: string; value: string; info?: boolean }) => {
  return (
    <Box display="flex" alignItems="center" justifyContent="space-between">
      <Box display="flex" alignItems="center" gap="spacing-xxs">
        <Text variant='h5-regular' color="text-tertiary">{label}</Text>
        {info && (
          <Box as="span" aria-hidden="true" color="text-secondary">
            {/* tiny info dot */}
            <svg width="14" height="14" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.12" />
              <path d="M12 8.5h.01M11 11.5h2v4h-2z" fill="currentColor" />
            </svg>
          </Box>
        )}
      </Box>
      <Text variant='h5-regular' color="text-tertiary">{value}</Text>
    </Box>
  );
}

const FeeBracket = () => {
    return (
        <Box position="relative" width="22px" height="100%">
            <Box
                position="absolute"
                width="2px"
                backgroundColor="surface-tertiary"
                borderRadius="radius-xxxl"
                css={css`
                    top: 0;
                    bottom: 16px;
                    left: 8px;
                `}
            />
            <Box
                position="absolute"
                height="2px"
                width="18px"
                backgroundColor="surface-tertiary"
                borderRadius="radius-xxxl"
                css={css`
                    top: 14px;
                    left: 8px;
                `}
            />
            <Box
                position="absolute"
                height="18px"
                width="16px"
                css={css`
                    left: 8px;
                    bottom: 0;
                    border-left: 2px solid var(--surface-tertiary);
                    border-bottom: 2px solid var(--surface-tertiary);
                    border-bottom-left-radius: var(--radius-xs);
                `}
            />
        </Box>
    );
}

export default QuoteSummary;