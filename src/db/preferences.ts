import { eq, lt } from 'drizzle-orm';
import { db } from './index.js';
import { revokedSessions, systemSettings, userProfiles, users } from './schema.js';

const SETTINGS_KEY = 'default';
const SESSION_TIMEOUT_KEY = 'session_timeout_minutes';

export const ALLOWED_THEMES = [
  'ajinomoto-crimson',
  'mojokerto-eco',
  'ajiu-navy',
  'obsidian-dark',
  'aminoscience-dark',
] as const;

export const ALLOWED_SESSION_TIMEOUTS = [5, 10, 15, 30, 60] as const;

export type ValidThemeId = (typeof ALLOWED_THEMES)[number];
export type ValidLanguage = 'id' | 'en';
export type ValidSessionTimeoutMinutes = (typeof ALLOWED_SESSION_TIMEOUTS)[number];

let cachedSessionTimeoutMinutes: ValidSessionTimeoutMinutes = 15;

export function sanitizeThemeId(value: unknown): ValidThemeId {
  const s = String(value || '').trim();
  return (ALLOWED_THEMES as readonly string[]).includes(s)
    ? (s as ValidThemeId)
    : 'ajinomoto-crimson';
}

export function sanitizeLang(value: unknown): ValidLanguage {
  return value === 'en' ? 'en' : 'id';
}

export function sanitizeSessionTimeoutMinutes(value: unknown): ValidSessionTimeoutMinutes {
  const num = Number(value);
  return (ALLOWED_SESSION_TIMEOUTS as readonly number[]).includes(num)
    ? (num as ValidSessionTimeoutMinutes)
    : 15;
}

export function getCachedSessionTimeoutMinutes(): ValidSessionTimeoutMinutes {
  return cachedSessionTimeoutMinutes;
}

async function readSessionTimeoutMinutesFromDb(): Promise<ValidSessionTimeoutMinutes> {
  try {
    const rows = await db
      .select({
        valueText: systemSettings.gasApiUrl,
      })
      .from(systemSettings)
      .where(eq(systemSettings.key, SESSION_TIMEOUT_KEY));

    const value = sanitizeSessionTimeoutMinutes(rows[0]?.valueText ?? 15);
    cachedSessionTimeoutMinutes = value;
    return value;
  } catch (err) {
    console.error('Database query failed in readSessionTimeoutMinutesFromDb:', err);
    return cachedSessionTimeoutMinutes;
  }
}

async function writeSessionTimeoutMinutesToDb(
  minutes: ValidSessionTimeoutMinutes,
  updatedBy: string
): Promise<void> {
  cachedSessionTimeoutMinutes = minutes;
  const serialized = String(minutes);
  await db
    .insert(systemSettings)
    .values({
      key: SESSION_TIMEOUT_KEY,
      gasApiUrl: serialized,
      updatedBy,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: {
        gasApiUrl: serialized,
        updatedBy,
        updatedAt: new Date(),
      },
    });
}

export async function getPreferencesFromDb(userUid?: string | null): Promise<{
  themeId: ValidThemeId;
  lang: ValidLanguage;
  sessionTimeoutMinutes: ValidSessionTimeoutMinutes;
  scope: 'user' | 'system';
}> {
  try {
    const timeoutPromise = readSessionTimeoutMinutesFromDb();

    if (userUid) {
      const userRows = await db.select({ id: users.id }).from(users).where(eq(users.uid, userUid));
      const userId = userRows[0]?.id;
      if (userId) {
        const [profileRows, sessionTimeoutMinutes] = await Promise.all([
          db
            .select({
              preferredTheme: userProfiles.preferredTheme,
              preferredLang: userProfiles.preferredLang,
            })
            .from(userProfiles)
            .where(eq(userProfiles.userId, userId)),
          timeoutPromise,
        ]);
        if (profileRows[0]) {
          return {
            themeId: sanitizeThemeId(profileRows[0].preferredTheme),
            lang: sanitizeLang(profileRows[0].preferredLang),
            sessionTimeoutMinutes,
            scope: 'user',
          };
        }
      }
    }

    const [settingRows, sessionTimeoutMinutes] = await Promise.all([
      db
        .select({
          defaultTheme: systemSettings.defaultTheme,
          defaultLang: systemSettings.defaultLang,
        })
        .from(systemSettings)
        .where(eq(systemSettings.key, SETTINGS_KEY)),
      timeoutPromise,
    ]);

    if (settingRows[0]) {
      return {
        themeId: sanitizeThemeId(settingRows[0].defaultTheme),
        lang: sanitizeLang(settingRows[0].defaultLang),
        sessionTimeoutMinutes,
        scope: 'system',
      };
    }

    return {
      themeId: 'ajinomoto-crimson',
      lang: 'id',
      sessionTimeoutMinutes,
      scope: 'system',
    };
  } catch (error) {
    console.error('Database query failed in getPreferencesFromDb:', error);
    return {
      themeId: 'ajinomoto-crimson',
      lang: 'id',
      sessionTimeoutMinutes: cachedSessionTimeoutMinutes,
      scope: 'system',
    };
  }
}

export async function savePreferencesToDb(params: {
  themeId?: unknown;
  lang?: unknown;
  sessionTimeoutMinutes?: unknown;
  userUid?: string | null;
  updatedBy?: string | null;
}): Promise<{
  themeId: ValidThemeId;
  lang: ValidLanguage;
  sessionTimeoutMinutes: ValidSessionTimeoutMinutes;
  scope: 'user' | 'system';
}> {
  const current = await getPreferencesFromDb(params.userUid);
  const nextTheme = params.themeId !== undefined ? sanitizeThemeId(params.themeId) : current.themeId;
  const nextLang = params.lang !== undefined ? sanitizeLang(params.lang) : current.lang;
  const nextTimeout =
    params.sessionTimeoutMinutes !== undefined
      ? sanitizeSessionTimeoutMinutes(params.sessionTimeoutMinutes)
      : current.sessionTimeoutMinutes;
  const actor = params.updatedBy || 'portal';

  // Always keep system default synced so public portal & cross-tab sessions immediately reflect changes
  await db
    .insert(systemSettings)
    .values({
      key: SETTINGS_KEY,
      defaultTheme: nextTheme,
      defaultLang: nextLang,
      updatedBy: actor,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: {
        defaultTheme: nextTheme,
        defaultLang: nextLang,
        updatedBy: actor,
        updatedAt: new Date(),
      },
    });

  if (params.sessionTimeoutMinutes !== undefined) {
    await writeSessionTimeoutMinutesToDb(nextTimeout, actor);
  }

  if (params.userUid) {
    const userRows = await db.select({ id: users.id }).from(users).where(eq(users.uid, params.userUid));
    const userId = userRows[0]?.id;
    if (userId) {
      await db
        .update(userProfiles)
        .set({
          preferredTheme: nextTheme,
          preferredLang: nextLang,
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.userId, userId));

      return {
        themeId: nextTheme,
        lang: nextLang,
        sessionTimeoutMinutes: nextTimeout,
        scope: 'user',
      };
    }
  }

  return {
    themeId: nextTheme,
    lang: nextLang,
    sessionTimeoutMinutes: nextTimeout,
    scope: 'system',
  };
}

export async function revokeSessionInDb(
  jti: string,
  userUid: string,
  expiresAtMs: number
): Promise<void> {
  try {
    await db
      .insert(revokedSessions)
      .values({
        jti,
        userUid,
        expiresAt: new Date(expiresAtMs),
        revokedAt: new Date(),
      })
      .onConflictDoNothing({ target: revokedSessions.jti });

    // Opportunistic cleanup of expired revocation rows
    await db.delete(revokedSessions).where(lt(revokedSessions.expiresAt, new Date()));
  } catch (error) {
    console.error('Database error in revokeSessionInDb:', error);
  }
}

export async function isSessionRevokedInDb(jti: string): Promise<boolean> {
  try {
    const rows = await db
      .select({ jti: revokedSessions.jti })
      .from(revokedSessions)
      .where(eq(revokedSessions.jti, jti));
    return rows.length > 0;
  } catch (error) {
    console.error('Database error in isSessionRevokedInDb:', error);
    return false;
  }
}
