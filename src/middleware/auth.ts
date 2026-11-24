import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { isSessionRevokedInDb, revokeSessionInDb } from '../db/preferences.js';
import { getOrCreateUser, getUserWithProfileByUid, type HydratedAdminUser } from '../db/users.js';
import { adminAuth } from '../lib/firebase-admin.js';

export const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'hr.mojokerto';
export const CREDENTIAL_SALT = 'ajinomoto-mojokerto-hr-2026';

export const DEFAULT_ADMIN_HASH = crypto
  .createHash('sha256')
  .update(`${CREDENTIAL_SALT}:Ajinomoto2026!`)
  .digest('hex');

export const ADMIN_PASSWORD_HASH =
  process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD !== 'CHANGE_ME'
    ? crypto.createHash('sha256').update(`${CREDENTIAL_SALT}:${process.env.ADMIN_PASSWORD}`).digest('hex')
    : DEFAULT_ADMIN_HASH;

export const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  crypto.createHash('sha256').update(`${CREDENTIAL_SALT}:session:${ADMIN_PASSWORD_HASH}`).digest('hex');

export interface TokenPayload {
  jti: string;
  uid: string;
  username: string;
  namaTampilan: string;
  role: string;
  exp: number;
}

export interface AuthRequest extends Request {
  user?: DecodedIdToken | { uid: string; email?: string };
  adminUser?: HydratedAdminUser;
  authToken?: string;
}

export function hashPassword(plain: string): string {
  return crypto.createHash('sha256').update(`${CREDENTIAL_SALT}:${plain}`).digest('hex');
}

export function hashPasswordScrypt(plain: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plain, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(plain: string, storedHash: string | null | undefined): boolean {
  if (!storedHash) return false;
  if (storedHash.startsWith('scrypt$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 3) return false;
    const [, salt, hexDigest] = parts;
    if (!salt || !hexDigest) return false;
    try {
      const derived = crypto.scryptSync(plain, salt, 64);
      const expected = Buffer.from(hexDigest, 'hex');
      if (derived.length !== expected.length) return false;
      return crypto.timingSafeEqual(derived, expected);
    } catch {
      return false;
    }
  }
  // Legacy SHA-256 fallback for initial seeded corporate credential
  const legacyCandidate = Buffer.from(hashPassword(plain), 'utf8');
  const legacyExpected = Buffer.from(storedHash, 'utf8');
  if (legacyCandidate.length !== legacyExpected.length) return false;
  return crypto.timingSafeEqual(legacyCandidate, legacyExpected);
}

export const ALLOWED_ACCOUNT_ROLES = [
  'HR Development Admin',
  'Admin Operasional',
  'Pimpinan Perusahaan',
  'Pimpinan Departemen / Seksi',
] as const;

export type AllowedAccountRole = (typeof ALLOWED_ACCOUNT_ROLES)[number];

export function isAdminRole(role?: string | null): boolean {
  if (!role) return false;
  const normalized = role.trim().toLowerCase();
  return (
    normalized === 'hr development admin' ||
    normalized === 'super admin' ||
    normalized === 'admin' ||
    normalized === 'admin operasional' ||
    normalized.includes('admin')
  );
}

export function canManageUsersRole(role?: string | null): boolean {
  if (!role) return false;
  const normalized = role.trim().toLowerCase();
  return (
    normalized === 'hr development admin' ||
    normalized === 'super admin' ||
    normalized === 'admin' ||
    normalized === 'admin sistem'
  );
}

export function signSessionToken(payload: TokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export async function revokeSessionToken(token: string): Promise<void> {
  if (!token) return;
  const payload = verifyHmacSessionToken(token);
  if (payload?.jti) {
    await revokeSessionInDb(payload.jti, payload.uid || 'unknown', payload.exp);
  }
}

export function verifyHmacSessionToken(token: string): TokenPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;

  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TokenPayload;
    if (!parsed || typeof parsed.exp !== 'number' || Date.now() > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)ajinomoto_session=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
}

export async function resolveAuthenticatedAdmin(token: string): Promise<{
  decodedUser: DecodedIdToken | { uid: string; email?: string };
  adminUser: HydratedAdminUser;
} | null> {
  // 1. Check signed corporate HMAC token first (2-part base64url)
  const hmacPayload = verifyHmacSessionToken(token);
  if (hmacPayload) {
    if (hmacPayload.jti && (await isSessionRevokedInDb(hmacPayload.jti))) {
      return null;
    }
    const uid = hmacPayload.uid || 'local-hr-mojokerto';
    try {
      const dbUser = await getUserWithProfileByUid(uid);
      if (dbUser) {
        if (!dbUser.isActive) {
          return null;
        }
        return {
          decodedUser: { uid: dbUser.uid, email: dbUser.email },
          adminUser: dbUser,
        };
      }
    } catch (error) {
      console.error('Failed loading HMAC session user from database:', error);
    }
    return {
      decodedUser: { uid },
      adminUser: {
        id: 0,
        uid,
        username: hmacPayload.username,
        namaTampilan: hmacPayload.namaTampilan,
        role: hmacPayload.role,
        departemen: 'HR Development Section',
        email: 'hr.development@ajinomoto.co.id',
        noTelepon: '+62 321-361-000',
        avatarUrl: '/assets/images/avatar_hr_admin_1794535891951.jpg',
        authProvider: 'password',
        isActive: true,
      },
    };
  }

  // 2. Otherwise verify Firebase ID Token (3-part JWT) via Firebase Admin SDK
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const adminUser = await getOrCreateUser(
      decodedToken.uid,
      decodedToken.email || 'hr.development@ajinomoto.co.id',
      decodedToken.name || 'HR Development Admin',
      decodedToken.picture,
      'firebase_google'
    );
    if (!adminUser.isActive) {
      return null;
    }
    return { decodedUser: decodedToken, adminUser };
  } catch {
    return null;
  }
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase());
  const hasBearer = Boolean(req.headers.authorization && req.headers.authorization.startsWith('Bearer '));
  const hasAjaxHeader = req.headers['x-requested-with'] === 'XMLHttpRequest';

  if (isMutation && !hasBearer && !hasAjaxHeader) {
    return res.status(403).json({
      error: 'Permintaan tidak valid (header verifikasi CSRF diperlukan).',
    });
  }

  const token = getTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ error: 'Sesi admin tidak ditemukan. Silakan login terlebih dahulu.' });
  }

  const resolved = await resolveAuthenticatedAdmin(token);
  if (!resolved) {
    return res.status(401).json({ error: 'Sesi telah berakhir, akun nonaktif, atau token tidak valid. Silakan login kembali.' });
  }

  req.user = resolved.decodedUser;
  req.adminUser = resolved.adminUser;
  req.authToken = token;
  return next();
};

export const requireUserManagementRole = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.adminUser || !canManageUsersRole(req.adminUser.role)) {
    return res.status(403).json({
      error: 'Akses ditolak. Hanya akun HR Development Admin yang dapat mengelola pengguna sistem.',
    });
  }
  return next();
};
