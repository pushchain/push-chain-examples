// Import React
import React, { useEffect, useRef, useState } from "react";
import "./App.css";

// Import Matter component
import MatterComponent, {
  addMultipleBlockchainBalls,
  ETHEREUM_COLOR,
  PUSH_CHAIN_COLOR,
  SOLANA_COLOR,
} from "./Matter";

// Import UI Kit
import {
  PushUI,
  PushUniversalAccountButton,
  usePushChainClient,
  usePushWalletContext,
  usePushChain,
} from "@pushchain/ui-kit";

// Import Ethers
import { ethers } from "ethers";

// Import ABI
import UniversalCounterABI from "./abi/UniversalCounter.json";

// Contract address for the Universal Counter
const CONTRACT_ADDRESS = "0x07E7Ca060A4b5BcDa61A6B701305ef0Ee29E1A3e";

// Use the imported ABI

const App: React.FC = () => {
  // Counter state variables
  const [countEth, setCountEth] = useState(-1);
  const [countSol, setCountSol] = useState(-1);
  const [countPC, setCountPC] = useState(-1);
  const [showMatter, setShowMatter] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isIncrementing, setIsIncrementing] = useState(false);
  const [txHash, setTxHash] = useState("");

  // Get PushChain context and client
  const { connectionStatus } = usePushWalletContext();
  const { pushChainClient } = usePushChainClient();
  const { PushChain } = usePushChain();

  // Create refs for elements that will interact with Matter.js physics
  const headingRef = useRef<HTMLHeadingElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const counterBoxRef = useRef<HTMLDivElement>(null);

  // Function to encode transaction data for increment function
  const getTxData = () => {
    if (!pushChainClient) return "";

    return PushChain.utils.helpers.encodeTxData({
      abi: UniversalCounterABI,
      functionName: "increment",
    });
  };

  // Function to fetch counter values
  const fetchCounters = async () => {
    try {
      // Create a contract instance for read operations
      const provider = new ethers.JsonRpcProvider(
        "https://evm.rpc-testnet-donut-node1.push.org/"
      );
      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        UniversalCounterABI,
        provider
      );

      // Fetch counter values
      const ethCount = await contract.countEth();
      const solCount = await contract.countSol();
      const pcCount = await contract.countPC();
      
      // Convert to numbers
      const newEthCount = Number(ethCount);
      const newSolCount = Number(solCount);
      const newPCCount = Number(pcCount);
      
      console.log("Fetched counter values:", { newEthCount, newSolCount, newPCCount });
      
      // Check if this is the initial load or a refresh
      const isInitialLoad = countEth === -1 && countSol === -1 && countPC === -1;
      
      if (isInitialLoad) {
        // On initial load, drop the exact number of balls for each counter
        console.log("Initial load - dropping balls for current counts");
        if (newEthCount > 0) addMultipleBlockchainBalls(ETHEREUM_COLOR, newEthCount);
        if (newSolCount > 0) addMultipleBlockchainBalls(SOLANA_COLOR, newSolCount);
        if (newPCCount > 0) addMultipleBlockchainBalls(PUSH_CHAIN_COLOR, newPCCount);
      } else {
        // On subsequent loads, only add balls if the counter has increased
        if (newEthCount > countEth) {
          const diff = newEthCount - countEth;
          console.log(`ETH counter increased by ${diff} - adding balls`);
          addMultipleBlockchainBalls(ETHEREUM_COLOR, diff);
        }
        
        if (newSolCount > countSol) {
          const diff = newSolCount - countSol;
          console.log(`SOL counter increased by ${diff} - adding balls`);
          addMultipleBlockchainBalls(SOLANA_COLOR, diff);
        }
        
        if (newPCCount > countPC) {
          const diff = newPCCount - countPC;
          console.log(`PC counter increased by ${diff} - adding balls`);
          addMultipleBlockchainBalls(PUSH_CHAIN_COLOR, diff);
        }
      }

      // Update state
      setCountEth(newEthCount);
      setCountSol(newSolCount);
      setCountPC(newPCCount);
    } catch (err) {
      console.error("Error fetching counter values:", err);
    }
  };

  // Handle transaction to increment counter
  const handleIncrement = async () => {
    if (connectionStatus === "connected" && pushChainClient) {
      try {
        setIsLoading(true);
        setIsIncrementing(true);

        // Send transaction to increment counter
        const tx = await pushChainClient.universal.sendTransaction({
          to: CONTRACT_ADDRESS,
          data: getTxData(),
          value: BigInt(0),
        });

        setTxHash(tx.hash);

        // Wait for transaction to be mined
        await tx.wait();

        // Refresh counter values
        // await fetchCounters();

        // Add a single Push Chain colored ball for immediate visual feedback
        // The fetchCounters will handle adding any additional balls needed
        addMultipleBlockchainBalls(PUSH_CHAIN_COLOR, 1);

        setIsLoading(false);
      } catch (err) {
        console.error("Transaction error:", err);
        setIsLoading(false);
      } finally {
        setIsIncrementing(false);
      }
    } else {
      alert("Please connect your wallet first");
    }
  };

  // This function has been merged with handleIncrement

  // Create a ref to track if initial fetch has been done
  const initialFetchDoneRef = useRef(false);
  // Create a ref to track the last fetch timestamp to debounce multiple calls
  const lastFetchTimeRef = useRef(0);
  // Minimum time between fetches in milliseconds
  const FETCH_DEBOUNCE_MS = 1000;

  // Set up WebSocket connection for real-time updates
  useEffect(() => {
    // Only fetch counters on the initial mount, not when dependencies change
    if (!initialFetchDoneRef.current) {
      console.log("Component mounted, fetching initial counter values...");
      fetchCounters();
      initialFetchDoneRef.current = true;
      lastFetchTimeRef.current = Date.now();
    } else {
      console.log("Skipping initial fetch as it was already done");
    }

    // Create WebSocket connection
    const wsUrl = "wss://evm.ws-testnet-donut-node1.push.org/";
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("WebSocket connected");
      // Subscribe to CountIncremented events
      const subscribeMsg = {
        id: 1,
        jsonrpc: "2.0",
        method: "eth_subscribe",
        params: [
          "logs",
          {
            address: CONTRACT_ADDRESS,
            topics: [
              "0x3d4a04291c66b06f39a4ecb817875b12b5485a05ec563133a56a905305c48e55", // CountIncremented event signature
            ],
          },
        ],
      };
      ws.send(JSON.stringify(subscribeMsg));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.method === "eth_subscription" && data.params?.result?.topics) {
          // This is a CountIncremented event
          console.log("Received CountIncremented event:", data);
          
          // Extract blockchain ID from the event data
          const blockchainIdHex = data.params.result.topics[1];
          const blockchainId = parseInt(blockchainIdHex, 16);
          
          console.log(`Blockchain ID from event: ${blockchainId}`);
          
          // Check if enough time has passed since the last fetch
          const now = Date.now();
          if (now - lastFetchTimeRef.current > FETCH_DEBOUNCE_MS) {
            console.log("Debounce time passed, fetching counters...");
            // Refresh counters to update the UI and drop balls
            fetchCounters();
            lastFetchTimeRef.current = now;
          } else {
            console.log("Skipping fetchCounters due to debounce");
          }
        }
      } catch (err) {
        console.error("Error processing WebSocket message:", err);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    // Clean up WebSocket connection on component unmount
    return () => {
      ws.close();
    };
  }, [pushChainClient, connectionStatus]);

  return (
    <>
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1,
        }}
      >
        {showMatter && (
          <MatterComponent
            physicBodyRefs={[cardRef, counterBoxRef]}
            fullScreen={true}
          />
        )}
      </div>

      <div
        style={{
          position: "absolute",
          top: "80px",
          left: "0",
          right: "0",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          zIndex: 20,
          padding: "20px",
        }}
      >
        <h1 ref={headingRef}>Ballsy</h1>

        <div
          style={{
            padding: "20px",
            borderRadius: "8px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "15px",
            maxWidth: "800px",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", gap: "15px" }}>
            <div ref={cardRef} style={{ width: "200px" }}>
              <PushUniversalAccountButton />
            </div>

            {connectionStatus ===
              PushUI.CONSTANTS.CONNECTION.STATUS.CONNECTED && (
              <div ref={counterBoxRef} style={{ width: "200px" }}>
                <button
                  onClick={handleIncrement}
                  disabled={isLoading}
                  style={{
                    padding: "18px 20px",
                    fontSize: "16px",
                    backgroundColor: isLoading ? "#727272" : "#d548ec",
                    color: "white",
                    border: "none",
                    borderRadius: "12px",
                    cursor: isLoading ? "not-allowed" : "pointer",
                  }}
                >
                  {isLoading ? "Processing..." : "Increment Counter"}
                </button>
              </div>
            )}
          </div>

          {connectionStatus !==
            PushUI.CONSTANTS.CONNECTION.STATUS.CONNECTED && (
            <p style={{ color: "gray", fontSize: "14px", marginTop: "0px" }}>
              Please connect your wallet to interact with the counter.
            </p>
          )}

          {countEth === -1 ? (
            <p>Calculating the Winner...</p>
          ) : (
            <div
              className={`winner-announcement ${
                countEth > countSol && countEth > countPC
                  ? "eth-winner"
                  : countSol > countEth && countSol > countPC
                  ? "sol-winner"
                  : "pc-winner"
              }`}
            >
              {countEth > countSol && countEth > countPC ? (
                <>
                  🎉 Ethereum Users are Winning! 🚀{" "}
                  <span style={{ fontSize: "1.8rem" }}>🏆</span>
                </>
              ) : countSol > countEth && countSol > countPC ? (
                <>
                  ✨ Solana Users areWinning! 🌟{" "}
                  <span style={{ fontSize: "1.8rem" }}>🏆</span>
                </>
              ) : (
                <>
                  🔥 Push Chain Users are Winning! 💪{" "}
                  <span style={{ fontSize: "1.8rem" }}>🏆</span>
                </>
              )}
            </div>
          )}
          <div
            style={{
              position: "fixed",
              bottom: "20px",
              left: "20px",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: "8px",
              backgroundColor: "rgba(255, 255, 255, 0.9)",
              padding: "15px",
              borderRadius: "8px",
              fontSize: "12px",
              zIndex: 30,
            }}
          >
            <h4 style={{ margin: "0 0 8px 0" }}>
              Total Universal Count:{" "}
              {countEth === -1 ? "..." : countEth + countSol + countPC}
            </h4>

            <div
              className="counter-box"
              style={{
                padding: "8px",
                backgroundColor: `${ETHEREUM_COLOR}66`,
                borderRadius: "8px",
                width: "200px",
                marginBottom: "4px",
              }}
            >
              <h4 style={{ margin: 0 }}>
                ETH: {countEth === -1 ? "..." : countEth}
              </h4>
            </div>

            <div
              className="counter-box"
              style={{
                padding: "8px",
                backgroundColor: `${SOLANA_COLOR}66`,
                borderRadius: "8px",
                width: "200px",
                marginBottom: "4px",
              }}
            >
              <h4 style={{ margin: 0 }}>
                Sol: {countSol === -1 ? "..." : countSol}
              </h4>
            </div>

            <div
              className="counter-box"
              style={{
                padding: "8px",
                backgroundColor: `${PUSH_CHAIN_COLOR}66`,
                borderRadius: "8px",
                width: "200px",
              }}
            >
              <h4 style={{ margin: 0 }}>
                PC: {countPC === -1 ? "..." : countPC}
              </h4>
            </div>

            <div
              className="counter-box"
              style={{
                padding: "8px",
                borderRadius: "8px",
                width: "200px",
              }}
            >
              <button
                onClick={() => setShowMatter(!showMatter)}
                style={{
                  marginTop: "20px",
                  padding: "8px 16px",
                  backgroundColor: "#6c757d",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                }}
              >
                {showMatter ? "Hide Physics" : "Show Physics"}
              </button>
            </div>
          </div>

          {connectionStatus ===
            PushUI.CONSTANTS.CONNECTION.STATUS.CONNECTED && (
            <div style={{ display: "grid", gap: "10px", width: "100%" }}>
              {txHash && pushChainClient && (
                <div
                  style={{ display: "grid", gap: "10px", marginTop: "10px" }}
                >
                  <p>
                    Transaction Hash: <code>{txHash}</code>
                  </p>
                  <a
                    href={pushChainClient.explorer.getTransactionUrl(txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#0066cc" }}
                  >
                    View in Explorer
                  </a>
                  <button
                    onClick={fetchCounters}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "#007bff",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Refresh Counter Values
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default App;
