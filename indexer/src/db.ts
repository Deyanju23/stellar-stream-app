import DatabaseConstructor, { Database } from 'better-sqlite3';
import path from 'node:path';

export interface StreamRecord {
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
  created_at: number;
  updated_at: number;
}

export interface EventRecord {
  id: number;
  stream_id: number;
  event_type: string;
  ledger: number;
  ledger_closed_at: string | null;
  data: string;
  tx_hash: string | null;
  created_at: number;
}

let dbInstance: Database | null = null;

export function initDatabase(dbPath?: string): Database {
  if (dbInstance) return dbInstance;

  const targetPath =
    dbPath || process.env.DB_PATH || path.join(process.cwd(), 'stellar_stream.sqlite');
  const db = new DatabaseConstructor(targetPath);

  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  // Schema migrations
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS streams (
      id INTEGER PRIMARY KEY,
      sender TEXT NOT NULL,
      recipient TEXT NOT NULL,
      token TEXT NOT NULL,
      deposit_amount TEXT NOT NULL,
      start_time INTEGER NOT NULL,
      stop_time INTEGER NOT NULL,
      rate_per_second TEXT NOT NULL,
      remaining_balance TEXT NOT NULL,
      recipient_withdrawn TEXT NOT NULL DEFAULT '0',
      is_canceled INTEGER NOT NULL DEFAULT 0,
      cancelable INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_streams_sender ON streams(sender);
    CREATE INDEX IF NOT EXISTS idx_streams_recipient ON streams(recipient);
    CREATE INDEX IF NOT EXISTS idx_streams_is_canceled ON streams(is_canceled);

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stream_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      ledger INTEGER NOT NULL,
      ledger_closed_at TEXT,
      data TEXT NOT NULL,
      tx_hash TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_events_stream_id ON events(stream_id);
    CREATE INDEX IF NOT EXISTS idx_events_ledger ON events(ledger);
  `);

  dbInstance = db;
  return db;
}

export function getDatabase(): Database {
  if (!dbInstance) {
    return initDatabase();
  }
  return dbInstance;
}

export function getLastLedger(): number {
  const db = getDatabase();
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get('last_ledger') as
    | { value: string }
    | undefined;

  if (!row) {
    const start = process.env.START_LEDGER ? parseInt(process.env.START_LEDGER, 10) : 0;
    return Number.isNaN(start) ? 0 : start;
  }
  return parseInt(row.value, 10);
}

export function setLastLedger(ledger: number): void {
  const db = getDatabase();
  db.prepare(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run('last_ledger', ledger.toString());
}

export function upsertStream(stream: Omit<StreamRecord, 'updated_at'>): void {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  db.prepare(`
    INSERT INTO streams (
      id, sender, recipient, token, deposit_amount, start_time, stop_time,
      rate_per_second, remaining_balance, recipient_withdrawn, is_canceled, cancelable, created_at, updated_at
    ) VALUES (
      @id, @sender, @recipient, @token, @deposit_amount, @start_time, @stop_time,
      @rate_per_second, @remaining_balance, @recipient_withdrawn, @is_canceled, @cancelable, @created_at, @updated_at
    ) ON CONFLICT(id) DO UPDATE SET
      remaining_balance = excluded.remaining_balance,
      recipient_withdrawn = excluded.recipient_withdrawn,
      is_canceled = excluded.is_canceled,
      updated_at = excluded.updated_at
  `).run({
    ...stream,
    updated_at: now,
  });
}

export function recordWithdrawal(
  streamId: number,
  amount: string,
  remainingBalance: string,
): void {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  const stream = getStreamById(streamId);
  if (!stream) return;

  const currentWithdrawn = BigInt(stream.recipient_withdrawn || '0');
  const withdrawnDelta = BigInt(amount);
  const newWithdrawn = (currentWithdrawn + withdrawnDelta).toString();

  db.prepare(`
    UPDATE streams
    SET recipient_withdrawn = ?,
        remaining_balance = ?,
        updated_at = ?
    WHERE id = ?
  `).run(newWithdrawn, remainingBalance, now, streamId);
}

export function recordCancellation(streamId: number): void {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  db.prepare(`
    UPDATE streams
    SET is_canceled = 1,
        remaining_balance = '0',
        updated_at = ?
    WHERE id = ?
  `).run(now, streamId);
}

export function insertEvent(
  streamId: number,
  eventType: string,
  ledger: number,
  data: Record<string, unknown>,
  txHash?: string,
  ledgerClosedAt?: string,
): void {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  db.prepare(`
    INSERT INTO events (stream_id, event_type, ledger, ledger_closed_at, data, tx_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    streamId,
    eventType,
    ledger,
    ledgerClosedAt || null,
    JSON.stringify(data),
    txHash || null,
    now,
  );
}

export function getStreamById(id: number): StreamRecord | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM streams WHERE id = ?').get(id) as StreamRecord | undefined;
}

export function getStreamsBySender(sender: string): StreamRecord[] {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM streams WHERE sender = ? ORDER BY id DESC')
    .all(sender) as StreamRecord[];
}

export function getStreamsByRecipient(recipient: string): StreamRecord[] {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM streams WHERE recipient = ? ORDER BY id DESC')
    .all(recipient) as StreamRecord[];
}

export function getAllStreams(limit = 50, offset = 0): StreamRecord[] {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM streams ORDER BY id DESC LIMIT ? OFFSET ?')
    .all(limit, offset) as StreamRecord[];
}

export function getEventsByStreamId(streamId: number): EventRecord[] {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM events WHERE stream_id = ? ORDER BY ledger ASC, id ASC')
    .all(streamId) as EventRecord[];
}
