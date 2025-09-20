import {
  PushUniversalAccountButton,
  usePushChain,
  usePushChainClient,
  usePushWalletContext,
} from "@pushchain/ui-kit";
import { ethers } from "ethers";
import { useEffect, useState } from "react";
import CounterABI from "./abi/UniversalCounter.json";
import "./App.css";

// Contract address for the deployed Counter contract
const COUNTER_CONTRACT_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

// Global provider for Push Chain testnet
const provider = new ethers.JsonRpcProvider(
  "https://evm.rpc-testnet-donut-node1.push.org/"
);

function App() {
  const { connectionStatus } = usePushWalletContext();
  const { pushChainClient } = usePushChainClient();
  const { PushChain } = usePushChain();

  const [counter, setCounter] = useState<number>(0);
  const [countPC, setCountPC] = useState<number>(0);
  const [countETH, setCountETH] = useState<number>(0);
  const [countSOL, setCountSOL] = useState<number>(0);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [txHash, setTxHash] = useState<string>("");

  // Function to read the current counter value
  const readCounter = async () => {
    try {
      const contract = new ethers.Contract(
        COUNTER_CONTRACT_ADDRESS,
        CounterABI,
        provider
      );

      const currentCount = await contract.getCount();
      const currentCountPC = await contract.countPC();
      const currentCountETH = await contract.countEth();
      const currentCountSOL = await contract.countSol();

      setCounter(Number(currentCount));
      setCountPC(Number(currentCountPC));
      setCountETH(Number(currentCountETH));
      setCountSOL(Number(currentCountSOL));
    } catch (err) {
      console.error("Error reading counter:", err);
      setError("Failed to read counter value");
    }
  };

  // Function to increment the counter
  const incrementCounter = async () => {
    if (connectionStatus === "connected" && pushChainClient) {
      try {
        setIsLoading(true);
        setError("");

        // Send transaction to increment counter
        const tx = await pushChainClient.universal.sendTransaction({
          to: COUNTER_CONTRACT_ADDRESS,
          data: PushChain.utils.helpers.encodeTxData({
            abi: CounterABI,
            functionName: "increment",
          }),
          value: BigInt(0),
        });

        setTxHash(tx.hash);

        // Wait for transaction to be mined
        await tx.wait();

        // Refresh counter values
        await readCounter();

        setIsLoading(false);
      } catch (err) {
        console.error("Transaction error:", err);
        setError("Failed to increment counter");
        setIsLoading(false);
      }
    } else {
      setError("Please connect your wallet first");
    }
  };

  // Read counter value on component mount and when account changes
  useEffect(() => {
    readCounter();
  }, []);

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
        Universal Counter Example
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
        This tutorial demonstrates the <b>Universal Counter</b> — a contract that identifies whether a user is from Push Chain, Ethereum, or Solana, and attributes counts accordingly. We keep the logic simple with hardcoded chains. For a more dynamic approach, see the {" "}
        <a
          href="https://github.com/pushchain/push-chain-examples/tree/main/tutorials/universal-counter-dynamic/app"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#d548ec" }}
        >
          dynamic example
        </a>
        .
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
          Please connect your wallet to interact with the counter
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
        <p>Counter: {counter}</p>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "1rem",
            fontSize: "1rem",
            marginTop: "1rem",
          }}
        >
          <p>PC Counter: {countPC}</p>
          <p>ETH Counter: {countETH}</p>
          <p>SOL Counter: {countSOL}</p>
        </div>
      </div>

      {connectionStatus === "connected" && (
        <div style={{ textAlign: "center" }}>
          <button
            onClick={incrementCounter}
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
            {isLoading ? "Incrementing..." : "Increment Counter"}
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
            href="https://github.com/pushchain/push-chain-examples/tree/main/tutorials/universal-counter/app"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#d548ec" }}
          >
            Source Code
          </a>{" "}
          |&nbsp;
          <a
            href="https://donut.push.network/address/0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512?tab=contract"
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
