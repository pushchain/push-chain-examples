import {
  PushUniversalAccountButton,
  usePushChain,
  usePushChainClient,
  usePushWalletContext,
} from "@pushchain/ui-kit";
import { PublicKey } from "@solana/web3.js";
import { useEffect, useMemo, useState } from "react";
import "./App.css";

type CEARow = {
  chainNamespace: string;
  chainName: string;
  ceaAddress: string;
  isDeployed: boolean;
  error?: string;
};

// SVM chains return CEA addresses as 32-byte hex; show them in the
// base58 form Solana developers expect.
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, "");
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return bytes;
}

function formatChainAddress(chain: string, address: string): string {
  if (!chain.startsWith("solana:")) return address;
  if (!address) return address;
  try {
    return new PublicKey(hexToBytes(address)).toBase58();
  } catch {
    return address;
  }
}

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
        // PushChain.utils.account.deriveExecutorAccount(account, { chain }) call.
        // The `chain` option produces a CEA on that chain instead of a UEA.
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
            // Normalize deployment status: SVM chains can return `null`
            // (no on-chain check available); treat null/undefined the same as
            // false — both mean "not yet deployed" from the user's perspective.
            const isDeployed = cea.deployed === true;
            out.push({
              chainNamespace: chain,
              chainName,
              ceaAddress: cea.address,
              isDeployed,
            });
          } catch (err) {
            out.push({
              chainNamespace: chain,
              chainName,
              ceaAddress: "",
              isDeployed: false,
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
      {/* Title */}
      <h1 className="app-title">Derive Chain Executor Account Example</h1>

      {/* Description */}
      <p className="app-description">
        <p>
          This example demonstrates how a Push Chain wallet can deterministically
          derive a <b>Chain Executor Account (CEA)</b> on every supported
          external chain.
        </p>
        &nbsp;
        <p>
          A CEA is the address that holds your assets and executes transactions
          on an external chain on your behalf. CEAs are the inverse of UEAs:
          UEA = your external wallet's executor on Push Chain; CEA = your Push
          Chain wallet's executor on Sepolia, BNB, Solana, etc.
        </p>
        &nbsp;
        <p>
          Connect your wallet to derive the deterministic CEA address you
          control on each supported external chain.
        </p>
      </p>

      {/* Wallet connection button */}
      <div style={{ marginBottom: "2rem" }}>
        <PushUniversalAccountButton />
      </div>

      {/* Connection prompt */}
      {connectionStatus !== "connected" && (
        <p
          style={{
            fontSize: "0.9rem",
            color: "gray",
            textAlign: "center",
            marginTop: "-1rem",
            marginBottom: "2rem",
          }}
        >
          Please connect your wallet to derive your CEAs.
        </p>
      )}

      {/* Connected Push account */}
      {connectionStatus === "connected" && pushChainClient && (
        <div className="info-box info-box-blue">
          <h3 className="info-box-title">🔑 Your Push Chain Account</h3>

          <div className="info-card">
            <p className="label-text">Origin Wallet:</p>
            <p className="address-text">
              {pushChainClient.universal.origin.address}
            </p>
            <p className="chain-label">
              Chain:{" "}
              {PushChain.utils.chains.getChainName(
                pushChainClient.universal.origin.chain
              ) ?? pushChainClient.universal.origin.chain}
            </p>
          </div>

          <div className="info-card">
            <p className="label-text">UEA on Push Chain:</p>
            <p className="uea-address">{pushChainClient.universal.account}</p>
          </div>
        </div>
      )}

      {/* Divider */}
      {connectionStatus === "connected" && (
        <div className="divider-container">
          <div className="divider-line-left" />
          <div className="divider-content">
            <div className="divider-or">↓</div>
            <div className="divider-subtitle">CEAs on External Chains</div>
          </div>
          <div className="divider-line-right" />
        </div>
      )}

      {/* CEA list */}
      {connectionStatus === "connected" && (
        <div className="info-box" style={{ marginTop: "1rem" }}>
          <h3
            className="info-box-title"
            style={{ color: "#d548ec" }}
          >
            🛰️ Your Chain Executor Accounts
          </h3>

          {loading && (
            <p className="muted">Deriving CEAs across supported chains…</p>
          )}
          {error && (
            <p className="muted" style={{ color: "#c0392b" }}>
              Failed to load CEAs: {error}
            </p>
          )}

          {!loading &&
            rows.map((row) => {
              const displayAddress = formatChainAddress(
                row.chainNamespace,
                row.ceaAddress
              );
              return (
                <div className="info-card" key={row.chainNamespace}>
                  <div className="cea-card-header">
                    <span className="cea-card-chain">{row.chainName}</span>
                    <span className="cea-card-namespace">
                      {row.chainNamespace}
                    </span>
                  </div>

                  {row.error ? (
                    <p className="muted" style={{ marginTop: "0.5rem" }}>
                      — {row.error}
                    </p>
                  ) : (
                    <p className="uea-address">{displayAddress}</p>
                  )}

                  <div className="cea-card-row">
                    <span
                      className={
                        row.isDeployed
                          ? "cea-status deployed"
                          : "cea-status undeployed"
                      }
                    >
                      {row.isDeployed ? "Deployed" : "Not deployed"}
                    </span>
                    {displayAddress && (
                      <button
                        className="btn-secondary"
                        onClick={() =>
                          navigator.clipboard.writeText(displayAddress)
                        }
                      >
                        Copy address
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

          <div className="callout">
            <strong>How to use a CEA:</strong> CEAs start undeployed. They
            activate the first time you target their chain via Route 2 — fund
            your UEA on Push Chain, then send a Route 2 universal transaction
            to that external chain. Once deployed, the CEA can also originate
            Route 3 transactions back to Push Chain. See{" "}
            <a
              href="https://github.com/pushchain/push-chain-examples/tree/main/core-sdk-functions/send-universal-transaction-to-external-chains"
              target="_blank"
              rel="noopener noreferrer"
            >
              send-universal-transaction-to-external-chains
            </a>{" "}
            for a runnable example.
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="footer">
        <p className="footer-text">
          <a
            href="https://github.com/pushchain/push-chain-examples/tree/main/tutorials/derive-chain-executor-account/app"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            Source Code
          </a>
        </p>
      </div>
    </div>
  );
}

export default App;
