'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  Filter,
  Flame,
  Layers,
  Loader2,
  PlusCircle,
  RefreshCw,
  Search,
  Wallet,
  Zap,
} from 'lucide-react';
import { formatUnits, Stream } from '@stellar-stream/sdk';
import StreamCard from '@/components/StreamCard';
import { useFreighter } from '@/hooks/useFreighter';
import { CONFIG } from '@/lib/config';

type TabType = 'outgoing' | 'incoming' | 'all';
type StatusFilter = 'ALL' | 'ACTIVE' | 'COMPLETED' | 'CANCELED';

interface RawStreamRecord {
  id: number;
  sender: string;
  recipient: string;
  token: string;
  deposit_amount: string;
  start_time: number;
  stop_time: number;
  rate_per_second: string;
  remaining_balance: string;
  recipient_withdrawn: string;
  is_canceled: number;
  cancelable: number;
}

export default function DashboardPage() {
  const { isConnected, address, connect } = useFreighter();

  const [activeTab, setActiveTab] = useState<TabType>('outgoing');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [allStreams, setAllStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStreams = useCallback(async () => {
    try {
      let url = `${CONFIG.indexerUrl}/api/streams?limit=100`;

      if (isConnected && address) {
        if (activeTab === 'outgoing') {
          url = `${CONFIG.indexerUrl}/api/streams/sender/${address}`;
        } else if (activeTab === 'incoming') {
          url = `${CONFIG.indexerUrl}/api/streams/recipient/${address}`;
        }
      }

      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        const rawList: RawStreamRecord[] = json.streams || [];

        const mapped: Stream[] = rawList.map((s) => ({
          id: BigInt(s.id),
          sender: s.sender,
          recipient: s.recipient,
          token: s.token,
          depositAmount: BigInt(s.deposit_amount),
          startTime: BigInt(s.start_time),
          stopTime: BigInt(s.stop_time),
          ratePerSecond: BigInt(s.rate_per_second),
          remainingBalance: BigInt(s.remaining_balance),
          recipientWithdrawn: BigInt(s.recipient_withdrawn),
          isCanceled: Boolean(s.is_canceled),
          cancelable: Boolean(s.cancelable),
        }));

        setAllStreams(mapped);
      }
    } catch (err) {
      console.warn('Could not reach indexer, running with empty cache:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, isConnected, address]);

  useEffect(() => {
    setLoading(true);
    fetchStreams();
  }, [fetchStreams]);

  // Filtered list
  const filteredStreams = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);

    return allStreams.filter((stream) => {
      // 1. Status Filter
      if (statusFilter === 'CANCELED' && !stream.isCanceled) return false;
      if (statusFilter === 'ACTIVE') {
        if (stream.isCanceled || now >= Number(stream.stopTime)) return false;
      }
      if (statusFilter === 'COMPLETED') {
        if (stream.isCanceled || now < Number(stream.stopTime)) return false;
      }

      // 2. Search Query (matches ID, sender, or recipient)
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const idMatch = stream.id.toString() === query;
        const senderMatch = stream.sender.toLowerCase().includes(query);
        const recipientMatch = stream.recipient.toLowerCase().includes(query);
        return idMatch || senderMatch || recipientMatch;
      }

      return true;
    });
  }, [allStreams, statusFilter, searchQuery]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    let totalDeposited = 0n;
    let activeCount = 0;
    let totalRemaining = 0n;

    for (const s of allStreams) {
      totalDeposited += s.depositAmount;
      totalRemaining += s.remainingBalance;
      if (!s.isCanceled && now >= Number(s.startTime) && now < Number(s.stopTime)) {
        activeCount++;
      }
    }

    return {
      activeCount,
      totalDeposited: formatUnits(totalDeposited, 7),
      totalRemaining: formatUnits(totalRemaining, 7),
      streamCount: allStreams.length,
    };
  }, [allStreams]);

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="glass-panel relative overflow-hidden rounded-3xl p-6 sm:p-10">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center space-x-2 rounded-xl bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-stellar-cyan border border-cyan-500/30">
              <Flame className="h-3.5 w-3.5" />
              <span>Real-Time Continuous Token Streaming</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
              Continuous Linear Money Streams on{' '}
              <span className="text-gradient-cyan">Stellar Soroban</span>
            </h1>
            <p className="text-sm text-slate-400 max-w-xl">
              Stream payroll, subscriptions, vesting, or grant disbursements with sub-second precision, zero loss of precision, and instant withdrawal flexibility.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/create"
              className="inline-flex items-center justify-center space-x-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-400 px-6 py-3.5 text-sm font-bold text-stellar-dark shadow-xl shadow-cyan-500/20 hover:opacity-95 transition-all active:scale-[0.99]"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Create Stream</span>
            </Link>
          </div>
        </div>

        {/* Hero Stat Counters */}
        <div className="relative z-10 mt-8 grid grid-cols-2 md:grid-cols-4 gap-3 pt-6 border-t border-stellar-border/60 text-xs">
          <div className="rounded-2xl border border-stellar-border bg-stellar-dark/60 p-4">
            <span className="text-slate-400 block mb-1">Active Streams</span>
            <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
              {metrics.activeCount}
            </span>
          </div>

          <div className="rounded-2xl border border-stellar-border bg-stellar-dark/60 p-4">
            <span className="text-slate-400 block mb-1">Total Streams Indexed</span>
            <span className="text-xl sm:text-2xl font-black text-slate-200 font-mono">
              {metrics.streamCount}
            </span>
          </div>

          <div className="rounded-2xl border border-stellar-border bg-stellar-dark/60 p-4">
            <span className="text-slate-400 block mb-1">Total Volume Streamed</span>
            <span className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400 font-mono">
              {metrics.totalDeposited} <span className="text-xs text-slate-400">XLM</span>
            </span>
          </div>

          <div className="rounded-2xl border border-stellar-border bg-stellar-dark/60 p-4">
            <span className="text-slate-400 block mb-1">Locked Protocol TVL</span>
            <span className="text-xl sm:text-2xl font-black text-cyan-300 font-mono">
              {metrics.totalRemaining} <span className="text-xs text-slate-400">XLM</span>
            </span>
          </div>
        </div>
      </div>

      {/* Tabs, Search & Filters Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Perspective Tabs */}
        <div className="flex rounded-2xl bg-stellar-card p-1 border border-stellar-border">
          <button
            type="button"
            onClick={() => setActiveTab('outgoing')}
            className={`flex items-center space-x-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
              activeTab === 'outgoing'
                ? 'bg-stellar-hover text-white shadow-sm border border-stellar-border/80'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ArrowUpRight className="h-3.5 w-3.5 text-stellar-cyan" />
            <span>Outgoing (Created)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('incoming')}
            className={`flex items-center space-x-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
              activeTab === 'incoming'
                ? 'bg-stellar-hover text-white shadow-sm border border-stellar-border/80'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-400" />
            <span>Incoming (Received)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`flex items-center space-x-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
              activeTab === 'all'
                ? 'bg-stellar-hover text-white shadow-sm border border-stellar-border/80'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="h-3.5 w-3.5 text-slate-400" />
            <span>Explore All</span>
          </button>
        </div>

        {/* Search & Status Filters */}
        <div className="flex items-center space-x-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by ID or G... address"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-stellar-border bg-stellar-card/80 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-stellar-cyan focus:outline-none transition-colors"
            />
          </div>

          {/* Status Filter Buttons */}
          <div className="flex rounded-xl bg-stellar-card p-1 border border-stellar-border text-xs">
            {(['ALL', 'ACTIVE', 'COMPLETED', 'CANCELED'] as StatusFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setStatusFilter(f)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all ${
                  statusFilter === f
                    ? 'bg-stellar-hover text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {f === 'ALL' ? 'All' : f.slice(0, 3)}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setRefreshing(true);
              fetchStreams();
            }}
            disabled={refreshing}
            className="p-2 rounded-xl border border-stellar-border bg-stellar-card text-slate-300 hover:bg-stellar-hover transition-colors"
            title="Refresh streams"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Wallet Warning if filtering by user address but wallet not connected */}
      {!isConnected && (activeTab === 'outgoing' || activeTab === 'incoming') && (
        <div className="rounded-3xl border border-cyan-500/30 bg-cyan-500/5 p-6 backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="rounded-xl bg-cyan-500/10 p-2 text-stellar-cyan">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Connect Your Wallet</h3>
              <p className="text-xs text-slate-400">
                Connect Freighter to view your personal outgoing and incoming payment streams.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => connect()}
            className="rounded-xl border border-cyan-500/40 bg-cyan-500/20 px-4 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/30 transition-colors"
          >
            Connect Freighter
          </button>
        </div>
      )}

      {/* Streams Grid */}
      {loading ? (
        <div className="flex h-64 flex-col items-center justify-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-stellar-cyan" />
          <p className="text-xs text-slate-400">Loading stream records...</p>
        </div>
      ) : filteredStreams.length === 0 ? (
        <div className="glass-panel rounded-3xl p-12 text-center max-w-lg mx-auto">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-stellar-hover text-slate-400">
            <Layers className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-white">No Streams Found</h3>
          <p className="mt-1 text-xs text-slate-400">
            {searchQuery
              ? 'No streams match your search filter criteria.'
              : activeTab === 'outgoing'
              ? 'You have not created any outgoing streams yet.'
              : activeTab === 'incoming'
              ? 'No streams directed to your address have been indexed.'
              : 'No payment streams exist on this network yet.'}
          </p>

          <div className="mt-6">
            <Link
              href="/create"
              className="inline-flex items-center space-x-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-400 px-4 py-2.5 text-xs font-bold text-stellar-dark hover:opacity-90 shadow-md shadow-cyan-500/20"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Create First Stream</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredStreams.map((stream) => (
            <StreamCard
              key={stream.id.toString()}
              stream={stream}
              perspective={activeTab === 'incoming' ? 'recipient' : 'sender'}
              tokenSymbol="XLM"
            />
          ))}
        </div>
      )}
    </div>
  );
}
