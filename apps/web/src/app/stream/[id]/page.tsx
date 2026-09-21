'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  Coins,
  Copy,
  ExternalLink,
  HelpCircle,
  History,
  Info,
  Loader2,
  Lock,
  RefreshCw,
  ShieldAlert,
  Unlock,
  Wallet,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  formatUnits,
  parseUnits,
  Stream,
} from '@stellar-stream/sdk';
import StreamVisualizer from '@/components/StreamVisualizer';
import { formatAddress, useFreighter } from '@/hooks/useFreighter';
import { useStreamBalance } from '@/hooks/useStreamBalance';
import { CONFIG } from '@/lib/config';
import {
  getStreamClient,
  submitSignedTransaction,
} from '@/lib/stellar';

interface StreamEventItem {
  id: number;
  stream_id: number;
  event_type: string;
  ledger: number;
  ledger_closed_at: string | null;
  data: string;
  tx_hash: string | null;
}

export default function StreamDetailPage() {
  const params = useParams();
  const idParam = params?.id as string;
  const streamId = BigInt(idParam || '0');

  const { isConnected, address: connectedAddress, connect, signTx } = useFreighter();

  // Stream data
  const [stream, setStream] = useState<Stream | null>(null);
  const [events, setEvents] = useState<StreamEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Withdrawal action state
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null);

  // Cancellation action state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null);

  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Live balance values
  const balanceState = useStreamBalance(stream, 7);

  const fetchStreamData = useCallback(async () => {
    if (!idParam) return;
    setError(null);

    try {
      const client = getStreamClient();
      let streamData: Stream | null = null;

      // 1. Attempt fetching from local indexer first
      try {
        const indexerRes = await fetch(`${CONFIG.indexerUrl}/api/streams/${idParam}`);
        if (indexerRes.ok) {
          const json = await indexerRes.json();
          if (json.stream) {
            const s = json.stream;
            streamData = {
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
            };
          }
        }
      } catch {
        // Indexer offline or unreachable, fallback to on-chain RPC
      }

      // 2. Fallback to on-chain Soroban query if indexer had no record
      if (!streamData) {
        streamData = await client.getStream(streamId);
      }

      setStream(streamData);

      // 3. Fetch event history from indexer
      try {
        const eventRes = await fetch(`${CONFIG.indexerUrl}/api/events/${idParam}`);
        if (eventRes.ok) {
          const json = await eventRes.json();
          if (json.events) {
            setEvents(json.events);
          }
        }
      } catch {
        // ignore event log fetch failure
      }
    } catch (err) {
      console.error('Error loading stream:', err);
      setError(err instanceof Error ? err.message : 'Failed to load stream details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [idParam, streamId]);

  useEffect(() => {
    fetchStreamData();
  }, [fetchStreamData]);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Withdraw Action
  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError(null);
    setWithdrawSuccess(null);

    if (!isConnected || !connectedAddress) {
      try {
        await connect();
        return;
      } catch {
        setWithdrawError('Please connect Freighter wallet first');
        return;
      }
    }

    if (!stream) return;

    if (connectedAddress !== stream.recipient) {
      setWithdrawError(
        `Only the recipient (${formatAddress(stream.recipient)}) can withdraw accrued tokens. Your wallet: ${formatAddress(connectedAddress)}`,
      );
      return;
    }

    let parsedAmount = 0n;
    try {
      parsedAmount = parseUnits(withdrawAmount, 7);
    } catch {
      setWithdrawError('Invalid withdrawal amount');
      return;
    }

    if (parsedAmount <= 0n) {
      setWithdrawError('Withdrawal amount must be greater than 0');
      return;
    }

    if (parsedAmount > balanceState.recipientClaimable) {
      setWithdrawError(
        `Amount exceeds currently available claimable tokens (${balanceState.formattedClaimable})`,
      );
      return;
    }

    setIsWithdrawing(true);

    try {
      const client = getStreamClient();
      const tx = await client.withdrawTx({
        streamId,
        amount: parsedAmount,
        recipient: connectedAddress,
      });

      const signedXdr = await signTx(tx.toXDR());
      const result = await submitSignedTransaction(signedXdr);

      setWithdrawSuccess(`Withdrawal successful! TX: ${result.hash.slice(0, 8)}...`);
      setWithdrawAmount('');
      fetchStreamData();
    } catch (err) {
      console.error('Withdraw error:', err);
      setWithdrawError(err instanceof Error ? err.message : 'Withdrawal failed');
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Cancel Action
  const handleCancel = async () => {
    setCancelError(null);
    setCancelSuccess(null);

    if (!isConnected || !connectedAddress) {
      try {
        await connect();
        return;
      } catch {
        setCancelError('Please connect Freighter wallet first');
        return;
      }
    }

    if (!stream) return;

    if (connectedAddress !== stream.sender) {
      setCancelError(
        `Only the stream creator/sender (${formatAddress(stream.sender)}) can cancel this stream.`,
      );
      return;
    }

    setIsCanceling(true);

    try {
      const client = getStreamClient();
      const tx = await client.cancelTx(streamId, connectedAddress);
      const signedXdr = await signTx(tx.toXDR());
      const result = await submitSignedTransaction(signedXdr);

      setCancelSuccess(`Stream canceled successfully! TX: ${result.hash.slice(0, 8)}...`);
      setShowCancelModal(false);
      fetchStreamData();
    } catch (err) {
      console.error('Cancel error:', err);
      setCancelError(err instanceof Error ? err.message : 'Failed to cancel stream');
    } finally {
      setIsCanceling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-stellar-cyan" />
        <p className="text-sm text-slate-400">Loading stream on-chain records...</p>
      </div>
    );
  }

  if (error || !stream) {
    return (
      <div className="glass-panel mx-auto max-w-xl rounded-3xl p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-400">
          <XCircle className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold text-white">Stream Not Found</h2>
        <p className="mt-2 text-xs text-slate-400">
          {error || `Stream #${idParam} does not exist on this contract or network.`}
        </p>
        <div className="mt-6 flex justify-center space-x-3">
          <Link
            href="/"
            className="rounded-xl border border-stellar-border bg-stellar-hover px-4 py-2 text-xs font-semibold text-white hover:bg-stellar-border transition-colors"
          >
            Return to Dashboard
          </Link>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              fetchStreamData();
            }}
            className="rounded-xl bg-stellar-cyan/20 px-4 py-2 text-xs font-semibold text-cyan-300 hover:bg-stellar-cyan/30 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const isSender = connectedAddress === stream.sender;
  const isRecipient = connectedAddress === stream.recipient;
  const canCancel = stream.cancelable && !stream.isCanceled && isSender;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Back button & Refresh */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Dashboard</span>
        </Link>

        <button
          type="button"
          onClick={() => {
            setRefreshing(true);
            fetchStreamData();
          }}
          disabled={refreshing}
          className="flex items-center space-x-1.5 rounded-xl border border-stellar-border bg-stellar-card px-3 py-1.5 text-xs text-slate-300 hover:bg-stellar-hover transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Main 60fps Stream Visualizer */}
      <StreamVisualizer stream={stream} tokenSymbol="XLM" decimals={7} />

      {/* Interactive Action Panels Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recipient Withdrawal Action Panel */}
        <div className="glass-panel rounded-3xl p-6 sm:p-7 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-400" />
              <span>Withdraw Claimable Tokens</span>
            </h3>
            <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300 border border-emerald-500/30">
              Recipient Action
            </span>
          </div>

          <p className="text-xs text-slate-400">
            Recipient can withdraw any portion of accrued tokens at any time. Remaining tokens continue streaming unimpeded.
          </p>

          <form onSubmit={handleWithdraw} className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Available Claimable:</span>
                <span className="font-mono font-bold text-emerald-300">
                  {balanceState.formattedClaimable} XLM
                </span>
              </div>

              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0.0000001"
                  placeholder="0.0"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  disabled={balanceState.recipientClaimable <= 0n || stream.isCanceled}
                  className="w-full rounded-2xl border border-stellar-border bg-stellar-dark/90 px-4 py-3 font-mono text-sm text-white placeholder-slate-500 focus:border-stellar-cyan focus:outline-none focus:ring-1 focus:ring-stellar-cyan transition-colors pr-24 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setWithdrawAmount(balanceState.formattedClaimable)}
                  disabled={balanceState.recipientClaimable <= 0n || stream.isCanceled}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-stellar-hover px-2.5 py-1 text-xs font-semibold text-stellar-cyan hover:bg-stellar-border transition-colors disabled:opacity-50"
                >
                  MAX
                </button>
              </div>
            </div>

            {withdrawError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                {withdrawError}
              </div>
            )}

            {withdrawSuccess && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                {withdrawSuccess}
              </div>
            )}

            {!isConnected ? (
              <button
                type="button"
                onClick={() => connect()}
                className="w-full rounded-2xl border border-cyan-500/40 bg-cyan-500/10 py-3 text-xs font-bold text-cyan-300 hover:bg-cyan-500/20 transition-all"
              >
                Connect Wallet to Withdraw
              </button>
            ) : !isRecipient ? (
              <button
                type="button"
                disabled
                className="w-full rounded-2xl border border-stellar-border bg-stellar-hover/40 py-3 text-xs font-medium text-slate-500 cursor-not-allowed"
              >
                Connected Wallet is Not Recipient
              </button>
            ) : (
              <button
                type="submit"
                id="submit-withdraw-btn"
                disabled={
                  isWithdrawing ||
                  balanceState.recipientClaimable <= 0n ||
                  !withdrawAmount ||
                  parseFloat(withdrawAmount) <= 0
                }
                className="w-full flex items-center justify-center space-x-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 py-3.5 text-xs font-bold text-stellar-dark shadow-md shadow-emerald-500/20 hover:opacity-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isWithdrawing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processing Withdrawal...</span>
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    <span>Withdraw {withdrawAmount ? `${withdrawAmount} XLM` : 'Tokens'}</span>
                  </>
                )}
              </button>
            )}
          </form>
        </div>

        {/* Sender Stream Management & Cancellation Panel */}
        <div className="glass-panel rounded-3xl p-6 sm:p-7 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-rose-400" />
              <span>Stream Management</span>
            </h3>
            <span className="rounded-lg bg-stellar-hover px-2.5 py-1 text-xs font-medium text-slate-300 border border-stellar-border">
              Sender Action
            </span>
          </div>

          <p className="text-xs text-slate-400">
            {stream.isCanceled
              ? 'This stream was canceled. Accrued tokens were paid to recipient and remainder returned to sender.'
              : stream.cancelable
              ? 'This stream is cancelable. If canceled, recipient immediately receives all unwithdrawn earned tokens and sender is refunded the remainder.'
              : 'This stream is marked irrevocable. Neither sender nor contract admin can stop or refund deposited tokens.'}
          </p>

          <div className="rounded-2xl border border-stellar-border bg-stellar-dark/60 p-4 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Cancelable:</span>
              <span className="font-semibold text-slate-200">
                {stream.cancelable ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Current Status:</span>
              <span
                className={`font-semibold ${
                  stream.isCanceled ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {stream.isCanceled ? 'Canceled' : 'Active'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Sender Refundable If Canceled:</span>
              <span className="font-mono font-bold text-cyan-300">
                {balanceState.formattedRefundable} XLM
              </span>
            </div>
          </div>

          {cancelError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              {cancelError}
            </div>
          )}

          {cancelSuccess && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
              {cancelSuccess}
            </div>
          )}

          {!stream.isCanceled && stream.cancelable && (
            <div>
              {canCancel ? (
                <button
                  type="button"
                  id="open-cancel-modal-btn"
                  onClick={() => setShowCancelModal(true)}
                  className="w-full rounded-2xl border border-rose-500/40 bg-rose-500/10 py-3.5 text-xs font-bold text-rose-300 hover:bg-rose-500/20 transition-all shadow-sm"
                >
                  Cancel Stream & Settle Payouts
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="w-full rounded-2xl border border-stellar-border bg-stellar-hover/40 py-3.5 text-xs font-medium text-slate-500 cursor-not-allowed"
                >
                  {isSender ? 'Stream Active' : 'Only Sender Can Cancel Stream'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal for Cancellation */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-3xl p-6 sm:p-7 border border-rose-500/30 shadow-2xl">
            <h4 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-rose-400" />
              <span>Confirm Stream Cancellation</span>
            </h4>
            <p className="mt-2 text-xs text-slate-300">
              Canceling stream #{stream.id.toString()} stops all future streaming immediately.
            </p>

            <div className="my-4 rounded-2xl bg-stellar-dark/80 p-4 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Recipient Payout (Earned):</span>
                <span className="font-mono font-bold text-emerald-400">
                  {balanceState.formattedClaimable} XLM
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Sender Refund (Unearned):</span>
                <span className="font-mono font-bold text-cyan-400">
                  {balanceState.formattedRefundable} XLM
                </span>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="flex-1 rounded-xl border border-stellar-border bg-stellar-hover py-2.5 text-xs font-semibold text-slate-300 hover:text-white"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isCanceling}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white hover:bg-rose-500 transition-colors flex items-center justify-center space-x-1.5"
              >
                {isCanceling ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Canceling...</span>
                  </>
                ) : (
                  <span>Confirm Cancellation</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contract Metadata & Addresses */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 space-y-6">
        <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-stellar-border/60 pb-4">
          <Info className="h-4 w-4 text-stellar-cyan" />
          <span>Stream Verification & Account Details</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          {/* Sender */}
          <div className="rounded-2xl border border-stellar-border bg-stellar-card/60 p-4 space-y-1">
            <span className="text-[11px] text-slate-400 font-sans block">
              Sender Address (Creator)
            </span>
            <div className="flex items-center justify-between">
              <span className="text-slate-200 truncate mr-2">{stream.sender}</span>
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => handleCopy(stream.sender, 'sender')}
                  className="p-1 text-slate-400 hover:text-stellar-cyan"
                  title="Copy address"
                >
                  {copiedField === 'sender' ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
                <a
                  href={`https://stellar.expert/explorer/testnet/account/${stream.sender}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 text-slate-400 hover:text-stellar-cyan"
                  title="View on Stellar.Expert"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>

          {/* Recipient */}
          <div className="rounded-2xl border border-stellar-border bg-stellar-card/60 p-4 space-y-1">
            <span className="text-[11px] text-slate-400 font-sans block">
              Recipient Address (Beneficiary)
            </span>
            <div className="flex items-center justify-between">
              <span className="text-slate-200 truncate mr-2">{stream.recipient}</span>
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => handleCopy(stream.recipient, 'recipient')}
                  className="p-1 text-slate-400 hover:text-stellar-cyan"
                  title="Copy address"
                >
                  {copiedField === 'recipient' ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
                <a
                  href={`https://stellar.expert/explorer/testnet/account/${stream.recipient}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 text-slate-400 hover:text-stellar-cyan"
                  title="View on Stellar.Expert"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>

          {/* Token Contract */}
          <div className="rounded-2xl border border-stellar-border bg-stellar-card/60 p-4 space-y-1">
            <span className="text-[11px] text-slate-400 font-sans block">
              Token Contract ID (SAC)
            </span>
            <div className="flex items-center justify-between">
              <span className="text-slate-200 truncate mr-2">{stream.token}</span>
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => handleCopy(stream.token, 'token')}
                  className="p-1 text-slate-400 hover:text-stellar-cyan"
                  title="Copy token address"
                >
                  {copiedField === 'token' ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
                <a
                  href={`https://stellar.expert/explorer/testnet/contract/${stream.token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 text-slate-400 hover:text-stellar-cyan"
                  title="View contract on Stellar.Expert"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>

          {/* Stream Protocol Contract */}
          <div className="rounded-2xl border border-stellar-border bg-stellar-card/60 p-4 space-y-1">
            <span className="text-[11px] text-slate-400 font-sans block">
              StellarStream Protocol Contract
            </span>
            <div className="flex items-center justify-between">
              <span className="text-slate-200 truncate mr-2">
                {CONFIG.contractId || '(Contract ID in .env)'}
              </span>
              {CONFIG.contractId && (
                <a
                  href={`https://stellar.expert/explorer/testnet/contract/${CONFIG.contractId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 text-slate-400 hover:text-stellar-cyan"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Events Audit Log */}
      {events.length > 0 && (
        <div className="glass-panel rounded-3xl p-6 sm:p-8 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <History className="h-4 w-4 text-stellar-cyan" />
            <span>On-Chain Contract Event Timeline</span>
          </h3>

          <div className="space-y-3">
            {events.map((ev) => (
              <div
                key={ev.id}
                className="flex items-center justify-between rounded-2xl border border-stellar-border bg-stellar-card/70 p-3.5 text-xs"
              >
                <div className="flex items-center space-x-3">
                  <span
                    className={`rounded-lg px-2 py-0.5 font-semibold text-[10px] ${
                      ev.event_type === 'StreamCreated'
                        ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                        : ev.event_type === 'TokensWithdrawn'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {ev.event_type}
                  </span>
                  <span className="text-slate-300 font-mono">
                    Ledger #{ev.ledger}
                  </span>
                  {ev.ledger_closed_at && (
                    <span className="text-slate-500 hidden sm:inline">
                      {new Date(ev.ledger_closed_at).toLocaleString()}
                    </span>
                  )}
                </div>

                {ev.tx_hash && (
                  <a
                    href={`https://stellar.expert/explorer/testnet/tx/${ev.tx_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 text-slate-400 hover:text-stellar-cyan font-mono"
                  >
                    <span>{ev.tx_hash.slice(0, 6)}...</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
