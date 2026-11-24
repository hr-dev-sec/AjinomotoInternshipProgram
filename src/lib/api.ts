// Zero localStorage/sessionStorage: auth tokens live strictly in JS memory
// and persist across reloads via server-issued HttpOnly; Secure; SameSite=None; Partitioned cookies.
let inMemoryAdminToken: string | null = null;
let inMemoryFirebaseToken: string | null = null;

export function getFirebaseIdToken(): string | null {
  return inMemoryFirebaseToken;
}

export function setFirebaseIdToken(token: string | null): void {
  inMemoryFirebaseToken = token;
}

export function getAdminToken(): string | null {
  return inMemoryAdminToken;
}

export function setAdminToken(token: string | null): void {
  inMemoryAdminToken = token;
}

export async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
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
    json = { error: 'Respons server bukan format JSON yang valid.' };
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

  return json as T;
}
