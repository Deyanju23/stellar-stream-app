'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, PlusCircle, Layers } from 'lucide-react';
import dynamic from 'next/dynamic';

const WalletButton = dynamic(() => import('./WalletButton'), {
  ssr: false,
  loading: () => (
    <div className="h-9 w-36 animate-pulse rounded-xl bg-stellar-hover/60" />
  ),
});

export default function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    { name: 'Dashboard', href: '/', icon: Layers },
    { name: 'Create Stream', href: '/create', icon: PlusCircle },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-stellar-border bg-stellar-dark/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center space-x-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 to-emerald-400 p-0.5 shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
            <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-stellar-dark">
              <Activity className="h-5 w-5 text-stellar-cyan animate-pulse-subtle" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
              Stellar<span className="text-gradient-cyan">Stream</span>
            </span>
            <span className="text-[10px] font-medium tracking-wider uppercase text-slate-400">
              Soroban Protocol
            </span>
          </div>
        </Link>

        {/* Navigation Tabs */}
        <div className="hidden md:flex items-center space-x-1 rounded-2xl bg-stellar-card/60 p-1 border border-stellar-border">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center space-x-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-stellar-hover text-white shadow-sm border border-stellar-border/80'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-stellar-hover/40'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-stellar-cyan' : 'text-slate-400'}`} />
                <span>{link.name}</span>
              </Link>
            );
          })}
        </div>

        {/* Right Section: Network Badge & Wallet Connection */}
        <div className="flex items-center space-x-3">
          <div className="hidden sm:flex items-center space-x-2 rounded-xl border border-stellar-border/70 bg-stellar-card/40 px-3 py-1.5 text-xs text-slate-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-medium">Testnet</span>
          </div>

          <WalletButton />
        </div>
      </div>
    </nav>
  );
}
