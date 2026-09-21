import {
  rpc,
  StrKey,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import { StellarStreamClient } from '@stellar-stream/sdk';
import { CONFIG } from './config';

let clientInstance: StellarStreamClient | null = null;

export function getStreamClient(): StellarStreamClient {
  if (!clientInstance) {
    clientInstance = new StellarStreamClient({
      rpcUrl: CONFIG.rpcUrl,
      networkPassphrase: CONFIG.networkPassphrase,
      contractId: CONFIG.contractId,
    });
  }
  return clientInstance;
}

export function isValidStellarAddress(address: string): boolean {
  if (!address) return false;
  return StrKey.isValidEd25519PublicKey(address);
}

export function isValidContractAddress(address: string): boolean {
  if (!address) return false;
  return StrKey.isValidContract(address) || StrKey.isValidEd25519PublicKey(address);
}

/**
 * Submits a signed transaction XDR to the Soroban RPC server and polls until finalized.
 */
export async function submitSignedTransaction(
  signedTxXdr: string,
): Promise<{ hash: string; status: string; streamId?: bigint }> {
  const client = getStreamClient();
  const tx = TransactionBuilder.fromXDR(
    signedTxXdr,
    CONFIG.networkPassphrase,
  );

  const sendResponse = await client.server.sendTransaction(tx);

  if (sendResponse.status === 'ERROR') {
    const errorDetails =
      'errorResult' in sendResponse ? JSON.stringify(sendResponse.errorResult) : '';
    throw new Error(`Transaction submission error: ${sendResponse.status} ${errorDetails}`);
  }

  const txHash = sendResponse.hash;

  // Poll for completion (up to 30 seconds)
  const maxAttempts = 15;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const statusResponse = await client.server.getTransaction(txHash);

    if (statusResponse.status === 'SUCCESS') {
      let streamId: bigint | undefined;

      // Try parsing returned stream ID from returnValue if available
      if (statusResponse.resultMetaXdr) {
        try {
          if (statusResponse.returnValue) {
            const native = statusResponse.returnValue.value();
            if (typeof native === 'bigint') streamId = native;
            else if (typeof native === 'number') streamId = BigInt(native);
          }
        } catch {
          // ignore return value extraction if not present
        }
      }

      return {
        hash: txHash,
        status: 'SUCCESS',
        streamId,
      };
    }

    if (statusResponse.status === 'FAILED') {
      throw new Error(
        `Transaction failed on-chain. Details: ${JSON.stringify(statusResponse.resultXdr || '')}`,
      );
    }
  }

  throw new Error(`Transaction confirmation timed out after 30s. Hash: ${txHash}`);
}
