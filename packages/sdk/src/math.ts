import { LiveBalance, Stream } from './types.js';

/**
 * Computes the exact amount earned by the recipient at a given timestamp.
 * Uses exact BigInt integer ratios: earned = (deposit_amount * elapsed) / duration
 * Exactly mirrors the on-chain Soroban contract logic without floating-point error.
 */
export function computeEarned(
  stream: Pick<Stream, 'depositAmount' | 'startTime' | 'stopTime'>,
  currentTimestamp: bigint | number,
): bigint {
  const current = BigInt(Math.floor(Number(currentTimestamp)));
  const start = BigInt(stream.startTime);
  const stop = BigInt(stream.stopTime);
  const deposit = BigInt(stream.depositAmount);

  if (current <= start) {
    return 0n;
  }
  if (current >= stop) {
    return deposit;
  }

  const duration = stop - start;
  if (duration <= 0n) {
    return deposit;
  }

  const elapsed = current - start;
  return (deposit * elapsed) / duration;
}

/**
 * Replicates the exact on-chain math in TypeScript for 60fps UI counters
 * without continuous RPC polling.
 */
export function calculateLiveBalance(
  stream: Stream,
  currentTimestamp: bigint | number,
): LiveBalance {
  const current = BigInt(Math.floor(Number(currentTimestamp)));
  const deposit = BigInt(stream.depositAmount);
  const withdrawn = BigInt(stream.recipientWithdrawn);
  const start = BigInt(stream.startTime);
  const stop = BigInt(stream.stopTime);

  // If stream is already canceled, remaining balance is 0 and no further streaming occurs
  if (stream.isCanceled) {
    return {
      recipientEarned: withdrawn,
      recipientClaimable: 0n,
      senderRefundable: 0n,
      progressFraction:
        deposit > 0n ? Number((withdrawn * 10000n) / deposit) / 10000 : 1,
    };
  }

  const earned = computeEarned(stream, current);

  const claimable = earned > withdrawn ? earned - withdrawn : 0n;
  const refundable = deposit > earned ? deposit - earned : 0n;

  const duration = stop > start ? stop - start : 1n;
  const elapsed = current > start ? (current < stop ? current - start : duration) : 0n;
  const progressFraction = Math.min(1, Math.max(0, Number(elapsed) / Number(duration)));

  return {
    recipientEarned: earned,
    recipientClaimable: claimable,
    senderRefundable: refundable,
    progressFraction,
  };
}

/**
 * Formats a raw integer amount (stroops) into a human-readable decimal string with fixed decimal places.
 * Default 7 decimals corresponds to standard Stellar tokens (XLM / SAC).
 */
export function formatUnits(amount: bigint | string | number, decimals = 7): string {
  const raw = BigInt(amount);
  const negative = raw < 0n;
  const abs = negative ? -raw : raw;

  const factor = 10n ** BigInt(decimals);
  const integerPart = abs / factor;
  const fractionalPart = abs % factor;

  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  const sign = negative ? '-' : '';

  return `${sign}${integerPart}.${fractionalStr}`;
}

/**
 * Parses a decimal string (e.g. "12.3456789") into raw stroops (bigint) with specified decimals.
 */
export function parseUnits(formatted: string, decimals = 7): bigint {
  const trimmed = formatted.trim();
  if (!trimmed) return 0n;

  const [intPart, fracPart = ''] = trimmed.split('.');
  const cleanInt = BigInt(intPart || '0');
  const paddedFrac = fracPart.padEnd(decimals, '0').slice(0, decimals);
  const cleanFrac = BigInt(paddedFrac);

  const factor = 10n ** BigInt(decimals);
  return cleanInt * factor + cleanFrac;
}

/**
 * Computes rate per second formatted string (e.g. "0.0001157 XLM/sec").
 */
export function formatRatePerSecond(
  depositAmount: bigint | string | number,
  durationSeconds: bigint | number,
  decimals = 7,
): string {
  const deposit = BigInt(depositAmount);
  const duration = BigInt(durationSeconds);

  if (duration <= 0n) return formatUnits(0n, decimals);

  const rateStroops = deposit / duration;
  return formatUnits(rateStroops, decimals);
}
