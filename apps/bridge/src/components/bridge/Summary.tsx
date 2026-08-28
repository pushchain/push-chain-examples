import { MoveableToken } from "@pushchain/core/src/lib/constants";
import { useMemo, useState } from "react";
import { Box, CaretDown, css, Spinner, Text } from "shared-components";
import { getExternalTokenSymbol, normaliseAmount } from "./utils";
import {
  BRIDGE_SIGNAL_EVENTS,
  getTokenPair,
  trackEvent,
} from "../../services/analytics";

type QuoteSummaryProps = {
  fromAmount?: string;
  fromToken?: MoveableToken;
  toAmount: string;
  toToken?: MoveableToken;
  loading?: boolean;
  error?: string;
  netFee?: string;
  bridgeFee?: string;
  destinationGasFee?: string;
  feeLoading?: boolean;
  disabled?: boolean;
};

const formatDisplayAmount = (value: string) => {
  if (!value) return "0";

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  if (parsed === 0) return "0";
  if (parsed > 0 && parsed < 0.0001) return "<0.0001";

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 6,
  }).format(parsed);
};

const percentFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

const getDisplaySymbol = (token?: MoveableToken) =>
  getExternalTokenSymbol(token?.symbol) || token?.symbol || "";

const getRateImpact = ({
  fromAmount,
  fromToken,
  toAmount,
  toToken,
}: {
  fromAmount?: string;
  fromToken?: MoveableToken;
  toAmount: string;
  toToken?: MoveableToken;
}) => {
  const fromSymbol = getDisplaySymbol(fromToken);
  const toSymbol = getDisplaySymbol(toToken);

  if (!fromAmount || !toAmount || !fromSymbol || fromSymbol !== toSymbol) {
    return "";
  }

  const parsedFrom = Number(normaliseAmount(fromAmount));
  const parsedTo = Number(normaliseAmount(toAmount));

  if (
    !Number.isFinite(parsedFrom) ||
    !Number.isFinite(parsedTo) ||
    parsedFrom <= 0 ||
    parsedTo <= 0
  ) {
    return "";
  }

  const difference = parsedFrom - parsedTo;

  if (difference <= 0) return "";

  const percent = (difference / parsedFrom) * 100;

  return `${formatDisplayAmount(String(difference))} ${toSymbol} (${percentFormatter.format(percent)}%)`;
};

const QuoteSummary: React.FC<QuoteSummaryProps> = ({
  fromAmount,
  fromToken,
  toAmount,
  toToken,
  loading = false,
  error = "",
  netFee = "--",
  bridgeFee = "--",
  destinationGasFee = "--",
  feeLoading = false,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const receiveToken = toToken?.symbol || "";
  const rateImpact = useMemo(
    () =>
      getRateImpact({
        fromAmount,
        fromToken,
        toAmount,
        toToken,
      }),
    [fromAmount, fromToken, toAmount, toToken],
  );

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
                cursor: ${disabled ? "default" : "pointer"};
                user-select: none;
            `}
            onClick={
                disabled
                    ? undefined
                    : () =>
                          setOpen((s) => {
                              if (!s) {
                                  trackEvent(
                                      BRIDGE_SIGNAL_EVENTS.FEE_SUMMARY_EXPANDED,
                                      {
                                          token_pair: getTokenPair(
                                              getDisplaySymbol(fromToken),
                                              getDisplaySymbol(toToken),
                                          ),
                                      },
                                  );
                              }
                              return !s;
                          })
            }
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
                    {loading ? (
                        <Box display="flex" alignItems="center" gap="spacing-xxs">
                            <Spinner size="small" variant="secondary" />
                            <Text variant="bm-regular">Fetching quote</Text>
                        </Box>
                    ) : error ? (
                        <Text variant="bm-regular" color="text-state-danger-subtle">
                            {error}
                        </Text>
                    ) : (
                        <>
                            <Text variant="bm-regular">
                                {formatDisplayAmount(toAmount)} {receiveToken}
                            </Text>
                            <Text variant="bm-regular" color="text-tertiary">in</Text>
                            <Text variant="bm-regular">~20 secs</Text>
                        </>
                    )}
                </Box>
            </Box>

            {!disabled && <CaretDown size={20} color="icon-primary" />}
        </Box>

        {!disabled && open && (
            <Box display="flex" flexDirection="column" gap="spacing-xs">
                {!loading && !error && rateImpact && (
                    <Row label="Rate impact" value={rateImpact} />
                )}
                <Row label="Network fee" value={feeLoading ? "Estimating" : netFee} />

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
                        <Row label="Bridge fee" value={feeLoading ? "Estimating" : bridgeFee} />
                        <Row
                            label="Destination gas fee"
                            value={feeLoading ? "Estimating" : destinationGasFee}
                        />
                    </Box>
                </Box>
            </Box>
        )}
    </Box>
  );
}

const Row = ({ label, value, info = false }: { label: string; value: string; info?: boolean }) => {
  return (
    <Box display="flex" alignItems="center" justifyContent="space-between" gap="spacing-xs">
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
      <Text
        variant='h5-regular'
        color="text-tertiary"
        css={css`
          text-align: right;
        `}
      >
        {value}
      </Text>
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
