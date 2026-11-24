import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

declare global {
  var _postgresPool: Pool | undefined;
}

function getExternalConnectionString(): string | null {
  const candidates = [process.env.SUPABASE_DB_URL, process.env.DATABASE_URL];
  for (const raw of candidates) {
    const trimmed = (raw || '').trim();
    if (
      trimmed &&
      (trimmed.startsWith('postgres://') || trimmed.startsWith('postgresql://')) &&
      !trimmed.includes('YOUR_PASSWORD') &&
      !trimmed.includes('CHANGE_ME')
    ) {
      return trimmed;
    }
  }
  return null;
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
        max: isServerless ? 3 : 10,
        idleTimeoutMillis: isServerless ? 10000 : 30000,
        connectionTimeoutMillis: 15000,
      });
    } else {
      global._postgresPool = new Pool({
        host: process.env.SQL_HOST,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME,
        max: isServerless ? 3 : 10,
        idleTimeoutMillis: isServerless ? 10000 : 30000,
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
