import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import {
  PushUniversalAccountButton,
  usePushChain,
  usePushChainClient,
  usePushWalletContext,
} from "@pushchain/ui-kit";
import { ethers } from "ethers";
import { useEffect, useState } from "react";
import UniversalAirdropABI from "./abi/UniversalAirdrop.json";
import "./App.css";

interface WalletEntry {
  address: string;
  chain: string;
  amount: string;
}

interface MerkleTreeData {
  tree: StandardMerkleTree<[string, string]>;
  root: string;
}

function App() {
  // Get Push Chain Core Hooks
  const { PushChain } = usePushChain();
  const { pushChainClient } = usePushChainClient('AirdropDeployer');
  const { pushChainClient: claimerPushChainClient } = usePushChainClient('AirdropClaimer');

  const { connectionStatus } = usePushWalletContext('AirdropDeployer');
  const { connectionStatus: claimerConnectionStatus } = usePushWalletContext('AirdropClaimer');

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [walletList, setWalletList] = useState<WalletEntry[]>([]);
  const [newWalletAddress, setNewWalletAddress] = useState<string>("");
  const [selectedChain, setSelectedChain] = useState<string>(PushChain.CONSTANTS.CHAIN.PUSH_TESTNET);
  const [airdropAmount, setAirdropAmount] = useState<string>("100");
  const [convertedAddresses, setConvertedAddresses] = useState<[string, string, string, string][]>([]);
  const [merkleRoot, setMerkleRoot] = useState<string>("");
  const [merkleTree, setMerkleTree] = useState<MerkleTreeData | null>(null);
  const [deployedAirdropAddress, setDeployedAirdropAddress] = useState<string>("");
  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [isClaiming, setIsClaiming] = useState<boolean>(false);
  const [claimerEligibility, setClaimerEligibility] = useState<{
    isEligible: boolean;
    hasClaimed: boolean;
    amount: string;
    executorAddress: string;
  } | null>(null);
  const [manualLookupAddress, setManualLookupAddress] = useState<string>("");
  const [manualLookupChain, setManualLookupChain] = useState<string>(PushChain.CONSTANTS.CHAIN.ETHEREUM_SEPOLIA);
  const [manualLookupResult, setManualLookupResult] = useState<{
    isEligible: boolean;
    hasClaimed: boolean;
    amount: string;
    executorAddress: string;
  } | null>(null);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState<boolean>(false);
  const [showMerkleData, setShowMerkleData] = useState<boolean>(false);

  const [error, setError] = useState<string>("");

  const FACTORY_ADDRESS = "0xa82fF9aFd8f496c3d6ac40E2a0F282E47488CFc9";

  const chains = [
    { value: PushChain.CONSTANTS.CHAIN.PUSH_TESTNET, label: "Push Chain" },
    { value: PushChain.CONSTANTS.CHAIN.ETHEREUM_SEPOLIA, label: "Ethereum Sepolia" },
    { value: PushChain.CONSTANTS.CHAIN.SOLANA_DEVNET, label: "Solana Devnet" },
    { value: PushChain.CONSTANTS.CHAIN.BASE_SEPOLIA, label: "Base Sepolia" },
    { value: PushChain.CONSTANTS.CHAIN.ARBITRUM_SEPOLIA, label: "Arbitrum Sepolia" },
    { value: PushChain.CONSTANTS.CHAIN.BNB_TESTNET, label: "BNB Testnet" },
  ];

  // Automatically add connected wallet to airdrop list
  useEffect(() => {
    if (connectionStatus === "connected" && pushChainClient?.universal.account && currentStep === 1) {
      setWalletList((prevList) => {
        // Check if wallet is already in the list
        const isAlreadyAdded = prevList.some(
          (entry) => entry.address.toLowerCase() === pushChainClient.universal.origin.address.toLowerCase()
        );

        if (!isAlreadyAdded) {
          const newEntry: WalletEntry = {
            address: pushChainClient.universal.origin.address,
            chain: pushChainClient.universal.origin.chain,
            amount: airdropAmount.toString(),
          };
          return [newEntry, ...prevList];
        }
        return prevList;
      });
    }
  }, [connectionStatus, pushChainClient, currentStep, PushChain.CONSTANTS.CHAIN.PUSH_TESTNET, airdropAmount]);

  const addWalletToList = () => {
    if (!newWalletAddress.trim()) {
      setError("Please enter a wallet address");
      return;
    }

    const newEntry: WalletEntry = {
      address: newWalletAddress.trim(),
      chain: selectedChain,
      amount: airdropAmount,
    };

    setWalletList([...walletList, newEntry]);
    setNewWalletAddress("");
    setError("");
  };

  const removeWallet = (index: number) => {
    setWalletList(walletList.filter((_, i) => i !== index));
  };

  const convertToPushChainAddresses = async () => {
    if (walletList.length === 0) {
      setError("Please add at least one wallet to the list");
      return;
    }

    try {
      // For each wallet and chain namespace, 
      // convert to UEA (Executor Account) on Push Chain
      const addressPromises = walletList.map(async (entry) => {
        // Convert to universal account
        const account = PushChain.utils.account.toUniversal(entry.address, {
          chain: entry.chain as PushChain.CONSTANTS.CHAIN
        });
        
        // derive deterministic address
        const executorAddress = await PushChain.utils.account.convertOriginToExecutor(account);

        // Return as tuple [executorAddress, amount, originalAddress, chain]
        return [
          executorAddress.address,
          ethers.parseUnits(entry.amount, 18).toString(),
          entry.address,
          entry.chain
        ] as [string, string, string, string];
      });

      const addresses = await Promise.all(addressPromises);

      // Save the converted addresses array
      setConvertedAddresses(addresses);
      setError("");
      
      // Move to Step 2
      setCurrentStep(2);
    } catch (err) {
      console.error("Error generating deterministic addresses on Push Chain:", err);
      setError("Failed to generate deterministic addresses on Push Chain");
    }
  };

  const generateMerkleTree = () => {
    if (convertedAddresses.length === 0) {
      setError("No converted addresses available");
      return;
    }

    try {
      // Prepare values for merkle tree: [address, amount]
      // This matches the contract's leaf generation: keccak256(bytes.concat(keccak256(abi.encode(address, amount))))
      const values: [string, string][] = convertedAddresses.map(([address, amount]) => [address, amount]);

      // Create StandardMerkleTree with double hashing (matching OpenZeppelin's MerkleProof.verify)
      const tree = StandardMerkleTree.of(values, ["address", "uint256"]);
      
      const root = tree.root;

      setMerkleRoot(root);
      setMerkleTree({ tree, root });
      setError("");
      
      // Move to Step 3
      setCurrentStep(3);
    } catch (err) {
      console.error("Error generating merkle tree:", err);
      setError("Failed to generate merkle tree");
    }
  };

  const deployAirdrop = async () => {
    if (!pushChainClient) {
      setError("Wallet not connected");
      return;
    }

    if (!merkleRoot) {
      setError("Merkle root not generated");
      return;
    }

    setIsDeploying(true);
    setError("");

    try {
      // Calculate total amount (sum of all amounts)
      const totalAmount = convertedAddresses.reduce(
        (sum, [, amount]) => sum + BigInt(amount),
        BigInt(0)
      );

      // Factory ABI for createAirdrop function
      const factoryABI = [
        {
          inputs: [
            { internalType: "uint256", name: "_totalAmount", type: "uint256" },
            { internalType: "bytes32", name: "_merkleRoot", type: "bytes32" }
          ],
          name: "createAirdrop",
          outputs: [{ internalType: "address", name: "", type: "address" }],
          stateMutability: "nonpayable",
          type: "function"
        }
      ];

      // Encode the transaction data using PushChain helper
      const txData = PushChain.utils.helpers.encodeTxData({
        abi: factoryABI,
        functionName: "createAirdrop",
        args: [totalAmount, merkleRoot]
      });

      // Send transaction to factory contract
      const tx = await pushChainClient.universal.sendTransaction({
        to: FACTORY_ADDRESS,
        data: txData,
        value: BigInt(0),
      });

      console.log("Deployment transaction sent:", tx.hash);

      // Wait for transaction confirmation
      const receipt = await tx.wait();
      console.log("Transaction confirmed:", receipt);

      // Parse the AirdropCreated event to get the deployed contract address
      // Event signature: AirdropCreated(address indexed airdrop, address indexed owner, uint256 totalAmount, bytes32 merkleRoot)
      // The factory contract emits this event, so we need to find it in the logs
      if (receipt.logs && receipt.logs.length > 0) {
        // Find the AirdropCreated event from the factory contract
        const factoryLog = receipt.logs.find(
          (log) => log.address.toLowerCase() === FACTORY_ADDRESS.toLowerCase()
        );
        
        if (factoryLog && factoryLog.topics && factoryLog.topics.length > 1) {
          // The first indexed parameter (airdrop address) is in topics[1]
          // Topics are 32 bytes, addresses are 20 bytes, so we take the last 40 hex chars (20 bytes)
          const airdropAddress = "0x" + factoryLog.topics[1].slice(-40);
          console.log("Deployed airdrop contract address:", airdropAddress);
          setDeployedAirdropAddress(airdropAddress);
          setCurrentStep(4);
        } else {
          setError("Failed to parse deployed contract address from event logs");
        }
      } else {
        setError("No logs found in transaction receipt");
      }

      setIsDeploying(false);
    } catch (err) {
      console.error("Error deploying airdrop:", err);
      setError("Failed to deploy airdrop contract");
      setIsDeploying(false);
    }
  };

  // Check eligibility for connected claimer wallet
  useEffect(() => {
    const checkClaimerEligibility = async () => {
      if (claimerConnectionStatus === "connected" && claimerPushChainClient?.universal.account && deployedAirdropAddress) {
        const claimerAddress = claimerPushChainClient.universal.account as string;
        
        // Find if claimer is in the eligible list
        const entry = convertedAddresses.find(
          ([addr]) => addr.toLowerCase() === claimerAddress.toLowerCase()
        );

        if (entry) {
          const [executorAddr, amount] = entry;
          
          // Check if already claimed by querying contract
          let hasClaimed = false;
          try {
            const provider = new ethers.JsonRpcProvider("https://evm.donut.rpc.push.org/");
            const contract = new ethers.Contract(
              deployedAirdropAddress,
              UniversalAirdropABI,
              provider
            );
            hasClaimed = await contract.hasClaimed(claimerAddress);
          } catch (err) {
            console.error("Error checking claim status:", err);
          }
          
          setClaimerEligibility({
            isEligible: true,
            hasClaimed: hasClaimed,
            amount: amount,
            executorAddress: executorAddr,
          });
        } else {
          setClaimerEligibility({
            isEligible: false,
            hasClaimed: false,
            amount: "0",
            executorAddress: "",
          });
        }
      } else {
        setClaimerEligibility(null);
      }
    };

    checkClaimerEligibility();
  }, [claimerConnectionStatus, claimerPushChainClient, deployedAirdropAddress, convertedAddresses]);

  // Check eligibility for manual address lookup
  const checkManualEligibility = async () => {
    if (!manualLookupAddress.trim()) {
      setError("Please enter an address");
      return;
    }

    setIsCheckingEligibility(true);
    setError("");

    try {
      // Convert origin address to executor address
      const account = PushChain.utils.account.toUniversal(manualLookupAddress, {
        chain: manualLookupChain as any
      });
      
      const executorAddress = await PushChain.utils.account.convertOriginToExecutor(account);
      const executorAddr = executorAddress.address;

      // Find if address is in the eligible list
      const entry = convertedAddresses.find(
        ([addr]) => addr.toLowerCase() === executorAddr.toLowerCase()
      );

      if (entry) {
        const [, amount] = entry;
        
        // Check if already claimed by querying contract
        let hasClaimed = false;
        if (deployedAirdropAddress) {
          try {
            const provider = new ethers.JsonRpcProvider("https://evm.donut.rpc.push.org/");
            const contract = new ethers.Contract(
              deployedAirdropAddress,
              UniversalAirdropABI,
              provider
            );
            hasClaimed = await contract.hasClaimed(executorAddr);
          } catch (err) {
            console.error("Error checking claim status:", err);
          }
        }
        
        setManualLookupResult({
          isEligible: true,
          hasClaimed: hasClaimed,
          amount: amount,
          executorAddress: executorAddr,
        });
      } else {
        setManualLookupResult({
          isEligible: false,
          hasClaimed: false,
          amount: "0",
          executorAddress: executorAddr,
        });
      }
    } catch (err) {
      console.error("Error checking eligibility:", err);
      setError("Failed to check eligibility");
    } finally {
      setIsCheckingEligibility(false);
    }
  };

  const claimAirdrop = async (addressToClaim?: string) => {
    console.log("claimAirdrop called with addressToClaim:", addressToClaim);
    
    const clientToUse = addressToClaim ? pushChainClient : claimerPushChainClient;
    const claimAddr = addressToClaim || (claimerPushChainClient?.universal.account as string);

    console.log("clientToUse:", clientToUse);
    console.log("claimAddr:", claimAddr);
    console.log("deployedAirdropAddress:", deployedAirdropAddress);

    if (!clientToUse) {
      const errorMsg = "Wallet not connected";
      console.error(errorMsg);
      setError(errorMsg);
      alert(errorMsg);
      return;
    }

    if (!claimAddr) {
      const errorMsg = "No address to claim";
      console.error(errorMsg);
      setError(errorMsg);
      alert(errorMsg);
      return;
    }

    if (!deployedAirdropAddress) {
      const errorMsg = "No deployed airdrop contract";
      console.error(errorMsg);
      setError(errorMsg);
      alert(errorMsg);
      return;
    }

    setIsClaiming(true);
    setError("");

    try {
      console.log("Starting claim process...");
      console.log("convertedAddresses:", convertedAddresses);
      
      // Find the address in converted addresses
      const entry = convertedAddresses.find(
        ([addr]) => addr.toLowerCase() === claimAddr.toLowerCase()
      );

      console.log("Found entry:", entry);

      if (!entry) {
        const errorMsg = "Address not found in airdrop list";
        console.error(errorMsg);
        setError(errorMsg);
        alert(errorMsg);
        setIsClaiming(false);
        return;
      }

      const [, amount] = entry;

      // Check if address has already claimed
      console.log("Checking if address has already claimed...");
      try {
        const provider = new ethers.JsonRpcProvider("https://evm.donut.rpc.push.org/");
        const contract = new ethers.Contract(
          deployedAirdropAddress,
          UniversalAirdropABI,
          provider
        );
        const hasClaimed = await contract.hasClaimed(claimAddr);
        
        if (hasClaimed) {
          const errorMsg = "This address has already claimed the airdrop";
          console.log(errorMsg);
          setError(errorMsg);
          alert(errorMsg);
          setIsClaiming(false);
          
          // Update eligibility status to reflect claimed state
          if (claimerEligibility && claimerEligibility.executorAddress.toLowerCase() === claimAddr.toLowerCase()) {
            setClaimerEligibility({ ...claimerEligibility, hasClaimed: true });
          }
          if (manualLookupResult && manualLookupResult.executorAddress.toLowerCase() === claimAddr.toLowerCase()) {
            setManualLookupResult({ ...manualLookupResult, hasClaimed: true });
          }
          return;
        }
        console.log("Address has not claimed yet, proceeding...");
      } catch (err) {
        console.error("Error checking claim status:", err);
        // Continue with claim attempt even if check fails
      }

      // Generate merkle proof for this address using the StandardMerkleTree
      if (!merkleTree) {
        const errorMsg = "Merkle tree not generated";
        console.error(errorMsg);
        setError(errorMsg);
        alert(errorMsg);
        setIsClaiming(false);
        return;
      }

      console.log("Merkle tree exists, generating proof...");

      // Find the proof for this specific address and amount
      let proof: string[] = [];
      let foundIndex = -1;
      for (const [i, v] of merkleTree.tree.entries()) {
        if (v[0].toLowerCase() === claimAddr.toLowerCase()) {
          proof = merkleTree.tree.getProof(i);
          foundIndex = i;
          console.log("Found proof at index", i, ":", proof);
          console.log("Proof length:", proof.length, "(empty array is valid for single-entry trees)");
          break;
        }
      }

      if (foundIndex === -1) {
        const errorMsg = "Could not find address in merkle tree";
        console.error(errorMsg);
        setError(errorMsg);
        alert(errorMsg);
        setIsClaiming(false);
        return;
      }

      console.log("Encoding transaction data...");

      // Encode the transaction data using PushChain helper with imported ABI
      const txData = PushChain.utils.helpers.encodeTxData({
        abi: UniversalAirdropABI,
        functionName: "claim",
        args: [amount, proof]
      });

      console.log("Transaction data encoded:", txData);
      console.log("Sending transaction...");

      // Send transaction to airdrop contract
      const tx = await clientToUse.universal.sendTransaction({
        to: deployedAirdropAddress as `0x${string}`,
        data: txData,
        value: BigInt(0),
      });

      console.log("Claim transaction sent:", tx.hash);

      // Wait for transaction confirmation
      await tx.wait();
      console.log("Claim successful!");

      alert(`Successfully claimed ${ethers.formatEther(amount)} $UNICORN tokens!`);
      setIsClaiming(false);
      
      // Refresh eligibility status
      if (claimerEligibility && claimerEligibility.executorAddress.toLowerCase() === claimAddr.toLowerCase()) {
        setClaimerEligibility({ ...claimerEligibility, hasClaimed: true });
      }
      if (manualLookupResult && manualLookupResult.executorAddress.toLowerCase() === claimAddr.toLowerCase()) {
        setManualLookupResult({ ...manualLookupResult, hasClaimed: true });
      }
    } catch (err) {
      console.error("Error claiming airdrop:", err);
      setError("Failed to claim airdrop. You may have already claimed or are not eligible.");
      setIsClaiming(false);
    }
  };

  return (
    <div className="app-container">
      <h1 className="app-title">
        Universal Claimable Airdrop
      </h1>

      <p className="app-description">
        This tutorial demonstrates a Universal Claimable Airdrop on Push Chain.
        Any user, whether from Ethereum, Solana, Push or any supported chain can
        <b> claim the airdrop allocation</b> dircetly from their existing
        wallet.
        <p />
        &nbsp;
        <p />
        <b>One claim flow. Any wallet. Any chain.</b>
      </p>

      <div className="wallet-button-container">
        <PushUniversalAccountButton uid="AirdropDeployer" />
      </div>

      {connectionStatus !== "connected" && (
        <p className="connection-message">
          Please connect your wallet to start the airdrop setup.
        </p>
      )}

      <p className="optional-text">
        Optional: Add <b>0x0165878A594ca255338adfa4d48449f69242Eb8F</b>{" "}
        ($UNICORN Token Address) to your wallet to see your balance in the
        wallet.
      </p>

      <div className="step-navigation">
        {[1, 2, 3, 4].map((step) => (
          <button
            key={step}
            onClick={() => setCurrentStep(step)}
            className={`step-button ${currentStep === step ? 'step-button-active' : 'step-button-inactive'}`}
          >
            Step {step}
          </button>
        ))}
      </div>

      {connectionStatus === "connected" && currentStep === 1 && (
        <>
          <div className="step-container">
            <h2 className="step-title">
              Step 1: Add Claimable Wallets
            </h2>
            <p className="step-description">
              Add wallet addresses from different chains to create your airdrop
              list. We will use this list to generate deterministic addresses
              for them on Push Chain.
            </p>

            <div
              style={{
                marginBottom: "1.5rem",
                backgroundColor: "#f9f9f9",
                borderRadius: "12px",
                padding: "2rem",
              }}
            >
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontWeight: "bold",
                  color: "#333",
                }}
              >
                Chain
              </label>
              <select
                value={selectedChain}
                onChange={(e) => setSelectedChain(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  fontSize: "1rem",
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
                  marginBottom: "0.5rem",
                  fontWeight: "bold",
                  color: "#333",
                }}
              >
                Wallet Address
              </label>
              <input
                type="text"
                value={newWalletAddress}
                onChange={(e) => setNewWalletAddress(e.target.value)}
                placeholder="0x..."
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  fontSize: "1rem",
                  borderRadius: "8px",
                  border: "1px solid #ddd",
                  marginBottom: "1rem",
                }}
              />

              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontWeight: "bold",
                  color: "#333",
                }}
              >
                Airdrop Amount (tokens)
              </label>
              <input
                type="number"
                value={airdropAmount}
                onChange={(e) => setAirdropAmount(e.target.value)}
                placeholder="100"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  fontSize: "1rem",
                  borderRadius: "8px",
                  border: "1px solid #ddd",
                  marginBottom: "1rem",
                }}
              />

              <button
                onClick={addWalletToList}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  fontSize: "1rem",
                  fontWeight: "bold",
                  backgroundColor: "#4CAF50",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                Add to List
              </button>
            </div>

            {walletList.length > 0 && (
              <div style={{ marginBottom: "1.5rem" }}>
                <h3
                  style={{
                    fontSize: "1.2rem",
                    marginBottom: "1rem",
                    color: "#333",
                  }}
                >
                  Wallet List ({walletList.length})
                </h3>
                <div
                  style={{
                    maxHeight: "300px",
                    overflowY: "auto",
                    backgroundColor: "white",
                    borderRadius: "8px",
                    padding: "1rem",
                  }}
                >
                  {walletList.map((wallet, index) => (
                    <div
                      key={index}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.75rem",
                        marginBottom: "0.5rem",
                        backgroundColor: "#f0f0f0",
                        borderRadius: "6px",
                        fontSize: "0.85rem",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: "bold", color: "#d548ec" }}>
                          {PushChain.utils.chains.getChainName(wallet.chain)} (Chain namespace: {wallet.chain})
                        </div>
                        <div
                          style={{
                            color: "#666",
                            wordBreak: "break-all",
                            fontSize: "0.8rem",
                          }}
                        >
                          Address: {wallet.address}
                        </div>
                        <div style={{ color: "#333", marginTop: "0.25rem" }}>
                          Amount: {wallet.amount} tokens
                        </div>
                      </div>
                      <button
                        onClick={() => removeWallet(index)}
                        style={{
                          padding: "0.5rem 1rem",
                          backgroundColor: "#dc3545",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "0.85rem",
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={convertToPushChainAddresses}
              disabled={walletList.length === 0}
              style={{
                width: "100%",
                padding: "1rem",
                fontSize: "1.2rem",
                fontWeight: "bold",
                backgroundColor: walletList.length === 0 ? "#ccc" : "#d548ec",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: walletList.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              Convert to Addresses (EVM Based) on Push Chain
            </button>

            {error && (
              <div
                style={{
                  marginTop: "1rem",
                  padding: "1rem",
                  backgroundColor: "#fee",
                  color: "#dc3545",
                  borderRadius: "8px",
                  fontSize: "0.9rem",
                }}
              >
                {error}
              </div>
            )}

          </div>
        </>
      )}

      {connectionStatus === "connected" && currentStep === 2 && (
        <>
          <div className="step-container">
            <h2 className="step-title">
              Step 2: Generate Merkle Tree
            </h2>
            <p className="step-description">
              We now have deterministic addresses from all chains in EVM format on Push Chain.
              Review the converted addresses below and generate the Merkle Tree for the airdrop.
            </p>

            <div
              style={{
                marginBottom: "2rem",
                backgroundColor: "#f9f9f9",
                borderRadius: "12px",
                padding: "1.5rem",
              }}
            >
              <h3
                style={{
                  fontSize: "1.1rem",
                  marginBottom: "1rem",
                  color: "#333",
                }}
              >
                Converted Addresses Preview ({convertedAddresses.length})
              </h3>
              <div
                style={{
                  maxHeight: "400px",
                  overflowY: "auto",
                  backgroundColor: "white",
                  borderRadius: "8px",
                  padding: "1rem",
                }}
              >
                <pre
                  style={{
                    fontSize: "0.85rem",
                    color: "#333",
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                    textAlign: "left",
                  }}
                >
                  {convertedAddresses.map(([executorAddr, amount, originalAddr, chain], index) => {
                    const chainLabel = chains.find(c => c.value === chain)?.label || chain;
                    return `// Original: ${originalAddr} (${chainLabel})\n[\n  "${executorAddr}",\n  "${amount}"\n]${index < convertedAddresses.length - 1 ? ',' : ''}\n\n`;
                  }).join('')}
                </pre>
              </div>
              <p
                style={{
                  fontSize: "0.8rem",
                  color: "#666",
                  marginTop: "1rem",
                  fontStyle: "italic",
                }}
              >
                Format: [["address", "amount_in_wei"], ...]
              </p>
            </div>

            <button
              onClick={generateMerkleTree}
              disabled={convertedAddresses.length === 0}
              style={{
                width: "100%",
                padding: "1rem",
                fontSize: "1.2rem",
                fontWeight: "bold",
                backgroundColor: convertedAddresses.length === 0 ? "#ccc" : "#d548ec",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: convertedAddresses.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              Generate Merkle Tree and Proofs
            </button>

            {error && (
              <div
                style={{
                  marginTop: "1rem",
                  padding: "1rem",
                  backgroundColor: "#fee",
                  color: "#dc3545",
                  borderRadius: "8px",
                  fontSize: "0.9rem",
                }}
              >
                {error}
              </div>
            )}

            {merkleRoot && (
              <div
                style={{
                  marginTop: "1rem",
                  padding: "1rem",
                  backgroundColor: "#e8f5e9",
                  borderRadius: "8px",
                }}
              >
                <p
                  style={{
                    fontWeight: "bold",
                    color: "#2e7d32",
                    marginBottom: "0.5rem",
                  }}
                >
                  Merkle Root Generated!
                </p>
                <code
                  style={{
                    fontSize: "0.75rem",
                    wordBreak: "break-all",
                    color: "#333",
                  }}
                >
                  {merkleRoot}
                </code>
              </div>
            )}
          </div>
        </>
      )}

      {connectionStatus === "connected" && currentStep === 3 && (
        <>
          <div className="step-container">
            <h2 className="step-title">
              Step 3: Deploy Claimable Airdrop Contract
            </h2>
            <p className="step-description">
              We are now ready to deploy the airdrop contract! We will mint <b>$UNICORN</b> tokens 
              and deploy the contract with the merkle root. We're using the standard OpenZeppelin 
              merkle tree implementation without any modifications.
              <p />&nbsp;<p/>
              To understand how the minting works, refer to this <a href="https://push.org/docs/chain/tutorials/basics/tutorial-mint-erc-20-tokens/" target="_blank">Mint Universal ERC-20 Tokens</a> tutorial.
            </p>

            <div
              style={{
                marginBottom: "2rem",
                backgroundColor: "#f0f7ff",
                borderRadius: "12px",
                padding: "1.5rem",
                border: "1px solid #d0e7ff",
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
                🔑 Key Concept
              </h3>
              <p
                style={{
                  fontSize: "0.9rem",
                  color: "#333",
                  lineHeight: "1.6",
                  margin: 0,
                }}
              >
                Users from any chain will interact with this contract through their <b>Universal Executor Account (UEA)</b>, ie: the 
                deterministic addresses we generated in Step 1. <p />&nbsp; <p/>Thus, a simple deployment of the contract with the merkle root, 
                and it works out of the box for all chains!
              </p>
            </div>

            <div
              style={{
                marginBottom: "2rem",
                backgroundColor: "#f9f9f9",
                borderRadius: "12px",
                padding: "1.5rem",
              }}
            >
              <h3
                style={{
                  fontSize: "1.1rem",
                  marginBottom: "1rem",
                  color: "#333",
                }}
              >
                Deployment Summary
              </h3>
              <div
                style={{
                  backgroundColor: "white",
                  borderRadius: "8px",
                  padding: "1rem",
                  marginBottom: "1rem",
                  textAlign: "left",
                }}
              >
                <div style={{ marginBottom: "0.75rem" }}>
                  <span style={{ fontWeight: "bold", color: "#666" }}>Token:</span>{" "}
                  <span style={{ color: "#333" }}>$UNICORN (ERC-20)</span>
                </div>
                <div style={{ marginBottom: "0.75rem" }}>
                  <span style={{ fontWeight: "bold", color: "#666" }}>Total Amount:</span>{" "}
                  <span style={{ color: "#333" }}>
                    {ethers.formatEther(
                      convertedAddresses.reduce(
                        (sum, [, amount]) => sum + BigInt(amount),
                        BigInt(0)
                      )
                    )} $UNICORN
                  </span>
                </div>
                <div style={{ marginBottom: "0.75rem" }}>
                  <span style={{ fontWeight: "bold", color: "#666" }}>Recipients:</span>{" "}
                  <span style={{ color: "#333" }}>{convertedAddresses.length} addresses</span>
                </div>
                <div style={{ marginBottom: "0.75rem" }}>
                  <span style={{ fontWeight: "bold", color: "#666" }}>Merkle Root:</span>
                  <div
                    style={{
                      marginTop: "0.5rem",
                      padding: "0.5rem",
                      backgroundColor: "#f0f0f0",
                      borderRadius: "4px",
                      wordBreak: "break-all",
                      fontSize: "0.75rem",
                      fontFamily: "monospace",
                    }}
                  >
                    {merkleRoot}
                  </div>
                </div>
                <div style={{ marginBottom: "0.75rem" }}>
                  <span style={{ fontWeight: "bold", color: "#666" }}>Contract Type:</span>{" "}
                  <span style={{ color: "#333" }}>OpenZeppelin MerkleAirdrop</span>
                </div>
                <div
                  style={{
                    marginTop: "1rem",
                    padding: "0.75rem",
                    backgroundColor: "#fff9e6",
                    borderRadius: "6px",
                    borderLeft: "3px solid #ffa726",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.8rem",
                      color: "#666",
                      lineHeight: "1.5",
                    }}
                  >
                    <strong>ℹ️ Note:</strong> $UNICORN is a custom token designed for this airdrop tutorial. 
                    It's hardcoded in the contract and will be minted automatically upon deployment for a smoother flow. 
                    In real-world cases, you would deposit your existing tokens into the contract and specify the 
                    ERC-20 address instead.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={deployAirdrop}
              disabled={isDeploying}
              style={{
                width: "100%",
                padding: "1rem",
                fontSize: "1.2rem",
                fontWeight: "bold",
                backgroundColor: isDeploying ? "#999" : "#d548ec",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: isDeploying ? "not-allowed" : "pointer",
                marginBottom: "1rem",
              }}
            >
              {isDeploying ? "Deploying..." : "Deploy Airdrop Contract"}
            </button>

            <p
              style={{
                fontSize: "0.8rem",
                color: "#666",
                textAlign: "center",
                fontStyle: "italic",
              }}
            >
              This will deploy the contract to Push Chain and mint the required $UNICORN tokens
            </p>
          </div>
        </>
      )}

      {connectionStatus === "connected" && currentStep === 4 && (
        <>
          <div className="step-container">
            <h2 className="step-title">
              Step 4: Claim Airdrop
            </h2>
            <p className="step-description">
              Your airdrop contract has been successfully deployed! Users from any chain can login and can claim their $UNICORN tokens.
            </p>

            <div
              style={{
                marginBottom: "2rem",
                backgroundColor: "#f0f7ff",
                borderRadius: "12px",
                padding: "1.5rem",
                border: "1px solid #d0e7ff",
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
                🎉 Deployment Successful!
              </h3>
              <div style={{ marginBottom: "1rem" }}>
                <label
                  style={{
                    display: "block",
                    fontWeight: "bold",
                    color: "#666",
                    marginBottom: "0.5rem",
                  }}
                >
                  Contract Address:
                </label>
                <input
                  type="text"
                  value={deployedAirdropAddress}
                  onChange={(e) => setDeployedAirdropAddress(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    backgroundColor: "white",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    fontSize: "0.85rem",
                    fontFamily: "monospace",
                  }}
                  placeholder="0x..."
                />
              </div>

              {/* Collapsible Merkle Tree Data */}
              <div style={{ marginTop: "1.5rem" }}>
                <button
                  onClick={() => setShowMerkleData(!showMerkleData)}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    backgroundColor: "#e3f2fd",
                    border: "1px solid #90caf9",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    fontWeight: "bold",
                    color: "#0066cc",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>Merkle Tree Data</span>
                  <span>{showMerkleData ? "▼" : "▶"}</span>
                </button>

                {showMerkleData && (
                  <div
                    style={{
                      marginTop: "1rem",
                      padding: "1rem",
                      backgroundColor: "#f9f9f9",
                      borderRadius: "8px",
                      border: "1px solid #ddd",
                    }}
                  >
                    <div style={{ marginBottom: "1rem" }}>
                      <label
                        style={{
                          display: "block",
                          fontWeight: "bold",
                          color: "#666",
                          marginBottom: "0.5rem",
                        }}
                      >
                        Merkle Root:
                      </label>
                      <input
                        type="text"
                        value={merkleRoot}
                        onChange={(e) => setMerkleRoot(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "0.75rem",
                          backgroundColor: "white",
                          border: "1px solid #ddd",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          fontFamily: "monospace",
                        }}
                        placeholder="0x..."
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontWeight: "bold",
                          color: "#666",
                          marginBottom: "0.5rem",
                        }}
                      >
                        Eligible Addresses (JSON):
                      </label>
                      <textarea
                        value={JSON.stringify(
                          convertedAddresses.map(([addr, amt]) => ({
                            address: addr,
                            amount: ethers.formatEther(amt),
                          })),
                          null,
                          2
                        )}
                        onChange={(e) => {
                          try {
                            const parsed = JSON.parse(e.target.value);
                            const newAddresses = parsed.map((item: { address: string; amount: string }) => [
                              item.address,
                              ethers.parseEther(item.amount).toString(),
                            ]) as [string, string, string, string][];
                            setConvertedAddresses(newAddresses);
                          } catch {
                            // Invalid JSON, ignore for now
                          }
                        }}
                        style={{
                          width: "100%",
                          minHeight: "200px",
                          padding: "0.75rem",
                          backgroundColor: "white",
                          border: "1px solid #ddd",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          fontFamily: "monospace",
                          resize: "vertical",
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div
              style={{
                marginBottom: "2rem",
                backgroundColor: "#fff3e0",
                borderRadius: "12px",
                padding: "1.5rem",
                border: "1px solid #ffe0b2",
              }}
            >
              <h3
                style={{
                  fontSize: "1.1rem",
                  marginBottom: "1rem",
                  color: "#e65100",
                  fontWeight: "bold",
                }}
              >
                Test Claim
              </h3>
              <p
                style={{
                  fontSize: "0.85rem",
                  color: "#666",
                  marginBottom: "1rem",
                }}
              >
                Connect a wallet to claim tokens from the airdrop:
              </p>
              <div style={{ marginBottom: "1rem", alignItems: "center", justifyContent: "center", display: "flex" }}>
                <PushUniversalAccountButton 
                  uid="AirdropClaimer" 
                  connectButtonText="Connect Claimer Wallet"
                />
              </div>

              {/* Show eligibility status for connected claimer wallet */}
              {claimerConnectionStatus === "connected" && claimerEligibility && (
                <div
                  style={{
                    marginTop: "1rem",
                    padding: "1rem",
                    backgroundColor: claimerEligibility.isEligible ? "#e8f5e9" : "#ffebee",
                    borderRadius: "8px",
                    border: `1px solid ${claimerEligibility.isEligible ? "#4caf50" : "#f44336"}`,
                  }}
                >
                  <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: "bold", color: "#333" }}>
                    {claimerEligibility.isEligible ? "✅ Eligible for Airdrop!" : "❌ Not Eligible"}
                  </p>
                  {claimerEligibility.isEligible && (
                    <>
                      <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.85rem", color: "#666" }}>
                        Amount: {ethers.formatEther(claimerEligibility.amount)} $UNICORN
                      </p>
                      {claimerEligibility.hasClaimed ? (
                        <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.85rem", color: "#666" }}>
                          Status: Already Claimed ✓
                        </p>
                      ) : (
                        <button
                          onClick={() => claimAirdrop()}
                          disabled={isClaiming}
                          style={{
                            marginTop: "1rem",
                            width: "100%",
                            padding: "1rem",
                            fontSize: "1.1rem",
                            fontWeight: "bold",
                            backgroundColor: isClaiming ? "#999" : "#d548ec",
                            color: "white",
                            border: "none",
                            borderRadius: "8px",
                            cursor: isClaiming ? "not-allowed" : "pointer",
                          }}
                        >
                          {isClaiming ? "Claiming..." : "Claim Airdrop"}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Manual address lookup */}
              <div style={{ marginTop: "2rem", paddingTop: "2rem", borderTop: "1px solid #ddd" }}>
                <p
                  style={{
                    fontSize: "0.85rem",
                    color: "#666",
                    marginBottom: "1rem",
                    fontWeight: "bold",
                  }}
                >
                  Manual Address Lookup:
                </p>
                <p
                  style={{
                    fontSize: "0.8rem",
                    color: "#666",
                    marginBottom: "1rem",
                  }}
                >
                  Enter an address and chain to check eligibility:
                </p>
                
                <label style={{ display: "block", fontSize: "0.85rem", color: "#666", marginBottom: "0.5rem" }}>
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

                <label style={{ display: "block", fontSize: "0.85rem", color: "#666", marginBottom: "0.5rem" }}>
                  Address:
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
                  onClick={checkManualEligibility}
                  disabled={isCheckingEligibility}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    fontSize: "1rem",
                    fontWeight: "bold",
                    backgroundColor: isCheckingEligibility ? "#999" : "#2196f3",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: isCheckingEligibility ? "not-allowed" : "pointer",
                    marginBottom: "1rem",
                  }}
                >
                  {isCheckingEligibility ? "Checking..." : "Check Eligibility"}
                </button>

                {/* Show manual lookup result */}
                {manualLookupResult && (
                  <div
                    style={{
                      padding: "1rem",
                      backgroundColor: manualLookupResult.isEligible ? "#e8f5e9" : "#ffebee",
                      borderRadius: "8px",
                      border: `1px solid ${manualLookupResult.isEligible ? "#4caf50" : "#f44336"}`,
                    }}
                  >
                    <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: "bold", color: "#333" }}>
                      {manualLookupResult.isEligible ? "✅ Eligible for Airdrop!" : "❌ Not Eligible"}
                    </p>
                    <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.8rem", color: "#666", fontFamily: "monospace" }}>
                      Executor Address: {manualLookupResult.executorAddress}
                    </p>
                    {manualLookupResult.isEligible && (
                      <>
                        <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.85rem", color: "#666" }}>
                          Amount: {ethers.formatEther(manualLookupResult.amount)} $UNICORN
                        </p>
                        {manualLookupResult.hasClaimed ? (
                          <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.85rem", color: "#666" }}>
                            Status: Already Claimed ✓
                          </p>
                        ) : (
                          <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.85rem", color: "#666" }}>
                            Status: Ready to Claim
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <div className="footer">
        <p className="footer-text">
          <a
            href="https://github.com/pushchain/push-chain-examples/tree/main/tutorials/universal-claimable-airdrop"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            Source Code
          </a> |&nbsp;
          <a
            href="https://donut.push.network/address/0xa82fF9aFd8f496c3d6ac40E2a0F282E47488CFc9?tab=contract"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            Smart Contract
          </a>
        </p>
      </div>
    </div>
  );
}

export default App;
