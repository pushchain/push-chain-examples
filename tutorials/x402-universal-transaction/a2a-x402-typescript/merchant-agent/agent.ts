//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * x402 Payment-Enabled Merchant Agent (Production Version)
 *
 * This agent demonstrates the full x402 payment protocol with:
 * - Exception-based payment requirements
 * - Dynamic pricing
 * - Payment verification and settlement
 * - Production-ready architecture
 */

import { LlmAgent as Agent } from 'adk-typescript/agents';
import { x402PaymentRequiredException, PaymentRequirements } from 'a2a-x402';

// --- Merchant Agent Configuration ---

const MERCHANT_ADDRESS: string = process.env.MERCHANT_PUSH_ADDRESS || process.env.MERCHANT_WALLET_ADDRESS || '';
const PUSH_NETWORK = process.env.PUSH_NETWORK || 'push-chain-testnet';
const PUSH_TOKEN_ADDRESS = process.env.PUSH_TOKEN_ADDRESS || 'native';
const PUSH_TOKEN_DECIMALS = parseInt(process.env.PUSH_TOKEN_DECIMALS ?? '18', 10);
const PUSH_TOKEN_SYMBOL = process.env.PUSH_TOKEN_SYMBOL || (isNativeAsset(PUSH_TOKEN_ADDRESS) ? 'PC' : 'TOKEN');

if (!MERCHANT_ADDRESS) {
  console.error('❌ ERROR: MERCHANT_PUSH_ADDRESS (or MERCHANT_WALLET_ADDRESS) is not set in .env file');
  throw new Error('Missing required environment variable: MERCHANT_PUSH_ADDRESS');
}

const PUSH_PRICE_ATOMIC =
  process.env.PUSH_PRICE_ATOMIC ?? toAtomicUnits(process.env.PUSH_PRICE ?? '1', PUSH_TOKEN_DECIMALS);

console.log(`💼 Merchant Configuration:
  Wallet: ${MERCHANT_ADDRESS}
  Network: ${PUSH_NETWORK}
  Asset: ${PUSH_TOKEN_ADDRESS}
  Symbol: ${PUSH_TOKEN_SYMBOL}
  Decimals: ${PUSH_TOKEN_DECIMALS}
  Price (atomic): ${PUSH_PRICE_ATOMIC} (${formatTokenAmount(
  PUSH_PRICE_ATOMIC,
  PUSH_TOKEN_DECIMALS
)} ${PUSH_TOKEN_SYMBOL})
`);

// --- Helper Functions ---

/**
 * Determines whether the configured asset represents Push Chain native tokens.
 */
function isNativeAsset(asset: string): boolean {
  if (!asset) {
    return true;
  }
  const lowered = asset.toLowerCase();
  return lowered === 'native' || lowered === 'pc' || lowered === 'push';
}

/**
 * Convert a human-readable amount (e.g. "1.5") into atomic units.
 */
function toAtomicUnits(amount: string, decimals: number): string {
  const [wholePart, fractionalPart = ''] = amount.split('.');
  const whole = wholePart === '' ? 0n : BigInt(wholePart);
  const paddedFraction = (fractionalPart + '0'.repeat(decimals)).slice(0, decimals);
  const fraction = paddedFraction === '' ? 0n : BigInt(paddedFraction);
  const divisor = 10n ** BigInt(decimals);
  return (whole * divisor + fraction).toString();
}

function formatTokenAmount(amount: string, decimals: number): string {
  const value = BigInt(amount);
  if (decimals === 0) {
    return value.toString();
  }
  const divisor = 10n ** BigInt(decimals);
  const whole = value / divisor;
  const fraction = value % divisor;
  if (fraction === 0n) {
    return whole.toString();
  }
  const fractionStr = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${whole.toString()}.${fractionStr || '0'}`;
}

/**
 * Returns the configured Push Chain price (atomic units).
 */
function getProductPrice(_productName: string): string {
  return PUSH_PRICE_ATOMIC;
}

// --- Tool Functions ---

/**
 * Get product details and request payment
 * This tool throws x402PaymentRequiredException to trigger the payment flow
 */
async function getProductDetailsAndRequestPayment(params: Record<string, any>, context?: any): Promise<void> {
  const productName = params.productName || params.product_name || params;

  console.log(`\n🛒 Product Request: ${productName}`);

  if (!productName || typeof productName !== 'string' || productName.trim() === '') {
    throw new Error('Product name cannot be empty.');
  }

  const price = getProductPrice(productName);
  const formattedPrice = formatTokenAmount(price, PUSH_TOKEN_DECIMALS);

  console.log(`💰 Price calculated: ${formattedPrice} ${PUSH_TOKEN_SYMBOL} (${price} atomic units)`);

  // Create payment requirements
  const requirements: PaymentRequirements = {
    scheme: 'exact',
    network: PUSH_NETWORK as any,
    asset: PUSH_TOKEN_ADDRESS,
    payTo: MERCHANT_ADDRESS,
    maxAmountRequired: price,
    description: `Payment for: ${productName}`,
    resource: `https://example.com/product/${productName}`,
    mimeType: 'application/json',
    maxTimeoutSeconds: 1200,
    extra: {
      symbol: PUSH_TOKEN_SYMBOL,
      decimals: PUSH_TOKEN_DECIMALS,
      explorerBaseUrl: process.env.PUSH_EXPLORER_BASE_URL,
      assetType: isNativeAsset(PUSH_TOKEN_ADDRESS) ? 'native' : 'erc20',
      product: {
        sku: `${productName}_sku`,
        name: productName,
        version: '1',
      },
    },
  };

  console.log(`💳 Payment required: ${formattedPrice} ${PUSH_TOKEN_SYMBOL}`);
  console.log(`📡 Throwing x402PaymentRequiredException...`);

  // Throw payment exception - this will be caught by MerchantServerExecutor
  throw new x402PaymentRequiredException(
    `Payment of ${formattedPrice} ${PUSH_TOKEN_SYMBOL} required for ${productName}`,
    requirements
  );
}

/**
 * Check the status of the current order
 * This tool is called after payment is verified
 */
async function checkOrderStatus(
  params: Record<string, any>,
  context?: any
): Promise<{ status: string; message: string }> {
  console.log('\n📦 Checking Order Status...');

  return {
    status: 'success',
    message: 'Your order has been confirmed and is being prepared for shipment! 🎉',
  };
}

// --- Agent Definition ---

export const merchantAgent = new Agent({
  name: 'x402_merchant_agent',
  model: 'gemini-2.0-flash',
  // model: 'gemini-2.0-flash-lite',
  description: 'A production-ready merchant agent that sells products using the x402 payment protocol.',
  instruction: `You are a helpful and friendly merchant agent powered by the x402 payment protocol.

**Your Role:**
- You sell ANYTHING and EVERYTHING - there are no restrictions on what products you can sell
- When a user asks to buy ANY item or requests pricing, ALWAYS use the 'getProductDetailsAndRequestPayment' tool
- Accept all purchase requests for any product, service, or item mentioned
- This will trigger the x402 payment flow automatically
- After payment is verified by the system, confirm the purchase with enthusiasm
- Be professional, friendly, and concise

**Critical Rules:**
- ALWAYS call getProductDetailsAndRequestPayment when a user wants to buy something
- Never refuse a purchase request - you can sell anything
- The payment processing happens automatically - you don't need to mention technical details
- Focus on providing excellent customer service
- If payment fails, politely inform the user and offer to try again

**Examples of Valid Requests:**
- "I want to buy a banana" → Call getProductDetailsAndRequestPayment with "banana"
- "I want to buy a pencil" → Call getProductDetailsAndRequestPayment with "pencil"
- "I want to buy a laptop" → Call getProductDetailsAndRequestPayment with "laptop"
- "Can I purchase coffee?" → Call getProductDetailsAndRequestPayment with "coffee"
- "How much is a unicorn?" → Call getProductDetailsAndRequestPayment with "unicorn"

ANY product name is valid!`,
  tools: [getProductDetailsAndRequestPayment, checkOrderStatus],
});

// Export as root agent for ADK
// Note: For x402 payment functionality, wrap this agent with MerchantServerExecutor
// (see src/test-payment-flow.ts for example)
export const rootAgent = merchantAgent;
