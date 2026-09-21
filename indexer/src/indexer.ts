import { rpc, scValToNative, xdr } from '@stellar/stellar-sdk';
import dotenv from 'dotenv';
import {
  getLastLedger,
  insertEvent,
  recordCancellation,
  recordWithdrawal,
  setLastLedger,
  upsertStream,
} from './db.js';

dotenv.config();

export interface IndexerConfig {
  rpcUrl: string;
  contractId: string;
  pollIntervalMs?: number;
}

export class StreamIndexer {
  private server: rpc.Server;
  private contractId: string;
  private pollIntervalMs: number;
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(config?: Partial<IndexerConfig>) {
    const rpcUrl =
      config?.rpcUrl ||
      process.env.SOROBAN_RPC_URL ||
      'https://soroban-testnet.stellar.org';
    this.contractId =
      config?.contractId || process.env.STREAM_CONTRACT_ID || '';
    this.pollIntervalMs = config?.pollIntervalMs || 3000;

    this.server = new rpc.Server(rpcUrl, {
      allowHttp: rpcUrl.startsWith('http://'),
    });
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log(
      `[Indexer] Initialized for contract: ${this.contractId || '(not configured, waiting for contract ID)'}`,
    );

    let startLedger = getLastLedger();
    if (startLedger === 0) {
      try {
        const latest = await this.server.getLatestLedger();
        startLedger = Math.max(1, latest.sequence - 100);
        setLastLedger(startLedger);
        console.log(`[Indexer] Starting sync from ledger: ${startLedger}`);
      } catch (err) {
        console.warn(
          `[Indexer] Could not fetch latest ledger, starting at ledger 1:`,
          err,
        );
        startLedger = 1;
      }
    } else {
      console.log(`[Indexer] Resuming sync from saved ledger: ${startLedger}`);
    }

    this.poll();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    console.log('[Indexer] Polling stopped');
  }

  private async poll(): Promise<void> {
    if (!this.isRunning) return;

    try {
      if (!this.contractId) {
        // If contract ID is not configured yet, wait and re-check env
        this.contractId = process.env.STREAM_CONTRACT_ID || '';
        this.scheduleNext(this.pollIntervalMs);
        return;
      }

      const currentCursor = getLastLedger();
      const response = await this.server.getEvents({
        startLedger: currentCursor,
        filters: [
          {
            type: 'contract',
            contractIds: [this.contractId],
          },
        ],
        limit: 100,
      });

      if (response.events && response.events.length > 0) {
        let maxLedger = currentCursor;

        for (const rawEvent of response.events) {
          try {
            await this.processEvent(rawEvent);
            if (rawEvent.ledger > maxLedger) {
              maxLedger = rawEvent.ledger;
            }
          } catch (err) {
            console.error(`[Indexer] Error processing event ${rawEvent.id}:`, err);
          }
        }

        // Set last ledger to the next ledger to fetch
        setLastLedger(maxLedger + 1);
      } else {
        // Update to latest ledger if no events
        try {
          const latest = await this.server.getLatestLedger();
          if (latest.sequence > currentCursor + 100) {
            setLastLedger(latest.sequence - 10);
          }
        } catch {
          // ignore ledger fetch errors in idle state
        }
      }
    } catch (err) {
      console.error('[Indexer] Polling error:', err);
    }

    this.scheduleNext(this.pollIntervalMs);
  }

  private scheduleNext(delay: number): void {
    if (!this.isRunning) return;
    this.timer = setTimeout(() => {
      this.poll();
    }, delay);
  }

  private async processEvent(event: rpc.Api.EventResponse): Promise<void> {
    // Decode topics
    const decodedTopics: unknown[] = [];
    for (const t of event.topic) {
      try {
        if (typeof t === 'string') {
          const scVal = xdr.ScVal.fromXDR(t, 'base64');
          decodedTopics.push(scValToNative(scVal));
        } else {
          decodedTopics.push(scValToNative(t));
        }
      } catch {
        decodedTopics.push(t);
      }
    }

    // Decode value
    let decodedValue: unknown = null;
    try {
      if (typeof event.value === 'string') {
        const scVal = xdr.ScVal.fromXDR(event.value, 'base64');
        decodedValue = scValToNative(scVal);
      } else {
        decodedValue = scValToNative(event.value as xdr.ScVal);
      }
    } catch {
      decodedValue = event.value;
    }

    // Find topic identifier
    const eventName = decodedTopics.map(String).join(':');

    if (eventName.includes('StreamCreated') || String(decodedValue).includes('deposit_amount')) {
      this.handleStreamCreated(decodedValue, event.ledger, event.txHash, event.ledgerClosedAt);
    } else if (eventName.includes('TokensWithdrawn') || String(decodedValue).includes('amount')) {
      this.handleTokensWithdrawn(decodedValue, event.ledger, event.txHash, event.ledgerClosedAt);
    } else if (eventName.includes('StreamCanceled') || String(decodedValue).includes('sender_refund')) {
      this.handleStreamCanceled(decodedValue, event.ledger, event.txHash, event.ledgerClosedAt);
    }
  }

  private handleStreamCreated(
    value: unknown,
    ledger: number,
    txHash?: string,
    ledgerClosedAt?: string,
  ): void {
    if (!value || typeof value !== 'object') return;
    const data = value as Record<string, unknown>;

    const streamId = Number(data.stream_id ?? data.streamId ?? 0);
    const sender = String(data.sender || '');
    const recipient = String(data.recipient || '');
    const token = String(data.token || '');
    const depositAmount = String(data.deposit_amount ?? data.depositAmount ?? '0');
    const startTime = Number(data.start_time ?? data.startTime ?? 0);
    const stopTime = Number(data.stop_time ?? data.stopTime ?? 0);

    const duration = stopTime > startTime ? stopTime - startTime : 1;
    const ratePerSecond = (BigInt(depositAmount) / BigInt(duration)).toString();

    upsertStream({
      id: streamId,
      sender,
      recipient,
      token,
      deposit_amount: depositAmount,
      start_time: startTime,
      stop_time: stopTime,
      rate_per_second: ratePerSecond,
      remaining_balance: depositAmount,
      recipient_withdrawn: '0',
      is_canceled: 0,
      cancelable: 1,
      created_at: ledgerClosedAt ? Math.floor(new Date(ledgerClosedAt).getTime() / 1000) : Math.floor(Date.now() / 1000),
    });

    insertEvent(
      streamId,
      'StreamCreated',
      ledger,
      data,
      txHash,
      ledgerClosedAt,
    );

    console.log(`[Indexer] StreamCreated indexed: ID #${streamId} (${depositAmount} tokens)`);
  }

  private handleTokensWithdrawn(
    value: unknown,
    ledger: number,
    txHash?: string,
    ledgerClosedAt?: string,
  ): void {
    if (!value || typeof value !== 'object') return;
    const data = value as Record<string, unknown>;

    const streamId = Number(data.stream_id ?? data.streamId ?? 0);
    const amount = String(data.amount ?? '0');
    const remainingBalance = String(data.remaining_balance ?? data.remainingBalance ?? '0');

    recordWithdrawal(streamId, amount, remainingBalance);

    insertEvent(
      streamId,
      'TokensWithdrawn',
      ledger,
      data,
      txHash,
      ledgerClosedAt,
    );

    console.log(`[Indexer] TokensWithdrawn indexed: Stream #${streamId} withdrawn ${amount}`);
  }

  private handleStreamCanceled(
    value: unknown,
    ledger: number,
    txHash?: string,
    ledgerClosedAt?: string,
  ): void {
    if (!value || typeof value !== 'object') return;
    const data = value as Record<string, unknown>;

    const streamId = Number(data.stream_id ?? data.streamId ?? 0);

    recordCancellation(streamId);

    insertEvent(
      streamId,
      'StreamCanceled',
      ledger,
      data,
      txHash,
      ledgerClosedAt,
    );

    console.log(`[Indexer] StreamCanceled indexed: Stream #${streamId}`);
  }
}
