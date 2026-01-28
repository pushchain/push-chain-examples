# Reading Push Chain State Examples

Learn how to read blockchain state from Push Chain using different EVM clients (ethers.js and viem). Compare implementations and responses from both libraries.

- [Push Chain Documentation](https://push.org/docs/chain)

## 🚀 Quick Start

```bash
npm install
npm start
```

## 🔍 HTTP Client Examples

The example shows how to:
- Initialize Push Chain RPC clients with both ethers.js and viem
- Fetch and compare blockchain data:
  - Get transaction details by hash
  - Get latest block information
  - Get historical block by hash
- Handle BigInt serialization for JSON output
- Compare response formats between ethers.js and viem

## ⚡ WebSocket Examples

The example shows how to:
- Initialize WebSocket connections for real-time updates
- Watch for new blocks using both libraries
- Filter transactions by address
- Handle WebSocket lifecycle events:
  - Connection established
  - Connection errors
  - Connection closed
- Clean up connections properly

## 💻 Implementation Details

### HTTP Clients
```javascript
// Ethers
const provider = new ethers.JsonRpcProvider('https://evm.donut.rpc.push.org/')

// Viem
const viemClient = createPublicClient({
  chain: pushTestnet,
  transport: http()
})
```

### WebSocket Clients
```javascript
// Ethers
const wsProvider = new ethers.WebSocketProvider('wss://evm.rpc-testnet-donut-node1.push.org/')

// Viem
const wsViemClient = createPublicClient({
  chain: pushTestnet,
  transport: webSocket('wss://evm.rpc-testnet-donut-node1.push.org/')
})
```

## 📦 Dependencies

- `ethers`: ^6.14.4 - For ethers.js HTTP and WebSocket implementation
- `viem`: ^2.31.3 - For viem HTTP and WebSocket implementation
