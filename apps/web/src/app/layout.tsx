import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'StellarStream — Real-time Token Streaming on Stellar Soroban',
  description:
    'Continuous linear money-streaming protocol on Stellar Soroban with sub-second live balance accumulation, instant withdrawals, and zero precision loss.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-stellar-dark text-slate-100 antialiased selection:bg-cyan-500/20 selection:text-cyan-300">
        <div className="relative min-h-screen flex flex-col">
          {/* Subtle background ambient glow */}
          <div className="pointer-events-none fixed inset-0 z-0 bg-stream-glow opacity-80" />

          {/* Top navigation */}
          <Navbar />

          {/* Main page body */}
          <main className="relative z-10 flex-1 px-4 py-8 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
            {children}
          </main>

          {/* Footer */}
          <footer className="relative z-10 border-t border-stellar-border/50 py-6 text-center text-xs text-slate-500">
            <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
              <p>
                StellarStream Protocol &bull; Built on Stellar Soroban Smart Contracts
              </p>
              <div className="flex items-center space-x-4">
                <a
                  href="https://stellar.expert/explorer/testnet"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-stellar-cyan transition-colors"
                >
                  Stellar.Expert Testnet Explorer
                </a>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
