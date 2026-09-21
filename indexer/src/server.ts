import cors from 'cors';
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import {
  getAllStreams,
  getEventsByStreamId,
  getLastLedger,
  getStreamById,
  getStreamsByRecipient,
  getStreamsBySender,
  initDatabase,
} from './db.js';
import { StreamIndexer } from './indexer.js';

dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || '3001', 10);

app.use(cors());
app.use(express.json());

// Initialize SQLite database
initDatabase();

// Initialize and start background Soroban event indexer
const indexer = new StreamIndexer();
indexer.start().catch((err) => {
  console.error('[Server] Failed to start indexer:', err);
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'stellar-stream-indexer',
    lastLedger: getLastLedger(),
    timestamp: new Date().toISOString(),
  });
});

// GET /api/streams/sender/:address
app.get('/api/streams/sender/:address', (req: Request, res: Response) => {
  try {
    const address = Array.isArray(req.params.address)
      ? req.params.address[0]
      : req.params.address;
    if (!address) {
      return res.status(400).json({ error: 'Sender address is required' });
    }
    const streams = getStreamsBySender(address);
    return res.json({ streams });
  } catch (err) {
    console.error('Error fetching streams by sender:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/streams/recipient/:address
app.get('/api/streams/recipient/:address', (req: Request, res: Response) => {
  try {
    const address = Array.isArray(req.params.address)
      ? req.params.address[0]
      : req.params.address;
    if (!address) {
      return res.status(400).json({ error: 'Recipient address is required' });
    }
    const streams = getStreamsByRecipient(address);
    return res.json({ streams });
  } catch (err) {
    console.error('Error fetching streams by recipient:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/streams/:id
app.get('/api/streams/:id', (req: Request, res: Response) => {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(rawId || '', 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid stream ID' });
    }
    const stream = getStreamById(id);
    if (!stream) {
      return res.status(404).json({ error: 'Stream not found' });
    }
    return res.json({ stream });
  } catch (err) {
    console.error('Error fetching stream by ID:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/streams (List with pagination)
app.get('/api/streams', (req: Request, res: Response) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const offset = Math.max(0, parseInt(req.query.offset as string, 10) || 0);

    const streams = getAllStreams(limit, offset);
    return res.json({ streams, limit, offset });
  } catch (err) {
    console.error('Error listing streams:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/events/:streamId (Audit log of events)
app.get('/api/events/:streamId', (req: Request, res: Response) => {
  try {
    const rawStreamId = Array.isArray(req.params.streamId)
      ? req.params.streamId[0]
      : req.params.streamId;
    const streamId = parseInt(rawStreamId || '', 10);
    if (Number.isNaN(streamId)) {
      return res.status(400).json({ error: 'Invalid stream ID' });
    }
    const events = getEventsByStreamId(streamId);
    return res.json({ events });
  } catch (err) {
    console.error('Error fetching events for stream:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export const server = app.listen(port, () => {
  console.log(`[Server] StellarStream Indexer REST API running on http://localhost:${port}`);
});

process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down...');
  indexer.stop();
  server.close();
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received, shutting down...');
  indexer.stop();
  server.close();
});

export default app;
