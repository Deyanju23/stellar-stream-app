'use client';

import {
  formatRatePerSecond,
  formatUnits,
  Stream,
} from '@stellar-stream/sdk';
import {
  formatTimeCountdown,
  useStreamBalance,
} from '@/hooks/useStreamBalance';
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Coins,
  DollarSign,
  Flame,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface StreamVisualizerProps {
  stream: Stream;
  tokenSymbol?: string;
  decimals?: number;
}

export default function StreamVisualizer({
  stream,
  tokenSymbol = 'XLM',
  decimals = 7,
}: StreamVisualizerProps) {
  const {
    formattedEarned,
    formattedClaimable,
    formattedRefundable,
    progressFraction,
    progressPercent,
    status,
    remainingSeconds,
    elapsedSeconds,
    durationSeconds,
  } = useStreamBalance(stream, decimals);

  const duration = BigInt(Math.max(1, Number(stream.stopTime) - Number(stream.startTime)));
  const rateFormatted = formatRatePerSecond(stream.depositAmount, duration, decimals);
  const totalDepositFormatted = formatUnits(stream.depositAmount, decimals);
  const withdrawnFormatted = formatUnits(stream.recipientWithdrawn, decimals);

  // Status configuration
  const statusConfig = {
    STREAMING: {
      label: 'Streaming Live',
      badgeClass:
        'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 shadow-sm shadow-emerald-500/20',
      icon: Flame,
      indicatorClass: 'bg-emerald-400 animate-pulse',
    },
    COMPLETED: {
      label: 'Stream Finished',
      badgeClass:
        'bg-cyan-500/10 border-cyan-500/40 text-cyan-400 shadow-sm shadow-cyan-500/20',
      icon: CheckCircle2,
      indicatorClass: 'bg-cyan-400',
    },
    CANCELED: {
      label: 'Stream Canceled',
      badgeClass:
        'bg-rose-500/10 border-rose-500/40 text-rose-400 shadow-sm shadow-rose-500/20',
      icon: AlertCircle,
      indicatorClass: 'bg-rose-400',
    },
    NOT_STARTED: {
      label: 'Scheduled',
      badgeClass:
        'bg-amber-500/10 border-amber-500/40 text-amber-400 shadow-sm shadow-amber-500/20',
      icon: Clock,
      indicatorClass: 'bg-amber-400',
    },
  }[status];

  const StatusIcon = statusConfig.icon;

  return (
    <div className="glass-panel relative overflow-hidden rounded-3xl p-6 sm:p-8">
      {/* Background radial glow */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

      {/* Header with status badge & stream ID */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-stellar-border/60 pb-5">
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stellar-hover border border-stellar-border">
            <Coins className="h-5 w-5 text-stellar-cyan" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-white tracking-wide">
                Stream #{stream.id.toString()}
              </h2>
              {stream.cancelable ? (
                <span className="inline-flex items-center space-x-1 rounded-md bg-stellar-hover/60 px-2 py-0.5 text-[11px] text-slate-300 border border-stellar-border/50">
                  <ShieldCheck className="h-3 w-3 text-cyan-400" />
                  <span>Cancelable</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 rounded-md bg-stellar-hover/60 px-2 py-0.5 text-[11px] text-slate-400 border border-stellar-border/50">
                  <span>Irrevocable</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Continuous linear distribution
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div
          className={`flex items-center space-x-2 rounded-xl border px-3 py-1.5 text-xs font-semibold ${statusConfig.badgeClass}`}
        >
          <span
            className={`h-2 w-2 rounded-full ${statusConfig.indicatorClass}`}
          />
          <StatusIcon className="h-3.5 w-3.5" />
          <span>{statusConfig.label}</span>
        </div>
      </div>

      {/* Main Accrued Balance Counter */}
      <div className="relative z-10 my-8 flex flex-col items-center justify-center text-center">
        <span className="text-xs font-medium uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-stellar-cyan" />
          Real-time Accrued Recipient Balance
        </span>

        {/* Live ticking number with sub-second 7 decimals */}
        <div className="flex items-baseline space-x-2 font-mono-numeric">
          <span className="text-4xl sm:text-6xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 drop-shadow-[0_0_25px_rgba(0,229,255,0.3)]">
            {formattedEarned}
          </span>
          <span className="text-xl sm:text-2xl font-bold text-slate-400">
            {tokenSymbol}
          </span>
        </div>

        {/* Live Flow Rate */}
        <div className="mt-3 flex items-center space-x-2 rounded-full bg-stellar-hover/80 px-4 py-1.5 text-xs text-slate-300 border border-stellar-border">
          <span className="text-slate-400">Rate:</span>
          <span className="font-mono font-semibold text-stellar-cyan">
            {rateFormatted} {tokenSymbol}/sec
          </span>
        </div>
      </div>

      {/* Interactive Progress Bar */}
      <div className="relative z-10 mb-8 space-y-2">
        <div className="flex justify-between text-xs text-slate-400 font-medium">
          <span>Stream Progress ({progressPercent})</span>
          <span>
            {status === 'COMPLETED'
              ? 'Completed'
              : status === 'NOT_STARTED'
              ? `Starts in ${formatTimeCountdown(Math.max(0, Number(stream.startTime) - Math.floor(Date.now() / 1000)))}`
              : `${formatTimeCountdown(remainingSeconds)} remaining`}
          </span>
        </div>

        {/* Track */}
        <div className="relative h-4 w-full overflow-hidden rounded-full bg-stellar-dark border border-stellar-border/80">
          {/* Progress fill */}
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 transition-all duration-300 relative overflow-hidden"
            style={{ width: `${Math.min(100, Math.max(0, progressFraction * 100))}%` }}
          >
            {/* Animated shimmer when streaming */}
            {status === 'STREAMING' && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-stream-flow" />
            )}
          </div>
        </div>

        <div className="flex justify-between text-[11px] text-slate-500 font-mono">
          <span>Start: {new Date(Number(stream.startTime) * 1000).toLocaleString()}</span>
          <span>End: {new Date(Number(stream.stopTime) * 1000).toLocaleString()}</span>
        </div>
      </div>

      {/* Metrics Breakdown Grid */}
      <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        {/* Total Deposit */}
        <div className="rounded-2xl border border-stellar-border bg-stellar-card/80 p-3.5">
          <span className="text-slate-400 block mb-1">Total Stream Deposit</span>
          <span className="font-mono text-sm font-bold text-slate-200">
            {totalDepositFormatted} {tokenSymbol}
          </span>
        </div>

        {/* Claimable Available */}
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3.5">
          <span className="text-emerald-400/90 block mb-1 font-medium">
            Available to Claim
          </span>
          <span className="font-mono text-sm font-bold text-emerald-300">
            {formattedClaimable} {tokenSymbol}
          </span>
        </div>

        {/* Already Withdrawn */}
        <div className="rounded-2xl border border-stellar-border bg-stellar-card/80 p-3.5">
          <span className="text-slate-400 block mb-1">Claimed / Withdrawn</span>
          <span className="font-mono text-sm font-bold text-slate-200">
            {withdrawnFormatted} {tokenSymbol}
          </span>
        </div>

        {/* Refundable to Sender */}
        <div className="rounded-2xl border border-stellar-border bg-stellar-card/80 p-3.5">
          <span className="text-slate-400 block mb-1">Sender Unaccrued</span>
          <span className="font-mono text-sm font-bold text-slate-200">
            {formattedRefundable} {tokenSymbol}
          </span>
        </div>
      </div>
    </div>
  );
}
