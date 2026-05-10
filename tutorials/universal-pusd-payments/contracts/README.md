::q# PusdPaywall — Smart Contract

A minimal subscription contract that accepts PUSD as payment. Users from any chain can pay because every cross-chain caller arrives through their deterministic UEA on Push Chain — `msg.sender` is the caller's UEA, and `expiresAt[msg.sender]` therefore tracks per-user access correctly without any chain-specific logic in the contract.

## Contract: `src/PusdPaywall.sol`

```solidity
function pay() external {
    require(PUSD.transferFrom(msg.sender, address(this), FEE), "PusdPaywall: PUSD pull failed");
    uint256 current = expiresAt[msg.sender];
    uint256 base = current > block.timestamp ? current : block.timestamp;
    uint256 newExpiry = base + DURATION;
    expiresAt[msg.sender] = newExpiry;
    emit AccessGranted(msg.sender, newExpiry, FEE);
}
```

Highlights:

- **PUSD-native payments.** Holds the PUSD proxy address as a constant. No bridge, no oracle.
- **One-line cross-chain support.** Treats `msg.sender` as the user's identity. The universal transaction layer rewrites the sender to the user's UEA on inbound from any external chain, so the same contract works for callers on Sepolia, Base, BNB, Solana, or native Push.
- **Multicall-friendly.** The frontend pairs this with `approve` (and optionally a PUSD mint) in a single multicall — the user signs once.

## Deploy

```bash
# from this directory
forge install foundry-rs/forge-std --no-commit

# deploy with a Push EOA private key
forge create src/PusdPaywall.sol:PusdPaywall \
    --rpc-url push_testnet \
    --private-key $PUSH_PRIVATE_KEY \
    --constructor-args $YOUR_TREASURY_ADDRESS \
    --broadcast
```

After deployment, copy the printed contract address into the frontend's `PAYWALL_ADDRESS` constant.

## Test (sanity)

The contract has no off-chain dependencies — you can sanity-check the deployed instance with `cast`:

```bash
cast call <PAYWALL> 'PUSD()(address)' --rpc-url push_testnet
# → 0x488d080e16386379561a47A4955D22001d8A9D89

cast call <PAYWALL> 'FEE()(uint256)' --rpc-url push_testnet
# → 1000000  (1 PUSD; 6 decimals)
```

## Files

```
contracts/
├── README.md          # this file
├── foundry.toml       # solc 0.8.22, push_testnet RPC + verifier
└── src/
    └── PusdPaywall.sol
```

## Notes

- This is a tutorial contract — production paywalls will want pause / fee changes / role-based withdraw / event indexers / refund flows. None of that is necessary to demonstrate the cross-chain payment pattern.
- The contract holds collected PUSD until `withdraw` is called by the owner. The owner is set at deployment and immutable.
