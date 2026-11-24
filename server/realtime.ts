import type { Request, Response } from 'express';

export type RealtimeEntity =
  | 'lowongan'
  | 'pendaftaran'
  | 'mahasiswa'
  | 'absensi'
  | 'evaluasi'
  | 'universitas_pks'
  | 'media'
  | 'users'
  | 'settings'
  | 'preferences'
  | 'all';

export interface RealtimeChangeEvent {
  id: string;
  entity: RealtimeEntity;
  action: string;
  timestamp: string;
  meta?: Record<string, unknown>;
}

interface SseClient {
  id: string;
  res: Response;
}

const clients = new Map<string, SseClient>();
let eventSeq = 0;

export function getRealtimeClientCount(): number {
  return clients.size;
}

export function handleRealtimeSse(req: Request, res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const clientId = `sse-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  clients.set(clientId, { id: clientId, res });

  const connectedPayload = JSON.stringify({
    type: 'connected',
    clientId,
    timestamp: new Date().toISOString(),
  });
  res.write(`event: connected\ndata: ${connectedPayload}\n\n`);

  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    } catch {
      clearInterval(heartbeat);
      clients.delete(clientId);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(clientId);
  });
}

export function broadcastRealtimeEvent(
  entity: RealtimeEntity,
  action: string,
  meta?: Record<string, unknown>
): void {
  eventSeq += 1;
  const payload: RealtimeChangeEvent = {
    id: `${Date.now()}-${eventSeq}`,
    entity,
    action,
    timestamp: new Date().toISOString(),
    meta,
  };
  const serialized = `id: ${payload.id}\nevent: change\ndata: ${JSON.stringify(payload)}\n\n`;

  for (const [clientId, client] of clients.entries()) {
    try {
      client.res.write(serialized);
    } catch {
      clients.delete(clientId);
    }
  }
}
