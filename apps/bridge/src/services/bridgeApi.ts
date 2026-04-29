import { ChainOptions } from "../components/bridge";

const BRIDGE_API_ENDPOINT = 'https://us-east1-push-prod-apps.cloudfunctions.net/pushpointsrewardsystem/api/v3/bridge/events';
const BRIDGE_WEBHOOK_SECRET = '77d6c5f3ecd76d791b8a2ea47a4ac0cce4c403a7fec22a38bf731f3dfbc46d7d';

export interface BridgeEventPayload {
  eventId: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  fromAddress: string;
  fromChainId: string;
  fromTokenSymbol: string;
  toAddress: string;
  toChainId: string;
  toTokenSymbol: string;
  amount: string;
  decimals: number;
  sourceTxHash?: string;
  timestamp: string;
  fromChainName?: string;
  toChainName?: string;
  destinationTxHash?: string;
  ueaWallet?: string;
  userId?: string;
  failureReason?: string;
}

export interface BridgeApiResponse {
  success: boolean;
  data?: {
    eventId: string;
    status: string;
    created: boolean;
    deduped: boolean;
  };
  message?: string;
}

// Helper function to generate eventId (ULID-like format)
function generateEventId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `bridge_${timestamp}_${random}`;
}

// Helper function to create HMAC-SHA256 signature
async function createSignature(timestamp: string, rawBody: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(BRIDGE_WEBHOOK_SECRET);
    const messageData = encoder.encode(`${timestamp}.${rawBody}`);

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', key, messageData);
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const signature = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    console.log('Signature debug:', {
      timestamp,
      rawBody,
      message: `${timestamp}.${rawBody}`,
      signature
    });
    
    return signature;
  } catch (error) {
    console.error('Error creating signature:', error);
    throw error;
  }
}

// Main function to send bridge event to API
export async function sendBridgeEvent(payload: Omit<BridgeEventPayload, 'timestamp'> & { eventId?: string }): Promise<BridgeApiResponse> {
  try {
    const timestamp = new Date().toISOString();

    const fullPayload: BridgeEventPayload = {
      ...payload,
      eventId: payload.eventId ?? generateEventId(),
      timestamp,
    };

    const rawBody = JSON.stringify(fullPayload);
    const timestampMs = Date.now().toString();
    const signature = await createSignature(timestampMs, rawBody);

    const response = await fetch(BRIDGE_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bridge-timestamp': timestampMs,
        'x-bridge-signature': signature,
        'Content-Length': new Blob([rawBody]).size.toString(),
      },
      body: rawBody
    });

    if (response.ok) {
      const result = await response.json();
      console.log('Bridge event sent successfully:', result);
      return result;
    } else {
      const errorText = await response.text();
      console.error('Failed to send bridge event:', response.status, errorText);
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }
  } catch (error) {
    console.error('Error sending bridge event:', error);
    throw error;
  }
}

// Function to update bridge event status
export async function updateBridgeEventStatus(
  eventId: string,
  status: 'COMPLETED' | 'FAILED',
  destinationTxHash?: string,
  failureReason?: string
): Promise<BridgeApiResponse> {
  try {
    const timestamp = new Date().toISOString();
    
    const payload: Partial<BridgeEventPayload> = {
      eventId,
      status,
      timestamp,
      ...(destinationTxHash && { destinationTxHash }),
      ...(failureReason && { failureReason })
    };

    const rawBody = JSON.stringify(payload);
    const timestampMs = Date.now().toString();
    const signature = await createSignature(timestampMs, rawBody);

    const response = await fetch(BRIDGE_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bridge-timestamp': timestampMs,
        'x-bridge-signature': signature,
      },
      body: rawBody
    });

    if (response.ok) {
      const result = await response.json();
      console.log('Bridge event status updated successfully:', result);
      return result;
    } else {
      const errorText = await response.text();
      console.error('Failed to update bridge event status:', response.status, errorText);
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }
  } catch (error) {
    console.error('Error updating bridge event status:', error);
    throw error;
  }
}

// Helper function to create bridge event payload from bridge data
export function createBridgeEventPayload(params: {
  eventId?: string;
  status: BridgeEventPayload['status'];
  fromAddress: string;
  fromChain?: ChainOptions;
  fromTokenSymbol: string;
  toAddress: string;
  toChain?: ChainOptions;
  toTokenSymbol: string;
  amount: string;
  decimals: number;
  sourceTxHash?: string;
  destinationTxHash?: string;
  failureReason?: string;
  ueaWallet?: string;
  userId?: string;
}): Omit<BridgeEventPayload, 'timestamp'> {
  return {
    eventId: params.eventId ?? generateEventId(),
    status: params.status,
    fromAddress: params.fromAddress,
    fromChainId: params.fromChain?.value || '',
    fromTokenSymbol: params.fromTokenSymbol,
    toAddress: params.toAddress,
    toChainId: params.toChain?.value || '',
    toTokenSymbol: params.toTokenSymbol,
    amount: params.amount,
    decimals: params.decimals,
    sourceTxHash: params.sourceTxHash,
    fromChainName: params.fromChain?.label,
    toChainName: params.toChain?.label,
    destinationTxHash: params.destinationTxHash,
    ueaWallet: params.ueaWallet,
    userId: params.userId,
    failureReason: params.failureReason,
  };
}
