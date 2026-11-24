import { useEffect, useRef } from 'react';

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

export interface RealtimeEventPayload {
  id: string;
  entity: RealtimeEntity;
  action: string;
  timestamp: string;
  meta?: Record<string, unknown>;
}

type Listener = (event: RealtimeEventPayload) => void;

const listeners = new Set<Listener>();
let sharedEventSource: EventSource | null = null;
let reconnectTimer: number | null = null;
let reconnectAttempt = 0;

function notifyListeners(payload: RealtimeEventPayload): void {
  for (const fn of listeners) {
    try {
      fn(payload);
    } catch {
      // isolate listener errors
    }
  }
}

function connectEventSource(): void {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;
  if (sharedEventSource || listeners.size === 0) return;

  const es = new EventSource('/api/events', { withCredentials: true });
  sharedEventSource = es;

  es.addEventListener('connected', () => {
    reconnectAttempt = 0;
  });

  es.addEventListener('change', (ev) => {
    try {
      const parsed = JSON.parse((ev as MessageEvent<string>).data) as RealtimeEventPayload;
      if (parsed && parsed.entity) {
        notifyListeners(parsed);
      }
    } catch {
      // ignore malformed event frames
    }
  });

  es.onerror = () => {
    es.close();
    if (sharedEventSource === es) {
      sharedEventSource = null;
    }
    if (listeners.size === 0) return;
    const delayMs = Math.min(15000, 1000 * Math.pow(2, Math.min(reconnectAttempt, 4)));
    reconnectAttempt += 1;
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer);
    }
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      connectEventSource();
    }, delayMs);
  };
}

export function subscribeRealtime(listener: Listener): () => void {
  listeners.add(listener);
  connectEventSource();

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (sharedEventSource) {
        sharedEventSource.close();
        sharedEventSource = null;
      }
    }
  };
}

export function useRealtimeSync(
  entities: RealtimeEntity[],
  onChange: (event: RealtimeEventPayload) => void,
  debounceMs = 180
): void {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const entityKey = entities.join(',');

  useEffect(() => {
    const allowed = new Set<RealtimeEntity>(entityKey.split(',') as RealtimeEntity[]);
    let timer: number | null = null;
    let latestEvent: RealtimeEventPayload | null = null;

    const unsubscribe = subscribeRealtime((ev) => {
      if (ev.entity === 'all' || allowed.has('all') || allowed.has(ev.entity)) {
        latestEvent = ev;
        if (timer !== null) {
          window.clearTimeout(timer);
        }
        timer = window.setTimeout(() => {
          timer = null;
          if (latestEvent) {
            onChangeRef.current(latestEvent);
          }
        }, debounceMs);
      }
    });

    return () => {
      if (timer !== null) {
        window.clearTimeout(timer);
      }
      unsubscribe();
    };
  }, [entityKey, debounceMs]);
}
