export const CONFIG = {
  networkPassphrase:
    process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE ||
    'Test SDF Network ; September 2015',
  rpcUrl:
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ||
    'https://soroban-testnet.stellar.org',
  contractId:
    process.env.NEXT_PUBLIC_STREAM_CONTRACT_ID || '',
  indexerUrl:
    process.env.NEXT_PUBLIC_INDEXER_URL || 'http://localhost:3001',
  defaultToken:
    process.env.NEXT_PUBLIC_DEFAULT_TOKEN_ADDRESS ||
    'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
};
