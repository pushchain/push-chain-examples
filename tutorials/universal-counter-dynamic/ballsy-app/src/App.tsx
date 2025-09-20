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
  usePushChain,
  usePushChainClient,
  usePushWalletContext,
} from "@pushchain/ui-kit";

// Import Ethers
import { ethers } from "ethers";

// Import ABI
import UniversalCounterABI from "./abi/UniversalCounter.json";

// Contract address for the Universal Counter
const CONTRACT_ADDRESS = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";

// Use the imported ABI

// Interface for chain data
interface ChainData {
  chainHash: string;
  chainName: string;
  totalCount: number;
  uniqueCount: number;
  color: string;
}

const App = () => {
  // Counter state variables
  const [chainData, setChainData] = useState<ChainData[]>([]);
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
  const footerRef = useRef<HTMLParagraphElement>(null);

  // Function to encode transaction data for increment function
  const getTxData = () => {
    if (!pushChainClient) return "";

    return PushChain.utils.helpers.encodeTxData({
      abi: UniversalCounterABI,
      functionName: "increment",
    });
  };

  // Helper function to get chain name from raw bytes
  const getChainName = (chainHash: string): string => {
    // Convert hex string back to UTF-8 to get the original chainNamespace:chainId
    try {
      // Remove '0x' prefix if present
      const hexString = chainHash.startsWith('0x') ? chainHash.slice(2) : chainHash;
      
      // Convert hex to bytes and then to UTF-8 string
      const bytes = ethers.getBytes('0x' + hexString);
      const chainString = ethers.toUtf8String(bytes);
      
      const chainHumanName = PushChain.utils.helpers.getChainName(chainString);

      if (chainHumanName) {
        // Split on underscore and take only the part before it if underscore is present
        const chainName = chainHumanName.split('_')[0];
        return chainName.charAt(0).toUpperCase() + chainName.slice(1).toLowerCase();
      } else {
        return "Unknown";
      }
    } catch (error) {
      // If decoding fails, return a shortened hash
      return `Unknown`;
    }
  };

  // Helper function to get chain color
  const getChainColor = (chainHash: string): string => {
    const chainHumanName = getChainName(chainHash);

    if (chainHumanName.toUpperCase().includes('PUSH')) return PUSH_CHAIN_COLOR;
    if (chainHumanName.toUpperCase().includes('ETHEREUM')) return ETHEREUM_COLOR;
    if (chainHumanName.toUpperCase().includes('SOLANA')) return SOLANA_COLOR;

    // Default colors for other chains
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dda0dd'];
    return colors[Math.abs(chainHash.charCodeAt(0)) % colors.length];
  };

  // Function to fetch counter values
  const fetchCounters = async () => {
    try {
      setIsLoading(true);
      
      // Create a contract instance for read operations
      const provider = new ethers.JsonRpcProvider(
        "https://evm.rpc-testnet-donut-node1.push.org/"
      );
      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        UniversalCounterABI,
        provider
      );

      // Get total counts
      const [newTotalCount, newTotalUniqueCount] = await contract.getCount();
      
      // Get all chain IDs (we need to iterate through the chainIds array)
      const newChainData: ChainData[] = [];
      let chainIndex = 0;
      
      try {
        // Keep fetching chain IDs until we get an error (array bounds)
        while (true) {
          const chainHash = await contract.chainIds(chainIndex);
          
          // Check if this is a valid chain (not just ":")
          try {
            const hexString = chainHash.startsWith('0x') ? chainHash.slice(2) : chainHash;
            const bytes = ethers.getBytes('0x' + hexString);
            const chainString = ethers.toUtf8String(bytes);
            
            // Skip chains that are just ":" or empty
            if (chainString === ':' || chainString.trim() === '') {
              chainIndex++;
              continue;
            }
          } catch (error) {
            // Skip invalid chain hashes
            chainIndex++;
            continue;
          }
          
          const totalCount = await contract.chainCount(chainHash);
          const uniqueCount = await contract.chainCountUnique(chainHash);
          
          const chainName = getChainName(chainHash);
          const color = getChainColor(chainHash);
          
          newChainData.push({
            chainHash,
            chainName,
            totalCount: Number(totalCount),
            uniqueCount: Number(uniqueCount),
            color
          });
          
          chainIndex++;
        }
      } catch (error) {
        // Expected error when we reach the end of the array

      }
      

      
      // Check if this is the initial load
      const isInitialLoad = chainData.length === 0;
      // Add balls for visual feedback (only when counters increase, not on initial load)
      if (newChainData.length === 0) {
        // Initial load - don't add balls for existing counters to avoid spam

      } else {
        // On subsequent loads, only add balls if counters have increased
        newChainData.forEach(newChain => {
          const oldChain = chainData.find(c => c.chainHash === newChain.chainHash);
          if (oldChain && newChain.totalCount > oldChain.totalCount) {
            const diff = newChain.totalCount - oldChain.totalCount;

            addMultipleBlockchainBalls(newChain.color, diff);
          } else if (!oldChain && newChain.totalCount > 0) {
            // New chain appeared

            addMultipleBlockchainBalls(newChain.color, newChain.totalCount);
          }
        });
      }

      // Update state
      setChainData(newChainData);
    } catch (err) {
      console.error("Error fetching counter values:", err);
    } finally {
      setIsLoading(false);
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

        // Refresh counter values - this will automatically add balls for the increment
        await fetchCounters();

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

      fetchCounters();
      initialFetchDoneRef.current = true;
      lastFetchTimeRef.current = Date.now();
    } else {

    }

    // Create WebSocket connection
    const wsUrl = "wss://evm.ws-testnet-donut-node1.push.org/";
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {

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

          
          // Extract blockchain ID from the event data
          const blockchainIdHex = data.params.result.topics[1];
          const blockchainId = parseInt(blockchainIdHex, 16);
          

          
          // Check if enough time has passed since the last fetch
          const now = Date.now();
          if (now - lastFetchTimeRef.current > FETCH_DEBOUNCE_MS) {

            // Refresh counters to update the UI and drop balls
            fetchCounters();
            lastFetchTimeRef.current = now;
          } else {

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
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1, // Higher than content (zIndex: 20) to allow ball interaction
          pointerEvents: showMatter ? "auto" : "none", // Enable interaction when physics is active
        }}
      >
        {showMatter && (
          <MatterComponent
            physicBodyRefs={[cardRef, counterBoxRef, footerRef]}
            fullScreen={true}
          />
        )}
      </div>

      <div
        style={{
          position: "absolute",
          top: "40px",
          left: "0",
          right: "0",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          zIndex: 20,
          padding: "20px",
          pointerEvents: "none",
        }}
      >
        <h1 ref={headingRef} style={{ pointerEvents: "auto"}}>Ballsy</h1>
        <p style={{ color: "gray", fontSize: "14px", marginTop: "-20px", maxWidth: "480px", pointerEvents: "auto"}}>
        Ballsy lets every chain battle for glory 🏆. No matter if you’re on Ethereum, Solana, or Push Chain, your clicks count towards your chain’s leaderboard. One app, shared across all chains.
        </p>
        
        <div
          style={{
            padding: "10px 10px 20px 10px",
            borderRadius: "8px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "15px",
            maxWidth: "800px",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", gap: "15px", marginBottom: "20px" }}>
            <div ref={cardRef} style={{ width: "200px", pointerEvents: "auto" }}>
              <PushUniversalAccountButton />
            </div>

            {connectionStatus ===
              PushUI.CONSTANTS.CONNECTION.STATUS.CONNECTED && (
              <div ref={counterBoxRef} style={{ width: "200px" }}>
                <button
                  onClick={handleIncrement}
                  disabled={isLoading}
                  style={{
                    width: "100%",
                    height: "100%",
                    padding: "12px",
                    fontSize: "16px",
                    backgroundColor: isLoading ? "#727272" : "#d548ec",
                    color: "white",
                    border: "none",
                    borderRadius: "12px",
                    cursor: isLoading ? "not-allowed" : "pointer",
                    pointerEvents: "auto"
                  }}
                >
                  {isLoading ? "Processing..." : "Increment Counter"}
                </button>
              </div>
            )}
          </div>

          <div>
            {/* Leaderboard Table */}
            <div className="responsive-leaderboard" style={{ pointerEvents: "auto" }}>
              <h3 style={{ margin: '0 0 1rem 0', textAlign: 'center' }}>
                Universal Leaderboard
              </h3>
              {chainData.length === 0 && 
                <p>Loading Leaderboard...</p>
              } 

              {chainData.length !== 0 && 
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '14px'
                }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Rank</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Chain</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Total Count</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Unique Users</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chainData
                      .sort((a, b) => b.totalCount - a.totalCount)
                      .map((chain, index) => (
                        <tr key={chain.chainHash} style={{ 
                          borderBottom: '1px solid #eee',
                          backgroundColor: index === 0 ? chain.color + '10' : 'transparent'
                        }}>
                          <td style={{ padding: '8px' }}>
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
                          </td>
                          <td style={{ padding: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                backgroundColor: chain.color
                              }}></div>
                              {chain.chainName}
                            </div>
                          </td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>
                            {chain.totalCount}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'right' }}>
                            {chain.uniqueCount}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              }
            </div>
            
            {/* Controls section - outside the leaderboard table */}
            <div style={{ display: "flex", gap: "10px", margin: "20px 0", flexDirection: "column", alignItems: "center", pointerEvents: "auto" }}>
              {connectionStatus ===
                PushUI.CONSTANTS.CONNECTION.STATUS.CONNECTED && (
                <div style={{ display: "grid", gap: "10px", width: "100%", maxWidth: "480px" }}>
                  {txHash && pushChainClient && (
                    <>
                      <div
                        style={{ display: "flex", gap: "10px", marginTop: "10px", justifyContent: "center" }}
                      >
                        <a
                          href={pushChainClient.explorer.getTransactionUrl(txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "#d548ec", 
                            backgroundColor: "transparent", 
                            padding: "8px 16px", 
                            border: "none", 
                            cursor: "pointer", }}
                        >
                          View in Explorer
                        </a>
                        <button
                          onClick={fetchCounters}
                          style={{
                            backgroundColor: "transparent",
                            color: "#d548ec",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          Refresh Leaderboard
                        </button>
                      </div>
                      <div>
                        <p style={{ fontSize: "12px", margin: "0px", textAlign: "center" }}>Transaction Hash: {txHash}</p>
                      </div>
                    </>
                  )}
                </div>
              )}
            
              {/* <button
                onClick={() => setShowMatter(!showMatter)}
                style={{
                  marginTop: "20px",
                  padding: "8px 16px",
                  backgroundColor: "#6c757d",
                  color: "white",
                  border: "none",
                  borderRadius: "12px",
                  width: '200px',
                }}
              >
                {showMatter ? "Hide Physics" : "Show Physics"}
              </button> */}
            </div>
          </div>

          <div ref={footerRef} style={{ 
            margin: "20px 0 0 0",
            padding: "12px 20px",
            borderTop: "1px solid rgba(0, 0, 0, 0.1)",
            pointerEvents: "auto",
          }}>
            <p style={{ 
              color: "gray", 
              fontSize: "14px",
              textAlign: "center",
              marginTop: "0px"
            }}>
             Made with 💖 and only possible with Push Chain.
            </p>
            <p style={{ 
              color: "gray", 
              fontSize: "12px",
            }}>
              <a href="https://github.com/pushchain/push-chain-examples/tree/main/tutorials/universal-counter/ballsy-app" target="_blank" rel="noopener noreferrer" style={{ color: "#d548ec" }}>Source Code</a> |&nbsp;
              <a href="https://donut.push.network/address/0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9?tab=contract" target="_blank" rel="noopener noreferrer" style={{ color: "#d548ec" }}>Smart Contract</a>
            </p>
          </div>

          
        </div>
      </div>
    </>
  );
};

export default App;
