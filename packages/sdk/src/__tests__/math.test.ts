import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateLiveBalance,
  computeEarned,
  formatRatePerSecond,
  formatUnits,
  parseUnits,
} from '../math.js';
import { Stream } from '../types.js';

describe('SDK Math & Precision Tests', () => {
  const mockStream: Stream = {
    id: 1n,
    sender: 'GAEXAMPLE111111111111111111111111111111111111111111111111',
    recipient: 'GAEXAMPLE222222222222222222222222222222222222222222222222',
    token: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    depositAmount: 10_000_000_000n, // 1000 XLM (7 decimals)
    startTime: 1000n,
    stopTime: 2000n, // 1000 seconds duration
    ratePerSecond: 10_000_000n, // 1 XLM/sec
    remainingBalance: 10_000_000_000n,
    recipientWithdrawn: 0n,
    isCanceled: false,
    cancelable: true,
  };

  it('computes 0 earned before or at start time', () => {
    assert.equal(computeEarned(mockStream, 500n), 0n);
    assert.equal(computeEarned(mockStream, 1000n), 0n);
  });

  it('computes exact 25% distribution at 250s', () => {
    // 25% of 10_000_000_000 = 2_500_000_000
    const earned = computeEarned(mockStream, 1250n);
    assert.equal(earned, 2_500_000_000n);
  });

  it('computes exact midpoint 50% distribution', () => {
    const earned = computeEarned(mockStream, 1500n);
    assert.equal(earned, 5_000_000_000n);
  });

  it('computes exact 100% distribution at or after stop time', () => {
    assert.equal(computeEarned(mockStream, 2000n), 10_000_000_000n);
    assert.equal(computeEarned(mockStream, 2500n), 10_000_000_000n);
  });

  it('guarantees zero precision loss: earned + refundable == deposit at every second', () => {
    const oddDepositStream: Stream = {
      ...mockStream,
      depositAmount: 3_333_333_333n, // Odd non-divisible number
      startTime: 100n,
      stopTime: 400n, // 300 seconds duration
    };

    for (let t = 100; t <= 400; t += 10) {
      const balance = calculateLiveBalance(oddDepositStream, t);
      assert.equal(
        balance.recipientEarned + balance.senderRefundable,
        oddDepositStream.depositAmount,
        `Precision loss at timestamp ${t}`,
      );
    }
  });

  it('correctly deducts recipientWithdrawn from claimable', () => {
    const partiallyWithdrawn: Stream = {
      ...mockStream,
      recipientWithdrawn: 2_000_000_000n, // Already took 200 XLM
    };

    // At midpoint: total earned is 5000, claimable is 5000 - 2000 = 3000
    const balance = calculateLiveBalance(partiallyWithdrawn, 1500n);
    assert.equal(balance.recipientEarned, 5_000_000_000n);
    assert.equal(balance.recipientClaimable, 3_000_000_000n);
    assert.equal(balance.senderRefundable, 5_000_000_000n);
    assert.equal(balance.progressFraction, 0.5);
  });

  it('handles canceled stream state gracefully', () => {
    const canceledStream: Stream = {
      ...mockStream,
      isCanceled: true,
      remainingBalance: 0n,
      recipientWithdrawn: 3_500_000_000n,
    };

    const balance = calculateLiveBalance(canceledStream, 1500n);
    assert.equal(balance.recipientClaimable, 0n);
    assert.equal(balance.senderRefundable, 0n);
    assert.equal(balance.recipientEarned, 3_500_000_000n);
  });

  it('formats units and parses units consistently without precision loss', () => {
    const stroops = 1234567890n;
    const formatted = formatUnits(stroops, 7);
    assert.equal(formatted, '123.4567890');

    const parsed = parseUnits(formatted, 7);
    assert.equal(parsed, stroops);

    const zeroFormatted = formatUnits(0n, 7);
    assert.equal(zeroFormatted, '0.0000000');
    assert.equal(parseUnits('0', 7), 0n);
  });

  it('calculates human-readable rate per second', () => {
    // 1000 XLM over 1000 seconds = 1.0000000 XLM/sec
    const rate = formatRatePerSecond(10_000_000_000n, 1000n, 7);
    assert.equal(rate, '1.0000000');
  });
});
