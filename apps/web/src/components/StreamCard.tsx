'use client';

import Link from 'next/link';
import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Flame,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { formatUnits, Stream } from '@stellar-stream/sdk';
import { formatAddress } from '@/hooks/useFreighter';
import { useStreamBalance } from '@/hooks/useStreamBalance';

interface StreamCardProps {
  stream: Stream;
  perspective?: 'sender' | 'recipient';
  tokenSymbol?: string;
  decimals?: number;
}

export default function StreamCard({
  stream,
  perspective = 'sender',
  tokenSymbol = 'XLM',
  decimals = 7,
}: StreamCardProps) {
  const {
    formattedEarned,
    formattedClaimable,
    formattedRefundable,
    progressFraction,
    progressPercent,
    status,
  } = useStreamBalance(stream, decimals);

  const totalDeposit = formatUnits(stream.depositAmount, decimals);

  const counterPartyLabel = perspective === 'sender' ? 'To' : 'From';
  const counterPartyAddress =
    perspective === 'sender' ? stream.recipient : stream.sender;

  const statusConfig = {
    STREAMING: {
      label: 'Streaming',
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      icon: Flame,
    },
    COMPLETED: {
      label: 'Finished',
      badgeClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
      icon: CheckCircle2,
    },
    CANCELED: {
      label: 'Canceled',
      badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
      icon: XCircle,
    },
    NOT_STARTED: {
      label: 'Scheduled',
      badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      icon: Clock,
    },
  }[status];

  const StatusIcon = statusConfig.icon;

  return (
    <Link
      href={`/stream/${stream.id.toString()}`}
      className="glass-panel glass-panel-hover group block rounded-3xl p-5 sm:p-6 relative overflow-hidden"
    >
      <div className="flex items-center justify-between gap-2 mb-4">
        {/* Stream ID & Counterparty */}
        <div className="flex items-center space-x-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-stellar-hover border border-stellar-border font-bold text-xs text-stellar-cyan">
            #{stream.id.toString()}
          </div>
          <div>
            <div className="text-xs text-slate-400">
              {counterPartyLabel}:{' '}
              <span className="font-mono text-slate-200">
                {formatAddress(counterPartyAddress)}
              </span>
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div
          className={`flex items-center space-x-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-semibold ${statusConfig.badgeClass}`}
        >
          <StatusIcon className="h-3 w-3" />
          <span>{statusConfig.label}</span>
        </div>
      </div>

      {/* Main Streaming Number */}
      <div className="my-3">
        <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-0.5">
          {perspective === 'recipient' ? 'Accrued to You' : 'Total Distributed'}
        </div>
        <div className="flex items-baseline space-x-1.5 font-mono-numeric">
          <span className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-300">
            {formattedEarned}
          </span>
          <span className="text-xs font-bold text-slate-400">
            / {totalDeposit} {tokenSymbol}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="my-3 space-y-1.5">
        <div className="flex justify-between text-[11px] text-slate-400">
          <span>Progress</span>
          <span className="font-mono font-medium text-slate-300">
            {progressPercent}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-stellar-dark border border-stellar-border/60">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300"
            style={{
              width: `${Math.min(100, Math.max(0, progressFraction * 100))}%`,
            }}
          />
        </div>
      </div>

      {/* Footer info: Claimable & Arrow */}
      <div className="pt-3 border-t border-stellar-border/50 flex items-center justify-between text-xs">
        <div>
          {perspective === 'recipient' ? (
            <span className="text-emerald-300 font-mono font-semibold">
              {formattedClaimable} {tokenSymbol} Claimable
            </span>
          ) : (
            <span className="text-slate-400 font-mono">
              Refundable: {formattedRefundable} {tokenSymbol}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1 text-slate-400 group-hover:text-stellar-cyan transition-colors font-medium text-[11px]">
          <span>View Stream</span>
          <ArrowUpRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </div>
      </div>
    </Link>
  );
}
