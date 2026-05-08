import {
  PushUniversalAccountButton,
  usePushChain,
  usePushChainClient,
  usePushWalletContext,
} from "@pushchain/ui-kit";
import { useEffect, useMemo, useState } from "react";
import "./App.css";

type CEARow = {
  chainNamespace: string;
  chainName: string;
  ceaAddress: string;
  isDeployed: boolean | "n/a";
  error?: string;
};

function App() {
  const { connectionStatus } = usePushWalletContext();
  const { pushChainClient } = usePushChainClient();
  const { PushChain } = usePushChain();

  const [rows, setRows] = useState<CEARow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const ueaAddress = useMemo(
    () => (pushChainClient ? pushChainClient.universal.account : null),
    [pushChainClient]
  );

  useEffect(() => {
    if (!ueaAddress || !PushChain) {
      setRows([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        // Step 1: Wrap the UEA into a UniversalAccount on Push Chain.
        const pushAccount = PushChain.utils.account.toUniversal(ueaAddress, {
          chain: PushChain.CONSTANTS.CHAIN.PUSH_TESTNET,
        });

        // Step 2: Look up every supported chain for the current network.
        const { chains } = PushChain.utils.chains.getSupportedChains(
          PushChain.CONSTANTS.PUSH_NETWORK.TESTNET
        );

        // Step 3: For each external chain, derive the CEA via the documented
        // PushChain.utils.account.deriveExecutorAccount(account, { chain })
        // call. The `chain` option produces a CEA on that chain instead of a UEA.
        const out: CEARow[] = [];
        for (const chain of chains) {
          if (chain === PushChain.CONSTANTS.CHAIN.PUSH_TESTNET) continue;
          const chainName =
            PushChain.utils.chains.getChainName(chain) ?? chain;
          try {
            const cea = await PushChain.utils.account.deriveExecutorAccount(
              pushAccount,
              { chain }
            );
            out.push({
              chainNamespace: chain,
              chainName,
              ceaAddress: cea.address,
              isDeployed: "deployed" in cea ? cea.deployed ?? "n/a" : "n/a",
            });
          } catch (err) {
            out.push({
              chainNamespace: chain,
              chainName,
              ceaAddress: "",
              isDeployed: "n/a",
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        if (!cancelled) setRows(out);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ueaAddress, PushChain]);

  return (
    <div className="app-container">
      <h1 className="app-title">CEA Wallet Flow</h1>
      <p className="app-subtitle">
        A <strong>Chain Executor Account (CEA)</strong> is the deterministic
        address that a Push Chain wallet controls on every supported external
        chain. Connect your wallet to derive all CEAs from your Push account.
      </p>

      <div className="connect-row">
        <PushUniversalAccountButton />
      </div>

      {connectionStatus !== "connected" && (
        <p className="muted" style={{ marginTop: "-0.25rem" }}>
          Connect your wallet to derive CEAs.
        </p>
      )}

      {connectionStatus === "connected" && pushChainClient && (
        <div className="section">
          <h3>🔑 Your Push Chain Account</h3>
          <div className="kv-row">
            <span className="kv-label">Origin Wallet</span>
            <span className="kv-value">
              {pushChainClient.universal.origin.address}
            </span>
          </div>
          <div className="kv-row">
            <span className="kv-label">Origin Chain</span>
            <span className="kv-value">
              {PushChain.utils.chains.getChainName(
                pushChainClient.universal.origin.chain
              ) ?? pushChainClient.universal.origin.chain}
            </span>
          </div>
          <div className="kv-row">
            <span className="kv-label">UEA on Push</span>
            <span className="kv-value">{pushChainClient.universal.account}</span>
          </div>
        </div>
      )}

      {connectionStatus === "connected" && (
        <div className="section">
          <h3>🛰️ Your CEA Addresses</h3>
          {loading && <p className="muted">Deriving CEAs across supported chains…</p>}
          {error && (
            <p className="muted" style={{ color: "#c0392b" }}>
              Failed to load CEAs: {error}
            </p>
          )}
          {!loading && rows.length > 0 && (
            <table className="cea-table">
              <thead>
                <tr>
                  <th>Chain</th>
                  <th>CEA Address</th>
                  <th>Deployed</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.chainNamespace}
                    className={row.isDeployed === true ? "deployed" : "undeployed"}
                  >
                    <td>
                      <div>{row.chainName}</div>
                      <div className="muted">{row.chainNamespace}</div>
                    </td>
                    <td>
                      {row.error ? (
                        <span className="muted">— {row.error}</span>
                      ) : (
                        row.ceaAddress
                      )}
                    </td>
                    <td>{String(row.isDeployed)}</td>
                    <td>
                      {row.ceaAddress && (
                        <button
                          className="copy-btn"
                          onClick={() => navigator.clipboard.writeText(row.ceaAddress)}
                        >
                          Copy
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="callout">
            <strong>How to use a CEA:</strong> CEAs start undeployed. To
            activate one, fund the address on the corresponding chain (e.g.,
            send Sepolia ETH to the Sepolia CEA). The CEA contract is deployed
            automatically on first use. Once funded, the connected Push wallet
            can originate transactions from that chain via Routes 2 and 3 — see{" "}
            <a
              href="https://github.com/pushchain/push-chain-examples/tree/main/core-sdk-functions/cea-origin-transaction"
              target="_blank"
              rel="noopener noreferrer"
            >
              cea-origin-transaction
            </a>
            .
          </div>
        </div>
      )}

      <div className="section">
        <h3>📚 What's happening under the hood</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          For every external chain returned by{" "}
          <code>PushChain.utils.chains.getSupportedChains(TESTNET)</code>, this
          app calls{" "}
          <code>
            PushChain.utils.account.deriveExecutorAccount(pushAccount, {"{ chain }"})
          </code>
          . The <code>chain</code> option flips the call from "UEA on Push
          Chain" to "CEA on that external chain" — the same documented utility
          handles both directions.
        </p>
      </div>
    </div>
  );
}

export default App;
