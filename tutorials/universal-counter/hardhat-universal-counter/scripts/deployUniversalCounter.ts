import hre from "hardhat";

const CONTRACT_NAME = "UniversalCounter";

async function main(): Promise<void> {
  console.log("\n🚀 Deploying", CONTRACT_NAME, "...\n");

  // Get deployer
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "ETH\n");

  // Deploy contract
  console.log("📝 Deploying contract...");
  const Contract = await hre.ethers.getContractFactory(CONTRACT_NAME);
  const contract = await Contract.deploy();

  await contract.waitForDeployment();

  const contractAddress = contract.target as string;

  console.log("✅ UniversalCounter deployed at:", contractAddress);

  // Network info
  const network = hre.network.name;
  const chainId = hre.network.config.chainId;

  console.log("\n📋 Deployment Info:");
  console.log("Network:", network);
  console.log("Chain ID:", chainId);
  console.log("Contract:", contractAddress);

  console.log("\n" + "=".repeat(50));
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("=".repeat(50));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });