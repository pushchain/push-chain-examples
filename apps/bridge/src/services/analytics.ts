/**
 * GA4 instrumentation for bridge.push.org (property G-Q905VR03WM, configured in index.html).
 *
 * Event names are chosen to match how stats.push.org classifies them: it buckets
 * events by regex on the name alone. Names containing `fail`/`error` render as
 * friction, names containing `bridge` (and other journey keywords) render as
 * funnel steps, everything else renders as a signal. So the funnel carries the
 * `bridge_` prefix, failures carry a `_failed`/`_error` suffix, and ancillary UI
 * events carry neither.
 */

/** Funnel steps. Ordered as the dashboard draws them. */
export const BRIDGE_FUNNEL_EVENTS = {
    WALLET_CONNECT_CLICKED: 'bridge_wallet_connect_clicked',
    WALLET_CONNECTED: 'bridge_wallet_connected',
    AMOUNT_ENTERED: 'bridge_amount_entered',
    /** Form is valid and the button is live: intent, minus the commitment. */
    ROUTE_READY: 'bridge_route_ready',
    TRANSACTION_SUBMITTED: 'bridge_transaction_submitted',
    TRANSACTION_SUCCEEDED: 'bridge_transaction_succeeded',
} as const;

/** Failures. Named so the dashboard files them as friction. */
export const BRIDGE_FAILURE_EVENTS = {
    TRANSACTION_FAILED: 'bridge_transaction_failed',
    INSUFFICIENT_BALANCE: 'bridge_insufficient_balance_error',
    ADDRESS_VALIDATION: 'bridge_address_validation_error',
    QUOTE_FAILED: 'bridge_quote_failed',
    FEE_PREVIEW_FAILED: 'bridge_fee_preview_failed',
    ADDRESS_DERIVATION_FAILED: 'bridge_address_derivation_failed',
    POINTS_EVENT_FAILED: 'bridge_points_event_failed',
    /** Connected, token picked, nothing to send. A dead end, not a mistake. */
    ZERO_BALANCE: 'bridge_zero_balance_error',
    /** A failed lookup reads as a zero balance, so the two must be separable. */
    BALANCE_FETCH_FAILED: 'bridge_balance_fetch_failed',
} as const;

/** Interaction detail. Deliberately unprefixed so the dashboard files them as signals. */
export const BRIDGE_SIGNAL_EVENTS = {
    /**
     * Repeat-bridge intent. Deliberately unprefixed: the dashboard headlines
     * "% of visitors reach [the journey step with fewest users]", and as a
     * funnel step this would make the repeat rate the headline instead of the
     * completion rate - painting a healthy app red whenever repeats are low.
     * As a signal it is still reported, just not as the bottom of the funnel.
     */
    MORE_TOKENS_CLICKED: 'more_tokens_clicked',
    /** Denominator for destination_address_edited. */
    ADDRESS_PREFILL_SHOWN: 'address_prefill_shown',
    /** Carries quote latency - the app's perceived speed before submit. */
    QUOTE_RECEIVED: 'quote_received',
    FROM_CHAIN_SELECTED: 'from_chain_selected',
    TO_CHAIN_SELECTED: 'to_chain_selected',
    FROM_TOKEN_SELECTED: 'from_token_selected',
    TO_TOKEN_SELECTED: 'to_token_selected',
    DIRECTION_FLIPPED: 'direction_flipped',
    MAX_AMOUNT_CLICKED: 'max_amount_clicked',
    USE_MY_ADDRESS_CLICKED: 'use_my_address_clicked',
    DESTINATION_ADDRESS_EDITED: 'destination_address_edited',
    FEE_SUMMARY_EXPANDED: 'fee_summary_expanded',
    EXPLORER_LINK_CLICKED: 'explorer_link_clicked',
    SOCIAL_LINK_CLICKED: 'social_link_clicked',
    LEGAL_LINK_CLICKED: 'legal_link_clicked',
} as const;

export const ANALYTICS_EVENTS = {
    ...BRIDGE_FUNNEL_EVENTS,
    ...BRIDGE_FAILURE_EVENTS,
    ...BRIDGE_SIGNAL_EVENTS,
} as const;

export type AnalyticsEventName =
    (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

/**
 * The shared parameter vocabulary. Register these as event-scoped custom
 * dimensions in GA4 to make them reportable — GA4 does not backfill, so they
 * only accrue from the day they are registered.
 *
 * Wallet addresses and transaction hashes are deliberately absent: they are user
 * identifiers, and the bridge backend already records them exactly.
 */
export type AnalyticsMetadata = Partial<{
    from_chain: string;
    from_chain_name: string;
    to_chain: string;
    to_chain_name: string;
    from_token: string;
    to_token: string;
    /** Pre-joined pair, e.g. "ETH→PC". The dimension a token breakdown ranks on. */
    token_pair: string;
    /** Pre-joined chain pair, e.g. "Ethereum Sepolia→Push". */
    route: string;
    route_type: string;
    flow_case: string;
    requires_swap: boolean;
    amount: number;
    amount_bucket: string;
    /** How much of the wallet is being moved. Bucketed to stay a dimension. */
    amount_pct_of_balance: string;
    duration_sec: number;
    duration_bucket: string;
    /** Landing to wallet connected. */
    time_to_connect_sec: number;
    /** Wallet connected to submit - how long the form takes to fill. */
    time_to_submit_sec: number;
    latency_ms: number;
    latency_bucket: string;
    prefill_type: string;
    namespace: string;
    network: string;
    link: string;
    reason: string;
    is_pc: boolean;
    status: string;
    error_message: string;
}>;

declare global {
    interface Window {
        gtag?: (
            command: 'event',
            eventName: string,
            parameters?: Record<string, string | number | boolean>,
        ) => void;
    }
}

const ALLOWED_METADATA_KEYS = new Set<keyof AnalyticsMetadata>([
    'from_chain',
    'from_chain_name',
    'to_chain',
    'to_chain_name',
    'from_token',
    'to_token',
    'token_pair',
    'route',
    'route_type',
    'flow_case',
    'requires_swap',
    'amount',
    'amount_bucket',
    'amount_pct_of_balance',
    'duration_sec',
    'duration_bucket',
    'time_to_connect_sec',
    'time_to_submit_sec',
    'latency_ms',
    'latency_bucket',
    'prefill_type',
    'namespace',
    'network',
    'link',
    'reason',
    'is_pc',
    'status',
    'error_message',
]);

/**
 * GA4 silently truncates parameter values over 100 characters. Clamping here
 * means what we send is what gets stored, rather than something GA4 quietly
 * cut in half - which matters because these values only become readable once
 * the matching custom dimensions are registered, long after they were sent.
 */
const GA4_MAX_VALUE_LENGTH = 100;

const clampValue = (value: string | number | boolean) =>
    typeof value === 'string' && value.length > GA4_MAX_VALUE_LENGTH
        ? value.slice(0, GA4_MAX_VALUE_LENGTH)
        : value;

const compactMetadata = (metadata: AnalyticsMetadata) =>
    Object.fromEntries(
        Object.entries(metadata)
            .filter(
                ([key, value]) =>
                    ALLOWED_METADATA_KEYS.has(
                        key as keyof AnalyticsMetadata,
                    ) &&
                    value !== undefined &&
                    value !== null &&
                    value !== '',
            )
            .map(([key, value]) => [
                key,
                clampValue(value as string | number | boolean),
            ]),
    ) as Record<string, string | number | boolean>;

/** Fire-and-forget GA4 tracking. Analytics must never interrupt a bridge. */
export const trackEvent = (
    eventName: AnalyticsEventName,
    metadata: AnalyticsMetadata = {},
) => {
    if (typeof window === 'undefined' || typeof window.gtag !== 'function')
        return;

    try {
        window.gtag('event', eventName, compactMetadata(metadata));
    } catch {
        // Analytics is best-effort and must not affect a transaction flow.
    }
};

/** Strips hashes and addresses, then truncates. Mirrors push-wallet's helper. */
export const getSafeErrorMessage = (
    error: unknown,
    fallback = 'Bridge failed',
) => {
    const message =
        error instanceof Error
            ? error.message
            : typeof error === 'string'
              ? error
              : fallback;

    return message
        .replace(/\b0x[a-fA-F0-9]{40,}\b/g, '[redacted]')
        .replace(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g, '[redacted]')
        .slice(0, 100);
};

/**
 * Buckets keep amount usable as a dimension. The raw `amount` rides along as a
 * number, but is indicative only — summing across tokens is meaningless.
 */
export const getAmountBucket = (amount: string | number) => {
    const parsed = typeof amount === 'number' ? amount : Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) return '';
    if (parsed < 0.01) return '<0.01';
    if (parsed < 0.1) return '0.01-0.1';
    if (parsed < 1) return '0.1-1';
    if (parsed < 10) return '1-10';
    if (parsed < 100) return '10-100';
    if (parsed < 1000) return '100-1000';
    return '1000+';
};

export const getSafeAmount = (amount: string) => {
    const parsed = Number(amount);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

/** Raw numbers are metrics, not dimensions, so every one also ships a bucket. */
export const getDurationBucket = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return '';
    if (seconds < 15) return '<15s';
    if (seconds < 30) return '15-30s';
    if (seconds < 60) return '30-60s';
    if (seconds < 180) return '1-3min';
    return '3min+';
};

export const getLatencyBucket = (ms: number) => {
    if (!Number.isFinite(ms) || ms < 0) return '';
    if (ms < 500) return '<0.5s';
    if (ms < 1000) return '0.5-1s';
    if (ms < 2000) return '1-2s';
    if (ms < 5000) return '2-5s';
    return '5s+';
};

/** Whether people move a little or everything. Empty when balance is unknown. */
export const getPercentOfBalanceBucket = (
    amount: string,
    balance: string,
) => {
    const a = Number(amount);
    const b = Number(balance);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0 || a <= 0)
        return '';

    const pct = (a / b) * 100;
    if (pct < 10) return '<10%';
    if (pct < 25) return '10-25%';
    if (pct < 50) return '25-50%';
    if (pct < 90) return '50-90%';
    if (pct <= 100) return '90-100%';
    return '>100%';
};

/** "ETH→PC" — one dimension instead of two, so the dashboard table is one query. */
export const getTokenPair = (fromSymbol?: string, toSymbol?: string) =>
    fromSymbol && toSymbol ? `${fromSymbol}→${toSymbol}` : '';

/** "Ethereum Sepolia→Push" — the corridor, for volume-by-route. */
export const getRouteLabel = (fromLabel?: string, toLabel?: string) =>
    fromLabel && toLabel ? `${fromLabel}→${toLabel}` : '';
