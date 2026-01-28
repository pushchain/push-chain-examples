import {
    PushUniversalAccountButton,
    usePushChain,
    usePushChainClient,
    usePushWalletContext,
} from "@pushchain/ui-kit";
import { ethers } from "ethers";
import { useCallback, useEffect, useState } from "react";
import CounterABI from "./abi/Counter.json";
import ERC20ABI from "./abi/ERC20.json";
import "./App.css";

// Contract address for the deployed Counter contract
const COUNTER_CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

// ERC20 contract address for the deployed ERC20 contract
const ERC20_CONTRACT_ADDRESS = "0x0165878A594ca255338adfa4d48449f69242Eb8F";

// Global provider for Push Chain testnet
const provider = new ethers.JsonRpcProvider(
  "https://evm.donut.rpc.push.org/"
);

function App() {
  const { connectionStatus } = usePushWalletContext();
  const { pushChainClient } = usePushChainClient();
  const { PushChain } = usePushChain();

  const [counter, setCounter] = useState<number>(0);
  const [balance, setBalance] = useState<number>(0);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [txHash, setTxHash] = useState<string>("");

  // Function to read the current counter value and balance
  const readStatus = useCallback(async () => {
    try {
      // Read counter value
      const counterContract = new ethers.Contract(
        COUNTER_CONTRACT_ADDRESS,
        CounterABI,
        provider
      );
      const currentCount = await counterContract.countPC();
      setCounter(Number(currentCount));

      // Read ERC20 balance if wallet is connected
      if (pushChainClient && connectionStatus === "connected") {
        const erc20Contract = new ethers.Contract(
          ERC20_CONTRACT_ADDRESS,
          ERC20ABI,
          provider
        );
        const bal = await erc20Contract.balanceOf(pushChainClient.universal.account);
        setBalance(Number(ethers.formatUnits(bal, 18)));
      }
    } catch (err) {
      console.error("Error reading status:", err);
      setError("Failed to read contract values");
    }
  }, [pushChainClient, connectionStatus]);

  // Function to execute batch transaction (increment counter + mint tokens)
  const executeBatchTransaction = async () => {
    if (connectionStatus === "connected" && pushChainClient) {
      try {
        setIsLoading(true);
        setError("");

        // Create function call for Counter.increment()
        const incrementData = PushChain.utils.helpers.encodeTxData({
          abi: CounterABI,
          functionName: "increment",
        });

        // Create function call for ERC20.mint()
        const mintData = PushChain.utils.helpers.encodeTxData({
          abi: ERC20ABI,
          functionName: "mint",
          args: [
            pushChainClient.universal.account,
            PushChain.utils.helpers.parseUnits("11", 18), // 11 tokens in wei
          ],
        });

        // Create batch transaction
        const batchTx = await pushChainClient.universal.sendTransaction({
          to: pushChainClient.universal.account,
          data: [
            { to: COUNTER_CONTRACT_ADDRESS, value: BigInt(0), data: incrementData },
            { to: ERC20_CONTRACT_ADDRESS, value: BigInt(0), data: mintData },
          ],
        });

        setTxHash(batchTx.hash);

        // Wait for transaction to be mined
        await batchTx.wait();

        // Refresh counter and balance values
        await readStatus();

        setIsLoading(false);
      } catch (err) {
        console.error("Transaction error:", err);
        setError("Failed to execute batch transaction");
        setIsLoading(false);
      }
    } else {
      setError("Please connect your wallet first");
    }
  };

  // Read status on component mount and when connection changes
  useEffect(() => {
    if (pushChainClient && connectionStatus === "notConnected") {
      setCounter(0);
      setBalance(0);
    }
    readStatus();
  }, [connectionStatus, pushChainClient, readStatus]);

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
        Batch Transactions (Multicall) Example
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
        Batch Transactions (Multicall) demonstrate how Push Chain enables executing multiple contract calls in a single transaction, reducing gas costs and improving UX.
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
          Please connect your wallet to execute batch transactions (multicall).
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
        <p>Balance: {balance} $UNICORN</p>
      </div>

      {balance > 0 && (
        <div style={{ maxWidth: "500px", textAlign: "center", fontSize: "0.75rem", marginBottom: "1rem" }}>
          <p>
            Optional: Add <b>{ERC20_CONTRACT_ADDRESS}</b> ($UNICORN Token Address) to your wallet to see your balance.
          </p>
        </div>
      )}

      {connectionStatus === "connected" && (
        <div style={{ textAlign: "center" }}>
          <button
            onClick={executeBatchTransaction}
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
            {isLoading ? "Executing..." : "Do Batch Transaction"}
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
            href="https://github.com/pushchain/push-chain-examples/tree/main/tutorials/simple-counter/app"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#d548ec" }}
          >
            Source Code
          </a>{" "}
          |&nbsp;
          <a
            href="https://donut.push.network/address/0x5FbDB2315678afecb367f032d93F642f64180aa3?tab=contract"
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
