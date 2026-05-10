import {
  PushUniversalAccountButton,
  usePushChain,
  usePushChainClient,
  usePushWalletContext,
} from '@pushchain/ui-kit';
import { ethers } from 'ethers';
import { useCallback, useEffect, useState } from 'react';

/**
 * Universal PUSD Payments — paywall demo
 * --------------------------------------
 * One signature, two on-chain effects:
 *   1. PUSD.approve(paywall, FEE)   ← lets the contract pull 1 PUSD
 *   2. paywall.pay()                ← extends the user's access
 *
 * The two legs ride in a single universal transaction (`to: ZERO_ADDRESS`,
 * `data: [...]`). Cross-chain users land in the contract under their UEA, so
 * `expiresAt[msg.sender]` gives the correct per-user state regardless of
 * origin chain.
 */

// ── Donut Testnet constants ──────────────────────────────────────────────
const PUSD_ADDRESS = '0x488d080e16386379561a47A4955D22001d8A9D89';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const PUSH_RPC_URL = 'https://evm.donut.rpc.push.org/';

// Replace this with the address you got from `forge create`. Until then the
// app shows a yellow banner so contributors know to deploy.
const PAYWALL_ADDRESS = ((import.meta.env.VITE_PAYWALL_ADDRESS as string | undefined) ?? '') as `0x${string}` | '';

// ── ABI fragments ────────────────────────────────────────────────────────
const APPROVE_ABI = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

const PAY_ABI = [
  {
    type: 'function',
    name: 'pay',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
] as const;

// Read-only fragments used via ethers.Contract.
const PUSD_READ_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

const PAYWALL_READ_ABI = [
  'function expiresAt(address) view returns (uint256)',
  'function hasAccess(address) view returns (bool)',
  'function FEE() view returns (uint256)',
];

const provider = new ethers.JsonRpcProvider(PUSH_RPC_URL);

function App() {
  const { connectionStatus } = usePushWalletContext();
  const { pushChainClient } = usePushChainClient();
  const { PushChain } = usePushChain();

  const [pusdBalance, setPusdBalance] = useState<bigint | null>(null);
  const [expiresAt, setExpiresAt] = useState<bigint | null>(null);
  const [now, setNow] = useState<number>(Math.floor(Date.now() / 1000));
  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState<string>('');
  const [txHash, setTxHash] = useState<string>('');

  // Tick "now" every second so the access countdown updates live.
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const refreshState = useCallback(async () => {
    if (!pushChainClient) return;
    const user = pushChainClient.universal.account;
    try {
      const pusd = new ethers.Contract(PUSD_ADDRESS, PUSD_READ_ABI, provider);
      const balance = (await pusd.balanceOf(user)) as bigint;
      setPusdBalance(balance);
      if (PAYWALL_ADDRESS) {
        const paywall = new ethers.Contract(PAYWALL_ADDRESS, PAYWALL_READ_ABI, provider);
        const expiry = (await paywall.expiresAt(user)) as bigint;
        setExpiresAt(expiry);
      }
    } catch (err) {
      console.error('refreshState failed:', err);
    }
  }, [pushChainClient]);

  useEffect(() => {
    if (connectionStatus === 'connected' && pushChainClient) {
      refreshState();
    } else {
      setPusdBalance(null);
      setExpiresAt(null);
    }
  }, [connectionStatus, pushChainClient, refreshState]);

  const pay = async () => {
    if (!pushChainClient || !PushChain || !PAYWALL_ADDRESS) {
      setError('Paywall not configured. Set VITE_PAYWALL_ADDRESS in .env first.');
      return;
    }

    try {
      setIsPaying(true);
      setError('');
      setTxHash('');

      const FEE = PushChain.utils.helpers.parseUnits('1', 6);

      // Multicall:
      //   leg 1 — PUSD.approve(paywall, FEE)
      //   leg 2 — paywall.pay()
      // Outer `to` is the zero address: tells the universal tx layer to walk
      // each leg against its own `to`.
      const approveData = PushChain.utils.helpers.encodeTxData({
        abi: APPROVE_ABI,
        functionName: 'approve',
        args: [PAYWALL_ADDRESS, FEE],
      });

      const payData = PushChain.utils.helpers.encodeTxData({
        abi: PAY_ABI,
        functionName: 'pay',
      });

      const tx = await pushChainClient.universal.sendTransaction({
        to: ZERO_ADDRESS,
        value: BigInt(0),
        data: [
          { to: PUSD_ADDRESS, value: BigInt(0), data: approveData },
          { to: PAYWALL_ADDRESS, value: BigInt(0), data: payData },
        ],
      });

      setTxHash(tx.hash);
      await tx.wait();
      await refreshState();
    } catch (err) {
      console.error('pay() failed:', err);
      setError(err instanceof Error ? err.message : 'Payment failed.');
    } finally {
      setIsPaying(false);
    }
  };

  const isConnected = connectionStatus === 'connected' && !!pushChainClient;
  const accessActive = expiresAt !== null && Number(expiresAt) > now;
  const secondsRemaining = accessActive ? Number(expiresAt) - now : 0;
  const balanceLabel =
    pusdBalance === null
      ? '…'
      : (Number(pusdBalance) / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 6 });

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '3rem 1.5rem',
        boxSizing: 'border-box',
      }}
    >
      <h1 style={{ fontSize: '2.25rem', margin: 0, color: '#1a1a1a' }}>PUSD Paywall</h1>
      <p
        style={{
          maxWidth: 520,
          textAlign: 'center',
          color: '#666',
          fontSize: '0.95rem',
          marginTop: '0.5rem',
          marginBottom: '2rem',
        }}
      >
        Pay <b>1 PUSD</b>, unlock <b>30 days</b> of access. Connect from any
        chain — Ethereum, Solana, BNB, Push — and the contract recognises you
        through your UEA.
      </p>

      {!PAYWALL_ADDRESS && (
        <div
          style={{
            backgroundColor: '#fff7d6',
            border: '1px solid #f5c842',
            color: '#664c00',
            borderRadius: 8,
            padding: '0.75rem 1rem',
            marginBottom: '1.5rem',
            maxWidth: 520,
            fontSize: '0.875rem',
          }}
        >
          <b>Setup needed.</b> Deploy <code>contracts/src/PusdPaywall.sol</code>{' '}
          and put the address in <code>app/.env</code> as{' '}
          <code>VITE_PAYWALL_ADDRESS</code>.
        </div>
      )}

      <div style={{ marginBottom: '1.5rem' }}>
        <PushUniversalAccountButton />
      </div>

      {!isConnected && (
        <p style={{ color: '#666', fontSize: '0.9rem' }}>
          Connect a wallet to view your access status and pay.
        </p>
      )}

      {isConnected && (
        <div
          style={{
            border: '1px solid #e3e3e3',
            borderRadius: 12,
            padding: '1.5rem',
            width: '100%',
            maxWidth: 460,
            backgroundColor: 'white',
          }}
        >
          <Row label="Your PUSD balance" value={`${balanceLabel} PUSD`} />
          <Row
            label="Access status"
            value={
              expiresAt === null
                ? '…'
                : accessActive
                ? `Active (${formatDuration(secondsRemaining)} left)`
                : 'Inactive'
            }
            valueColor={
              expiresAt === null ? undefined : accessActive ? '#1a8f4a' : '#a30b0b'
            }
          />

          <button
            onClick={pay}
            disabled={isPaying || !PAYWALL_ADDRESS}
            style={{
              width: '100%',
              marginTop: '1.5rem',
              padding: '0.85rem 1rem',
              fontSize: '1rem',
              fontWeight: 600,
              border: 'none',
              borderRadius: 10,
              cursor: isPaying ? 'wait' : 'pointer',
              backgroundColor: isPaying ? '#bbb' : '#d548ec',
              color: 'white',
            }}
          >
            {isPaying ? 'Sending…' : 'Pay 1 PUSD — extend 30 days'}
          </button>

          {error && (
            <p style={{ color: '#a30b0b', fontSize: '0.85rem', marginTop: '0.75rem' }}>
              {error}
            </p>
          )}

          {txHash && pushChainClient && (
            <div
              style={{
                marginTop: '1rem',
                padding: '0.75rem',
                backgroundColor: '#f3f4f6',
                borderRadius: 8,
                fontSize: '0.85rem',
              }}
            >
              <div style={{ marginBottom: '0.25rem', fontWeight: 600 }}>
                Transaction sent
              </div>
              <a
                href={pushChainClient.explorer.getTransactionUrl(txHash)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#d548ec', wordBreak: 'break-all' }}
              >
                View on Donut explorer →
              </a>
            </div>
          )}
        </div>
      )}

      <p style={{ color: '#999', fontSize: '0.8rem', marginTop: '2rem' }}>
        No PUSD?{' '}
        <a
          href="https://pusd.push.org/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#d548ec' }}
        >
          Mint some from any chain →
        </a>
      </p>
    </div>
  );
}

// ── Small UI helpers ─────────────────────────────────────────────────────

function Row({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.5rem 0',
        borderBottom: '1px solid #f0f0f0',
        fontSize: '0.95rem',
      }}
    >
      <span style={{ color: '#666' }}>{label}</span>
      <span style={{ fontWeight: 600, color: valueColor ?? '#1a1a1a' }}>{value}</span>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0s';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m ${seconds % 60}s`;
}

export default App;
