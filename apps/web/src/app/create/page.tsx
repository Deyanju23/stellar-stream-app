'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  ExternalLink,
  Flame,
  Info,
  Loader2,
  Lock,
  RotateCcw,
  Shield,
  Unlock,
  Wallet,
  Zap,
} from 'lucide-react';
import { formatRatePerSecond, parseUnits } from '@stellar-stream/sdk';
import { useFreighter } from '@/hooks/useFreighter';
import { CONFIG } from '@/lib/config';
import {
  getStreamClient,
  isValidContractAddress,
  isValidStellarAddress,
  submitSignedTransaction,
} from '@/lib/stellar';

export default function CreateStreamPage() {
  const router = useRouter();
  const { isConnected, address: senderAddress, connect, signTx } = useFreighter();

  // Form states
  const [recipient, setRecipient] = useState('');
  const [tokenAddress, setTokenAddress] = useState(CONFIG.defaultToken);
  const [isNativeToken, setIsNativeToken] = useState(true);
  const [amount, setAmount] = useState('');
  const [cancelable, setCancelable] = useState(true);

  // Time states
  const nowUtc = Math.floor(Date.now() / 1000);
  const [startTime, setStartTime] = useState<number>(nowUtc);
  const [durationSeconds, setDurationSeconds] = useState<number>(86400 * 7); // Default 7 days

  // Submission & UI feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState<{
    hash: string;
    streamId?: bigint;
  } | null>(null);

  // Duration Presets
  const durationPresets = [
    { label: '1 Day', seconds: 86400 },
    { label: '7 Days', seconds: 86400 * 7 },
    { label: '30 Days', seconds: 86400 * 30 },
    { label: '90 Days', seconds: 86400 * 90 },
    { label: '1 Year', seconds: 86400 * 365 },
  ];

  const stopTime = startTime + durationSeconds;

  // Rate calculation
  const parsedDeposit = useMemo(() => {
    try {
      if (!amount || parseFloat(amount) <= 0) return 0n;
      return parseUnits(amount, 7);
    } catch {
      return 0n;
    }
  }, [amount]);

  const rateDisplay = useMemo(() => {
    if (parsedDeposit <= 0n || durationSeconds <= 0) return '0.0000000';
    return formatRatePerSecond(parsedDeposit, BigInt(durationSeconds), 7);
  }, [parsedDeposit, durationSeconds]);

  // Validation
  const recipientValid = useMemo(() => {
    return isValidStellarAddress(recipient);
  }, [recipient]);

  const tokenValid = useMemo(() => {
    return isValidContractAddress(tokenAddress);
  }, [tokenAddress]);

  const amountValid = useMemo(() => {
    return parsedDeposit > 0n;
  }, [parsedDeposit]);

  const canSubmit = recipientValid && tokenValid && amountValid && !isSubmitting;

  const handleToggleNative = (useNative: boolean) => {
    setIsNativeToken(useNative);
    if (useNative) {
      setTokenAddress(CONFIG.defaultToken);
    } else {
      setTokenAddress('');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isConnected || !senderAddress) {
      try {
        await connect();
        return;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Please connect Freighter wallet first');
        return;
      }
    }

    if (!recipientValid) {
      setError('Please enter a valid Stellar G... recipient address');
      return;
    }

    if (!tokenValid) {
      setError('Please enter a valid SAC token contract address');
      return;
    }

    if (!amountValid) {
      setError('Amount must be greater than 0');
      return;
    }

    setIsSubmitting(true);
    setSubmitStep('Preparing transaction with Soroban RPC...');

    try {
      const client = getStreamClient();

      // 1. Build unsigned transaction
      const tx = await client.createStreamTx({
        sender: senderAddress,
        recipient: recipient.trim(),
        token: tokenAddress.trim(),
        depositAmount: parsedDeposit,
        startTime: BigInt(startTime),
        stopTime: BigInt(stopTime),
        cancelable,
      });

      // 2. Request Freighter signature
      setSubmitStep('Awaiting signature in Freighter wallet...');
      const xdrToSign = tx.toXDR();
      const signedXdr = await signTx(xdrToSign);

      // 3. Submit transaction and poll for completion
      setSubmitStep('Submitting transaction to Stellar Testnet...');
      const result = await submitSignedTransaction(signedXdr);

      setTxSuccess(result);
      setSubmitStep('');
    } catch (err) {
      console.error('Error creating stream:', err);
      setError(err instanceof Error ? err.message : 'Failed to create stream');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl flex items-center gap-3">
          Create <span className="text-gradient-cyan">Stream</span>
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Initiate continuous, second-by-second token streaming to any Stellar address.
        </p>
      </div>

      {/* Success Modal / Banner */}
      {txSuccess && (
        <div className="mb-8 rounded-3xl border border-emerald-500/40 bg-emerald-500/10 p-6 backdrop-blur-xl">
          <div className="flex items-start space-x-4">
            <div className="rounded-full bg-emerald-500/20 p-2 text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-white">
                Stream Created Successfully!
              </h3>
              <p className="mt-1 text-xs text-slate-300">
                Your continuous money stream is live on Stellar Testnet.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${txSuccess.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1.5 rounded-xl bg-emerald-500/20 px-3.5 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30 transition-colors"
                >
                  <span>View on Stellar.Expert</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>

                {txSuccess.streamId !== undefined && (
                  <button
                    type="button"
                    onClick={() => router.push(`/stream/${txSuccess.streamId}`)}
                    className="inline-flex items-center space-x-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/20 px-3.5 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/30 transition-colors"
                  >
                    <span>View Stream #{txSuccess.streamId.toString()}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setTxSuccess(null);
                    setRecipient('');
                    setAmount('');
                  }}
                  className="rounded-xl border border-stellar-border bg-stellar-hover/60 px-3.5 py-2 text-xs text-slate-300 hover:text-white transition-colors"
                >
                  Create Another
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleCreate} className="space-y-6">
        {/* Recipient Address */}
        <div className="glass-panel rounded-3xl p-6 sm:p-7 space-y-4">
          <div className="flex items-center justify-between">
            <label
              htmlFor="recipient-input"
              className="text-sm font-semibold text-white flex items-center gap-2"
            >
              <span>Recipient Address</span>
              <span className="text-rose-400">*</span>
            </label>
            {recipient && (
              <span
                className={`text-xs font-medium ${
                  recipientValid ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {recipientValid ? 'Valid Stellar Address' : 'Invalid G... Address'}
              </span>
            )}
          </div>

          <input
            id="recipient-input"
            type="text"
            required
            placeholder="G..."
            value={recipient}
            onChange={(e) => setRecipient(e.target.value.trim())}
            className="w-full rounded-2xl border border-stellar-border bg-stellar-dark/90 px-4 py-3 font-mono text-sm text-white placeholder-slate-500 focus:border-stellar-cyan focus:outline-none focus:ring-1 focus:ring-stellar-cyan transition-colors"
          />
          <p className="text-xs text-slate-400">
            The recipient Stellar public key (G-address) authorized to withdraw streamed funds.
          </p>
        </div>

        {/* Token Selection & Amount */}
        <div className="glass-panel rounded-3xl p-6 sm:p-7 space-y-5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-white flex items-center gap-2">
              <Coins className="h-4 w-4 text-stellar-cyan" />
              <span>Token & Deposit Amount</span>
            </label>

            {/* Quick Toggle Native SAC */}
            <div className="flex rounded-xl bg-stellar-hover p-1 border border-stellar-border text-xs">
              <button
                type="button"
                onClick={() => handleToggleNative(true)}
                className={`rounded-lg px-3 py-1 font-medium transition-all ${
                  isNativeToken
                    ? 'bg-stellar-cyan text-stellar-dark font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Native XLM
              </button>
              <button
                type="button"
                onClick={() => handleToggleNative(false)}
                className={`rounded-lg px-3 py-1 font-medium transition-all ${
                  !isNativeToken
                    ? 'bg-stellar-cyan text-stellar-dark font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Custom SAC
              </button>
            </div>
          </div>

          {!isNativeToken && (
            <div className="space-y-1.5">
              <span className="text-xs text-slate-400">Token Contract ID (C...)</span>
              <input
                type="text"
                required
                placeholder="C..."
                value={tokenAddress}
                onChange={(e) => setTokenAddress(e.target.value.trim())}
                className="w-full rounded-2xl border border-stellar-border bg-stellar-dark/90 px-4 py-3 font-mono text-xs text-white placeholder-slate-500 focus:border-stellar-cyan focus:outline-none focus:ring-1 focus:ring-stellar-cyan transition-colors"
              />
            </div>
          )}

          {/* Amount input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Total Deposit Amount</span>
              <span className="font-mono text-slate-400">
                {isNativeToken ? 'Decimals: 7 (Stellar SAC)' : 'Decimals: 7'}
              </span>
            </div>
            <div className="relative">
              <input
                id="deposit-amount-input"
                type="number"
                step="any"
                min="0.0000001"
                required
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-2xl border border-stellar-border bg-stellar-dark/90 px-4 py-3.5 font-mono text-lg font-semibold text-white placeholder-slate-500 focus:border-stellar-cyan focus:outline-none focus:ring-1 focus:ring-stellar-cyan transition-colors pr-20"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 font-semibold text-sm text-stellar-cyan">
                {isNativeToken ? 'XLM' : 'TOKEN'}
              </div>
            </div>
          </div>
        </div>

        {/* Duration & Scheduling */}
        <div className="glass-panel rounded-3xl p-6 sm:p-7 space-y-5">
          <label className="text-sm font-semibold text-white flex items-center gap-2">
            <Clock className="h-4 w-4 text-stellar-cyan" />
            <span>Streaming Schedule & Duration</span>
          </label>

          {/* Duration Presets */}
          <div className="space-y-2">
            <span className="text-xs text-slate-400">Select Stream Duration:</span>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {durationPresets.map((preset) => {
                const isSelected = durationSeconds === preset.seconds;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setDurationSeconds(preset.seconds)}
                    className={`rounded-xl border py-2 text-xs font-semibold transition-all ${
                      isSelected
                        ? 'border-stellar-cyan bg-stellar-cyan/15 text-stellar-cyan shadow-sm shadow-cyan-500/20'
                        : 'border-stellar-border bg-stellar-hover/40 text-slate-400 hover:text-white hover:bg-stellar-hover'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Start Time Presets */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stellar-border/60 text-xs text-slate-400">
            <span>Start Time:</span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setStartTime(Math.floor(Date.now() / 1000))}
                className="rounded-lg bg-stellar-hover px-2.5 py-1 text-slate-300 hover:text-white border border-stellar-border"
              >
                Now
              </button>
              <button
                type="button"
                onClick={() => setStartTime(Math.floor(Date.now() / 1000) + 3600)}
                className="rounded-lg bg-stellar-hover px-2.5 py-1 text-slate-300 hover:text-white border border-stellar-border"
              >
                +1 Hour
              </button>
              <button
                type="button"
                onClick={() => setStartTime(Math.floor(Date.now() / 1000) + 86400)}
                className="rounded-lg bg-stellar-hover px-2.5 py-1 text-slate-300 hover:text-white border border-stellar-border"
              >
                +1 Day
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-stellar-dark/60 p-3 text-xs text-slate-400 font-mono flex justify-between">
            <span>Start: {new Date(startTime * 1000).toLocaleString()}</span>
            <span>End: {new Date(stopTime * 1000).toLocaleString()}</span>
          </div>
        </div>

        {/* Stream Parameters & Flow Rate Preview */}
        <div className="glass-panel rounded-3xl p-6 sm:p-7 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <Flame className="h-4 w-4 text-stellar-cyan" />
                <span>Computed Flow Rate</span>
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Exact second-by-second linear distribution
              </p>
            </div>
            <div className="text-right">
              <span className="font-mono text-lg font-bold text-gradient-cyan">
                {rateDisplay}
              </span>
              <span className="text-xs text-slate-400 block">
                {isNativeToken ? 'XLM' : 'TOKEN'} / sec
              </span>
            </div>
          </div>

          {/* Cancelable Option */}
          <div className="pt-4 border-t border-stellar-border/60 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div
                className={`rounded-xl p-2 ${
                  cancelable
                    ? 'bg-cyan-500/10 text-stellar-cyan'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {cancelable ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              </div>
              <div>
                <span className="text-sm font-semibold text-white block">
                  {cancelable ? 'Cancelable Stream' : 'Irrevocable Stream'}
                </span>
                <span className="text-xs text-slate-400">
                  {cancelable
                    ? 'Sender can cancel anytime and reclaim unearned tokens.'
                    : 'Stream cannot be canceled once created; full deposit is guaranteed.'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCancelable(!cancelable)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                cancelable ? 'bg-stellar-cyan' : 'bg-stellar-hover'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-stellar-dark transition-transform ${
                  cancelable ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <div className="pt-2">
          {!isConnected ? (
            <button
              type="button"
              id="connect-and-stream-btn"
              onClick={() => connect()}
              className="flex w-full items-center justify-center space-x-2 rounded-2xl border border-cyan-500/40 bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 py-4 text-base font-bold text-cyan-300 shadow-xl shadow-cyan-500/10 hover:border-cyan-400 hover:from-cyan-500/30 hover:to-emerald-500/30 transition-all active:scale-[0.99]"
            >
              <Wallet className="h-5 w-5 text-stellar-cyan" />
              <span>Connect Freighter to Create Stream</span>
            </button>
          ) : (
            <button
              type="submit"
              id="submit-create-stream-btn"
              disabled={!canSubmit}
              className={`flex w-full items-center justify-center space-x-2 rounded-2xl py-4 text-base font-bold transition-all shadow-xl ${
                canSubmit
                  ? 'bg-gradient-to-r from-cyan-500 to-emerald-400 text-stellar-dark shadow-cyan-500/20 hover:opacity-95 hover:shadow-cyan-500/30 active:scale-[0.99]'
                  : 'bg-stellar-hover text-slate-500 border border-stellar-border cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-stellar-dark" />
                  <span>{submitStep || 'Processing...'}</span>
                </>
              ) : (
                <>
                  <Zap className="h-5 w-5" />
                  <span>
                    Stream {amount || '0'} {isNativeToken ? 'XLM' : 'Tokens'}
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
