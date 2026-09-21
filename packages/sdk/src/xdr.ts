import {
  Address,
  nativeToScVal,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';
import { Stream } from './types.js';

/**
 * Converts a Stellar account / contract address (G... or C...) into an Address ScVal.
 */
export function addressToScVal(address: string): xdr.ScVal {
  return new Address(address).toScVal();
}

/**
 * Converts a u64 integer into an ScVal.
 */
export function u64ToScVal(value: bigint | number): xdr.ScVal {
  return nativeToScVal(BigInt(value), { type: 'u64' });
}

/**
 * Converts an i128 integer into an ScVal.
 */
export function i128ToScVal(value: bigint | string | number): xdr.ScVal {
  return nativeToScVal(BigInt(value), { type: 'i128' });
}

/**
 * Converts a boolean into an ScVal.
 */
export function boolToScVal(value: boolean): xdr.ScVal {
  return nativeToScVal(Boolean(value), { type: 'bool' });
}

/**
 * Parses a Soroban return value into a typed Stream structure.
 * Handles both raw xdr.ScVal and native JS objects/maps returned by scValToNative.
 */
export function parseStreamScVal(val: xdr.ScVal | unknown): Stream {
  const native = val instanceof xdr.ScVal ? scValToNative(val) : val;

  if (!native || typeof native !== 'object') {
    throw new Error('Invalid Stream return value from contract');
  }

  // Handle Map or Record
  const getProp = (keySnake: string, keyCamel: string): unknown => {
    if (native instanceof Map) {
      return native.get(keySnake) ?? native.get(keyCamel);
    }
    const rec = native as Record<string, unknown>;
    return rec[keySnake] ?? rec[keyCamel];
  };

  const toBigInt = (v: unknown, field: string): bigint => {
    if (typeof v === 'bigint') return v;
    if (typeof v === 'number') return BigInt(v);
    if (typeof v === 'string') return BigInt(v);
    throw new Error(`Invalid or missing bigint field: ${field}`);
  };

  const toString = (v: unknown, field: string): string => {
    if (typeof v === 'string') return v;
    if (v && typeof (v as { toString?: () => string }).toString === 'function') {
      return (v as { toString: () => string }).toString();
    }
    throw new Error(`Invalid or missing string field: ${field}`);
  };

  const toBool = (v: unknown): boolean => {
    return Boolean(v);
  };

  return {
    id: toBigInt(getProp('id', 'id'), 'id'),
    sender: toString(getProp('sender', 'sender'), 'sender'),
    recipient: toString(getProp('recipient', 'recipient'), 'recipient'),
    token: toString(getProp('token', 'token'), 'token'),
    depositAmount: toBigInt(getProp('deposit_amount', 'depositAmount'), 'depositAmount'),
    startTime: toBigInt(getProp('start_time', 'startTime'), 'startTime'),
    stopTime: toBigInt(getProp('stop_time', 'stopTime'), 'stopTime'),
    ratePerSecond: toBigInt(getProp('rate_per_second', 'ratePerSecond'), 'ratePerSecond'),
    remainingBalance: toBigInt(getProp('remaining_balance', 'remainingBalance'), 'remainingBalance'),
    recipientWithdrawn: toBigInt(getProp('recipient_withdrawn', 'recipientWithdrawn'), 'recipientWithdrawn'),
    isCanceled: toBool(getProp('is_canceled', 'isCanceled')),
    cancelable: toBool(getProp('cancelable', 'cancelable')),
  };
}
