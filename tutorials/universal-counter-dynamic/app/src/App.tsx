import {
  PushUniversalAccountButton,
  usePushChain,
  usePushChainClient,
  usePushWalletContext,
} from "@pushchain/ui-kit";
import { ethers } from "ethers";
import { useEffect, useState } from "react";
import UCDynamicABI from "./abi/UniversalCounterDynamic.json";
import "./App.css";

// Contract address for the deployed Counter contract
const COUNTER_CONTRACT_ADDRESS = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";

// Global provider for Push Chain testnet
const provider = new ethers.JsonRpcProvider(
  "https://evm.rpc-testnet-donut-node1.push.org/"
);

function App() {
  const { connectionStatus } = usePushWalletContext();
  const { pushChainClient } = usePushChainClient();
  const { PushChain } = usePushChain();

  const [counter, setCounter] = useState<number>(0);
  const [chainData, setChainData] = useState<Array<{chainHash: string, count: number, uniqueCount: number}>>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [txHash, setTxHash] = useState<string>("");

  // Function to read the current counter value
  const readCounter = async () => {
    try {
      const contract = new ethers.Contract(
        COUNTER_CONTRACT_ADDRESS,
        UCDynamicABI,
        provider
      );

      const [totalCount] = await contract.getCount();
      setCounter(Number(totalCount));

      // Get all chain data
      const newChainData: Array<{chainHash: string, count: number, uniqueCount: number}> = [];
      let chainIndex = 0;
      
      try {
        while (true) {
          const chainHash = await contract.chainIds(chainIndex);
          const count = await contract.chainCount(chainHash);
          const uniqueCount = await contract.chainCountUnique(chainHash);
          
          newChainData.push({
            chainHash: ethers.hexlify(chainHash),
            count: Number(count),
            uniqueCount: Number(uniqueCount)
          });
          
          chainIndex++;
        }
      } catch (error) {
        // Expected error when we reach the end of the array
      }
      
      setChainData(newChainData);
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
            abi: UCDynamicABI,
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
        position: "fixed",
        top: 0,
        left: 0,
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
        Universal Dynamic Counter Example
      </h1>
      <p
        style={{
          color: "gray",
          fontSize: "14px",
          margin: "-1rem 0 5rem 0",
          padding: "0 0 1rem 0",
          maxWidth: "480px",
          pointerEvents: "auto",
          borderBottom: "1px solid rgba(0, 0, 0, 0.1)",
        }}
      >
        This tutorial shows how Push Chain enables a dynamic Universal Counter that automatically detects and tracks activity from any chain. Unlike the hardcoded version, this contract stores counters for each chain dynamically, including total and unique counts.
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
        {chainData.length > 0 && (
          <div style={{ marginTop: "2rem", maxWidth: "600px" }}>
            <h3 style={{ fontSize: "1.2rem", marginBottom: "1rem", color: "#333" }}>Chain Data</h3>
            <table style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.9rem",
              backgroundColor: "white",
              borderRadius: "8px",
              overflow: "hidden",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
            }}>
              <thead>
                <tr style={{ backgroundColor: "#f8f9fa" }}>
                  <th style={{ padding: "12px", textAlign: "left", borderBottom: "1px solid #dee2e6" }}>Chain Name</th>
                  <th style={{ padding: "12px", textAlign: "center", borderBottom: "1px solid #dee2e6" }}>Count</th>
                  <th style={{ padding: "12px", textAlign: "center", borderBottom: "1px solid #dee2e6" }}>Unique Count</th>
                </tr>
              </thead>
              <tbody>
                {chainData.map((chain, index) => (
                  <tr key={index} style={{ borderBottom: index < chainData.length - 1 ? "1px solid #dee2e6" : "none" }}>
                    <td style={{ padding: "12px", fontFamily: "monospace", fontSize: "0.8rem", wordBreak: "break-all" }}>
                      {PushChain.utils.helpers.getChainName(ethers.toUtf8String(chain.chainHash))}
                    </td>
                    <td style={{ padding: "12px", textAlign: "center", fontWeight: "bold" }}>
                      {chain.count}
                    </td>
                    <td style={{ padding: "12px", textAlign: "center", fontWeight: "bold" }}>
                      {chain.uniqueCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
          pointerEvents: "auto",
        }}
      >
        <p
          style={{
            color: "gray",
            fontSize: "12px",
          }}
        >
          <a
            href="https://github.com/pushchain/push-chain-examples/tree/main/tutorials/universal-counter/app-dynamic"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#d548ec" }}
          >
            Source Code
          </a>{" "}
          |&nbsp;
          <a
            href="https://donut.push.network/address/0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9?tab=contract"
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
