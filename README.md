# StellarStream App

Continuous linear money-streaming protocol on Stellar Soroban.

## Architecture

This monorepo contains:

- **`packages/sdk`**: TypeScript SDK for interacting with the StellarStream Soroban smart contract, containing typed clients, XDR parsers, and a 60fps high-frequency balance calculator.
- **`indexer`**: Fast event indexing service polling Soroban RPC for contract events (`StreamCreated`, `TokensWithdrawn`, `StreamCanceled`), persisted in SQLite and served over REST.
- **`apps/web`**: Next.js 14+ App Router frontend featuring real-time linear streaming visualizer (7 decimal places at 60fps), Freighter wallet integration, stream creation, and withdrawal management.

## Network & Configuration

- **Network**: Stellar Testnet
- **Network Passphrase**: `Test SDF Network ; September 2015`
- **Soroban RPC URL**: `https://soroban-testnet.stellar.org`
- **Default SAC (Native XLM)**: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`

## Getting Started

```bash
# Install dependencies
pnpm install

# Run all packages in development mode
pnpm dev

# Build all packages
pnpm build

# Run test suites
pnpm test
```
