// Zero localStorage/sessionStorage: auth tokens and short-lived GET cache live strictly in JS memory.
// Auth persists across reloads via server-issued HttpOnly; Secure; SameSite=None; Partitioned cookies.
let inMemoryAdminToken: string | null = null;
let inMemoryFirebaseToken: string | null = null;

// In-memory GET response cache + in-flight deduplication for zero-flash instant tab switching
const GET_CACHE_TTL_MS = 90_000;
const getResponseCache = new Map<string, { data: unknown; expiresAt: number }>();
const inFlightGetRequests = new Map<string, Promise<unknown>>();

export function clearApiGetCache(): void {
  getResponseCache.clear();
}

export function getCachedApiResponse<T>(url: string): T | null {
  const cached = getResponseCache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data as T;
  }
  return null;
}

export function primeApiGetCache(url: string, data: unknown): void {
  getResponseCache.set(url, { data, expiresAt: Date.now() + GET_CACHE_TTL_MS });
}

export function prefetchApiGet(url: string): void {
  if (getCachedApiResponse(url) !== null || inFlightGetRequests.has(url)) {
    return;
  }
  void apiRequest(url).catch(() => {
    // Silent best-effort background warmup
  });
}

export function getFirebaseIdToken(): string | null {
  return inMemoryFirebaseToken;
}

export function setFirebaseIdToken(token: string | null): void {
  inMemoryFirebaseToken = token;
  getResponseCache.clear();
}

export function getAdminToken(): string | null {
  return inMemoryAdminToken;
}

export function setAdminToken(token: string | null): void {
  inMemoryAdminToken = token;
  getResponseCache.clear();
}

export async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const isCacheableGet =
    method === 'GET' &&
    !url.startsWith('/api/auth/session') &&
    !url.startsWith('/api/health');

  if (isCacheableGet) {
    const cached = getResponseCache.get(url);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as T;
    }
    const existingFlight = inFlightGetRequests.get(url);
    if (existingFlight) {
      return existingFlight as Promise<T>;
    }
  } else if (method !== 'GET') {
    // Any mutation immediately invalidates cached GET data so next read is fresh from PostgreSQL
    getResponseCache.clear();
  }

  const exec = (async (): Promise<T> => {
    const token = getAdminToken() || getFirebaseIdToken();
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    headers.set('X-Requested-With', 'XMLHttpRequest');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const res = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    const text = await res.text();
    let json: Record<string, unknown> | null = null;
    let parseError = false;
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      parseError = true;
      json = {
        error: `Respons server bukan format JSON yang valid (HTTP ${res.status}). Pastikan backend API & koneksi database Supabase aktif.`,
      };
    }

    if (!res.ok) {
      if (res.status === 401 && url !== '/api/auth/login' && url !== '/api/auth/firebase') {
        setAdminToken(null);
        setFirebaseIdToken(null);
        if (url !== '/api/auth/session' && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('ajinomoto:unauthorized'));
        }
      }
      throw new Error(String(json?.error || `Permintaan gagal (${res.status})`));
    }

    if (parseError || json === null) {
      throw new Error('Respons server tidak valid. Silakan muat ulang halaman.');
    }

    if (isCacheableGet) {
      getResponseCache.set(url, { data: json, expiresAt: Date.now() + GET_CACHE_TTL_MS });
    } else if (method !== 'GET' && typeof window !== 'undefined') {
      getResponseCache.clear();
      if (!url.startsWith('/api/ai/') && !url.startsWith('/api/auth/login')) {
        window.dispatchEvent(new CustomEvent('ajinomoto:mutated', { detail: { url, method } }));
      }
    }

    return json as T;
  })();

  if (isCacheableGet) {
    inFlightGetRequests.set(url, exec);
    exec.finally(() => {
      inFlightGetRequests.delete(url);
    });
  }

  return exec;
}
