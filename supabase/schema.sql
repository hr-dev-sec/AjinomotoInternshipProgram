-- =============================================================================
-- PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory
-- Ajinomoto Indonesia University · Sistem Informasi Magang (MBKM & PKL)
-- Complete PostgreSQL / Supabase Database Schema + Triggers + Realtime Sync
-- =============================================================================
-- Cara Pakai di Supabase:
-- 1. Buka Supabase Dashboard -> SQL Editor -> New Query
-- 2. Tempel seluruh isi file ini dan klik "Run"
-- 3. Isi SUPABASE_DB_URL pada environment server aplikasi Anda
--    (seluruh 15 tabel, relasi, trigger updated_at, dan publikasi Realtime aktif otomatis)
-- =============================================================================

-- 1. Akun Pengguna (HR Development Admin, Admin Operasional, Pimpinan Perusahaan / Dept. / Seksi)
CREATE TABLE IF NOT EXISTS public.users (
  id SERIAL PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'HR Development Admin',
  auth_provider TEXT NOT NULL DEFAULT 'password',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2. Manajemen Profil Pengguna & Preferensi Tema/Bahasa (Zero Local Browser Storage)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  nama_tampilan TEXT NOT NULL,
  role TEXT NOT NULL,
  departemen TEXT NOT NULL,
  email_korporat TEXT NOT NULL,
  no_telepon TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL,
  preferred_theme TEXT NOT NULL DEFAULT 'ajinomoto-crimson',
  preferred_lang TEXT NOT NULL DEFAULT 'id',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 3. Log Audit Perubahan Profil & Manajemen Akun
CREATE TABLE IF NOT EXISTS public.profile_change_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  changed_fields TEXT NOT NULL,
  previous_avatar_url TEXT,
  new_avatar_url TEXT,
  password_changed BOOLEAN NOT NULL DEFAULT FALSE,
  changed_by TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 4. Manajemen Aset Media & Gambar Portal (Landing Page, Poster Magang/PKL, Logo)
CREATE TABLE IF NOT EXISTS public.media_assets (
  id SERIAL PRIMARY KEY,
  asset_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  placement TEXT NOT NULL,
  current_url TEXT NOT NULL,
  alt_text TEXT NOT NULL,
  object_position TEXT NOT NULL DEFAULT 'center',
  mime_type TEXT NOT NULL DEFAULT 'image/png',
  source_type TEXT NOT NULL DEFAULT 'system_asset',
  updated_by_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 5. Riwayat Revisi & Editing Gambar/Dokumen Sistem
CREATE TABLE IF NOT EXISTS public.media_edit_history (
  id SERIAL PRIMARY KEY,
  media_asset_id INTEGER NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE,
  asset_key TEXT NOT NULL,
  previous_url TEXT,
  new_url TEXT NOT NULL,
  previous_object_position TEXT,
  new_object_position TEXT,
  change_note TEXT NOT NULL,
  edited_by TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 6. Lowongan Magang (MBKM & PKL)
CREATE TABLE IF NOT EXISTS public.lowongan (
  id TEXT PRIMARY KEY,
  nama_posisi TEXT NOT NULL,
  pendidikan TEXT NOT NULL,
  prodi TEXT NOT NULL,
  skill TEXT NOT NULL DEFAULT '',
  tugas TEXT NOT NULL DEFAULT '',
  benefit TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Open',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 7. Master Peserta Magang Aktif & Alumni
CREATE TABLE IF NOT EXISTS public.mahasiswa (
  nim TEXT PRIMARY KEY,
  program TEXT NOT NULL,
  department TEXT NOT NULL,
  nama TEXT NOT NULL,
  universitas TEXT NOT NULL,
  jurusan TEXT NOT NULL,
  tgl_masuk TEXT NOT NULL,
  tanggal_berakhir TEXT NOT NULL,
  gender TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Aktif',
  talent TEXT NOT NULL DEFAULT 'Belum Dievaluasi',
  skor INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 8. Pendaftaran Pelamar MBKM & PKL (termasuk CV PDF)
CREATE TABLE IF NOT EXISTS public.pendaftaran (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  jenis TEXT NOT NULL,
  nama TEXT NOT NULL,
  nim TEXT NOT NULL,
  universitas TEXT NOT NULL,
  jurusan TEXT NOT NULL,
  lowongan_id TEXT REFERENCES public.lowongan(id) ON DELETE SET NULL,
  lowongan TEXT NOT NULL,
  link_cv TEXT NOT NULL DEFAULT '-',
  cv_file_name TEXT,
  cv_base64 TEXT,
  cv_summary_text TEXT,
  status TEXT NOT NULL DEFAULT 'Pending',
  email TEXT NOT NULL,
  persetujuan_privacy BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 9. Log Absensi Selfie & GPS Geofence Harian
CREATE TABLE IF NOT EXISTS public.absensi (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  tanggal TEXT NOT NULL,
  nim TEXT NOT NULL REFERENCES public.mahasiswa(nim) ON DELETE CASCADE,
  nama TEXT NOT NULL,
  status TEXT NOT NULL,
  lokasi TEXT NOT NULL,
  jarak_meter INTEGER NOT NULL DEFAULT 0,
  link_foto TEXT NOT NULL,
  keterangan TEXT,
  anomali_flag TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 10. Evaluasi 4 Pilar Kompetensi (BK, PS, TW, IS)
CREATE TABLE IF NOT EXISTS public.evaluasi (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  nim TEXT NOT NULL REFERENCES public.mahasiswa(nim) ON DELETE CASCADE,
  nama TEXT NOT NULL,
  skor_bk INTEGER NOT NULL,
  skor_ps INTEGER NOT NULL,
  skor_tw INTEGER NOT NULL,
  skor_is INTEGER NOT NULL,
  skor INTEGER NOT NULL,
  rekomendasi TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 11. Kontrak PKS Universitas Mitra
CREATE TABLE IF NOT EXISTS public.universitas_pks (
  id TEXT PRIMARY KEY,
  universitas TEXT NOT NULL,
  tanggal_mulai TEXT NOT NULL,
  tanggal_berakhir TEXT NOT NULL,
  durasi_hari INTEGER NOT NULL DEFAULT 0,
  durasi_bulan INTEGER NOT NULL DEFAULT 0,
  keterangan TEXT NOT NULL DEFAULT '',
  link_data_pks TEXT NOT NULL,
  dokumen_nama TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  reminder_sent_at TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 12. Audit Log Pemanggilan Layanan AI HR
CREATE TABLE IF NOT EXISTS public.ai_audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  fitur TEXT NOT NULL,
  admin_user TEXT NOT NULL,
  ringkasan_prompt TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 13. Log Notifikasi Email Otomatis
CREATE TABLE IF NOT EXISTS public.email_logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  kepada TEXT NOT NULL,
  subjek TEXT NOT NULL,
  jenis TEXT NOT NULL,
  isi_ringkas TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 14. Konfigurasi Sistem, Geofence Pabrik & Preferensi Global Portal
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  gas_api_url TEXT NOT NULL DEFAULT '',
  factory_lat DOUBLE PRECISION NOT NULL DEFAULT -7.4589,
  factory_lng DOUBLE PRECISION NOT NULL DEFAULT 112.4631,
  max_radius_meters INTEGER NOT NULL DEFAULT 650,
  timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  default_theme TEXT NOT NULL DEFAULT 'ajinomoto-crimson',
  default_lang TEXT NOT NULL DEFAULT 'id',
  updated_by TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 15. Pencabutan Sesi (Revoked Sessions — Server-Side Session Security)
CREATE TABLE IF NOT EXISTS public.revoked_sessions (
  jti TEXT PRIMARY KEY,
  user_uid TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES FOR FAST QUERIES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_absensi_tanggal ON public.absensi (tanggal);
CREATE INDEX IF NOT EXISTS idx_absensi_nim ON public.absensi (nim);
CREATE INDEX IF NOT EXISTS idx_evaluasi_nim ON public.evaluasi (nim);
CREATE INDEX IF NOT EXISTS idx_pendaftaran_status ON public.pendaftaran (status);
CREATE INDEX IF NOT EXISTS idx_pendaftaran_nim_email ON public.pendaftaran (nim, email);
CREATE INDEX IF NOT EXISTS idx_universitas_pks_status ON public.universitas_pks (status, tanggal_berakhir);
CREATE INDEX IF NOT EXISTS idx_media_edit_history_asset ON public.media_edit_history (asset_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_revoked_sessions_expires ON public.revoked_sessions (expires_at);

-- =============================================================================
-- AUTOMATIC updated_at TRIGGER FUNCTION
-- =============================================================================
CREATE OR REPLACE FUNCTION public.ajinomoto_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'users',
    'user_profiles',
    'media_assets',
    'lowongan',
    'mahasiswa',
    'pendaftaran',
    'universitas_pks',
    'system_settings'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I;', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.ajinomoto_touch_updated_at();',
      tbl,
      tbl
    );
  END LOOP;
END $$;

-- =============================================================================
-- SUPABASE REALTIME PUBLICATION (Otomatis Terupdate Real-Time)
-- =============================================================================
DO $$
DECLARE
  tbl TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH tbl IN ARRAY ARRAY[
      'users',
      'user_profiles',
      'media_assets',
      'lowongan',
      'mahasiswa',
      'pendaftaran',
      'absensi',
      'evaluasi',
      'universitas_pks',
      'system_settings'
    ]
    LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = tbl
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', tbl);
      END IF;
    END LOOP;
  END IF;
END $$;
