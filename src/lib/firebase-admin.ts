import fs from 'node:fs';
import path from 'node:path';
import type { Auth } from 'firebase-admin/auth';

let cachedAdminAuth: Auth | null = null;

function resolveFirebaseProjectId(): string | undefined {
  if (process.env.FIREBASE_PROJECT_ID) {
    return process.env.FIREBASE_PROJECT_ID;
  }
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as { projectId?: string };
      if (parsed?.projectId) return parsed.projectId;
    }
  } catch {
    // Fallback gracefully on external hosting (e.g., Vercel + Supabase)
  }
  return undefined;
}

export async function getAdminAuth(): Promise<Auth> {
  if (cachedAdminAuth) return cachedAdminAuth;
  const [{ getApps, initializeApp }, { getAuth }] = await Promise.all([
    import('firebase-admin/app'),
    import('firebase-admin/auth'),
  ]);
  if (!getApps().length) {
    const projectId = resolveFirebaseProjectId();
    initializeApp(projectId ? { projectId } : undefined);
  }
  cachedAdminAuth = getAuth();
  return cachedAdminAuth;
}
