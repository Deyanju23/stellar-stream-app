/**
 * Core domain types and interfaces for the StellarStream Soroban smart contract.
 */

export interface Stream {
  id: bigint;
  sender: string;
  recipient: string;
  token: string;
  depositAmount: bigint;
  startTime: bigint;
  stopTime: bigint;
  ratePerSecond: bigint;
  remainingBalance: bigint;
  recipientWithdrawn: bigint;
  isCanceled: boolean;
  cancelable: boolean;
}

export interface CreateStreamParams {
  sender: string;
  recipient: string;
  token: string;
  depositAmount: bigint;
  startTime: bigint;
  stopTime: bigint;
  cancelable: boolean;
}

export interface WithdrawParams {
  streamId: bigint;
  amount: bigint;
  recipient: string;
}

export interface CancelParams {
  streamId: bigint;
  sender: string;
}

export interface LiveBalance {
  recipientEarned: bigint;
  recipientClaimable: bigint;
  senderRefundable: bigint;
  progressFraction: number;
}

export interface StreamCreatedEvent {
  sender: string;
  recipient: string;
  streamId: bigint;
  token: string;
  depositAmount: bigint;
  startTime: bigint;
  stopTime: bigint;
  ledger?: number;
}

export interface TokensWithdrawnEvent {
  recipient: string;
  streamId: bigint;
  amount: bigint;
  remainingBalance: bigint;
  ledger?: number;
}

export interface StreamCanceledEvent {
  streamId: bigint;
  senderRefund: bigint;
  recipientPayout: bigint;
  ledger?: number;
}

export type StreamEvent =
  | { type: 'StreamCreated'; data: StreamCreatedEvent }
  | { type: 'TokensWithdrawn'; data: TokensWithdrawnEvent }
  | { type: 'StreamCanceled'; data: StreamCanceledEvent };

export interface ClientConfig {
  rpcUrl: string;
  networkPassphrase: string;
  contractId: string;
}
