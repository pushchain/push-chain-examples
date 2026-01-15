import {
  PushUniversalAccountButton,
  usePushChain,
  usePushChainClient,
  usePushWalletContext,
} from "@pushchain/ui-kit";
import { ethers } from "ethers";
import { useEffect, useState } from "react";
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

  const [manualLookupAddress, setManualLookupAddress] = useState<string>("");
  const [manualLookupChain, setManualLookupChain] = useState<string>(
    PushChain.CONSTANTS.CHAIN.ETHEREUM_SEPOLIA
  );
  const [manualLookupResult, setManualLookupResult] = useState<string>("");
  const [isCheckingUEA, setIsCheckingUEA] = useState<boolean>(false);

  const chains = [
    { value: PushChain.CONSTANTS.CHAIN.PUSH_TESTNET, label: "Push Chain" },
    {
      value: PushChain.CONSTANTS.CHAIN.ETHEREUM_SEPOLIA,
      label: "Ethereum Sepolia",
    },
    { value: PushChain.CONSTANTS.CHAIN.SOLANA_DEVNET, label: "Solana Devnet" },
    { value: PushChain.CONSTANTS.CHAIN.BASE_SEPOLIA, label: "Base Sepolia" },
    {
      value: PushChain.CONSTANTS.CHAIN.ARBITRUM_SEPOLIA,
      label: "Arbitrum Sepolia",
    },
    { value: PushChain.CONSTANTS.CHAIN.BNB_TESTNET, label: "BNB Testnet" },
  ];

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
              PushChain.utils.helpers.parseUnits("100", 18),
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
        Derive Universal Executor Account Example
      </h1>
      <p
        style={{
          color: "gray",
          fontSize: "14px",
          margin: "-1rem 0 3rem 0",
          padding: "0 0 1rem 0",
          maxWidth: "480px",
          borderBottom: "1px solid rgba(0, 0, 0, 0.1)",
        }}
      >
        <p>
          This example demonstrates how any wallet, from Ethereum, Solana, or
          any supported chain, can deterministically derive a{" "}
          <b>Universal Executor Account (UEA)</b> on Push Chain.
        </p>
        &nbsp;
        <p>
          Push Chain maps the external wallet to a single executor account that
          can sign, pay fees, and execute transactions natively on Push.
        </p>
        &nbsp;
        <p>
          The origin wallet remains the user’s identity and No new keys are
          created.
        </p>
        &nbsp;
        <p>
          This derived UEA becomes the execution surface for all future
          interactions, regardless of the user’s origin chain.
        </p>
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
          Please connect your wallet to see it in action.
        </p>
      )}

      {connectionStatus === "connected" && pushChainClient && (
        <div
          style={{
            marginBottom: "2rem",
            padding: "1.5rem",
            backgroundColor: "#f9f9f9",
            borderRadius: "12px",
            maxWidth: "600px",
            width: "100%",
          }}
        >
          <h3
            style={{
              fontSize: "1rem",
              marginBottom: "1rem",
              color: "#0066cc",
              fontWeight: "bold",
            }}
          >
            🔑 Your Universal Executor Account (UEA)
          </h3>
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "8px",
              padding: "1rem",
              marginBottom: "0.75rem",
            }}
          >
            <p
              style={{
                margin: "0 0 0.5rem 0",
                fontSize: "0.85rem",
                color: "#666",
                fontWeight: "bold",
              }}
            >
              Origin Wallet:
            </p>
            <p
              style={{
                margin: "0 0 0.5rem 0",
                fontSize: "0.8rem",
                color: "#333",
                fontFamily: "monospace",
                wordBreak: "break-all",
              }}
            >
              {pushChainClient.universal.origin.address}
            </p>
            <p
              style={{
                margin: 0,
                fontSize: "0.75rem",
                color: "#999",
              }}
            >
              Chain:{" "}
              {PushChain.utils.chains.getChainName(
                pushChainClient.universal.origin.chain
              )}
            </p>
          </div>
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "8px",
              padding: "1rem",
            }}
          >
            <p
              style={{
                margin: "0 0 0.5rem 0",
                fontSize: "0.85rem",
                color: "#666",
                fontWeight: "bold",
              }}
            >
              Universal Executor Account (UEA):
            </p>
            <p
              style={{
                margin: 0,
                fontSize: "0.8rem",
                color: "#d548ec",
                fontFamily: "monospace",
                wordBreak: "break-all",
                fontWeight: "bold",
              }}
            >
              {pushChainClient.universal.account}
            </p>
          </div>
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          margin: "1rem 0 1rem 0",
          maxWidth: "600px",
          width: "100%",
        }}
      >
        <div
          style={{
            flex: 1,
            height: "1px",
            background: "linear-gradient(to right, transparent, #d548ec)",
          }}
        />
        <div
          style={{
            padding: "0 1.5rem",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "1.2rem",
              fontWeight: "bold",
              color: "#d548ec",
              marginBottom: "0.25rem",
            }}
          >
            OR
          </div>
          <div
            style={{
              fontSize: "0.85rem",
              color: "#666",
              fontWeight: "500",
            }}
          >
            Derive UEA from Any Wallet
          </div>
        </div>
        <div
          style={{
            flex: 1,
            height: "1px",
            background: "linear-gradient(to left, transparent, #d548ec)",
          }}
        />
      </div>

      <div
        style={{
          marginTop: "3rem",
          marginBottom: "2rem",
          padding: "1.5rem",
          backgroundColor: "#f9f9f9",
          borderRadius: "12px",
          maxWidth: "600px",
          width: "100%",
        }}
      >
        <p
          style={{
            fontSize: "0.85rem",
            color: "#666",
            marginBottom: "1rem",
          }}
        >
          Enter any wallet address and chain to derive its Universal Executor
          Account:
        </p>

        <label
          style={{
            display: "block",
            fontSize: "0.85rem",
            color: "#666",
            marginBottom: "0.5rem",
            fontWeight: "bold",
          }}
        >
          Chain:
        </label>
        <select
          value={manualLookupChain}
          onChange={(e) => setManualLookupChain(e.target.value)}
          style={{
            width: "100%",
            padding: "0.75rem",
            fontSize: "0.9rem",
            borderRadius: "8px",
            border: "1px solid #ddd",
            marginBottom: "1rem",
          }}
        >
          {chains.map((chain) => (
            <option key={chain.value} value={chain.value}>
              {chain.label}
            </option>
          ))}
        </select>

        <label
          style={{
            display: "block",
            fontSize: "0.85rem",
            color: "#666",
            marginBottom: "0.5rem",
            fontWeight: "bold",
          }}
        >
          Wallet Address:
        </label>
        <input
          type="text"
          value={manualLookupAddress}
          onChange={(e) => setManualLookupAddress(e.target.value)}
          placeholder="Enter address (e.g., 0x...)"
          style={{
            width: "100%",
            padding: "0.75rem",
            fontSize: "0.9rem",
            borderRadius: "8px",
            border: "1px solid #ddd",
            marginBottom: "1rem",
            fontFamily: "monospace",
          }}
        />

        <button
          onClick={async () => {
            if (!manualLookupAddress.trim()) {
              setError("Please enter an address");
              return;
            }

            setIsCheckingUEA(true);
            setError("");
            setManualLookupResult("");

            try {
              const account = PushChain.utils.account.toUniversal(
                manualLookupAddress,
                {
                  chain: manualLookupChain as any,
                }
              );

              const executorAddress =
                await PushChain.utils.account.convertOriginToExecutor(account);
              setManualLookupResult(executorAddress.address);
            } catch (err) {
              console.error("Error deriving UEA:", err);
              setError("Failed to derive Universal Executor Account");
            } finally {
              setIsCheckingUEA(false);
            }
          }}
          disabled={isCheckingUEA}
          style={{
            width: "100%",
            padding: "0.75rem",
            fontSize: "1rem",
            fontWeight: "bold",
            backgroundColor: isCheckingUEA ? "#999" : "#2196f3",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: isCheckingUEA ? "not-allowed" : "pointer",
            marginBottom: "1rem",
          }}
        >
          {isCheckingUEA ? "Deriving..." : "Derive UEA"}
        </button>

        {manualLookupResult && (
          <div
            style={{
              padding: "1rem",
              backgroundColor: "#e8f5e9",
              borderRadius: "8px",
              border: "1px solid #4caf50",
            }}
          >
            <p
              style={{
                margin: "0 0 0.5rem 0",
                fontSize: "0.9rem",
                fontWeight: "bold",
                color: "#333",
              }}
            >
              ✅ Universal Executor Account (UEA):
            </p>
            <p
              style={{
                margin: 0,
                fontSize: "0.8rem",
                color: "#d548ec",
                fontFamily: "monospace",
                wordBreak: "break-all",
                fontWeight: "bold",
              }}
            >
              {manualLookupResult}
            </p>
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          margin: "1rem 0 1rem 0",
          maxWidth: "600px",
          width: "100%",
        }}
      >
        <div
          style={{
            flex: 1,
            height: "1px",
            background: "linear-gradient(to right, transparent, #d548ec)",
          }}
        />
        <div
          style={{
            padding: "0 1.5rem",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "1.2rem",
              fontWeight: "bold",
              color: "#d548ec",
              marginBottom: "0.25rem",
            }}
          >
            OR
          </div>
          <div
            style={{
              fontSize: "0.85rem",
              color: "#666",
              fontWeight: "500",
            }}
          >
            Derive UEA from Smart Contract
          </div>
        </div>
        <div
          style={{
            flex: 1,
            height: "1px",
            background: "linear-gradient(to left, transparent, #d548ec)",
          }}
        />
      </div>

      <div
        style={{
          marginTop: "3rem",
          marginBottom: "6rem",
          padding: "1.5rem",
          backgroundColor: "#f9f9f9",
          borderRadius: "12px",
          maxWidth: "600px",
          width: "100%",
        }}
      >
        <p
          style={{
            fontSize: "0.85rem",
            color: "#666",
            marginBottom: "1rem",
            lineHeight: "1.6",
          }}
        >
          You can also derive UEA addresses directly in your smart contracts
          using the <b>UEAFactory</b> contract:
        </p>

        <div
          style={{
            backgroundColor: "#1e1e1e",
            borderRadius: "8px",
            padding: "1rem",
            marginBottom: "1rem",
            overflow: "auto",
          }}
        >
          <pre
            style={{
              margin: 0,
              fontSize: "0.75rem",
              color: "#d4d4d4",
              fontFamily: "monospace",
              lineHeight: "1.5",
              textAlign: "left",
            }}
          >
            {`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "push-chain-core-contracts/src/Interfaces/IUEAFactory.sol";

contract MyContract {
    IUEAFactory constant FACTORY = 
        IUEAFactory(0x00000000000000000000000000000000000000eA);

    function getUEAForUser(
        string memory chainNamespace,
        string memory chainId,
        bytes memory owner
    ) public view returns (address uea, bool isDeployed) {
        UniversalAccountId memory account = UniversalAccountId({
            chainNamespace: chainNamespace,
            chainId: chainId,
            owner: owner
        });
        
        return FACTORY.getUEAForOrigin(account);
    }
    
    function checkOrigin(address addr) 
        public view returns (UniversalAccountId memory, bool) {
        return FACTORY.getOriginForUEA(addr);
    }
}`}
          </pre>
        </div>

        <div
          style={{
            backgroundColor: "white",
            borderRadius: "8px",
            padding: "1rem",
            border: "1px solid #e0e0e0",
          }}
        >
          <p
            style={{
              margin: "0 0 0.75rem 0",
              fontSize: "0.85rem",
              fontWeight: "bold",
              color: "#333",
            }}
          >
            UEAFactory Address:
          </p>
          <code
            style={{
              fontSize: "0.75rem",
              color: "#d548ec",
              fontFamily: "monospace",
              wordBreak: "break-all",
              fontWeight: "bold",
            }}
          >
            0x00000000000000000000000000000000000000eA
          </code>
          <p
            style={{
              margin: "1rem 0 0.5rem 0",
              fontSize: "0.85rem",
              fontWeight: "bold",
              color: "#333",
            }}
          >
            Key Methods:
          </p>
          <ul
            style={{
              margin: "0.5rem 0 0 0",
              paddingLeft: "1.5rem",
              fontSize: "0.8rem",
              color: "#666",
              lineHeight: "1.8",
            }}
          >
            <li>
              <code style={{ color: "#d548ec" }}>getUEAForOrigin()</code> - Get
              UEA address for any wallet
            </li>
            <li>
              <code style={{ color: "#d548ec" }}>getOriginForUEA()</code> - Get
              origin wallet from UEA
            </li>
          </ul>
          <p
            style={{
              margin: "1rem 0 0 0",
              fontSize: "0.75rem",
              color: "#999",
              fontStyle: "italic",
            }}
          >
            Learn more in the{" "}
            <a
              href="https://push.org/docs/chain/build/contract-helpers"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#d548ec", textDecoration: "none" }}
            >
              Contract Helpers documentation
            </a>
          </p>
        </div>
      </div>

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
            href="https://github.com/pushchain/push-chain-examples/tree/main/tutorials/derive-universal-executor-account/app"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#d548ec" }}
          >
            Source Code
          </a>
        </p>
      </div>
    </div>
  );
}

export default App;
