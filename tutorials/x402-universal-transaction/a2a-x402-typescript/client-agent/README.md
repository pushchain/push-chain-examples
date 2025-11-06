# x402 Client Agent

An orchestrator agent that can interact with merchant agents and handle x402 payment flows using cryptocurrency.

## Features

- 🤖 Connects to merchant agents
- 💰 Payment handling with user confirmation
- 🔐 Secure wallet integration
- ⛓️ Push Chain universal transactions (native or ERC-20)
- ✅ Transparent payment flow

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create a `.env` file:

```bash
cp .env.example .env
```

Edit with your values:

```bash
GOOGLE_API_KEY=your_gemini_api_key
WALLET_PRIVATE_KEY=0xYourClientPrivateKey
PUSH_NETWORK=push-chain-testnet
PUSH_RPC_URL=https://evm.donut.rpc.push.org/
# Optional: override explorer links returned to users
PUSH_EXPLORER_BASE_URL=https://explorer.push.org
```

### 3. Fund Your Wallet

Make sure the wallet has funds on the configured Push network:
- **Native PC** for gas (Push Testnet Donut faucet: https://push.org/faucet)
- Any ERC-20 asset you plan to use for payments (bridge or mint on testnet)

### 4. Start the Agent

```bash
npm run dev
```

## Example Interaction

```
You: I want to buy a banana

Agent: The merchant is requesting payment of 1.00 PC for a banana.
       Do you want to proceed with the payment?

You: yes

Agent: ✅ Payment completed successfully!
       Transaction: 0x1234...

       View on Push Explorer: https://explorer.push.org/tx/0x1234...
```

## How It Works

1. **Request product** → Agent contacts merchant
2. **Receive payment requirements** → Merchant responds with Push network, asset, and amount
3. **User confirmation** → Agent shows payment details and asks to proceed
4. **Submit universal transaction** → Wallet uses the Push Chain SDK to send the payment
5. **Order confirmed** → Merchant verifies settlement and acknowledges the purchase

## Security

⚠️ **Private Key**: Your `WALLET_PRIVATE_KEY` can spend tokens!

- Never commit `.env` to git
- Use separate wallets for testnet vs mainnet
- Consider hardware wallet for production

The client signs a Push Chain *universal signer* with your private key to submit transactions. The SDK handles gas estimates and execution across networks.

## Network Configuration

**Push Chain Testnet (Donut)**
- RPC: `https://evm.donut.rpc.push.org/`
- Explorer: `https://explorer.push.org`
- Chain ID: 42101 (`push-chain-testnet`)

**Push Chain Mainnet**
- RPC: `https://evm.push.org/`
- Explorer: `https://explorer.push.org`
- Chain ID: 9 (`push-chain-mainnet`)

## Troubleshooting

**Insufficient balance**
- Fund the wallet with native PC and the payment token on the configured Push network
- Check balance: Your wallet address is shown when the agent starts

**Transaction failed**
- Ensure wallet has ETH for gas fees
- Verify RPC URL is correct
- Check network connectivity

## Related

- [Merchant Agent](../merchant-agent/README.md)
- [x402 Protocol Library](../x402_a2a/README.md)

## License

Apache-2.0
