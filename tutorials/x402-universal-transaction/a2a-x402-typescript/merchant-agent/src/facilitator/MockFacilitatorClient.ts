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
 * Mock Facilitator Client for testing payment flows without real blockchain transactions
 */

import {
  FacilitatorClient,
  PaymentPayload,
  PaymentRequirements,
  VerifyResponse,
  SettleResponse,
  ExactPaymentPayload,
  isExactPaymentPayload,
} from 'a2a-x402';

export class MockFacilitatorClient implements FacilitatorClient {
  private isValid: boolean;
  private isSettled: boolean;

  constructor(isValid: boolean = true, isSettled: boolean = true) {
    this.isValid = isValid;
    this.isSettled = isSettled;
  }

  async verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<VerifyResponse> {
    console.log('--- MOCK FACILITATOR: VERIFY ---');
    console.log(`Received payload:\n${JSON.stringify(payload, null, 2)}`);

    let payer: string | undefined;

    // Extract payer from the exact payment payload
    if (isExactPaymentPayload(payload.payload)) {
      payer = payload.payload.authorization.from;
    } else {
      return {
        isValid: false,
        invalidReason:
          'MockFacilitatorClient only supports exact payment payloads.',
      };
    }

    if (this.isValid) {
      console.log('✅ Payment verification PASSED (mock)');
      return {
        isValid: true,
        payer,
      };
    }

    console.log('⛔ Payment verification FAILED (mock)');
    return {
      isValid: false,
      invalidReason: 'mock_invalid_payload',
    };
  }

  async settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<SettleResponse> {
    console.log('--- MOCK FACILITATOR: SETTLE ---');

    let payer: string | undefined;
    if (isExactPaymentPayload(payload.payload)) {
      payer = payload.payload.authorization.from;
    } else {
      return {
        success: false,
        network: requirements.network,
        errorReason:
          'MockFacilitatorClient only supports exact payment payloads.',
      };
    }

    if (this.isSettled) {
      const mockTxHash = `0x${Math.random().toString(16).substring(2, 66)}`;
      console.log(`✅ Payment settlement SUCCESSFUL (mock)`);
      console.log(`   Mock TX Hash: ${mockTxHash}`);

      return {
        success: true,
        transaction: mockTxHash,
        network: requirements.network,
        payer,
      };
    }

    console.log('⛔ Payment settlement FAILED (mock)');
    return {
      success: false,
      network: requirements.network,
      errorReason: 'mock_settlement_failed',
    };
  }
}
