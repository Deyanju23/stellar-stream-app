'use client';

import { useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  Loader2,
  LogOut,
  Wallet,
} from 'lucide-react';
import { formatAddress, useFreighter } from '@/hooks/useFreighter';

export default function WalletButton() {
  const {
    isInstalled,
    isConnected,
    address,
    network,
    isLoading,
    connect,
    disconnect,
  } = useFreighter();

  const [copied, setCopied] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-10 w-36 items-center justify-center space-x-2 rounded-xl border border-stellar-border bg-stellar-hover/50 text-xs text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin text-stellar-cyan" />
        <span>Connecting...</span>
      </div>
    );
  }

  if (!isInstalled) {
    return (
      <a
        href="https://www.freighter.app"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center space-x-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-xs font-medium text-amber-300 transition-all hover:bg-amber-500/20"
      >
        <span>Install Freighter</span>
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    );
  }

  if (!isConnected || !address) {
    return (
      <button
        type="button"
        id="connect-wallet-btn"
        onClick={() => connect()}
        className="flex items-center space-x-2 rounded-xl border border-cyan-500/50 bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 px-4 py-2 text-sm font-semibold text-cyan-300 shadow-md shadow-cyan-500/10 transition-all hover:border-cyan-400 hover:from-cyan-500/30 hover:to-emerald-500/30 hover:shadow-lg hover:shadow-cyan-500/20 active:scale-95"
      >
        <Wallet className="h-4 w-4 text-stellar-cyan" />
        <span>Connect Wallet</span>
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        id="wallet-profile-btn"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center space-x-2.5 rounded-xl border border-stellar-border bg-stellar-card px-3 py-1.5 text-xs text-slate-200 transition-all hover:border-cyan-500/50 hover:bg-stellar-hover shadow-sm"
      >
        <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" />
        <span className="font-mono font-medium">{formatAddress(address)}</span>
      </button>

      {dropdownOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setDropdownOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-stellar-border bg-stellar-card p-3 shadow-2xl backdrop-blur-xl z-50">
            <div className="mb-2.5 pb-2.5 border-b border-stellar-border/70">
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                Connected Account
              </div>
              <div className="flex items-center justify-between bg-stellar-dark/60 rounded-lg p-2">
                <span className="font-mono text-xs text-slate-200 truncate mr-2">
                  {address}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-slate-400 hover:text-stellar-cyan transition-colors"
                  title="Copy address"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 mb-3 px-1">
              <span>Network:</span>
              <span className="font-medium text-slate-200">{network || 'TESTNET'}</span>
            </div>

            <button
              type="button"
              id="disconnect-wallet-btn"
              onClick={() => {
                disconnect();
                setDropdownOpen(false);
              }}
              className="flex w-full items-center justify-center space-x-2 rounded-xl border border-rose-500/30 bg-rose-500/10 py-2 text-xs font-medium text-rose-300 hover:bg-rose-500/20 transition-all"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Disconnect</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
