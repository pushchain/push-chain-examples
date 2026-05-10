import {
  PushUniversalAccountButton,
  usePushChain,
  usePushChainClient,
  usePushWalletContext,
} from "@pushchain/ui-kit";
import { ethers } from "ethers";
import { useEffect, useState } from "react";
import MultiChainCounterABI from "./abi/MultiChainCounter.json";
import ExternalCounterABI from "./abi/ExternalCounter.json";
import "./App.css";

// =============================================================================
// Configuration — pre-filled with the tutorial's reference deployment.
// Devs running the tutorial against their own contracts can swap these out.
// =============================================================================

/// Address of MultiChainCounter on Push Donut Testnet.
const ORCHESTRATOR_ADDRESS = "0x6448B16c0b295F24DAB9743C80d842f47F923D15";

/// Per-destination configuration. Each entry maps a destination chain to:
///   • the deployed `ExternalCounter` address on that chain
///   • the PRC-20 routing token on Push that selects this destination chain
///     (see https://push.org/docs/chain/setup/smart-contract-address-book)
///   • the destination-chain RPC the app uses for read-only `count()` queries
///   • the gas budget the orchestrator should grant the CEA's call
const DESTINATIONS = [
  {
    label: "Ethereum Sepolia",
    chainKey: "ETHEREUM_SEPOLIA" as const,
    counterAddress: "0x6448B16c0b295F24DAB9743C80d842f47F923D15",
    pushRoutingToken: "0x2971824Db68229D087931155C2b8bB820B275809", // pETH
    destinationRpc: "https://ethereum-sepolia-rpc.publicnode.com",
    explorerBase: "https://sepolia.etherscan.io",
    gasLimit: 1_000_000n,
  },
  {
    label: "BNB Testnet",
    chainKey: "BNB_TESTNET" as const,
    counterAddress: "0xb3fB98A3C6EEA643532198CF22cc50BC48026E79",
    pushRoutingToken: "0x7a9082dA308f3fa005beA7dB0d203b3b86664E36", // pBNB
    destinationRpc: "https://bsc-testnet-rpc.publicnode.com",
    explorerBase: "https://testnet.bscscan.com",
    gasLimit: 1_000_000n,
  },
  {
    label: "Arbitrum Sepolia",
    chainKey: "ARBITRUM_SEPOLIA" as const,
    counterAddress: "0xb3fB98A3C6EEA643532198CF22cc50BC48026E79",
    pushRoutingToken: "0xc0a821a1AfEd1322c5e15f1F4586C0B8cE65400e", // pETH_ARB
    destinationRpc: "https://sepolia-rollup.arbitrum.io/rpc",
    explorerBase: "https://sepolia.arbiscan.io",
    gasLimit: 1_000_000n,
  },
];

/// Push Chain Donut Testnet RPC — used for reading the orchestrator's state.
const pushProvider = new ethers.JsonRpcProvider("https://evm.donut.rpc.push.org/");

/// Naive per-call fee in PC. The proper flow is to quote each via
/// `UniversalCore.getOutboundTxGasAndFees(token, gasLimit)` — this default
/// (5 PC each) is comfortable headroom for testnet outbound to BNB/Sepolia.
const PER_CALL_FEE_PC = ethers.parseEther("5");

/// Shape of a single SDK progress event emitted via `tx.progressHook(cb)`.
/// Each event carries a route-prefixed id (e.g. SEND-TX-101 for Route 1),
/// a human-readable title/message, and a level we use to style the row.
type ProgressEvent = {
  id: string;
  title: string;
  message?: string;
  level: "INFO" | "SUCCESS" | "ERROR";
  response?: unknown;
  timestamp?: string;
};

function App() {
  const { connectionStatus } = usePushWalletContext();
  const { pushChainClient } = usePushChainClient();
  const { PushChain } = usePushChain();

  const [ceaAddrs, setCeaAddrs] = useState<Record<string, string>>({});
  const [counts, setCounts] = useState<Record<string, bigint>>({});
  const [lastCallers, setLastCallers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [tickLoading, setTickLoading] = useState(false);
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState("");
  const [progressEvents, setProgressEvents] = useState<ProgressEvent[]>([]);

  /// Derive the orchestrator's CEA on each destination chain via the SDK.
  /// CEAs are deterministic, so this works before any cross-chain activity.
  const deriveAllCEAs = async () => {
    if (!PushChain) return;
    const next: Record<string, string> = {};
    const orchestratorOnPush = PushChain.utils.account.toUniversal(
      ORCHESTRATOR_ADDRESS,
      { chain: PushChain.CONSTANTS.CHAIN.PUSH_TESTNET }
    );
    for (const d of DESTINATIONS) {
      try {
        const cea = await PushChain.utils.account.deriveExecutorAccount(
          orchestratorOnPush,
          {
            chain: PushChain.CONSTANTS.CHAIN[d.chainKey],
            skipNetworkCheck: true,
          }
        );
        next[d.label] = cea.address;
      } catch (err) {
        console.warn(`CEA derivation failed for ${d.label}`, err);
        next[d.label] = "";
      }
    }
    setCeaAddrs(next);
  };

  /// Read each destination's `count()` and `lastCaller()` over its own RPC.
  const readAllCounts = async () => {
    setLoading(true);
    const nextCounts: Record<string, bigint> = {};
    const nextCallers: Record<string, string> = {};
    await Promise.all(
      DESTINATIONS.map(async (d) => {
        try {
          const provider = new ethers.JsonRpcProvider(d.destinationRpc);
          const counter = new ethers.Contract(
            d.counterAddress,
            ExternalCounterABI,
            provider
          );
          const [c, lc] = await Promise.all([
            counter.count() as Promise<bigint>,
            counter.lastCaller() as Promise<string>,
          ]);
          nextCounts[d.label] = c;
          nextCallers[d.label] = lc;
        } catch (err) {
          console.warn(`count()/lastCaller() read failed for ${d.label}`, err);
        }
      })
    );
    setCounts(nextCounts);
    setLastCallers(nextCallers);
    setLoading(false);
  };

  /// Call `tickAll` on the Push-side orchestrator. Sends one outbound per
  /// destination in a single transaction. Subscribes to the SDK's per-step
  /// lifecycle events via `tx.progressHook(callback)` so the UI streams the
  /// route's stages as they happen (SEND-TX-1xx for Route 1 — orchestrator
  /// is on Push, so this is a Route 1 / cosmos universal tx).
  const tickAll = async () => {
    if (!pushChainClient || !PushChain) return;
    setTickLoading(true);
    setError("");
    setTxHash("");
    setProgressEvents([]);
    try {
      const perCallFee = DESTINATIONS.map(() => PER_CALL_FEE_PC);
      const total = perCallFee.reduce((a, b) => a + b, 0n);

      const data = PushChain.utils.helpers.encodeTxData({
        abi: MultiChainCounterABI,
        functionName: "tickAll",
        args: [perCallFee, ORCHESTRATOR_ADDRESS],
      });

      const tx = await pushChainClient.universal.sendTransaction({
        to: ORCHESTRATOR_ADDRESS,
        value: total,
        data,
      });
      setTxHash(tx.hash);

      // Register the progress hook BEFORE awaiting wait() so we receive every
      // lifecycle event the SDK fires for this tx (sign / verify / broadcast /
      // poll / settle, terminal status). Each event has { id, title, message,
      // level, response, timestamp }.
      tx.progressHook((event: ProgressEvent) => {
        setProgressEvents((prev) => [...prev, event]);
      });

      await tx.wait();

      // Wait for TSS relay then re-read counts a few times so the destination
      // counters update in the UI.
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 15_000));
        await readAllCounts();
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setTickLoading(false);
    }
  };

  useEffect(() => {
    if (PushChain) {
      deriveAllCEAs();
    }
  }, [PushChain]);

  useEffect(() => {
    readAllCounts();
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "white",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "2rem",
        width: "100%",
      }}
    >
      <h1 style={{ fontSize: "2.25rem", marginBottom: "0.5rem", color: "#222" }}>
        Universal Cross-Chain Counters
      </h1>
      <p
        style={{
          color: "gray",
          fontSize: "14px",
          margin: "0 0 2rem 0",
          padding: "0 0 1rem 0",
          maxWidth: "640px",
          textAlign: "center",
          borderBottom: "1px solid rgba(0, 0, 0, 0.1)",
        }}
      >
        One Push Chain contract dispatches an <code>increment()</code> outbound to{" "}
        <b>three external chains</b> in a single transaction. Each destination's{" "}
        <code>ExternalCounter</code> records the caller — when <code>lastCaller</code> matches
        the orchestrator's deterministic <b>CEA</b> on that chain, you've got visible proof
        the tick came from your Push contract.
      </p>

      <div style={{ marginBottom: "2rem" }}>
        <PushUniversalAccountButton />
      </div>

      <section style={{ width: "100%", maxWidth: "780px", marginBottom: "2rem" }}>
        <h3 style={{ fontSize: "1.1rem", color: "#444", marginBottom: "0.75rem" }}>
          Destinations
        </h3>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "14px",
          }}
        >
          <thead>
            <tr style={{ textAlign: "left", color: "#666" }}>
              <th style={cellHeader}>Chain</th>
              <th style={cellHeader}>Orchestrator's CEA</th>
              <th style={cellHeader}>Counter</th>
              <th style={cellHeader}>Count</th>
              <th style={cellHeader}>lastCaller</th>
            </tr>
          </thead>
          <tbody>
            {DESTINATIONS.map((d) => {
              const cea = ceaAddrs[d.label];
              const lastCaller = lastCallers[d.label];
              const matches =
                cea && lastCaller && cea.toLowerCase() === lastCaller.toLowerCase();
              return (
                <tr key={d.label}>
                  <td style={cell}>
                    <strong>{d.label}</strong>
                  </td>
                  <td style={cellMono}>
                    {cea ? short(cea) : "deriving…"}
                  </td>
                  <td style={cellMono}>
                    <a
                      href={`${d.explorerBase}/address/${d.counterAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#d548ec", textDecoration: "none" }}
                    >
                      {short(d.counterAddress)}
                    </a>
                  </td>
                  <td style={cell}>
                    {counts[d.label] !== undefined ? counts[d.label].toString() : "—"}
                  </td>
                  <td style={cellMono}>
                    {lastCaller ? short(lastCaller) : "—"}
                    {matches && (
                      <span
                        style={{
                          marginLeft: "6px",
                          fontSize: "11px",
                          color: "#15803d",
                          fontWeight: 600,
                        }}
                        title="lastCaller matches the orchestrator's CEA on this chain — visible proof the increment came from your Push contract"
                      >
                        ✓ CEA
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p style={{ fontSize: "12px", color: "#888", marginTop: "0.5rem" }}>
          Counts are read directly from each destination's RPC. They update automatically a
          few seconds after a successful <code>tickAll()</code>.
        </p>
      </section>

      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
        <button
          onClick={readAllCounts}
          disabled={loading}
          style={{
            padding: "10px 18px",
            fontSize: "0.95rem",
            backgroundColor: loading ? "#ccc" : "#f3f4f6",
            color: "#222",
            border: "1px solid #ddd",
            borderRadius: "10px",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Reading…" : "Refresh counts"}
        </button>

        {connectionStatus === "connected" && (
          <button
            onClick={tickAll}
            disabled={tickLoading}
            style={{
              padding: "10px 18px",
              fontSize: "1rem",
              fontWeight: 600,
              backgroundColor: tickLoading ? "#ccc" : "#d548ec",
              color: "white",
              border: "none",
              borderRadius: "10px",
              cursor: tickLoading ? "not-allowed" : "pointer",
            }}
          >
            {tickLoading ? "Ticking…" : "Tick all destinations"}
          </button>
        )}
      </div>

      {error && (
        <div style={{ color: "#b91c1c", fontSize: "0.9rem", marginTop: "0.5rem", maxWidth: "640px", textAlign: "center" }}>
          {error}
        </div>
      )}

      {progressEvents.length > 0 && (
        <section
          style={{
            width: "100%",
            maxWidth: "780px",
            marginTop: "1.5rem",
            padding: "1rem 1.25rem",
            backgroundColor: "#fafafa",
            border: "1px solid #e5e5e5",
            borderRadius: "10px",
            fontSize: "13px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: "0.5rem",
            }}
          >
            <h3 style={{ fontSize: "1rem", color: "#444", margin: 0 }}>
              Lifecycle events
            </h3>
            <span style={{ color: "#999", fontSize: "11px" }}>
              from <code>tx.progressHook(...)</code>
            </span>
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {progressEvents.map((p, i) => {
              const dot =
                p.level === "SUCCESS" ? "#16a34a" : p.level === "ERROR" ? "#b91c1c" : "#6b7280";
              return (
                <li
                  key={`${p.id}-${i}`}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    padding: "6px 0",
                    borderBottom: i < progressEvents.length - 1 ? "1px solid #eee" : "none",
                  }}
                >
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: dot,
                      marginTop: "6px",
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: "8px", alignItems: "baseline" }}>
                      <code style={{ fontSize: "11px", color: "#666" }}>{p.id}</code>
                      <strong style={{ fontSize: "13px", color: "#222" }}>{p.title}</strong>
                    </div>
                    {p.message && (
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#555",
                          marginTop: "2px",
                          wordBreak: "break-word",
                        }}
                      >
                        {p.message}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {txHash && pushChainClient && (
        <div
          style={{
            marginTop: "1rem",
            padding: "1rem",
            backgroundColor: "#f8f9fa",
            borderRadius: "8px",
            fontSize: "0.9rem",
            maxWidth: "640px",
          }}
        >
          <p style={{ margin: "0 0 0.5rem 0", fontWeight: 600 }}>Transaction submitted</p>
          <p style={{ margin: "0 0 0.5rem 0", wordBreak: "break-all" }}>
            <code style={{ fontSize: "0.8rem" }}>{txHash}</code>
          </p>
          <a
            href={pushChainClient.explorer.getTransactionUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#d548ec", textDecoration: "none" }}
          >
            View on Push explorer →
          </a>
        </div>
      )}

      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "12px 20px",
          borderTop: "1px solid rgba(0, 0, 0, 0.1)",
          background: "#fff",
          textAlign: "center",
        }}
      >
        <p style={{ color: "gray", fontSize: "12px", margin: 0 }}>
          <a
            href="https://github.com/pushchain/push-chain-examples/tree/main/tutorials/universal-cross-chain-counters"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#d548ec" }}
          >
            Source code
          </a>
          &nbsp;|&nbsp;
          <a
            href="https://push.org/docs/chain/tutorials/power-features/tutorial-universal-cross-chain-counters/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#d548ec" }}
          >
            Tutorial
          </a>
        </p>
      </div>
    </div>
  );
}

const cellHeader: React.CSSProperties = {
  padding: "8px 12px",
  borderBottom: "1px solid #ddd",
  fontWeight: 600,
};
const cell: React.CSSProperties = {
  padding: "8px 12px",
  borderBottom: "1px solid #eee",
};
const cellMono: React.CSSProperties = {
  ...cell,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: "12px",
};

function short(addr: string) {
  if (!addr || addr.length < 12) return addr || "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default App;
