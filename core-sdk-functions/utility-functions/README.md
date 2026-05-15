# Push Chain Utility Functions Examples

A runnable companion to the [Utility Functions docs page](https://push.org/docs/chain/build/utility-functions). Every demo here corresponds 1:1 to a section in the docs and exercises only the public utility surface exposed by `@pushchain/core` (and the explorer / funds methods on a `pushChainClient`).

## Quick Start

```bash
npm install
npm start
```

## What's covered

The file walks the same sections as the docs, in the same order:

### Helper Utilities — `PushChain.utils.helpers.*`
- `parseUnits(value, exponent)` — human-readable amount → smallest-unit `bigint`
- `formatUnits(value, decimalsOrOptions)` — smallest-unit → human-readable string (with optional `precision`)
- `encodeTxData({ abi, functionName, args })` — EVM calldata
- `encodeTxData({ idl, functionName, args })` — Solana (Anchor) calldata

### Chain Utilities — `PushChain.utils.chains.*`
- `getChainNamespace(chainName)` — friendly name → CAIP-2 namespace
- `getChainName(chainNamespace)` — CAIP-2 namespace → friendly name
- `getSupportedChainsByName(network)` — array of friendly names
- `getSupportedChains(network)` — array of CAIP-2 namespaces

### Account Utilities — `PushChain.utils.account.*`
- `toUniversal(address, { chain })` — wrap an address into a `UniversalAccount`
- `toChainAgnostic(address, { chain })` — produce a CAIP-10 string
- `fromChainAgnostic(caip10)` — parse a CAIP-10 string back into a `UniversalAccount`
- `deriveExecutorAccount(account)` — derive UEA on Push Chain from any UOA (Ethereum + Solana variants)
- `deriveExecutorAccount(account, { chain })` — same call with `chain` derives a CEA on that external chain
- `deriveExecutorAccount(account, { skipNetworkCheck: true })` — deterministic-only derivation (no RPC)
- `resolveControllerAccount(executorAddress)` — resolve UEA → UOA
- `resolveControllerAccount(ceaAddress, { chain })` — resolve through CEA → Push account → UOA

### Signer Utilities — `PushChain.utils.signer.toUniversalFromKeypair`
Three library variants matching the docs:
- ethers v6 keypair
- viem `WalletClient`
- Solana `@solana/web3.js` `Keypair`

### Token Utilities — `PushChain.utils.tokens.*`
- `getMoveableTokens(chainOrClient?)` — list moveable tokens, optionally filtered by chain
- `getPayableTokens(chainOrClient?)` — list payable (gas) tokens
- `getPRC20Address(token, options?)` — resolve the Push Chain synthetic PRC20 for a supported origin token (works with both `{ chain, address }` and a `MoveableToken`)

### Conversion Utilities
- `PushChain.utils.conversion.slippageToMinAmount(amount, { slippageBps })` — slippage helper
- `pushChainClient.funds.getConversionQuote(amount, { from, to })` — quote pay-with-token vs. move-as-token (currently supported on Ethereum Sepolia)

### Explorer Utilities — `pushChainClient.explorer.*`
- `getTransactionUrl(txHash, { chain? })` — explorer URL for a tx; default uses the client's chain, optional `chain` overrides
- `listUrls({ chain? })` — explorer URLs for a chain
- `listAllUrls()` — explorer URLs for every supported chain on the current network

## What's deliberately not covered here

This file matches the **Utility Functions** docs page exactly, so it does NOT include:
- `pushChainClient.universal.signMessage`, `prepareTransaction`, `executeTransactions`, `trackTransaction` — those belong in the [send-universal-transaction](../send-universal-transaction/) examples.
- `pushChainClient.getAccountStatus()` — covered in [initialize-push-chain-client](../initialize-push-chain-client/).
- The legacy `convertOriginToExecutor` and `convertExecutorToOriginAccount` (removed in `@pushchain/core@6.0.0`), replaced by `deriveExecutorAccount` and `resolveControllerAccount` respectively.

## Network

- Push Chain Donut Testnet (chain id `42101`)
- RPC: `https://evm.donut.rpc.push.org/`
- Network constant in code: `PushChain.CONSTANTS.PUSH_NETWORK.TESTNET`

## Dependencies

- `@pushchain/core` — the only Push Chain import you need (always pinned to `latest`)
- `ethers` — for the ethers.js signer demo
- `viem` — for the viem `WalletClient` demo
- `@solana/web3.js` — for the Solana `Keypair` demo
- `@coral-xyz/anchor` — peer dep required for SVM IDL handling inside the SDK
