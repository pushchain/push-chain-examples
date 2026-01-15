import {
  PushUniversalAccountButton,
  usePushChain,
  usePushChainClient,
  usePushWalletContext,
} from "@pushchain/ui-kit";
import { useState } from "react";
import "./App.css";

function App() {
  // Push Chain hooks for wallet connection and utilities
  const { connectionStatus } = usePushWalletContext();
  const { pushChainClient } = usePushChainClient();
  const { PushChain } = usePushChain();

  // State for manual UEA lookup
  const [manualLookupAddress, setManualLookupAddress] = useState<string>("");
  const [manualLookupChain, setManualLookupChain] = useState<string>(
    PushChain.CONSTANTS.CHAIN.ETHEREUM_SEPOLIA
  );
  const [manualLookupResult, setManualLookupResult] = useState<string>("");
  const [isCheckingUEA, setIsCheckingUEA] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // Supported chains for UEA derivation
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

  // Handler to derive UEA from any wallet address
  const handleDeriveUEA = async () => {
    if (!manualLookupAddress.trim()) {
      setError("Please enter an address");
      return;
    }

    setIsCheckingUEA(true);
    setError("");
    setManualLookupResult("");

    try {
      // Convert the origin address to a Universal Account
      const account = PushChain.utils.account.toUniversal(
        manualLookupAddress,
        {
          chain: manualLookupChain as any,
        }
      );

      // Derive the Universal Executor Account (UEA) address
      const executorAddress =
        await PushChain.utils.account.convertOriginToExecutor(account);
      setManualLookupResult(executorAddress.address);
    } catch (err) {
      console.error("Error deriving UEA:", err);
      setError("Failed to derive Universal Executor Account");
    } finally {
      setIsCheckingUEA(false);
    }
  };

  return (
    <div className="app-container">
      {/* Main title */}
      <h1 className="app-title">
        Derive Universal Executor Account Example
      </h1>
      
      {/* Description section */}
      <p className="app-description">
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
          The origin wallet remains the user’s identity and 
          the derived UEA becomes the execution surface for all future
          interactions, regardless of the user’s origin chain.
        </p>
      </p>

      {/* Wallet connection button */}
      <div style={{ marginBottom: "2rem" }}>
        <PushUniversalAccountButton />
      </div>

      {/* Connection prompt */}
      {connectionStatus !== "connected" && (
        <p style={{ fontSize: "0.9rem", color: "gray", textAlign: "center", marginTop: "-1rem", marginBottom: "2rem" }}>
          Please connect your wallet to see it in action.
        </p>
      )}

      {/* Display connected wallet's UEA information */}
      {connectionStatus === "connected" && pushChainClient && (
        <div className="info-box">
          <h3 style={{ fontSize: "1rem", marginBottom: "1rem", color: "#0066cc", fontWeight: "bold" }}>
            🔑 Your Universal Executor Account (UEA)
          </h3>
          
          {/* Origin wallet information */}
          <div className="info-card">
            <p className="label-text">Origin Wallet:</p>
            <p className="address-text">{pushChainClient.universal.origin.address}</p>
            <p className="chain-label">
              Chain: {PushChain.utils.chains.getChainName(pushChainClient.universal.origin.chain)}
            </p>
          </div>
          
          {/* Derived UEA address */}
          <div className="info-card">
            <p className="label-text">Universal Executor Account (UEA):</p>
            <p className="uea-address">{pushChainClient.universal.account}</p>
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="divider-container">
        <div className="divider-line-left" />
        <div className="divider-content">
          <div className="divider-or">OR</div>
          <div className="divider-subtitle">Derive UEA from Any Wallet</div>
        </div>
        <div className="divider-line-right" />
      </div>

      {/* Manual UEA derivation form */}
      <div className="info-box" style={{ marginTop: "3rem" }}>
        <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "1rem" }}>
          Enter any wallet address and chain to derive its Universal Executor Account:
        </p>

        {/* Chain selector */}
        <label className="form-label">Chain:</label>
        <select
          value={manualLookupChain}
          onChange={(e) => setManualLookupChain(e.target.value)}
          className="form-select"
        >
          {chains.map((chain) => (
            <option key={chain.value} value={chain.value}>
              {chain.label}
            </option>
          ))}
        </select>

        {/* Address input */}
        <label className="form-label">Wallet Address:</label>
        <input
          type="text"
          value={manualLookupAddress}
          onChange={(e) => setManualLookupAddress(e.target.value)}
          placeholder="Enter address (e.g., 0x...)"
          className="form-input"
        />

        {/* Derive button */}
        <button onClick={handleDeriveUEA} disabled={isCheckingUEA} className="btn-primary">
          {isCheckingUEA ? "Deriving..." : "Derive UEA"}
        </button>

        {/* Display derived UEA result */}
        {manualLookupResult && (
          <div className="result-box">
            <p className="result-title">✅ Universal Executor Account (UEA):</p>
            <p className="uea-address">{manualLookupResult}</p>
          </div>
        )}
      </div>

      {/* Second divider */}
      <div className="divider-container">
        <div className="divider-line-left" />
        <div className="divider-content">
          <div className="divider-or">OR</div>
          <div className="divider-subtitle">Derive UEA from Smart Contract</div>
        </div>
        <div className="divider-line-right" />
      </div>

      {/* Smart contract derivation section */}
      <div className="info-box" style={{ marginTop: "3rem", marginBottom: "6rem" }}>
        <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "1rem", lineHeight: "1.6" }}>
          You can also derive UEA addresses directly in your smart contracts using the <b>UEAFactory</b> contract:
        </p>

        {/* Solidity code example */}
        <div className="code-container">
          <pre className="code-block">
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

        {/* Contract information */}
        <div className="contract-info">
          <p className="label-text">UEAFactory Address:</p>
          <code className="contract-address">
            0x00000000000000000000000000000000000000eA
          </code>
          
          <p className="label-text" style={{ marginTop: "1rem" }}>Key Methods:</p>
          <ul className="method-list">
            <li>
              <code className="method-code">getUEAForOrigin()</code> - Get UEA address for any wallet
            </li>
            <li>
              <code className="method-code">getOriginForUEA()</code> - Get origin wallet from UEA
            </li>
          </ul>
          
          <p className="doc-link">
            Learn more in the{" "}
            <a href="https://push.org/docs/chain/build/contract-helpers" target="_blank" rel="noopener noreferrer">
              Contract Helpers documentation
            </a>
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="footer">
        <p className="footer-text">
          <a
            href="https://github.com/pushchain/push-chain-examples/tree/main/tutorials/derive-universal-executor-account/app"
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
