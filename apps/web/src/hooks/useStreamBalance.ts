'use client';

import { useEffect, useRef, useState } from 'react';
import {
  calculateLiveBalance,
  formatUnits,
  Stream,
} from '@stellar-stream/sdk';

export type StreamStatus =
  | 'NOT_STARTED'
  | 'STREAMING'
  | 'COMPLETED'
  | 'CANCELED';

export interface LiveBalanceState {
  recipientEarned: bigint;
  recipientClaimable: bigint;
  senderRefundable: bigint;
  progressFraction: number;
  progressPercent: string;
  formattedEarned: string;
  formattedClaimable: string;
  formattedRefundable: string;
  status: StreamStatus;
  remainingSeconds: number;
  elapsedSeconds: number;
  durationSeconds: number;
}

export function useStreamBalance(
  stream: Stream | null | undefined,
  decimals = 7,
): LiveBalanceState {
  const getInitialState = (): LiveBalanceState => {
    if (!stream) {
      return {
        recipientEarned: 0n,
        recipientClaimable: 0n,
        senderRefundable: 0n,
        progressFraction: 0,
        progressPercent: '0.0%',
        formattedEarned: '0.0000000',
        formattedClaimable: '0.0000000',
        formattedRefundable: '0.0000000',
        status: 'NOT_STARTED',
        remainingSeconds: 0,
        elapsedSeconds: 0,
        durationSeconds: 0,
      };
    }

    const now = Math.floor(Date.now() / 1000);
    const start = Number(stream.startTime);
    const stop = Number(stream.stopTime);
    const duration = Math.max(1, stop - start);
    const elapsed = Math.max(0, Math.min(now - start, duration));
    const remaining = Math.max(0, stop - now);

    let status: StreamStatus = 'STREAMING';
    if (stream.isCanceled) {
      status = 'CANCELED';
    } else if (now < start) {
      status = 'NOT_STARTED';
    } else if (now >= stop) {
      status = 'COMPLETED';
    }

    const live = calculateLiveBalance(stream, now);
    const pct = (live.progressFraction * 100).toFixed(2) + '%';

    return {
      recipientEarned: live.recipientEarned,
      recipientClaimable: live.recipientClaimable,
      senderRefundable: live.senderRefundable,
      progressFraction: live.progressFraction,
      progressPercent: pct,
      formattedEarned: formatUnits(live.recipientEarned, decimals),
      formattedClaimable: formatUnits(live.recipientClaimable, decimals),
      formattedRefundable: formatUnits(live.senderRefundable, decimals),
      status,
      remainingSeconds: remaining,
      elapsedSeconds: elapsed,
      durationSeconds: duration,
    };
  };

  const [balanceState, setBalanceState] =
    useState<LiveBalanceState>(getInitialState);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!stream) {
      setBalanceState(getInitialState());
      return;
    }

    let lastTick = 0;

    const tick = () => {
      const nowMs = Date.now();
      // Tick at smooth ~60fps (every 16ms)
      if (nowMs - lastTick >= 16) {
        lastTick = nowMs;
        const nowSec = nowMs / 1000;
        const start = Number(stream.startTime);
        const stop = Number(stream.stopTime);
        const duration = Math.max(1, stop - start);
        const elapsed = Math.max(0, Math.min(Math.floor(nowSec) - start, duration));
        const remaining = Math.max(0, stop - Math.floor(nowSec));

        let status: StreamStatus = 'STREAMING';
        if (stream.isCanceled) {
          status = 'CANCELED';
        } else if (nowSec < start) {
          status = 'NOT_STARTED';
        } else if (nowSec >= stop) {
          status = 'COMPLETED';
        }

        const live = calculateLiveBalance(stream, nowSec);
        const pct = (live.progressFraction * 100).toFixed(2) + '%';

        setBalanceState({
          recipientEarned: live.recipientEarned,
          recipientClaimable: live.recipientClaimable,
          senderRefundable: live.senderRefundable,
          progressFraction: live.progressFraction,
          progressPercent: pct,
          formattedEarned: formatUnits(live.recipientEarned, decimals),
          formattedClaimable: formatUnits(live.recipientClaimable, decimals),
          formattedRefundable: formatUnits(live.senderRefundable, decimals),
          status,
          remainingSeconds: remaining,
          elapsedSeconds: elapsed,
          durationSeconds: duration,
        });

        // If completed or canceled, stop animation loop
        if (status === 'COMPLETED' || status === 'CANCELED') {
          return;
        }
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [stream, decimals]);

  return balanceState;
}

export function formatTimeCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0s';
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(' ');
}
