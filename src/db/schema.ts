import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

// 1. Akun Pengguna (Users & Auth Credentials / Firebase Auth Mapping)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  username: text('username').notNull().unique(),
  email: text('email').notNull(),
  passwordHash: text('password_hash'),
  role: text('role').notNull().default('HR Development Admin'),
  authProvider: text('auth_provider').notNull().default('password'),
  isActive: boolean('is_active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 2. Manajemen Profil Pengguna (User Profiles)
export const userProfiles = pgTable('user_profiles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  namaTampilan: text('nama_tampilan').notNull(),
  role: text('role').notNull(),
  departemen: text('departemen').notNull(),
  emailKorporat: text('email_korporat').notNull(),
  noTelepon: text('no_telepon').notNull().default(''),
  avatarUrl: text('avatar_url').notNull(),
  preferredTheme: text('preferred_theme').notNull().default('ajinomoto-crimson'),
  preferredLang: text('preferred_lang').notNull().default('id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 3. Log Perubahan Profil & Kredensial (Profile Change Audit)
export const profileChangeLogs = pgTable('profile_change_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  changedFields: text('changed_fields').notNull(),
  previousAvatarUrl: text('previous_avatar_url'),
  newAvatarUrl: text('new_avatar_url'),
  passwordChanged: boolean('password_changed').notNull().default(false),
  changedBy: text('changed_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 4. Aset Gambar & Media Sistem (Landing, Portal Cards, Logos, Avatars)
export const mediaAssets = pgTable('media_assets', {
  id: serial('id').primaryKey(),
  assetKey: text('asset_key').notNull().unique(),
  label: text('label').notNull(),
  placement: text('placement').notNull(),
  currentUrl: text('current_url').notNull(),
  altText: text('alt_text').notNull(),
  objectPosition: text('object_position').notNull().default('center'),
  mimeType: text('mime_type').notNull().default('image/png'),
  sourceType: text('source_type').notNull().default('system_asset'),
  updatedByUserId: integer('updated_by_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 5. Riwayat Perubahan & Editing Gambar Sistem (Media Edit History)
export const mediaEditHistory = pgTable('media_edit_history', {
  id: serial('id').primaryKey(),
  mediaAssetId: integer('media_asset_id')
    .references(() => mediaAssets.id, { onDelete: 'cascade' })
    .notNull(),
  assetKey: text('asset_key').notNull(),
  previousUrl: text('previous_url'),
  newUrl: text('new_url').notNull(),
  previousObjectPosition: text('previous_object_position'),
  newObjectPosition: text('new_object_position'),
  changeNote: text('change_note').notNull(),
  editedBy: text('edited_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 6. Lowongan Magang (Vacancies)
export const lowongan = pgTable('lowongan', {
  id: text('id').primaryKey(),
  namaPosisi: text('nama_posisi').notNull(),
  pendidikan: text('pendidikan').notNull(),
  prodi: text('prodi').notNull(),
  skill: text('skill').notNull().default(''),
  tugas: text('tugas').notNull().default(''),
  benefit: text('benefit').notNull().default(''),
  status: text('status').notNull().default('Open'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 7. Peserta Magang Aktif & Alumni (Intern Master)
export const mahasiswa = pgTable('mahasiswa', {
  nim: text('nim').primaryKey(),
  program: text('program').notNull(),
  department: text('department').notNull(),
  nama: text('nama').notNull(),
  universitas: text('universitas').notNull(),
  jurusan: text('jurusan').notNull(),
  tglMasuk: text('tgl_masuk').notNull(),
  tanggalBerakhir: text('tanggal_berakhir').notNull(),
  gender: text('gender').notNull(),
  status: text('status').notNull().default('Aktif'),
  talent: text('talent').notNull().default('Belum Dievaluasi'),
  skor: integer('skor').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 8. Pendaftaran Pelamar MBKM & PKL (Applicants)
export const pendaftaran = pgTable('pendaftaran', {
  id: text('id').primaryKey(),
  timestamp: text('timestamp').notNull(),
  jenis: text('jenis').notNull(),
  nama: text('nama').notNull(),
  nim: text('nim').notNull(),
  universitas: text('universitas').notNull(),
  jurusan: text('jurusan').notNull(),
  lowonganId: text('lowongan_id').references(() => lowongan.id, {
    onDelete: 'set null',
  }),
  lowongan: text('lowongan').notNull(),
  linkCv: text('link_cv').notNull().default('-'),
  cvFileName: text('cv_file_name'),
  cvBase64: text('cv_base64'),
  cvSummaryText: text('cv_summary_text'),
  status: text('status').notNull().default('Pending'),
  email: text('email').notNull(),
  persetujuanPrivacy: boolean('persetujuan_privacy').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 9. Log Absensi Selfie & GPS Harian (Attendance)
export const absensi = pgTable('absensi', {
  id: text('id').primaryKey(),
  timestamp: text('timestamp').notNull(),
  tanggal: text('tanggal').notNull(),
  nim: text('nim')
    .references(() => mahasiswa.nim, { onDelete: 'cascade' })
    .notNull(),
  nama: text('nama').notNull(),
  status: text('status').notNull(),
  lokasi: text('lokasi').notNull(),
  jarakMeter: integer('jarak_meter').notNull().default(0),
  linkFoto: text('link_foto').notNull(),
  keterangan: text('keterangan'),
  anomaliFlag: text('anomali_flag'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 10. Evaluasi 4 Pilar Kompetensi (Evaluations)
export const evaluasi = pgTable('evaluasi', {
  id: text('id').primaryKey(),
  timestamp: text('timestamp').notNull(),
  nim: text('nim')
    .references(() => mahasiswa.nim, { onDelete: 'cascade' })
    .notNull(),
  nama: text('nama').notNull(),
  skorBk: integer('skor_bk').notNull(),
  skorPs: integer('skor_ps').notNull(),
  skorTw: integer('skor_tw').notNull(),
  skorIs: integer('skor_is').notNull(),
  skor: integer('skor').notNull(),
  rekomendasi: text('rekomendasi').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 11. Kontrak PKS Universitas Mitra (University Agreements)
export const universitasPks = pgTable('universitas_pks', {
  id: text('id').primaryKey(),
  universitas: text('universitas').notNull(),
  tanggalMulai: text('tanggal_mulai').notNull(),
  tanggalBerakhir: text('tanggal_berakhir').notNull(),
  durasiHari: integer('durasi_hari').notNull().default(0),
  durasiBulan: integer('durasi_bulan').notNull().default(0),
  keterangan: text('keterangan').notNull().default(''),
  linkDataPks: text('link_data_pks').notNull(),
  dokumenNama: text('dokumen_nama'),
  status: text('status').notNull().default('Active'),
  reminderSentAt: text('reminder_sent_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 12. Audit Log Pemanggilan Layanan AI (AI Audit Logs)
export const aiAuditLogs = pgTable('ai_audit_logs', {
  id: text('id').primaryKey(),
  timestamp: text('timestamp').notNull(),
  fitur: text('fitur').notNull(),
  adminUser: text('admin_user').notNull(),
  ringkasanPrompt: text('ringkasan_prompt').notNull(),
  status: text('status').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 13. Log Notifikasi Email Otomatis (Email Logs)
export const emailLogs = pgTable('email_logs', {
  id: text('id').primaryKey(),
  timestamp: text('timestamp').notNull(),
  kepada: text('kepada').notNull(),
  subjek: text('subjek').notNull(),
  jenis: text('jenis').notNull(),
  isiRingkas: text('isi_ringkas').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 14. Konfigurasi Sistem & Geofence Pabrik (System Settings)
export const systemSettings = pgTable('system_settings', {
  key: text('key').primaryKey(),
  gasApiUrl: text('gas_api_url').notNull().default(''),
  factoryLat: doublePrecision('factory_lat').notNull().default(-7.4589),
  factoryLng: doublePrecision('factory_lng').notNull().default(112.4631),
  maxRadiusMeters: integer('max_radius_meters').notNull().default(650),
  timezone: text('timezone').notNull().default('Asia/Jakarta'),
  defaultTheme: text('default_theme').notNull().default('ajinomoto-crimson'),
  defaultLang: text('default_lang').notNull().default('id'),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 15. Pencabutan Sesi Server-Side (Revoked Sessions)
export const revokedSessions = pgTable('revoked_sessions', {
  jti: text('jti').primaryKey(),
  userUid: text('user_uid').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  revokedAt: timestamp('revoked_at').defaultNow().notNull(),
});

// ================= RELATIONS =================

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(userProfiles, {
    fields: [users.id],
    references: [userProfiles.userId],
  }),
  profileChanges: many(profileChangeLogs),
  updatedMediaAssets: many(mediaAssets),
}));

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, {
    fields: [userProfiles.userId],
    references: [users.id],
  }),
}));

export const profileChangeLogsRelations = relations(profileChangeLogs, ({ one }) => ({
  user: one(users, {
    fields: [profileChangeLogs.userId],
    references: [users.id],
  }),
}));

export const mediaAssetsRelations = relations(mediaAssets, ({ one, many }) => ({
  updatedByUser: one(users, {
    fields: [mediaAssets.updatedByUserId],
    references: [users.id],
  }),
  history: many(mediaEditHistory),
}));

export const mediaEditHistoryRelations = relations(mediaEditHistory, ({ one }) => ({
  asset: one(mediaAssets, {
    fields: [mediaEditHistory.mediaAssetId],
    references: [mediaAssets.id],
  }),
}));

export const lowonganRelations = relations(lowongan, ({ many }) => ({
  pendaftaran: many(pendaftaran),
}));

export const pendaftaranRelations = relations(pendaftaran, ({ one }) => ({
  lowonganRef: one(lowongan, {
    fields: [pendaftaran.lowonganId],
    references: [lowongan.id],
  }),
}));

export const mahasiswaRelations = relations(mahasiswa, ({ many }) => ({
  absensi: many(absensi),
  evaluasi: many(evaluasi),
}));

export const absensiRelations = relations(absensi, ({ one }) => ({
  mahasiswaRef: one(mahasiswa, {
    fields: [absensi.nim],
    references: [mahasiswa.nim],
  }),
}));

export const evaluasiRelations = relations(evaluasi, ({ one }) => ({
  mahasiswaRef: one(mahasiswa, {
    fields: [evaluasi.nim],
    references: [mahasiswa.nim],
  }),
}));
