import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import {
  broadcastRealtimeEvent,
  getRealtimeClientCount,
  handleRealtimeSse,
} from './realtime.js';
import {
  calcDurationMonths,
  computeTalentRekomendasi,
  dbStore,
  diffDays,
  getJakartaDateStr,
  getJakartaTimestamp,
  haversineDistanceMeters,
} from './store.js';
import {
  analyzeAttendanceAnomalies,
  chatWithHrAssistant,
  draftHrEmail,
  generateExecutiveInsight,
  screenApplicantCv,
} from './gemini.js';
import {
  formatPostgresConnectionError,
  getDatabaseProviderInfo,
  getLiveDatabaseTableCounts,
  pool,
} from '../src/db/index.js';
import {
  DEFAULT_MEDIA_ASSETS,
  OPTIONAL_MEDIA_KEYS,
  getAllMediaAssets,
  getPublicMediaMap,
  resetMediaAssetToDefault,
  updateMediaAsset,
} from '../src/db/media.js';
import { getPreferencesFromDb, savePreferencesToDb } from '../src/db/preferences.js';
import {
  createManagedUser,
  deleteManagedUser,
  getOrCreateUser,
  getRecentUserAuditLogs,
  getUserById,
  getUserWithPasswordByUsername,
  listAllUsers,
  updateManagedUser,
  updateUserProfileAndAudit,
} from '../src/db/users.js';
import { getAdminAuth } from '../src/lib/firebase-admin.js';
import {
  ADMIN_PASSWORD_HASH,
  ADMIN_USERNAME,
  ALLOWED_ACCOUNT_ROLES,
  type AuthRequest,
  SESSION_TTL_MS,
  type TokenPayload,
  canManageUsersRole,
  getTokenFromRequest,
  hashPasswordScrypt,
  invalidateAuthSessionCache,
  isAdminRole,
  requireAuth,
  requireUserManagementRole,
  resolveAuthenticatedAdmin,
  revokeSessionToken,
  signSessionToken,
  verifyPassword,
} from '../src/middleware/auth.js';
import type { Lowongan, Mahasiswa, Pendaftaran, UniversitasPKS } from '../src/types/internship.js';

function buildSessionCookieHeader(token: string, maxAgeSeconds: number): string {
  return `ajinomoto_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=${maxAgeSeconds}`;
}

function buildClearSessionCookieHeader(): string {
  return 'ajinomoto_session=; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=0';
}

// Simple sliding-window rate limiter for public endpoints (PRD 11.1 #4)
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${req.path}:${ip}`;
    const now = Date.now();
    const entry = rateBuckets.get(key);
    if (!entry || now > entry.resetAt) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (entry.count >= maxRequests) {
      return res.status(429).json({
        error: 'Terlalu banyak permintaan dari perangkat Anda. Silakan tunggu beberapa saat.',
      });
    }
    entry.count += 1;
    return next();
  };
}

function addDaysFromToday(days: number): string {
  const today = getJakartaDateStr();
  const [y, m, d] = today.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function createApiApp(): Express {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '10mb' }));

  // Health endpoint (zero startup probe; pass ?db=1 to test live PostgreSQL/Supabase connectivity safely)
  app.get('/api/health', async (req, res) => {
    const base = { ok: true, timezone: 'Asia/Jakarta', tanggal: getJakartaDateStr() };
    if (req.query.db !== '1') {
      return res.json(base);
    }
    const provider = getDatabaseProviderInfo();
    try {
      const ping = await pool.query<{ now: string }>('SELECT NOW()::text AS now');
      const userCountRes = await pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM users');
      return res.json({
        ...base,
        dbConnected: true,
        provider: provider.provider,
        hostLabel: provider.hostLabel,
        sslEnabled: provider.sslEnabled,
        serverTime: ping.rows[0]?.now || null,
        userAccountsCount: Number(userCountRes.rows[0]?.count || 0),
      });
    } catch (err) {
      return res.status(503).json({
        ...base,
        ok: false,
        dbConnected: false,
        provider: provider.provider,
        hostLabel: provider.hostLabel,
        sslEnabled: provider.sslEnabled,
        error: formatPostgresConnectionError(err),
      });
    }
  });

  // Real-time Server-Sent Events stream (disabled on Vercel serverless where long-lived streams time out after 30s)
  app.get('/api/events', (req, res) => {
    if (process.env.VERCEL) {
      return res.status(204).end();
    }
    handleRealtimeSse(req, res);
  });

  // Routes that query their own PostgreSQL table directly and never need full 11-table hydration
  const DIRECT_DB_PREFIXES = [
    '/health',
    '/events',
    '/preferences',
    '/public/media',
    '/media',
    '/users',
    '/auth/session',
    '/auth/profile',
    '/auth/logout',
  ];

  // Lazy on-demand PostgreSQL hydration only for routes backed by dbStore
  app.use('/api', async (req, res, next) => {
    const isDirectRoute = DIRECT_DB_PREFIXES.some(
      (prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`)
    );
    if (isDirectRoute) return next();
    try {
      await dbStore.ensurePostgresHydrated();
      return next();
    } catch (err) {
      console.error('Lazy database hydration failed:', err);
      if (req.path === '/public/media') {
        const fallbackMap: Record<string, (typeof DEFAULT_MEDIA_ASSETS)[number]> = {};
        for (const item of DEFAULT_MEDIA_ASSETS) {
          fallbackMap[item.assetKey] = item;
        }
        return res.json({ media: fallbackMap });
      }
      if (req.path === '/preferences') {
        return res.json({ themeId: 'ajinomoto-crimson', lang: 'id', scope: 'system' });
      }
      return res.status(503).json({
        error: err instanceof Error ? err.message : 'Layanan database sedang tidak tersedia.',
      });
    }
  });

  // ==================== DATABASE-BACKED UI PREFERENCES (ZERO LOCALSTORAGE) ====================

  app.get('/api/preferences', async (req, res) => {
    try {
      const token = getTokenFromRequest(req);
      let userUid: string | null = null;
      if (token) {
        const resolved = await resolveAuthenticatedAdmin(token);
        userUid = resolved?.adminUser.uid || null;
      }
      const prefs = await getPreferencesFromDb(userUid);
      return res.json(prefs);
    } catch (err) {
      console.error('Failed loading preferences from PostgreSQL:', err);
      return res.json({ themeId: 'ajinomoto-crimson', lang: 'id', scope: 'system' });
    }
  });

  app.put('/api/preferences', rateLimit(60, 60_000), async (req, res) => {
    try {
      const { themeId, lang } = req.body || {};
      const token = getTokenFromRequest(req);
      let userUid: string | null = null;
      let updatedBy = 'portal';
      if (token) {
        const resolved = await resolveAuthenticatedAdmin(token);
        if (resolved) {
          userUid = resolved.adminUser.uid;
          updatedBy = resolved.adminUser.username;
        }
      }
      const saved = await savePreferencesToDb({
        themeId,
        lang,
        userUid,
        updatedBy,
      });
      broadcastRealtimeEvent('preferences', 'updated', {
        themeId: saved.themeId,
        lang: saved.lang,
        scope: saved.scope,
      });
      return res.json(saved);
    } catch (err) {
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal menyimpan preferensi tampilan ke database.',
      });
    }
  });

  // ==================== PUBLIC ENDPOINTS ====================

  app.get('/api/public/media', async (_req, res) => {
    try {
      const media = await getPublicMediaMap();
      return res.json({ media });
    } catch (err) {
      console.error('Failed loading public media map:', err);
      const fallbackMap: Record<string, (typeof DEFAULT_MEDIA_ASSETS)[number]> = {};
      for (const item of DEFAULT_MEDIA_ASSETS) {
        fallbackMap[item.assetKey] = item;
      }
      return res.json({ media: fallbackMap });
    }
  });

  app.get('/api/public/summary', (_req, res) => {
    dbStore.autoUpdatePksStatuses();
    const data = dbStore.getAll();
    const totalMahasiswaAktif = data.mahasiswa.filter((m) => m.status === 'Aktif').length;
    const pksAktif = data.universitas.filter((u) => u.status === 'Active').length;
    const uniqueUniversities = new Set([
      ...data.universitas.filter((u) => u.status === 'Active').map((u) => u.universitas),
      ...data.mahasiswa.filter((m) => m.status === 'Aktif').map((m) => m.universitas),
    ]);
    const divisiOpen = data.lowongan.filter((l) => l.status === 'Open').length;

    res.json({
      totalMahasiswaAktif,
      totalUniversitasMitra: uniqueUniversities.size,
      divisiOpen,
      pksAktif,
      maxRadiusMeters: dbStore.getFactoryCoords().maxRadiusMeters,
    });
  });

  app.get('/api/public/track-status', rateLimit(25, 60_000), (req, res) => {
    const nim = String(req.query.nim || '').trim();
    const email = String(req.query.email || '').trim();
    if (!nim || !email) {
      return res.status(400).json({ error: 'Masukkan NIM dan Email pendaftaran untuk melacak status.' });
    }
    const result = dbStore.trackApplicationStatus(nim, email);
    if (!result) {
      return res.status(404).json({
        error: 'Data pendaftaran dengan kombinasi NIM dan Email tersebut tidak ditemukan.',
      });
    }
    res.json(result);
  });

  app.get('/api/lowongan', (_req, res) => {
    const data = dbStore.getAll();
    res.json(data.lowongan.filter((l) => l.status === 'Open'));
  });

  app.post('/api/pendaftaran', rateLimit(15, 60_000), async (req, res) => {
    try {
      const {
        jenis,
        nama,
        nim,
        universitas,
        jurusan,
        lowongan,
        email,
        persetujuanPrivacy,
        cvFileName,
        cvBase64,
        cvSummaryText,
      } = req.body || {};

      if (!['MBKM', 'PKL'].includes(jenis)) {
        return res.status(400).json({ error: 'Jenis program harus MBKM atau PKL.' });
      }
      if (!nama || !nim || !universitas || !jurusan || !lowongan || !email) {
        return res.status(400).json({ error: 'Seluruh field wajib diisi.' });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
        return res.status(400).json({ error: 'Format email tidak valid.' });
      }
      if (persetujuanPrivacy !== true) {
        return res.status(400).json({ error: 'Persetujuan kebijakan privasi wajib dicentang.' });
      }

      if (jenis === 'MBKM') {
        if (!cvBase64 || typeof cvBase64 !== 'string') {
          return res.status(400).json({ error: 'Pendaftar MBKM wajib mengunggah CV berformat PDF.' });
        }
        if (!cvBase64.startsWith('data:application/pdf;base64,')) {
          return res.status(400).json({ error: 'File CV harus berformat PDF (.pdf).' });
        }
        const approxBytes = Math.ceil((cvBase64.split(',')[1]?.length || 0) * 0.75);
        if (approxBytes > 2 * 1024 * 1024) {
          return res.status(400).json({ error: 'Ukuran file CV melebihi batas maksimal 2 MB.' });
        }
      }

      const data = dbStore.getAll();
      const newId = `REG-${new Date().getFullYear()}-${String(data.pendaftaran.length + 1).padStart(3, '0')}`;
      const safeFileName = cvFileName ? String(cvFileName).replace(/[^a-zA-Z0-9._-]/g, '_') : undefined;

      const record: Pendaftaran = {
        id: newId,
        timestamp: getJakartaTimestamp(),
        jenis,
        nama: String(nama).trim(),
        nim: String(nim).trim(),
        universitas: String(universitas).trim(),
        jurusan: String(jurusan).trim(),
        lowongan: String(lowongan).trim(),
        linkCv: jenis === 'MBKM' ? `drive://cv/${safeFileName || `${newId}.pdf`}` : '-',
        cvFileName: safeFileName,
        cvBase64: jenis === 'MBKM' ? cvBase64 : undefined,
        cvSummaryText: cvSummaryText ? String(cvSummaryText).trim() : undefined,
        status: 'Pending',
        email: String(email).trim(),
        persetujuanPrivacy: true,
      };

      data.pendaftaran.unshift(record);
      await dbStore.flushToPostgres();
      broadcastRealtimeEvent('pendaftaran', 'created', { id: record.id });

      res.status(201).json({
        message: 'Pendaftaran berhasil dikirim dan tercatat dengan status Pending.',
        data: {
          id: record.id,
          timestamp: record.timestamp,
          status: record.status,
        },
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal menyimpan pendaftaran.' });
    }
  });

  app.get('/api/absensi/nama', rateLimit(30, 60_000), (req, res) => {
    const nim = String(req.query.nim || '').trim();
    if (!nim || nim.length < 4) {
      return res.status(400).json({ error: 'NIM minimal 4 karakter.' });
    }
    const data = dbStore.getAll();
    const mhs = data.mahasiswa.find((m) => m.nim === nim);
    if (!mhs) {
      return res.status(404).json({ error: 'NIM tidak terdaftar pada database peserta magang.' });
    }
    if (mhs.status !== 'Aktif') {
      return res.status(403).json({ error: 'Status peserta magang sudah Tidak Aktif.' });
    }
    const today = getJakartaDateStr();
    const todayLogs = data.absensi.filter((a) => a.nim === mhs.nim && a.tanggal === today);
    res.json({
      nim: mhs.nim,
      nama: mhs.nama,
      program: mhs.program,
      department: mhs.department,
      universitas: mhs.universitas,
      maxRadiusMeters: dbStore.getFactoryCoords().maxRadiusMeters,
      todayStatus: {
        masuk: todayLogs.find((l) => l.status === 'Masuk')?.timestamp.split(' ')[1] || null,
        pulang: todayLogs.find((l) => l.status === 'Pulang')?.timestamp.split(' ')[1] || null,
        izin: todayLogs.find((l) => l.status === 'Izin')?.timestamp.split(' ')[1] || null,
      },
    });
  });

  app.post('/api/absensi', rateLimit(20, 60_000), async (req, res) => {
    try {
      const { nim, status, lokasi, fotoBase64, keterangan } = req.body || {};
      const cleanNim = String(nim || '').trim();
      if (!cleanNim || !['Masuk', 'Pulang', 'Izin'].includes(status)) {
        return res.status(400).json({ error: 'NIM dan status absensi (Masuk/Pulang/Izin) wajib valid.' });
      }
      if (!lokasi || typeof lokasi !== 'string' || !lokasi.includes(',')) {
        return res.status(400).json({ error: 'Koordinat lokasi GPS wajib disertakan.' });
      }
      if (!fotoBase64 || typeof fotoBase64 !== 'string') {
        return res.status(400).json({
          error: status === 'Izin' ? 'Bukti surat/foto izin wajib diunggah.' : 'Foto selfie kamera depan wajib diambil.',
        });
      }

      const validMime =
        fotoBase64.startsWith('data:image/') ||
        (status === 'Izin' && fotoBase64.startsWith('data:application/pdf;base64,'));
      if (!validMime) {
        return res.status(400).json({ error: 'Format lampiran tidak valid (gunakan gambar JPEG/PNG atau PDF untuk izin).' });
      }
      const approxBytes = Math.ceil((fotoBase64.split(',')[1]?.length || 0) * 0.75);
      if (approxBytes > 2.5 * 1024 * 1024) {
        return res.status(400).json({ error: 'Ukuran lampiran melebihi 2.5 MB.' });
      }

      const data = dbStore.getAll();
      const mhs = data.mahasiswa.find((m) => m.nim === cleanNim && m.status === 'Aktif');
      if (!mhs) {
        return res.status(404).json({ error: 'NIM tidak ditemukan atau berstatus Tidak Aktif.' });
      }

      const today = getJakartaDateStr();
      // PRD 11.1 #4: Prevent duplicate same-status attendance on the same day
      const alreadySubmitted = data.absensi.find(
        (a) => a.nim === cleanNim && a.tanggal === today && a.status === status
      );
      if (alreadySubmitted) {
        return res.status(409).json({
          error: `Anda sudah melakukan absensi "${status}" hari ini (${today}) pada pukul ${alreadySubmitted.timestamp.split(' ')[1]}.`,
        });
      }

      const [latStr, lngStr] = lokasi.split(',').map((s) => s.trim());
      const lat = Number(latStr);
      const lng = Number(lngStr);
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        return res.status(400).json({ error: 'Format koordinat GPS tidak valid.' });
      }

      const factoryCoords = dbStore.getFactoryCoords();
      const jarakMeter = haversineDistanceMeters(lat, lng, factoryCoords.lat, factoryCoords.lng);
      let anomaliFlag: string | undefined;
      if (status !== 'Izin' && jarakMeter > factoryCoords.maxRadiusMeters) {
        anomaliFlag = `Lokasi di luar radius pabrik (${jarakMeter} m > ${factoryCoords.maxRadiusMeters} m)`;
      }

      if (status === 'Izin' && (!keterangan || String(keterangan).trim().length < 3)) {
        return res.status(400).json({ error: 'Alasan izin/sakit wajib diisi.' });
      }

      const newAbsen = {
        id: `ABS-${Date.now()}`,
        timestamp: getJakartaTimestamp(),
        tanggal: today,
        nim: mhs.nim,
        nama: mhs.nama,
        status,
        lokasi: `${lat.toFixed(5)},${lng.toFixed(5)}`,
        jarakMeter,
        linkFoto: fotoBase64,
        keterangan: keterangan ? String(keterangan).trim() : undefined,
        anomaliFlag,
      };

      data.absensi.unshift(newAbsen);
      await dbStore.flushToPostgres();
      broadcastRealtimeEvent('absensi', 'created', { id: newAbsen.id, nim: mhs.nim });

      res.status(201).json({
        message: `Absensi ${status} berhasil dicatat untuk ${mhs.nama}.`,
        data: newAbsen,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal mencatat absensi.' });
    }
  });

  // ==================== AUTH ENDPOINTS ====================

  app.post('/api/auth/login', rateLimit(15, 60_000), async (req, res) => {
    try {
      const { username, password } = req.body || {};
      if (!username || !password) {
        return res.status(400).json({ error: 'Username dan password wajib diisi.' });
      }
      const cleanUsername = String(username).trim().toLowerCase();
      const rawPassword = String(password);

      const dbRecord = await getUserWithPasswordByUsername(cleanUsername);
      if (!dbRecord) {
        return res.status(401).json({ error: 'Username atau password tidak sesuai.' });
      }
      if (!dbRecord.user.isActive) {
        return res.status(403).json({
          error: 'Akun ini sedang dinonaktifkan. Silakan hubungi HR Development Admin.',
        });
      }
      if (!verifyPassword(rawPassword, dbRecord.user.passwordHash)) {
        return res.status(401).json({ error: 'Username atau password tidak sesuai.' });
      }

      const syncedUser = await getOrCreateUser(
        dbRecord.user.uid,
        dbRecord.profile?.emailKorporat || dbRecord.user.email,
        dbRecord.profile?.namaTampilan || dbRecord.user.username,
        dbRecord.profile?.avatarUrl,
        'password',
        dbRecord.user.username,
        dbRecord.user.passwordHash || ADMIN_PASSWORD_HASH
      );

      const payload: TokenPayload = {
        jti: crypto.randomBytes(16).toString('hex'),
        uid: syncedUser.uid,
        username: syncedUser.username,
        namaTampilan: syncedUser.namaTampilan,
        role: syncedUser.role,
        exp: Date.now() + SESSION_TTL_MS,
      };
      const token = signSessionToken(payload);

      res.setHeader(
        'Set-Cookie',
        buildSessionCookieHeader(token, Math.floor(SESSION_TTL_MS / 1000))
      );
      return res.json({
        token,
        user: syncedUser,
      });
    } catch (err) {
      return res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memproses login.' });
    }
  });

  app.post('/api/auth/firebase', rateLimit(20, 60_000), async (req, res) => {
    try {
      const tokenFromBody = typeof req.body?.idToken === 'string' ? req.body.idToken.trim() : null;
      const token = tokenFromBody || getTokenFromRequest(req);
      if (!token) {
        return res.status(401).json({ error: 'Token autentikasi Firebase tidak ditemukan.' });
      }
      const adminAuth = await getAdminAuth();
      const decodedToken = await adminAuth.verifyIdToken(token);
      const user = await getOrCreateUser(
        decodedToken.uid,
        decodedToken.email || 'hr.development@ajinomoto.co.id',
        decodedToken.name || 'HR Development Admin',
        decodedToken.picture,
        'firebase_google'
      );
      const sessionPayload: TokenPayload = {
        jti: crypto.randomBytes(16).toString('hex'),
        uid: user.uid,
        username: user.username,
        namaTampilan: user.namaTampilan,
        role: user.role,
        exp: Date.now() + SESSION_TTL_MS,
      };
      const sessionToken = signSessionToken(sessionPayload);
      res.setHeader(
        'Set-Cookie',
        buildSessionCookieHeader(sessionToken, Math.floor(SESSION_TTL_MS / 1000))
      );
      return res.json({ token: sessionToken, user });
    } catch (err) {
      console.error('Firebase token verification error:', err);
      return res.status(401).json({ error: 'Verifikasi akun Google Firebase gagal.' });
    }
  });

  app.get('/api/auth/session', async (req, res) => {
    const token = getTokenFromRequest(req);
    if (!token) return res.json({ authenticated: false });
    const resolved = await resolveAuthenticatedAdmin(token);
    if (!resolved) {
      return res.json({ authenticated: false });
    }
    return res.json({
      authenticated: true,
      user: resolved.adminUser,
    });
  });

  app.get('/api/auth/profile', requireAuth, (req: AuthRequest, res) => {
    res.json(req.adminUser || dbStore.getPublicAdminProfile());
  });

  app.put('/api/auth/profile', requireAuth, async (req: AuthRequest, res) => {
    try {
      const {
        namaTampilan,
        role,
        departemen,
        email,
        noTelepon,
        avatarUrl,
        currentPassword,
        newPassword,
      } = req.body || {};

      if (!namaTampilan || String(namaTampilan).trim().length < 2) {
        return res.status(400).json({ error: 'Nama tampilan minimal 2 karakter.' });
      }
      if (!role || String(role).trim().length < 2) {
        return res.status(400).json({ error: 'Jabatan / role wajib diisi.' });
      }
      if (!departemen || String(departemen).trim().length < 2) {
        return res.status(400).json({ error: 'Departemen / section wajib diisi.' });
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
        return res.status(400).json({ error: 'Format email korporat tidak valid.' });
      }

      if (avatarUrl && typeof avatarUrl === 'string' && avatarUrl.startsWith('data:')) {
        if (!/^data:image\/(png|jpeg|jpg|webp);base64,/.test(avatarUrl)) {
          return res.status(400).json({ error: 'Format foto profil harus JPG, PNG, atau WEBP.' });
        }
        const approxBytes = Math.ceil((avatarUrl.split(',')[1]?.length || 0) * 0.75);
        if (approxBytes > 2 * 1024 * 1024) {
          return res.status(400).json({ error: 'Ukuran foto profil maksimal 2 MB.' });
        }
      }

      const activeUid = req.adminUser?.uid || 'local-hr-mojokerto';
      const activeUsername = req.adminUser?.username || 'hr.mojokerto';
      const dbRecord = await getUserWithPasswordByUsername(activeUsername);
      const storedProfile = dbStore.getAdminProfile();
      let nextPasswordHash: string | undefined;

      if (newPassword && String(newPassword).trim().length > 0) {
        if (String(newPassword).length < 6) {
          return res.status(400).json({ error: 'Password baru minimal 6 karakter.' });
        }
        if (!currentPassword) {
          return res.status(400).json({ error: 'Masukkan password saat ini untuk mengganti password.' });
        }
        const expectedHash = dbRecord?.user.passwordHash || storedProfile.passwordHash || ADMIN_PASSWORD_HASH;
        if (!verifyPassword(String(currentPassword), expectedHash)) {
          return res.status(400).json({ error: 'Password saat ini tidak sesuai.' });
        }
        nextPasswordHash = hashPasswordScrypt(String(newPassword));
      }

      // Prevent privilege escalation: non-admin users cannot alter their own role via profile edit
      const effectiveRole = canManageUsersRole(req.adminUser?.role)
        ? String(role).trim().slice(0, 60)
        : (req.adminUser?.role || 'Pimpinan Departemen / Seksi');

      const updated = await updateUserProfileAndAudit(
        activeUid,
        {
          namaTampilan: String(namaTampilan).trim().slice(0, 80),
          role: effectiveRole,
          departemen: String(departemen).trim().slice(0, 80),
          email: String(email).trim().slice(0, 100),
          noTelepon: String(noTelepon || '').trim().slice(0, 30),
          avatarUrl:
            typeof avatarUrl === 'string' && avatarUrl.trim().length > 0 ? avatarUrl.trim() : undefined,
        },
        nextPasswordHash,
        activeUsername
      );

      if (activeUid === 'local-hr-mojokerto') {
        dbStore.updateAdminProfile({
          namaTampilan: updated.namaTampilan,
          role: updated.role,
          departemen: updated.departemen,
          email: updated.email,
          noTelepon: updated.noTelepon,
          avatarUrl: updated.avatarUrl,
          ...(nextPasswordHash ? { passwordHash: nextPasswordHash } : {}),
        });
      }

      invalidateAuthSessionCache();
      broadcastRealtimeEvent('users', 'profile_updated', { username: updated.username });
      return res.json({
        message: 'Profil pengguna berhasil diperbarui.',
        user: updated,
      });
    } catch (err) {
      return res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memperbarui profil.' });
    }
  });

  app.post('/api/auth/logout', async (req, res) => {
    const token = getTokenFromRequest(req);
    if (token) await revokeSessionToken(token);
    res.setHeader('Set-Cookie', buildClearSessionCookieHeader());
    res.json({ ok: true });
  });

  // ==================== USER MANAGEMENT ENDPOINTS (RBAC) ====================

  app.get('/api/users', requireAuth, requireUserManagementRole, async (_req: AuthRequest, res) => {
    try {
      const [accounts, auditLogs] = await Promise.all([listAllUsers(), getRecentUserAuditLogs(25)]);
      return res.json({
        users: accounts,
        auditLogs,
        allowedRoles: ALLOWED_ACCOUNT_ROLES,
      });
    } catch (err) {
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal memuat daftar akun pengguna.',
      });
    }
  });

  app.post('/api/users', requireAuth, requireUserManagementRole, async (req: AuthRequest, res) => {
    try {
      const { username, password, namaTampilan, role, departemen, email, noTelepon, isActive } =
        req.body || {};

      const cleanUsername = String(username || '').trim().toLowerCase();
      if (!/^[a-z0-9._-]{3,40}$/.test(cleanUsername)) {
        return res.status(400).json({
          error: 'Username harus 3–40 karakter dan hanya boleh huruf kecil, angka, titik, garis bawah, atau tanda hubung.',
        });
      }
      const rawPassword = String(password || '');
      if (rawPassword.length < 8) {
        return res.status(400).json({ error: 'Password awal minimal 8 karakter.' });
      }
      if (!namaTampilan || String(namaTampilan).trim().length < 2) {
        return res.status(400).json({ error: 'Nama lengkap minimal 2 karakter.' });
      }
      const cleanRole = String(role || '').trim();
      if (!(ALLOWED_ACCOUNT_ROLES as readonly string[]).includes(cleanRole)) {
        return res.status(400).json({ error: 'Role akun tidak valid.' });
      }
      if (!departemen || String(departemen).trim().length < 2) {
        return res.status(400).json({ error: 'Departemen / Seksi wajib diisi.' });
      }
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({ error: 'Format email korporat tidak valid.' });
      }

      const passwordHash = hashPasswordScrypt(rawPassword);
      const created = await createManagedUser(
        {
          username: cleanUsername,
          passwordHash,
          namaTampilan: String(namaTampilan).trim().slice(0, 80),
          role: cleanRole,
          departemen: String(departemen).trim().slice(0, 80),
          email: cleanEmail.slice(0, 100),
          noTelepon: String(noTelepon || '').trim().slice(0, 30),
          isActive: isActive !== false,
        },
        req.adminUser?.username || 'hr.mojokerto'
      );

      broadcastRealtimeEvent('users', 'created', { id: created.id, username: created.username });
      return res.status(201).json({
        message: `Akun @${created.username} (${created.role}) berhasil dibuat.`,
        user: created,
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'USERNAME_EXISTS') {
        return res.status(409).json({ error: 'Username tersebut sudah digunakan oleh akun lain.' });
      }
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal membuat akun pengguna baru.',
      });
    }
  });

  app.put('/api/users/:id', requireAuth, requireUserManagementRole, async (req: AuthRequest, res) => {
    try {
      const targetId = Number(req.params.id);
      if (!Number.isInteger(targetId) || targetId <= 0) {
        return res.status(400).json({ error: 'ID pengguna tidak valid.' });
      }

      const existing = await getUserById(targetId);
      if (!existing) {
        return res.status(404).json({ error: 'Akun pengguna tidak ditemukan.' });
      }

      const { namaTampilan, role, departemen, email, noTelepon, isActive, newPassword } = req.body || {};

      if (namaTampilan !== undefined && String(namaTampilan).trim().length < 2) {
        return res.status(400).json({ error: 'Nama lengkap minimal 2 karakter.' });
      }
      if (role !== undefined && !(ALLOWED_ACCOUNT_ROLES as readonly string[]).includes(String(role).trim())) {
        return res.status(400).json({ error: 'Role akun tidak valid.' });
      }
      if (departemen !== undefined && String(departemen).trim().length < 2) {
        return res.status(400).json({ error: 'Departemen / Seksi wajib diisi.' });
      }
      if (email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
        return res.status(400).json({ error: 'Format email korporat tidak valid.' });
      }

      // Guard against self-lockout or removing last active HR Development Admin
      const isSelf = req.adminUser?.id === targetId || req.adminUser?.uid === existing.uid;
      if (isSelf && isActive === false) {
        return res.status(400).json({ error: 'Anda tidak dapat menonaktifkan akun Anda sendiri.' });
      }
      if (isSelf && role !== undefined && !canManageUsersRole(String(role))) {
        return res.status(400).json({ error: 'Anda tidak dapat menurunkan hak akses admin pada akun Anda sendiri.' });
      }
      if (existing.username === ADMIN_USERNAME && isActive === false) {
        return res.status(400).json({ error: 'Akun HR Admin utama tidak dapat dinonaktifkan.' });
      }

      let nextPasswordHash: string | undefined;
      if (newPassword && String(newPassword).trim().length > 0) {
        if (String(newPassword).length < 8) {
          return res.status(400).json({ error: 'Password reset minimal 8 karakter.' });
        }
        nextPasswordHash = hashPasswordScrypt(String(newPassword));
      }

      const updated = await updateManagedUser(
        targetId,
        {
          namaTampilan: namaTampilan !== undefined ? String(namaTampilan).trim().slice(0, 80) : undefined,
          role: role !== undefined ? String(role).trim() : undefined,
          departemen: departemen !== undefined ? String(departemen).trim().slice(0, 80) : undefined,
          email: email !== undefined ? String(email).trim().toLowerCase().slice(0, 100) : undefined,
          noTelepon: noTelepon !== undefined ? String(noTelepon).trim().slice(0, 30) : undefined,
          isActive: typeof isActive === 'boolean' ? isActive : undefined,
        },
        nextPasswordHash,
        req.adminUser?.username || 'hr.mojokerto'
      );

      invalidateAuthSessionCache();
      broadcastRealtimeEvent('users', 'updated', { id: updated.id, username: updated.username });
      return res.json({
        message: `Akun @${updated.username} berhasil diperbarui.`,
        user: updated,
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'USER_NOT_FOUND') {
        return res.status(404).json({ error: 'Akun pengguna tidak ditemukan.' });
      }
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal memperbarui akun pengguna.',
      });
    }
  });

  app.delete('/api/users/:id', requireAuth, requireUserManagementRole, async (req: AuthRequest, res) => {
    try {
      const targetId = Number(req.params.id);
      if (!Number.isInteger(targetId) || targetId <= 0) {
        return res.status(400).json({ error: 'ID pengguna tidak valid.' });
      }

      const existing = await getUserById(targetId);
      if (!existing) {
        return res.status(404).json({ error: 'Akun pengguna tidak ditemukan.' });
      }

      const isSelf = req.adminUser?.id === targetId || req.adminUser?.uid === existing.uid;
      if (isSelf) {
        return res.status(400).json({ error: 'Anda tidak dapat menghapus akun yang sedang digunakan.' });
      }
      if (existing.username === ADMIN_USERNAME || existing.uid === 'local-hr-mojokerto') {
        return res.status(400).json({ error: 'Akun HR Development Admin utama tidak dapat dihapus.' });
      }

      if (canManageUsersRole(existing.role) && existing.isActive) {
        const all = await listAllUsers();
        const activeAdmins = all.filter((u) => u.isActive && canManageUsersRole(u.role));
        if (activeAdmins.length <= 1) {
          return res.status(400).json({ error: 'Minimal harus tersisa satu akun HR Development Admin yang aktif.' });
        }
      }

      await deleteManagedUser(targetId);
      invalidateAuthSessionCache();
      broadcastRealtimeEvent('users', 'deleted', { id: targetId });
      return res.json({ ok: true, message: `Akun @${existing.username} telah dihapus.` });
    } catch (err) {
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal menghapus akun pengguna.',
      });
    }
  });

  // ==================== ADMIN ENDPOINTS ====================

  app.get('/api/dashboard/stats', requireAuth, (_req, res) => {
    dbStore.autoUpdatePksStatuses();
    res.json(dbStore.getDashboardStats());
  });

  // Combined overview bootstrap endpoint: returns stats + mahasiswa in a single round-trip
  app.get('/api/dashboard/overview', requireAuth, (_req, res) => {
    dbStore.autoUpdatePksStatuses();
    res.json({
      stats: dbStore.getDashboardStats(),
      mahasiswa: dbStore.getAll().mahasiswa,
    });
  });

  app.get('/api/absensi/harian', requireAuth, (req, res) => {
    const tanggal = String(req.query.tanggal || getJakartaDateStr());
    res.json(dbStore.getDailyAttendance(tanggal));
  });

  // Mahasiswa CRUD
  app.get('/api/mahasiswa', requireAuth, (_req, res) => {
    res.json(dbStore.getAll().mahasiswa);
  });

  app.post('/api/mahasiswa', requireAuth, async (req, res) => {
    try {
      const { nim, program, department, nama, universitas, jurusan, tglMasuk, tanggalBerakhir, gender, status } =
        req.body || {};

      if (!nim || !nama || !universitas || !jurusan || !department) {
        return res.status(400).json({ error: 'NIM, Nama, Departemen, Universitas, dan Jurusan wajib diisi.' });
      }
      const data = dbStore.getAll();
      if (data.mahasiswa.some((m) => m.nim === String(nim).trim())) {
        return res.status(409).json({ error: 'NIM sudah terdaftar pada data peserta magang.' });
      }
      const cleanGender = gender === 'P' || gender === 'Perempuan' ? 'P' : 'L';
      const record: Mahasiswa = {
        nim: String(nim).trim(),
        program: program === 'PKL' ? 'PKL' : 'MBKM',
        department: String(department).trim(),
        nama: String(nama).trim(),
        universitas: String(universitas).trim(),
        jurusan: String(jurusan).trim(),
        tglMasuk: tglMasuk || getJakartaDateStr(),
        tanggalBerakhir: tanggalBerakhir || addDaysFromToday(90),
        gender: cleanGender,
        status: status === 'Tidak Aktif' ? 'Tidak Aktif' : 'Aktif',
        talent: 'Belum Dievaluasi',
        skor: 0,
      };
      data.mahasiswa.unshift(record);
      await dbStore.flushToPostgres();
      broadcastRealtimeEvent('mahasiswa', 'created', { nim: record.nim });
      res.status(201).json(record);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal menambah peserta magang.' });
    }
  });

  app.put('/api/mahasiswa/:nim', requireAuth, async (req, res) => {
    try {
      const targetNim = decodeURIComponent(String(req.params.nim));
      const data = dbStore.getAll();
      const idx = data.mahasiswa.findIndex((m) => m.nim === targetNim);
      if (idx === -1) return res.status(404).json({ error: 'Peserta tidak ditemukan.' });

      const body = req.body || {};
      const current = data.mahasiswa[idx];
      const cleanGender =
        body.gender === 'P' || body.gender === 'Perempuan'
          ? 'P'
          : body.gender === 'L' || body.gender === 'Laki-laki'
            ? 'L'
            : current.gender;

      data.mahasiswa[idx] = {
        ...current,
        program: body.program === 'PKL' || body.program === 'MBKM' ? body.program : current.program,
        department: body.department ?? current.department,
        nama: body.nama ?? current.nama,
        universitas: body.universitas ?? current.universitas,
        jurusan: body.jurusan ?? current.jurusan,
        tglMasuk: body.tglMasuk ?? current.tglMasuk,
        tanggalBerakhir: body.tanggalBerakhir ?? current.tanggalBerakhir,
        gender: cleanGender,
        status: body.status === 'Tidak Aktif' || body.status === 'Aktif' ? body.status : current.status,
      };
      await dbStore.flushToPostgres();
      broadcastRealtimeEvent('mahasiswa', 'updated', { nim: targetNim });
      res.json(data.mahasiswa[idx]);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memperbarui data peserta.' });
    }
  });

  app.post('/api/mahasiswa/sync', requireAuth, async (_req, res) => {
    try {
      const syncedCount = dbStore.syncMahasiswaTalent();
      await dbStore.flushToPostgres();
      broadcastRealtimeEvent('mahasiswa', 'synced', { syncedCount });
      res.json({ ok: true, syncedCount });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal menyinkronkan talent.' });
    }
  });

  app.get('/api/mahasiswa/:nim/detail', requireAuth, (req, res) => {
    const targetNim = decodeURIComponent(String(req.params.nim));
    const detail = dbStore.getInternDetail(targetNim);
    if (!detail) return res.status(404).json({ error: 'Peserta tidak ditemukan.' });
    res.json(detail);
  });

  // Pendaftar (Applicant Records)
  app.get('/api/pendaftar', requireAuth, (_req, res) => {
    res.json(dbStore.getAll().pendaftaran);
  });

  app.post('/api/pendaftar/bulk-status', requireAuth, async (req, res) => {
    try {
      const { ids, status } = req.body || {};
      if (!Array.isArray(ids) || ids.length === 0 || !['Diterima', 'Ditolak'].includes(status)) {
        return res.status(400).json({ error: 'Pilih minimal satu pelamar dan status keputusan yang valid.' });
      }
      const data = dbStore.getAll();
      let updatedCount = 0;
      let addedInternsCount = 0;

      for (const id of ids) {
        const applicant = data.pendaftaran.find((p) => p.id === String(id));
        if (!applicant || applicant.status === status) continue;
        applicant.status = status;
        updatedCount += 1;

        if (status === 'Diterima') {
          const existing = data.mahasiswa.find((m) => m.nim === applicant.nim);
          if (!existing) {
            data.mahasiswa.unshift({
              nim: applicant.nim,
              program: applicant.jenis,
              department: applicant.lowongan.split(' Intern')[0] || 'Operations',
              nama: applicant.nama,
              universitas: applicant.universitas,
              jurusan: applicant.jurusan,
              tglMasuk: getJakartaDateStr(),
              tanggalBerakhir: addDaysFromToday(applicant.jenis === 'MBKM' ? 120 : 60),
              gender: 'L',
              status: 'Aktif',
              talent: 'Belum Dievaluasi',
              skor: 0,
            });
            addedInternsCount += 1;
          }
          data.emailLogs.unshift({
            id: `MAIL-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            timestamp: getJakartaTimestamp(),
            kepada: applicant.email,
            subjek: `[PT Ajinomoto Indonesia - PT Ajinex International] Pengumuman Penerimaan Magang ${applicant.jenis} – ${applicant.lowongan}`,
            jenis: 'Seleksi Diterima',
            isiRingkas: `Yth. ${applicant.nama}, selamat! Anda dinyatakan DITERIMA pada program ${applicant.jenis} posisi ${applicant.lowongan} di PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory.`,
          });
        } else {
          data.emailLogs.unshift({
            id: `MAIL-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            timestamp: getJakartaTimestamp(),
            kepada: applicant.email,
            subjek: `[PT Ajinomoto Indonesia - PT Ajinex International] Informasi Hasil Seleksi Magang – ${applicant.lowongan}`,
            jenis: 'Seleksi Ditolak',
            isiRingkas: `Yth. ${applicant.nama}, terima kasih telah melamar posisi ${applicant.lowongan} di PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory. Saat ini Anda belum dapat melanjutkan ke tahap berikutnya.`,
          });
        }
      }

      await dbStore.flushToPostgres();
      broadcastRealtimeEvent('pendaftaran', 'bulk_updated', { updatedCount, addedInternsCount });
      if (addedInternsCount > 0) {
        broadcastRealtimeEvent('mahasiswa', 'created_from_selection', { addedInternsCount });
      }
      res.json({ updatedCount, addedInternsCount });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memperbarui status seleksi.' });
    }
  });

  app.put('/api/pendaftar/:id/status', requireAuth, async (req, res) => {
    try {
      const id = String(req.params.id);
      const { status, department, tanggalBerakhir } = req.body || {};
      if (!['Diterima', 'Ditolak', 'Pending'].includes(status)) {
        return res.status(400).json({ error: 'Status seleksi harus Diterima, Ditolak, atau Pending.' });
      }
      const data = dbStore.getAll();
      const applicant = data.pendaftaran.find((p) => p.id === id);
      if (!applicant) return res.status(404).json({ error: 'Data pelamar tidak ditemukan.' });

      applicant.status = status;
      let createdMahasiswa: Mahasiswa | null = null;
      let emailPreview: { subjek: string; isiRingkas: string } | null = null;

      if (status === 'Diterima') {
        const existing = data.mahasiswa.find((m) => m.nim === applicant.nim);
        if (!existing) {
          createdMahasiswa = {
            nim: applicant.nim,
            program: applicant.jenis,
            department: department || applicant.lowongan.split(' Intern')[0] || 'Operations',
            nama: applicant.nama,
            universitas: applicant.universitas,
            jurusan: applicant.jurusan,
            tglMasuk: getJakartaDateStr(),
            tanggalBerakhir: tanggalBerakhir || addDaysFromToday(applicant.jenis === 'MBKM' ? 120 : 60),
            gender: 'L',
            status: 'Aktif',
            talent: 'Belum Dievaluasi',
            skor: 0,
          };
          data.mahasiswa.unshift(createdMahasiswa);
        }

        emailPreview = {
          subjek: `[PT Ajinomoto Indonesia - PT Ajinex International] Pengumuman Penerimaan Magang ${applicant.jenis} – ${applicant.lowongan}`,
          isiRingkas: `Yth. ${applicant.nama} (${applicant.universitas}), selamat! Anda dinyatakan DITERIMA pada program ${applicant.jenis} posisi ${applicant.lowongan} di PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory. Silakan hadir untuk orientasi K3 (Safety First) dan pengaktifan akses absensi.`,
        };
        data.emailLogs.unshift({
          id: `MAIL-${Date.now()}`,
          timestamp: getJakartaTimestamp(),
          kepada: applicant.email,
          subjek: emailPreview.subjek,
          jenis: 'Seleksi Diterima',
          isiRingkas: emailPreview.isiRingkas,
        });
      } else if (status === 'Ditolak') {
        emailPreview = {
          subjek: `[PT Ajinomoto Indonesia - PT Ajinex International] Informasi Hasil Seleksi Magang – ${applicant.lowongan}`,
          isiRingkas: `Yth. ${applicant.nama}, terima kasih atas ketertarikan Anda bergabung dalam program magang PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory. Saat ini Anda belum dapat melanjutkan ke tahap berikutnya. Tetap semangat mengembangkan potensi.`,
        };
        data.emailLogs.unshift({
          id: `MAIL-${Date.now()}`,
          timestamp: getJakartaTimestamp(),
          kepada: applicant.email,
          subjek: emailPreview.subjek,
          jenis: 'Seleksi Ditolak',
          isiRingkas: emailPreview.isiRingkas,
        });
      }

      await dbStore.flushToPostgres();
      broadcastRealtimeEvent('pendaftaran', 'status_updated', { id: applicant.id, status: applicant.status });
      if (createdMahasiswa) {
        broadcastRealtimeEvent('mahasiswa', 'created_from_selection', { nim: createdMahasiswa.nim });
      }
      res.json({ applicant, createdMahasiswa, emailPreview });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memperbarui status pelamar.' });
    }
  });

  // Evaluasi
  app.get('/api/evaluasi', requireAuth, (_req, res) => {
    res.json(dbStore.getAll().evaluasi);
  });

  app.post('/api/evaluasi', requireAuth, async (req, res) => {
    try {
      const { nim, skorBk, skorPs, skorTw, skorIs } = req.body || {};
      const data = dbStore.getAll();
      const mhs = data.mahasiswa.find((m) => m.nim === String(nim).trim());
      if (!mhs) return res.status(404).json({ error: 'Peserta magang dengan NIM tersebut tidak ditemukan.' });

      const bk = Math.min(10, Math.max(1, Number(skorBk) || 0));
      const ps = Math.min(10, Math.max(1, Number(skorPs) || 0));
      const tw = Math.min(10, Math.max(1, Number(skorTw) || 0));
      const is = Math.min(10, Math.max(1, Number(skorIs) || 0));
      const total = bk + ps + tw + is;
      const rekomendasi = computeTalentRekomendasi(total);

      const record = {
        id: `EV-${Date.now()}`,
        timestamp: getJakartaTimestamp(),
        nim: mhs.nim,
        nama: mhs.nama,
        skorBk: bk,
        skorPs: ps,
        skorTw: tw,
        skorIs: is,
        skor: total,
        rekomendasi,
      };

      data.evaluasi.unshift(record);
      mhs.skor = total;
      mhs.talent = rekomendasi;
      await dbStore.flushToPostgres();
      broadcastRealtimeEvent('evaluasi', 'created', { id: record.id, nim: mhs.nim });
      broadcastRealtimeEvent('mahasiswa', 'evaluated', { nim: mhs.nim });

      res.status(201).json({ evaluasi: record, mahasiswa: mhs });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal menyimpan evaluasi.' });
    }
  });

  // Lowongan Admin CRUD
  app.get('/api/lowongan/admin', requireAuth, (_req, res) => {
    res.json(dbStore.getAll().lowongan);
  });

  app.post('/api/lowongan/admin', requireAuth, async (req, res) => {
    try {
      const { namaPosisi, pendidikan, prodi, skill, tugas, benefit, status } = req.body || {};
      if (!namaPosisi || !pendidikan || !prodi) {
        return res.status(400).json({ error: 'Nama posisi, pendidikan, dan prodi wajib diisi.' });
      }
      const data = dbStore.getAll();
      const record: Lowongan = {
        id: `LOW-${String(data.lowongan.length + 1).padStart(3, '0')}-${Date.now().toString().slice(-3)}`,
        namaPosisi: String(namaPosisi).trim(),
        pendidikan: String(pendidikan).trim(),
        prodi: String(prodi).trim(),
        skill: String(skill || '').trim(),
        tugas: String(tugas || '').trim(),
        benefit: String(benefit || '').trim(),
        status: status === 'Closed' ? 'Closed' : 'Open',
      };
      data.lowongan.unshift(record);
      await dbStore.flushToPostgres();
      broadcastRealtimeEvent('lowongan', 'created', { id: record.id });
      res.status(201).json(record);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal menambahkan lowongan.' });
    }
  });

  app.put('/api/lowongan/admin/:id', requireAuth, async (req, res) => {
    try {
      const id = String(req.params.id);
      const data = dbStore.getAll();
      const idx = data.lowongan.findIndex((l) => l.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Lowongan tidak ditemukan.' });

      const body = req.body || {};
      data.lowongan[idx] = {
        ...data.lowongan[idx],
        namaPosisi: body.namaPosisi ?? data.lowongan[idx].namaPosisi,
        pendidikan: body.pendidikan ?? data.lowongan[idx].pendidikan,
        prodi: body.prodi ?? data.lowongan[idx].prodi,
        skill: body.skill ?? data.lowongan[idx].skill,
        tugas: body.tugas ?? data.lowongan[idx].tugas,
        benefit: body.benefit ?? data.lowongan[idx].benefit,
        status: body.status === 'Closed' || body.status === 'Open' ? body.status : data.lowongan[idx].status,
      };
      await dbStore.flushToPostgres();
      broadcastRealtimeEvent('lowongan', 'updated', { id });
      res.json(data.lowongan[idx]);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memperbarui lowongan.' });
    }
  });

  app.patch('/api/lowongan/admin/:id/status', requireAuth, async (req, res) => {
    try {
      const id = String(req.params.id);
      const data = dbStore.getAll();
      const item = data.lowongan.find((l) => l.id === id);
      if (!item) return res.status(404).json({ error: 'Lowongan tidak ditemukan.' });
      item.status = item.status === 'Open' ? 'Closed' : 'Open';
      await dbStore.flushToPostgres();
      broadcastRealtimeEvent('lowongan', 'status_toggled', { id, status: item.status });
      res.json(item);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal mengubah status lowongan.' });
    }
  });

  // PKS Universitas CRUD
  app.get('/api/pks', requireAuth, (_req, res) => {
    dbStore.autoUpdatePksStatuses();
    res.json(dbStore.getAll().universitas);
  });

  app.post('/api/pks', requireAuth, async (req, res) => {
    try {
      const { universitas, tanggalMulai, tanggalBerakhir, keterangan, dokumenNama, linkDataPks } = req.body || {};
      if (!universitas || !tanggalMulai || !tanggalBerakhir) {
        return res.status(400).json({ error: 'Nama universitas, tanggal mulai, dan tanggal berakhir wajib diisi.' });
      }
      const durasiHari = Math.max(0, diffDays(tanggalMulai, tanggalBerakhir));
      const durasiBulan = calcDurationMonths(durasiHari);
      const today = getJakartaDateStr();
      const data = dbStore.getAll();

      const record: UniversitasPKS = {
        id: `PKS-${Date.now()}`,
        universitas: String(universitas).trim(),
        tanggalMulai,
        tanggalBerakhir,
        durasiHari,
        durasiBulan,
        keterangan: String(keterangan || '').trim(),
        dokumenNama: dokumenNama ? String(dokumenNama).trim() : undefined,
        linkDataPks: linkDataPks || (dokumenNama ? `drive://pks/${dokumenNama}` : 'drive://pks/dokumen-pks.pdf'),
        status: tanggalBerakhir < today ? 'Expired' : 'Active',
      };
      data.universitas.unshift(record);
      await dbStore.flushToPostgres();
      broadcastRealtimeEvent('universitas_pks', 'created', { id: record.id });
      res.status(201).json(record);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal menambahkan data PKS.' });
    }
  });

  app.put('/api/pks/:id', requireAuth, async (req, res) => {
    try {
      const id = String(req.params.id);
      const data = dbStore.getAll();
      const idx = data.universitas.findIndex((u) => u.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Data PKS tidak ditemukan.' });

      const body = req.body || {};
      const cur = data.universitas[idx];
      const tanggalMulai = body.tanggalMulai ?? cur.tanggalMulai;
      const tanggalBerakhir = body.tanggalBerakhir ?? cur.tanggalBerakhir;
      const durasiHari = Math.max(0, diffDays(tanggalMulai, tanggalBerakhir));
      const durasiBulan = calcDurationMonths(durasiHari);
      const today = getJakartaDateStr();

      data.universitas[idx] = {
        ...cur,
        universitas: body.universitas ?? cur.universitas,
        tanggalMulai,
        tanggalBerakhir,
        durasiHari,
        durasiBulan,
        keterangan: body.keterangan ?? cur.keterangan,
        dokumenNama: body.dokumenNama ?? cur.dokumenNama,
        linkDataPks: body.linkDataPks ?? cur.linkDataPks,
        status: body.status || (tanggalBerakhir < today ? 'Expired' : 'Active'),
      };
      await dbStore.flushToPostgres();
      broadcastRealtimeEvent('universitas_pks', 'updated', { id });
      res.json(data.universitas[idx]);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memperbarui data PKS.' });
    }
  });

  app.patch('/api/pks/:id/status', requireAuth, async (req, res) => {
    try {
      const id = String(req.params.id);
      const data = dbStore.getAll();
      const item = data.universitas.find((u) => u.id === id);
      if (!item) return res.status(404).json({ error: 'Data PKS tidak ditemukan.' });
      item.status = item.status === 'Active' ? 'Expired' : 'Active';
      await dbStore.flushToPostgres();
      broadcastRealtimeEvent('universitas_pks', 'status_toggled', { id, status: item.status });
      res.json(item);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal mengubah status PKS.' });
    }
  });

  app.post('/api/pks/check-reminders', requireAuth, async (_req, res) => {
    try {
      const { updatedExpired, h30Reminders } = dbStore.autoUpdatePksStatuses();
      const data = dbStore.getAll();
      const today = getJakartaDateStr();
      const approaching = data.universitas.filter((u) => {
        if (u.status !== 'Active') return false;
        const rem = diffDays(today, u.tanggalBerakhir);
        return rem >= 0 && rem <= 30;
      });

      for (const pks of approaching) {
        if (!pks.reminderSentAt || !pks.reminderSentAt.startsWith(today)) {
          pks.reminderSentAt = getJakartaTimestamp();
          data.emailLogs.unshift({
            id: `MAIL-PKS-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            timestamp: getJakartaTimestamp(),
            kepada: 'hr.development@ajinomoto.co.id',
            subjek: `[Reminder PKS H-${diffDays(today, pks.tanggalBerakhir)}] ${pks.universitas}`,
            jenis: 'Reminder PKS H-30',
            isiRingkas: `Masa berlaku PKS ${pks.universitas} akan berakhir pada ${pks.tanggalBerakhir}. Segera proses perpanjangan agar kuota MBKM tidak terhenti.`,
          });
        }
      }
      await dbStore.flushToPostgres();
      broadcastRealtimeEvent('universitas_pks', 'reminders_checked', { approachingCount: approaching.length });

      res.json({
        updatedExpired,
        h30ExactCount: h30Reminders.length,
        approachingCount: approaching.length,
        approaching: approaching.map((p) => ({
          universitas: p.universitas,
          tanggalBerakhir: p.tanggalBerakhir,
          sisaHari: diffDays(today, p.tanggalBerakhir),
        })),
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memeriksa reminder PKS.' });
    }
  });

  // System Media Assets & Edit History
  app.get('/api/system/media', requireAuth, async (_req, res) => {
    try {
      const result = await getAllMediaAssets();
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal mengambil riwayat media.' });
    }
  });

  app.put('/api/system/media/:assetKey', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!isAdminRole(req.adminUser?.role)) {
        return res.status(403).json({
          error: 'Akses ditolak. Hanya akun Admin yang dapat memperbarui gambar dan media portal.',
        });
      }

      const assetKey = decodeURIComponent(String(req.params.assetKey || '')).trim();
      const { currentUrl, altText, objectPosition, changeNote, sourceType } = req.body || {};

      if (!assetKey) {
        return res.status(400).json({ error: 'Kunci aset media wajib diisi.' });
      }
      if (typeof currentUrl !== 'string') {
        return res.status(400).json({ error: 'URL atau data dokumen media wajib diisi.' });
      }

      const trimmedUrl = currentUrl.trim();
      const isOptionalSlot = OPTIONAL_MEDIA_KEYS.has(assetKey);
      if (!trimmedUrl && !isOptionalSlot) {
        return res.status(400).json({ error: 'Slot gambar utama tidak boleh dikosongkan. Gunakan Reset Default jika perlu.' });
      }

      if (trimmedUrl.startsWith('data:')) {
        const isValidImage = /^data:image\/(png|jpeg|jpg|webp);base64,/.test(trimmedUrl);
        const isValidPdf = isOptionalSlot && /^data:application\/pdf;base64,/.test(trimmedUrl);
        if (!isValidImage && !isValidPdf) {
          return res.status(400).json({
            error: isOptionalSlot
              ? 'Format file harus gambar (PNG, JPG, WEBP) atau dokumen PDF.'
              : 'Format gambar harus PNG, JPEG, atau WEBP.',
          });
        }
        const approxBytes = Math.ceil((trimmedUrl.split(',')[1]?.length || 0) * 0.75);
        if (approxBytes > 4.5 * 1024 * 1024) {
          return res.status(400).json({ error: 'Ukuran dokumen/gambar maksimal 4,5 MB.' });
        }
      } else if (trimmedUrl) {
        const safePathOrHttp =
          trimmedUrl.startsWith('/assets/') ||
          trimmedUrl.startsWith('/src/assets/') ||
          /^https?:\/\//i.test(trimmedUrl);
        if (!safePathOrHttp) {
          return res.status(400).json({ error: 'URL gambar tidak valid. Gunakan file upload atau tautan HTTP/HTTPS.' });
        }
      }

      const updated = await updateMediaAsset(
        assetKey,
        {
          currentUrl: trimmedUrl,
          altText: typeof altText === 'string' ? altText.slice(0, 200) : undefined,
          objectPosition: typeof objectPosition === 'string' ? objectPosition.slice(0, 40) : undefined,
          changeNote: typeof changeNote === 'string' ? changeNote.slice(0, 200) : undefined,
          sourceType: typeof sourceType === 'string' ? sourceType.slice(0, 40) : undefined,
        },
        req.adminUser?.username || 'hr.mojokerto',
        req.adminUser?.id || undefined
      );

      broadcastRealtimeEvent('media', 'updated', { assetKey });
      return res.json({ message: 'Aset media berhasil diperbarui dan langsung aktif di portal.', asset: updated });
    } catch (err) {
      return res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memperbarui gambar sistem.' });
    }
  });

  app.post('/api/system/media/:assetKey/reset', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!isAdminRole(req.adminUser?.role)) {
        return res.status(403).json({
          error: 'Akses ditolak. Hanya akun Admin yang dapat mereset gambar dan media portal.',
        });
      }
      const assetKey = decodeURIComponent(String(req.params.assetKey || '')).trim();
      const updated = await resetMediaAssetToDefault(
        assetKey,
        req.adminUser?.username || 'hr.mojokerto',
        req.adminUser?.id || undefined
      );
      broadcastRealtimeEvent('media', 'reset', { assetKey });
      return res.json({ message: 'Aset media berhasil dikembalikan ke pengaturan awal.', asset: updated });
    } catch (err) {
      return res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal mereset aset media.' });
    }
  });

  // System Settings, Database Status (PostgreSQL/Supabase) & Logs
  app.get('/api/system/info', requireAuth, async (_req, res) => {
    const data = dbStore.getAll();
    const providerInfo = getDatabaseProviderInfo();
    let tableCounts = null;
    try {
      tableCounts = await getLiveDatabaseTableCounts();
    } catch (err) {
      console.error('Failed loading live database table counts:', err);
    }

    res.json({
      counts: {
        lowongan: data.lowongan.length,
        pendaftaran: data.pendaftaran.length,
        mahasiswa: data.mahasiswa.length,
        absensi: data.absensi.length,
        evaluasi: data.evaluasi.length,
        universitas: data.universitas.length,
      },
      database: {
        ...providerInfo,
        connectedClients: getRealtimeClientCount(),
        totalTables: 15,
        tableCounts,
      },
      aiAuditLogs: data.aiAuditLogs.slice(0, 20),
      emailLogs: data.emailLogs.slice(0, 20),
      gasApiUrl: data.gasApiUrl,
      timezone: 'Asia/Jakarta',
      factoryCoords: dbStore.getFactoryCoords(),
    });
  });

  app.get('/api/system/supabase-schema', requireAuth, (_req, res) => {
    try {
      const schemaPath = path.resolve(process.cwd(), 'supabase', 'schema.sql');
      const sql = fs.readFileSync(schemaPath, 'utf-8');
      res.json({
        fileName: 'ajinomoto_internship_supabase_schema.sql',
        sql,
        totalTables: 15,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal membaca berkas skema SQL Supabase.',
      });
    }
  });

  app.post('/api/system/refresh-db', requireAuth, async (_req, res) => {
    try {
      await dbStore.refreshFromPostgres();
      broadcastRealtimeEvent('all', 'db_refreshed');
      const tableCounts = await getLiveDatabaseTableCounts();
      res.json({ ok: true, tableCounts });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal menyinkronkan ulang data dari PostgreSQL.',
      });
    }
  });

  app.put('/api/system/geofence', requireAuth, async (req, res) => {
    try {
      const { maxRadiusMeters } = req.body || {};
      const num = Number(maxRadiusMeters);
      if (Number.isNaN(num) || num < 100 || num > 5000) {
        return res.status(400).json({ error: 'Radius geofence harus di antara 100 hingga 5000 meter.' });
      }
      const coords = dbStore.updateGeofenceRadius(num);
      await dbStore.flushToPostgres();
      broadcastRealtimeEvent('settings', 'geofence_updated', { maxRadiusMeters: coords.maxRadiusMeters });
      res.json({ ok: true, factoryCoords: coords });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memperbarui radius geofence.' });
    }
  });

  app.put('/api/system/gas-url', requireAuth, async (req, res) => {
    try {
      const { gasApiUrl } = req.body || {};
      const data = dbStore.getAll();
      data.gasApiUrl = String(gasApiUrl || '').trim();
      await dbStore.flushToPostgres();
      broadcastRealtimeEvent('settings', 'gas_url_updated');
      res.json({ ok: true, gasApiUrl: data.gasApiUrl });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal menyimpan URL GAS.' });
    }
  });

  app.post('/api/system/reset-seed', requireAuth, async (_req, res) => {
    try {
      const seeded = dbStore.resetSeed();
      await dbStore.flushToPostgres({ replaceAll: true });
      broadcastRealtimeEvent('all', 'seed_reset');
      res.json({ ok: true, counts: { mahasiswa: seeded.mahasiswa.length, pendaftaran: seeded.pendaftaran.length } });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal mereset database awal.' });
    }
  });

  // ==================== AI ASSISTANT ENDPOINTS ====================

  app.post('/api/ai/insight', requireAuth, async (req: AuthRequest, res) => {
    try {
      const lang: 'id' | 'en' = req.body?.lang === 'en' ? 'en' : 'id';
      const insight = await generateExecutiveInsight(req.adminUser?.username || 'hr-admin', lang);
      res.json(insight);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal menghasilkan AI Insight.' });
    }
  });

  app.post('/api/ai/screen-cv', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { pendaftaranId } = req.body || {};
      const lang: 'id' | 'en' = req.body?.lang === 'en' ? 'en' : 'id';
      const data = dbStore.getAll();
      const pendaftar = data.pendaftaran.find((p) => p.id === pendaftaranId);
      if (!pendaftar) return res.status(404).json({ error: 'Data pelamar tidak ditemukan.' });
      const lowongan = data.lowongan.find((l) => l.namaPosisi === pendaftar.lowongan);
      const result = await screenApplicantCv(pendaftar, lowongan, req.adminUser?.username || 'hr-admin', lang);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal melakukan screening CV dengan AI.' });
    }
  });

  app.post('/api/ai/chat', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { question, history } = req.body || {};
      const lang: 'id' | 'en' = req.body?.lang === 'en' ? 'en' : 'id';
      if (!question || typeof question !== 'string') {
        return res.status(400).json({ error: 'Pertanyaan tidak boleh kosong.' });
      }
      const answer = await chatWithHrAssistant(
        question,
        Array.isArray(history) ? history : [],
        req.adminUser?.username || 'hr-admin',
        lang
      );
      res.json({ answer });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal memproses pertanyaan Asisten HR.' });
    }
  });

  app.post('/api/ai/draft-email', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { jenisSurat, konteks } = req.body || {};
      const lang: 'id' | 'en' = req.body?.lang === 'en' ? 'en' : 'id';
      const draft = await draftHrEmail(
        jenisSurat || 'Diterima',
        konteks || {},
        req.adminUser?.username || 'hr-admin',
        lang
      );
      res.json(draft);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal menyusun draf surat.' });
    }
  });

  app.post('/api/ai/anomaly', requireAuth, async (req: AuthRequest, res) => {
    try {
      const tanggal = String(req.body?.tanggal || getJakartaDateStr());
      const lang: 'id' | 'en' = req.body?.lang === 'en' ? 'en' : 'id';
      const analysis = await analyzeAttendanceAnomalies(tanggal, req.adminUser?.username || 'hr-admin', lang);
      res.json(analysis);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal menganalisis anomali absensi.' });
    }
  });

  // Prevent unmatched /api/* routes from falling through to SPA HTML
  app.all('/api/*', (_req, res) => {
    res.status(404).json({ error: 'Endpoint API tidak ditemukan.' });
  });

  return app;
}
