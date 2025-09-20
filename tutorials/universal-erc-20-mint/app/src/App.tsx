import {
  PushUniversalAccountButton,
  usePushChain,
  usePushChainClient,
  usePushWalletContext,
} from "@pushchain/ui-kit";
import { ethers } from "ethers";
import { useEffect, useState } from "react";
import ERC20ABI from "./abi/ERC20.json";
import "./App.css";

// Contract address for the deployed Counter contract
const CONTRACT_ADDRESS = "0x0165878A594ca255338adfa4d48449f69242Eb8F";

// Global provider for Push Chain testnet
const provider = new ethers.JsonRpcProvider(
  "https://evm.rpc-testnet-donut-node1.push.org/"
);

function App() {
  const { connectionStatus } = usePushWalletContext();
  const { pushChainClient } = usePushChainClient();
  const { PushChain } = usePushChain();

  const [balance, setBalance] = useState<number>(-1);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [txHash, setTxHash] = useState<string>("");

  // Function to read the $UNICORN Balance
  const readBalance = async () => {
    if (connectionStatus === "connected" && pushChainClient) {
      try {
        const contract = new ethers.Contract(
          CONTRACT_ADDRESS,
          ERC20ABI,
          provider
        );

        const balance = await contract.balanceOf(
          pushChainClient.universal.account
        );

        // Convert from wei to human readable format (18 decimals)
        const formattedBalance = ethers.formatUnits(balance, 18);
        setBalance(Number(formattedBalance));
      } catch (err) {
        console.error("Error reading balance:", err);
        setError("Failed to read user balance");
      }
    }
  };

  // Read balance when account is connected
  useEffect(() => {
    if (connectionStatus === "connected" && pushChainClient) {
      readBalance();
    }

    // status reset
    // reset balance
    if (!pushChainClient) {
      setBalance(-1);
    }
  }, [connectionStatus, pushChainClient]);

  // Function to increment the counter
  const mintToken = async () => {
    if (connectionStatus === "connected" && pushChainClient) {
      try {
        setIsLoading(true);
        setError("");

        // Send transaction to mint tokens
        const tx = await pushChainClient.universal.sendTransaction({
          to: CONTRACT_ADDRESS,
          data: PushChain.utils.helpers.encodeTxData({
            abi: ERC20ABI,
            functionName: "mint",
            args: [
              pushChainClient.universal.account,
              ethers.parseUnits("100", 18),
            ], // Mint 100 tokens
          }),
          value: BigInt(0),
        });

        setTxHash(tx.hash);

        // Wait for transaction to be mined
        await tx.wait();

        // Refresh counter values
        await readBalance();

        setIsLoading(false);
      } catch (err) {
        console.error("Transaction error:", err);
        setError("Failed to mint token");
        setIsLoading(false);
      }
    } else {
      setError("Please connect your wallet first");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "white",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        width: "100%",
      }}
    >
      <h1
        style={{
          fontSize: "2.5rem",
          marginBottom: "2rem",
          color: "#333",
          textAlign: "center",
        }}
      >
        Mint Universal ERC-20 Example
      </h1>
      <p
        style={{
          color: "gray",
          fontSize: "14px",
          margin: "-1rem 0 5rem 0",
          padding: "0 0 1rem 0",
          maxWidth: "480px",
          borderBottom: "1px solid rgba(0, 0, 0, 0.1)",
        }}
      >
        This tutorial demonstrates a Universal ERC-20 token on Push Chain. Any
        user, whether from Ethereum, Solana, Push or any supported chain can
        mint the same token (<b>$UNICORN</b>) directly from their wallet.
        <p />
        &nbsp;
        <p />
        You don't require any bridging, wrapping, etc. Simply connect wallet and
        mint.
      </p>

      <div style={{ marginBottom: "2rem" }}>
        <PushUniversalAccountButton />
      </div>

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
          Please connect your wallet to view and mint balance.
        </p>
      )}

      <div
        style={{
          fontSize: "1.5rem",
          marginBottom: "1rem",
          color: "#333",
          textAlign: "center",
        }}
      >
        <p>User Balance: {balance == -1 ? "..." : (
          <>
              {balance}
            <span 
              style={{
                background: 'linear-gradient(90deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3)',
                backgroundSize: '400% 400%',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                animation: 'rainbow 3s ease-in-out infinite',
              }}
            >
            {' $UNICORN'}
            </span>
          </>
        )}</p>
        {balance != -1 && (
          <p style={{
            fontSize: "0.8rem",
            marginTop: "0.5rem",
            marginBottom: "1rem",
            color: "#333",
            textAlign: "center",
            margin: "0 auto",
            maxWidth: "480px",
          }}>
            Optional: Add <b>0x0165878A594ca255338adfa4d48449f69242Eb8F</b> ($UNICORN Token Address) to your
            wallet to see your balance in the wallet.
          </p>
        )}
      </div>

      {connectionStatus === "connected" && (
        <div style={{ textAlign: "center" }}>
          <button
            onClick={mintToken}
            disabled={isLoading}
            style={{
              padding: "12px 24px",
              fontSize: "1.1rem",
              fontWeight: "bold",
              backgroundColor: isLoading ? "#ccc" : "#d548ec",
              color: "white",
              border: "none",
              borderRadius: "12px",
              cursor: isLoading ? "not-allowed" : "pointer",
              marginBottom: "1rem",
            }}
          >
            {isLoading ? "Minting..." : "Mint Token"}
          </button>

          {error && (
            <div
              style={{
                color: "#dc3545",
                fontSize: "0.9rem",
                marginTop: "1rem",
              }}
            >
              {error}
            </div>
          )}

          {txHash && pushChainClient && (
            <div
              style={{
                marginTop: "1rem",
                padding: "1rem",
                backgroundColor: "#f8f9fa",
                borderRadius: "6px",
                fontSize: "0.9rem",
              }}
            >
              <p style={{ margin: "0 0 0.5rem 0", fontWeight: "bold" }}>
                Transaction Successful!
              </p>
              <p style={{ margin: "0 0 0.5rem 0" }}>
                Hash:{" "}
                <code style={{ fontSize: "0.8rem", wordBreak: "break-all" }}>
                  {txHash}
                </code>
              </p>
              <a
                href={pushChainClient.explorer.getTransactionUrl(txHash)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "#d548ec",
                  textDecoration: "none",
                  fontSize: "0.9rem",
                  borderRadius: "12px",
                }}
              >
                View on Explorer →
              </a>
            </div>
          )}
        </div>
      )}

      <div
        style={{
          position: "fixed",
          bottom: "0",
          left: "0",
          right: "0",
          margin: "40px 0 0 0",
          padding: "12px 20px",
          borderTop: "1px solid rgba(0, 0, 0, 0.1)",
          background: "#fff",
        }}
      >
        <p
          style={{
            color: "gray",
            fontSize: "12px",
          }}
        >
          <a
            href="https://github.com/pushchain/push-chain-examples/tree/main/tutorials/universal-erc-20-mint/app"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#d548ec" }}
          >
            Source Code
          </a>{" "}
          |&nbsp;
          <a
            href="https://donut.push.network/address/0x0165878A594ca255338adfa4d48449f69242Eb8F?tab=contract"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#d548ec" }}
          >
            Smart Contract
          </a>
        </p>
      </div>
    </div>
  );
}

export default App;
