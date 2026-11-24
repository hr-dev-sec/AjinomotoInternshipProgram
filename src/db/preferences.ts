import { eq, lt } from 'drizzle-orm';
import { db } from './index.js';
import { revokedSessions, systemSettings, userProfiles, users } from './schema.js';

const SETTINGS_KEY = 'default';

export const ALLOWED_THEMES = [
  'ajinomoto-crimson',
  'mojokerto-eco',
  'ajiu-navy',
  'obsidian-dark',
  'aminoscience-dark',
] as const;

export type ValidThemeId = (typeof ALLOWED_THEMES)[number];
export type ValidLanguage = 'id' | 'en';

export function sanitizeThemeId(value: unknown): ValidThemeId {
  const s = String(value || '').trim();
  return (ALLOWED_THEMES as readonly string[]).includes(s)
    ? (s as ValidThemeId)
    : 'ajinomoto-crimson';
}

export function sanitizeLang(value: unknown): ValidLanguage {
  return value === 'en' ? 'en' : 'id';
}

export async function getPreferencesFromDb(userUid?: string | null): Promise<{
  themeId: ValidThemeId;
  lang: ValidLanguage;
  scope: 'user' | 'system';
}> {
  try {
    if (userUid) {
      const userRows = await db.select({ id: users.id }).from(users).where(eq(users.uid, userUid));
      const userId = userRows[0]?.id;
      if (userId) {
        const profileRows = await db
          .select({
            preferredTheme: userProfiles.preferredTheme,
            preferredLang: userProfiles.preferredLang,
          })
          .from(userProfiles)
          .where(eq(userProfiles.userId, userId));
        if (profileRows[0]) {
          return {
            themeId: sanitizeThemeId(profileRows[0].preferredTheme),
            lang: sanitizeLang(profileRows[0].preferredLang),
            scope: 'user',
          };
        }
      }
    }

    const settingRows = await db
      .select({
        defaultTheme: systemSettings.defaultTheme,
        defaultLang: systemSettings.defaultLang,
      })
      .from(systemSettings)
      .where(eq(systemSettings.key, SETTINGS_KEY));

    if (settingRows[0]) {
      return {
        themeId: sanitizeThemeId(settingRows[0].defaultTheme),
        lang: sanitizeLang(settingRows[0].defaultLang),
        scope: 'system',
      };
    }

    return {
      themeId: 'ajinomoto-crimson',
      lang: 'id',
      scope: 'system',
    };
  } catch (error) {
    console.error('Database query failed in getPreferencesFromDb:', error);
    return {
      themeId: 'ajinomoto-crimson',
      lang: 'id',
      scope: 'system',
    };
  }
}

export async function savePreferencesToDb(params: {
  themeId?: unknown;
  lang?: unknown;
  userUid?: string | null;
  updatedBy?: string | null;
}): Promise<{
  themeId: ValidThemeId;
  lang: ValidLanguage;
  scope: 'user' | 'system';
}> {
  const current = await getPreferencesFromDb(params.userUid);
  const nextTheme = params.themeId !== undefined ? sanitizeThemeId(params.themeId) : current.themeId;
  const nextLang = params.lang !== undefined ? sanitizeLang(params.lang) : current.lang;

  // Always keep system default synced so public portal & cross-tab sessions immediately reflect changes
  await db
    .insert(systemSettings)
    .values({
      key: SETTINGS_KEY,
      defaultTheme: nextTheme,
      defaultLang: nextLang,
      updatedBy: params.updatedBy || 'portal',
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: {
        defaultTheme: nextTheme,
        defaultLang: nextLang,
        updatedBy: params.updatedBy || 'portal',
        updatedAt: new Date(),
      },
    });

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

      return { themeId: nextTheme, lang: nextLang, scope: 'user' };
    }
  }

  return { themeId: nextTheme, lang: nextLang, scope: 'system' };
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
