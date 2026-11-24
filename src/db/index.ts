import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

declare global {
  var _postgresPool: Pool | undefined;
}

function normalizeConnectionString(raw: string | undefined): string | null {
  if (!raw) return null;
  let cleaned = raw.trim();
  // Strip accidental `psql '...'` copy-paste prefix
  if (/^psql\s+/i.test(cleaned)) {
    cleaned = cleaned.replace(/^psql\s+/i, '').trim();
  }
  // Strip accidental surrounding quotes pasted into Vercel Environment Variables
  cleaned = cleaned.replace(/^['"]+|['"]+$/g, '').trim();

  if (
    !cleaned ||
    !(cleaned.startsWith('postgres://') || cleaned.startsWith('postgresql://')) ||
    cleaned.includes('YOUR_PASSWORD') ||
    cleaned.includes('[YOUR-PASSWORD]') ||
    cleaned.includes('CHANGE_ME')
  ) {
    return null;
  }

  // pg v8.13+ overrides `ssl: { rejectUnauthorized: false }` when `sslmode=` is present in URI,
  // which causes SELF_SIGNED_CERT_IN_CHAIN errors on Supabase Pooler. Strip sslmode cleanly.
  try {
    const parsed = new URL(cleaned);
    parsed.searchParams.delete('sslmode');
    parsed.searchParams.delete('uselibpqcompat');
    return parsed.toString();
  } catch {
    return cleaned;
  }
}

function getExternalConnectionString(): string | null {
  const candidates = [process.env.SUPABASE_DB_URL, process.env.DATABASE_URL];
  for (const raw of candidates) {
    const normalized = normalizeConnectionString(raw);
    if (normalized) return normalized;
  }
  return null;
}

export function formatPostgresConnectionError(err: unknown): string {
  const rawErr = err as { code?: string; message?: string; cause?: { code?: string; message?: string } };
  const inner = rawErr?.cause || rawErr;
  const code = String(inner?.code || rawErr?.code || '');
  const msg = String(inner?.message || rawErr?.message || '');
  const combined = `${code} ${msg}`.toLowerCase();

  if (combined.includes('econnrefused') || combined.includes('127.0.0.1') || combined.includes('::1')) {
    return 'Koneksi database ditolak (ECONNREFUSED). Pastikan variabel SUPABASE_DB_URL di Vercel terisi lengkap dengan URI Pooler Supabase (tanpa [YOUR-PASSWORD]) lalu lakukan Redeploy.';
  }
  if (combined.includes('enotfound') || combined.includes('eai_again') || combined.includes('enetunreach')) {
    return 'Host database Supabase tidak dapat dijangkau dari Vercel (IPv6/DNS). Gunakan Connection String dari tab Transaction Pooler (port 6543, host *.pooler.supabase.com), bukan Direct Connection (db.*.supabase.co).';
  }
  if (
    code === '28P01' ||
    combined.includes('password authentication failed') ||
    combined.includes('tenant or user not found')
  ) {
    return 'Autentikasi Supabase gagal (password atau username Pooler tidak cocok). Periksa ulang password dan format postgres.[PROJECT-REF] pada SUPABASE_DB_URL di Vercel.';
  }
  if (code === '42P01' || combined.includes('does not exist')) {
    return 'Tabel database belum ditemukan di Supabase. Jalankan seluruh skema SQL (supabase/schema.sql) di Supabase -> SQL Editor terlebih dahulu.';
  }
  if (combined.includes('timeout') || combined.includes('etimedout')) {
    return 'Koneksi ke database Supabase timeout. Pastikan project Supabase tidak dalam status Paused dan menggunakan Transaction Pooler port 6543.';
  }
  if (combined.includes('self-signed') || combined.includes('certificate')) {
    return 'Sertifikat SSL database ditolak. Hapus parameter ?sslmode=... dari SUPABASE_DB_URL lalu Redeploy.';
  }

  return `Gagal terhubung ke database PostgreSQL${code ? ` (${code})` : ''}: ${msg || 'kesalahan tidak diketahui'}`;
}

export interface DatabaseProviderInfo {
  provider: 'Supabase PostgreSQL' | 'Cloud SQL PostgreSQL';
  engine: 'PostgreSQL';
  sslEnabled: boolean;
  hostLabel: string;
  localBrowserStorage: false;
  localJsonFile: false;
  realtimeMode: 'Server-Sent Events (SSE) + PostgreSQL Write-Through';
}

export function getDatabaseProviderInfo(): DatabaseProviderInfo {
  const connStr = getExternalConnectionString();
  if (connStr) {
    let hostLabel = 'supabase-postgres';
    let isSupabase = connStr.includes('supabase');
    try {
      const parsed = new URL(connStr);
      hostLabel = parsed.hostname || hostLabel;
      isSupabase = isSupabase || hostLabel.includes('supabase');
    } catch {
      // keep safe default label
    }
    return {
      provider: isSupabase ? 'Supabase PostgreSQL' : 'Supabase PostgreSQL',
      engine: 'PostgreSQL',
      sslEnabled: true,
      hostLabel,
      localBrowserStorage: false,
      localJsonFile: false,
      realtimeMode: 'Server-Sent Events (SSE) + PostgreSQL Write-Through',
    };
  }

  return {
    provider: 'Cloud SQL PostgreSQL',
    engine: 'PostgreSQL',
    sslEnabled: false,
    hostLabel: process.env.SQL_HOST ? 'cloudsql-asia-southeast1' : 'postgresql-managed',
    localBrowserStorage: false,
    localJsonFile: false,
    realtimeMode: 'Server-Sent Events (SSE) + PostgreSQL Write-Through',
  };
}

export const createPool = () => {
  if (!global._postgresPool) {
    const externalUrl = getExternalConnectionString();
    const isServerless = Boolean(process.env.VERCEL);
    if (externalUrl) {
      global._postgresPool = new Pool({
        connectionString: externalUrl,
        ssl: { rejectUnauthorized: false },
        max: isServerless ? 6 : 10,
        idleTimeoutMillis: isServerless ? 15000 : 30000,
        connectionTimeoutMillis: 15000,
      });
    } else {
      global._postgresPool = new Pool({
        host: process.env.SQL_HOST,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME,
        max: isServerless ? 6 : 10,
        idleTimeoutMillis: isServerless ? 15000 : 30000,
        connectionTimeoutMillis: 15000,
      });
    }

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

export const pool = createPool();

export const db = drizzle(pool, { schema });

export interface LiveTableCounts {
  users: number;
  user_profiles: number;
  profile_change_logs: number;
  media_assets: number;
  media_edit_history: number;
  lowongan: number;
  mahasiswa: number;
  pendaftaran: number;
  absensi: number;
  evaluasi: number;
  universitas_pks: number;
  ai_audit_logs: number;
  email_logs: number;
  system_settings: number;
  revoked_sessions: number;
}

export async function getLiveDatabaseTableCounts(): Promise<LiveTableCounts> {
  const result = await pool.query<{ table_name: string; row_count: string }>(`
    SELECT 'users' AS table_name, COUNT(*)::text AS row_count FROM users
    UNION ALL SELECT 'user_profiles', COUNT(*)::text FROM user_profiles
    UNION ALL SELECT 'profile_change_logs', COUNT(*)::text FROM profile_change_logs
    UNION ALL SELECT 'media_assets', COUNT(*)::text FROM media_assets
    UNION ALL SELECT 'media_edit_history', COUNT(*)::text FROM media_edit_history
    UNION ALL SELECT 'lowongan', COUNT(*)::text FROM lowongan
    UNION ALL SELECT 'mahasiswa', COUNT(*)::text FROM mahasiswa
    UNION ALL SELECT 'pendaftaran', COUNT(*)::text FROM pendaftaran
    UNION ALL SELECT 'absensi', COUNT(*)::text FROM absensi
    UNION ALL SELECT 'evaluasi', COUNT(*)::text FROM evaluasi
    UNION ALL SELECT 'universitas_pks', COUNT(*)::text FROM universitas_pks
    UNION ALL SELECT 'ai_audit_logs', COUNT(*)::text FROM ai_audit_logs
    UNION ALL SELECT 'email_logs', COUNT(*)::text FROM email_logs
    UNION ALL SELECT 'system_settings', COUNT(*)::text FROM system_settings
    UNION ALL SELECT 'revoked_sessions', COUNT(*)::text FROM revoked_sessions
  `);

  const counts: LiveTableCounts = {
    users: 0,
    user_profiles: 0,
    profile_change_logs: 0,
    media_assets: 0,
    media_edit_history: 0,
    lowongan: 0,
    mahasiswa: 0,
    pendaftaran: 0,
    absensi: 0,
    evaluasi: 0,
    universitas_pks: 0,
    ai_audit_logs: 0,
    email_logs: 0,
    system_settings: 0,
    revoked_sessions: 0,
  };

  for (const row of result.rows) {
    const key = row.table_name as keyof LiveTableCounts;
    if (key in counts) {
      counts[key] = Number(row.row_count) || 0;
    }
  }
  return counts;
}
