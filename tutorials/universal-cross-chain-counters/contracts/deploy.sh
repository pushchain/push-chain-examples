#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# deploy.sh — Deploy + wire up the universal-cross-chain-counters tutorial
#
# Steps:
#   1. Deploy MultiChainCounter on Push Chain
#   2. Deploy ExternalCounter on each destination (Sepolia / BNB / Arbitrum)
#   3. Register every destination on the orchestrator via addDestination()
#
# Usage:
#   export PRIVATE_KEY=0x<your_key>           # used on every chain
#   bash deploy.sh
#
# Optional overrides:
#   export GAS_LIMIT=2000000                  # destination-side gas (default 1_000_000)
#   export MULTI=0xAlreadyDeployedOrchestrator # skip step 1 and reuse this orchestrator
#                                              # (handy when you only need to (re-)deploy
#                                              #  ExternalCounters and re-register them)
# ---------------------------------------------------------------------------
set -euo pipefail

if [ -z "${PRIVATE_KEY:-}" ]; then
  echo "Error: PRIVATE_KEY is not set. Run: export PRIVATE_KEY=0x<your_key>"
  exit 1
fi

# ---- Push Chain PRC-20 routing tokens (per destination chain) --------------
PETH_ON_PUSH="0x2971824Db68229D087931155C2b8bB820B275809"     # → Ethereum Sepolia
PBNB_ON_PUSH="0x7a9082dA308f3fa005beA7dB0d203b3b86664E36"     # → BNB Testnet
PETH_ARB_ON_PUSH="0xc0a821a1AfEd1322c5e15f1F4586C0B8cE65400e" # → Arbitrum Sepolia

# Destination-chain gas budget. Should be ≥ 1_000_000 — the destination CEA
# needs to execute the Vault wrapper + decode the multicall + call your
# target. Tight budgets revert with selector 0xff633a38 from the destination.
GAS_LIMIT="${GAS_LIMIT:-1000000}"

PUSH_RPC="https://evm.donut.rpc.push.org/"

# Helper: run forge create and extract the deployed address from its output.
# forge create (without --json) prints a line like:
#   Deployed to: 0x1234...
deploy() {
  local contract="$1"
  local rpc="$2"
  local output
  output=$(forge create "$contract" \
    --rpc-url "$rpc" \
    --private-key "$PRIVATE_KEY" \
    --broadcast \
    2>&1)
  echo "$output" >&2
  echo "$output" | grep "Deployed to:" | grep -oE '0x[0-9a-fA-F]+'
}

# Helper: register a destination on the orchestrator.
# Solidity sig: addDestination(bytes target, address chainToken, uint256 gasLimit)
# `bytes target` for an EVM destination is the bytes-packed counter address —
# the 20-byte address as raw hex. cast send accepts the address string for a
# `bytes` arg and hex-encodes it correctly.
register() {
  local label="$1"
  local counter="$2"
  local routing_token="$3"

  echo "→ Registering $label on orchestrator (counter=$counter, gasLimit=$GAS_LIMIT)"
  cast send \
    --rpc-url "$PUSH_RPC" \
    --private-key "$PRIVATE_KEY" \
    "$MULTI" \
    "addDestination(bytes,address,uint256)" \
    "$counter" \
    "$routing_token" \
    "$GAS_LIMIT" \
    >&2
}

if [ -n "${MULTI:-}" ]; then
  echo "========================================"
  echo "1. Reusing MultiChainCounter at $MULTI (skipping deploy)"
  echo "========================================"
  echo "Explorer: https://donut.push.network/address/$MULTI"
  echo ""
else
  echo "========================================"
  echo "1. Deploying MultiChainCounter → Push Chain Donut Testnet"
  echo "========================================"
  MULTI=$(deploy src/MultiChainCounter.sol:MultiChainCounter push_testnet)
  echo ""
  echo "MultiChainCounter deployed at: $MULTI"
  echo "Explorer: https://donut.push.network/address/$MULTI"
  echo ""
fi

echo "========================================"
echo "2. Deploying ExternalCounter → Ethereum Sepolia"
echo "========================================"
EXT_ETH=$(deploy src/ExternalCounter.sol:ExternalCounter sepolia)
echo ""
echo "ExternalCounter (Sepolia) deployed at: $EXT_ETH"
echo "Explorer: https://sepolia.etherscan.io/address/$EXT_ETH"
echo ""

echo "========================================"
echo "3. Deploying ExternalCounter → BNB Testnet"
echo "========================================"
EXT_BNB=$(deploy src/ExternalCounter.sol:ExternalCounter bsc_testnet)
echo ""
echo "ExternalCounter (BNB) deployed at: $EXT_BNB"
echo "Explorer: https://testnet.bscscan.com/address/$EXT_BNB"
echo ""

echo "========================================"
echo "4. Deploying ExternalCounter → Arbitrum Sepolia"
echo "========================================"
EXT_ARB=$(deploy src/ExternalCounter.sol:ExternalCounter arbitrum_sepolia)
echo ""
echo "ExternalCounter (Arbitrum) deployed at: $EXT_ARB"
echo "Explorer: https://sepolia.arbiscan.io/address/$EXT_ARB"
echo ""

echo "========================================"
echo "5. Registering destinations on MultiChainCounter (Push Chain)"
echo "========================================"
register "Ethereum Sepolia" "$EXT_ETH" "$PETH_ON_PUSH"
register "BNB Testnet"      "$EXT_BNB" "$PBNB_ON_PUSH"
register "Arbitrum Sepolia" "$EXT_ARB" "$PETH_ARB_ON_PUSH"
echo ""
echo "All destinations registered."
echo ""

echo "========================================"
echo "DEPLOYMENT SUMMARY"
echo "========================================"
echo "MultiChainCounter (Push Donut):   $MULTI"
echo "ExternalCounter (Eth Sepolia):    $EXT_ETH"
echo "ExternalCounter (BNB Testnet):    $EXT_BNB"
echo "ExternalCounter (Arb Sepolia):    $EXT_ARB"
echo ""
echo "Destinations registered on the orchestrator with gasLimit=$GAS_LIMIT each."
echo ""
echo "Next steps:"
echo "  1. Update app/src/App.tsx with the four addresses above"
echo "     (ORCHESTRATOR_ADDRESS and each DESTINATIONS[i].counterAddress)."
echo "  2. cd ../app && npm install && npm run dev"
echo "  3. Connect a Push wallet and click 'Tick all destinations'."
echo ""
echo "If a destination later reverts with selector 0xff633a38 (out of gas on"
echo "the CEA's sub-call), bump that destination's gas without redeploying:"
echo "  cast send \\"
echo "    --rpc-url $PUSH_RPC --private-key \$PRIVATE_KEY \\"
echo "    $MULTI 'setDestinationGasLimit(uint256,uint256)' <index> <newGasLimit>"
