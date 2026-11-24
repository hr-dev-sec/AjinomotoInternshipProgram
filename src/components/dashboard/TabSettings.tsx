import React, { useEffect, useState } from 'react';
import {
  Award,
  Bot,
  Briefcase,
  Building2,
  CalendarCheck,
  Check,
  Copy,
  Database,
  Download,
  FileCode2,
  GraduationCap,
  HardDrive,
  Image as ImageIcon,
  KeyRound,
  LogOut,
  Mail,
  MapPin,
  Radio,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sliders,
  UserPlus,
  Users,
} from 'lucide-react';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { apiRequest } from '../../lib/api';
import { exportToExcel } from '../../lib/exports';
import {
  localizeAiFeature,
  localizeAiPromptSummary,
  localizeApiMessage,
  localizeEmailSubject,
  localizeEmailType,
  localizeGender,
  localizeMajor,
  localizeStatus,
  localizeTalent,
} from '../../lib/localizeData';
import { useRealtimeSync } from '../../lib/realtime';
import type { AIAuditLog, EmailNotificationLog, Mahasiswa } from '../../types/internship';
import { AppearanceSettingsPanel } from '../ThemeLanguageControls';

interface LiveTableCounts {
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

interface SystemInfoResponse {
  counts: {
    lowongan: number;
    pendaftaran: number;
    mahasiswa: number;
    absensi: number;
    evaluasi: number;
    universitas: number;
  };
  database?: {
    provider: string;
    engine: string;
    sslEnabled: boolean;
    hostLabel: string;
    localBrowserStorage: boolean;
    localJsonFile: boolean;
    realtimeMode: string;
    connectedClients: number;
    totalTables: number;
    tableCounts: LiveTableCounts | null;
  };
  aiAuditLogs: AIAuditLog[];
  emailLogs: EmailNotificationLog[];
  gasApiUrl: string;
  timezone: string;
  factoryCoords: { lat: number; lng: number; maxRadiusMeters: number };
}

export const TabSettings: React.FC<{
  onLogout: () => void;
}> = ({ onLogout }) => {
  const { lang, t } = useAppPreferences();
  const [info, setInfo] = useState<SystemInfoResponse | null>(null);
  const [gasUrl, setGasUrl] = useState('');
  const [radiusInput, setRadiusInput] = useState<number>(650);
  const [savingRadius, setSavingRadius] = useState(false);
  const [refreshingDb, setRefreshingDb] = useState(false);
  const [downloadingSql, setDownloadingSql] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadInfo = async (silentArg?: unknown) => {
    const silent = silentArg === true;
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await apiRequest<SystemInfoResponse>('/api/system/info');
      setInfo(res);
      setGasUrl(res?.gasApiUrl || '');
      if (res?.factoryCoords?.maxRadiusMeters) {
        setRadiusInput(res.factoryCoords.maxRadiusMeters);
      }
    } catch (err) {
      if (!silent) {
        setError(
          err instanceof Error
            ? localizeApiMessage(err.message, lang)
            : t('Gagal memuat pengaturan sistem.', 'Failed to load system settings.')
        );
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadInfo();
  }, []);

  useRealtimeSync(['all'], () => {
    void loadInfo(true);
  });

  const handleRefreshFromPostgres = async () => {
    setRefreshingDb(true);
    setError('');
    setNotice('');
    try {
      await apiRequest('/api/system/refresh-db', { method: 'POST' });
      await loadInfo(true);
      setNotice(
        t(
          'Seluruh 15 tabel berhasil disinkronkan ulang langsung dari database PostgreSQL dan disiarkan ke seluruh sesi aktif.',
          'All 15 tables were re-synced directly from PostgreSQL and broadcast to all active sessions.'
        )
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? localizeApiMessage(err.message, lang)
          : t('Gagal menyinkronkan ulang dari PostgreSQL.', 'Failed to re-sync from PostgreSQL.')
      );
    } finally {
      setRefreshingDb(false);
    }
  };

  const handleDownloadSupabaseSql = async () => {
    setDownloadingSql(true);
    setError('');
    try {
      const res = await apiRequest<{ fileName: string; sql: string }>('/api/system/supabase-schema');
      const blob = new Blob([res.sql], { type: 'text/sql;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.fileName || 'ajinomoto_internship_supabase_schema.sql';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setNotice(
        t(
          'Skema lengkap 15 tabel Supabase SQL (+ trigger & publikasi Realtime) berhasil diunduh.',
          'Complete 15-table Supabase SQL schema (+ triggers & Realtime publication) downloaded.'
        )
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? localizeApiMessage(err.message, lang)
          : t('Gagal mengunduh skema SQL Supabase.', 'Failed to download Supabase SQL schema.')
      );
    } finally {
      setDownloadingSql(false);
    }
  };

  const handleCopySupabaseSql = async () => {
    setError('');
    try {
      const res = await apiRequest<{ sql: string }>('/api/system/supabase-schema');
      await navigator.clipboard.writeText(res.sql);
      setCopiedSql(true);
      setNotice(
        t(
          'Skema SQL Supabase telah disalin ke clipboard. Tempel langsung di Supabase SQL Editor dan klik Run.',
          'Supabase SQL schema copied to clipboard. Paste directly into Supabase SQL Editor and click Run.'
        )
      );
      setTimeout(() => setCopiedSql(false), 2500);
    } catch (err) {
      setError(
        err instanceof Error
          ? localizeApiMessage(err.message, lang)
          : t('Gagal menyalin skema SQL Supabase.', 'Failed to copy Supabase SQL schema.')
      );
    }
  };

  const handleSyncTalent = async () => {
    setError('');
    try {
      const res = await apiRequest<{ syncedCount: number }>('/api/mahasiswa/sync', { method: 'POST' });
      setNotice(
        t(
          `Sinkronisasi talent selesai untuk ${res.syncedCount} peserta berdasarkan evaluasi terbaru.`,
          `Talent synchronization completed for ${res.syncedCount} interns based on latest evaluations.`
        )
      );
      await loadInfo(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? localizeApiMessage(err.message, lang)
          : t('Gagal menyinkronkan data talent.', 'Failed to synchronize talent data.')
      );
    }
  };

  const handleSaveGasUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await apiRequest('/api/system/gas-url', {
        method: 'PUT',
        body: JSON.stringify({ gasApiUrl: gasUrl }),
      });
      setNotice(
        t(
          'URL Web App Google Apps Script berhasil disimpan pada konfigurasi database.',
          'Google Apps Script Web App URL saved to database configuration.'
        )
      );
      await loadInfo(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? localizeApiMessage(err.message, lang)
          : t('Gagal menyimpan konfigurasi GAS.', 'Failed to save GAS configuration.')
      );
    }
  };

  const handleSaveGeofence = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRadius(true);
    setError('');
    setNotice('');
    try {
      await apiRequest('/api/system/geofence', {
        method: 'PUT',
        body: JSON.stringify({ maxRadiusMeters: radiusInput }),
      });
      setNotice(
        t(
          `Radius geofence valid presensi PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory diperbarui menjadi ${radiusInput} meter.`,
          `Valid attendance geofence radius for PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory updated to ${radiusInput} meters.`
        )
      );
      await loadInfo(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? localizeApiMessage(err.message, lang)
          : t('Gagal memperbarui radius geofence.', 'Failed to update geofence radius.')
      );
    } finally {
      setSavingRadius(false);
    }
  };

  const handleExportFullDatabase = async () => {
    setError('');
    try {
      const mhs = await apiRequest<Mahasiswa[]>('/api/mahasiswa');
      exportToExcel(
        'Database_Master_Magang_Ajinomoto.xlsx',
        t('Mahasiswa', 'Interns'),
        mhs.map((m) => ({
          NIM: m.nim,
          Program: m.program,
          Department: m.department,
          Nama: m.nama,
          Universitas: m.universitas,
          Jurusan: localizeMajor(m.jurusan, lang),
          Tgl_Masuk: m.tglMasuk,
          Tanggal_Berakhir: m.tanggalBerakhir,
          Gender: localizeGender(m.gender, lang),
          Status: localizeStatus(m.status, lang),
          Talent: localizeTalent(m.talent, lang),
          Skor: m.skor,
        }))
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? localizeApiMessage(err.message, lang)
          : t('Gagal mengekspor master Excel.', 'Failed to export master Excel.')
      );
    }
  };

  const handleResetDemo = async () => {
    setError('');
    try {
      await apiRequest('/api/system/reset-seed', { method: 'POST' });
      setNotice(
        t(
          'Database demo berhasil dikembalikan ke data awal PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory.',
          'Demo database successfully restored to initial PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory seed data.'
        )
      );
      await loadInfo(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? localizeApiMessage(err.message, lang)
          : t('Gagal mereset database demo.', 'Failed to reset demo database.')
      );
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <AppearanceSettingsPanel />
        <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-200">
          {t('Memuat pengaturan sistem...', 'Loading system settings...')}
        </div>
      </div>
    );
  }

  if (error && !info) {
    return (
      <div className="space-y-6">
        <AppearanceSettingsPanel />
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200 space-y-3">
          <div>{error}</div>
          <button
            type="button"
            onClick={loadInfo}
            className="inline-flex items-center gap-1.5 rounded-lg btn-theme-primary px-3.5 py-2 text-xs font-semibold"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t('Coba Muat Ulang', 'Retry Reload')}
          </button>
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="space-y-6">
        <AppearanceSettingsPanel />
        <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-200">
          {t('Data konfigurasi sistem belum tersedia.', 'System configuration data is not available.')}
        </div>
      </div>
    );
  }

  const coords = info.factoryCoords ?? { lat: -7.4589, lng: 112.4631, maxRadiusMeters: 650 };
  const counts = info.counts ?? {
    lowongan: 0,
    pendaftaran: 0,
    mahasiswa: 0,
    absensi: 0,
    evaluasi: 0,
    universitas: 0,
  };
  const dbInfo = info.database;
  const tableCounts = dbInfo?.tableCounts;
  const aiAuditLogs = info.aiAuditLogs ?? [];
  const emailLogs = info.emailLogs ?? [];

  const allTablesCatalog = [
    { key: 'users', label: t('Akun Pengguna', 'Users'), icon: Users, count: tableCounts?.users ?? 0 },
    { key: 'user_profiles', label: t('Profil & Preferensi', 'Profiles & Prefs'), icon: ShieldCheck, count: tableCounts?.user_profiles ?? 0 },
    { key: 'profile_change_logs', label: t('Audit Profil', 'Profile Audits'), icon: HardDrive, count: tableCounts?.profile_change_logs ?? 0 },
    { key: 'media_assets', label: t('Aset Media & Banner', 'Media Assets'), icon: ImageIcon, count: tableCounts?.media_assets ?? 0 },
    { key: 'media_edit_history', label: t('Revisi Media', 'Media History'), icon: FileCode2, count: tableCounts?.media_edit_history ?? 0 },
    { key: 'lowongan', label: t('Lowongan Magang', 'Vacancies'), icon: Briefcase, count: tableCounts?.lowongan ?? counts.lowongan },
    { key: 'mahasiswa', label: t('Peserta Magang', 'Intern Roster'), icon: GraduationCap, count: tableCounts?.mahasiswa ?? counts.mahasiswa },
    { key: 'pendaftaran', label: t('Pelamar MBKM/PKL', 'Applicants'), icon: UserPlus, count: tableCounts?.pendaftaran ?? counts.pendaftaran },
    { key: 'absensi', label: t('Absensi Selfie/GPS', 'Attendance'), icon: CalendarCheck, count: tableCounts?.absensi ?? counts.absensi },
    { key: 'evaluasi', label: t('Evaluasi 4 Pilar', 'Evaluations'), icon: Award, count: tableCounts?.evaluasi ?? counts.evaluasi },
    { key: 'universitas_pks', label: t('PKS Universitas', 'University MoAs'), icon: Building2, count: tableCounts?.universitas_pks ?? counts.universitas },
    { key: 'ai_audit_logs', label: t('Log Audit AI', 'AI Audit Logs'), icon: Bot, count: tableCounts?.ai_audit_logs ?? aiAuditLogs.length },
    { key: 'email_logs', label: t('Log Email', 'Email Logs'), icon: Mail, count: tableCounts?.email_logs ?? emailLogs.length },
    { key: 'system_settings', label: t('Konfigurasi Sistem', 'System Settings'), icon: Sliders, count: tableCounts?.system_settings ?? 1 },
    { key: 'revoked_sessions', label: t('Sesi Dicabut', 'Revoked Sessions'), icon: KeyRound, count: tableCounts?.revoked_sessions ?? 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Visual Theme Gallery & Global Language Switcher */}
      <AppearanceSettingsPanel />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
          {notice}
        </div>
      )}

      {/* Full PostgreSQL / Supabase Architecture & Zero-LocalStorage Control Center */}
      <div className="surface-card p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg icon-theme-plinth shrink-0">
                <Database className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                  {t(
                    'Database Terpusat PostgreSQL / Supabase & Sinkronisasi Real-Time (15 Tabel)',
                    'Centralized PostgreSQL / Supabase Database & Real-Time Sync (15 Tables)'
                  )}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-200">
                  {t(
                    '100% data operasional, akun, media, tema, dan bahasa disimpan langsung di PostgreSQL — nol penyimpanan lokal di browser (tanpa localStorage/sessionStorage).',
                    '100% of operational data, user accounts, media assets, theme, and language are stored in PostgreSQL — zero browser local storage.'
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRefreshFromPostgres}
              disabled={refreshingDb}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshingDb ? 'animate-spin' : ''}`} />
              {refreshingDb
                ? t('Menyinkronkan...', 'Syncing...')
                : t('Sinkronkan dari PostgreSQL', 'Re-Sync from PostgreSQL')}
            </button>
            <button
              type="button"
              onClick={handleCopySupabaseSql}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              {copiedSql ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedSql ? t('SQL Disalin', 'SQL Copied') : t('Salin SQL Supabase', 'Copy Supabase SQL')}
            </button>
            <button
              type="button"
              onClick={handleDownloadSupabaseSql}
              disabled={downloadingSql}
              className="inline-flex items-center gap-1.5 rounded-lg btn-theme-primary px-3.5 py-2 text-xs font-semibold disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              {t('Unduh Skema Supabase (.sql)', 'Download Supabase Schema (.sql)')}
            </button>
          </div>
        </div>

        {/* Architecture Guarantees Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/50 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-200">
              <span>{t('Engine Database Aktif', 'Active Database Engine')}</span>
              <Database className="h-3.5 w-3.5 text-theme-accent" />
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {dbInfo?.provider || 'PostgreSQL'}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-200 font-mono">
              {dbInfo?.hostLabel || 'postgresql-managed'} · {dbInfo?.sslEnabled ? 'SSL TLS' : 'Private Pool'}
            </div>
          </div>

          <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-3.5 dark:border-emerald-900/40 dark:bg-emerald-950/20 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              <span>{t('Penyimpanan Lokal Browser', 'Local Browser Storage')}</span>
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />
            </div>
            <div className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
              {t('Nonaktif (0 Data Lokal)', 'Disabled (Zero Local Data)')}
            </div>
            <div className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80">
              {t('Sesi memakai cookie HttpOnly terenkripsi & preferensi di DB', 'Sessions use HttpOnly cookies & preferences live in DB')}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/50 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-200">
              <span>{t('Sinkronisasi Real-Time', 'Real-Time Auto-Update')}</span>
              <Radio className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {t('Aktif Otomatis (SSE Write-Through)', 'Live Active (SSE Write-Through)')}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-200">
              {t(
                'Setiap perubahan langsung tersimpan ke PostgreSQL & terbarui di seluruh layar.',
                'Every change writes directly to PostgreSQL & refreshes all open screens.'
              )}
            </div>
          </div>
        </div>

        {/* Complete 15-Table Live PostgreSQL Inventory */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {allTablesCatalog.map((item) => {
            const TableIcon = item.icon;
            return (
              <div
                key={item.key}
                className="kpi-tile p-3 flex flex-col justify-between gap-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">
                      {item.label}
                    </div>
                    <div className="font-mono text-[10px] text-slate-400 dark:text-slate-300 truncate">{item.key}</div>
                  </div>
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200/80 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700 shrink-0">
                    <TableIcon className="h-3.5 w-3.5" />
                  </div>
                </div>
                <div className="font-display text-xl font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
                  {item.count}
                </div>
              </div>
            );
          })}
        </div>

        {/* Supabase Connection Guide */}
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300 space-y-2">
          <div className="font-semibold text-slate-900 dark:text-slate-100">
            {t(
              'Cara Menghubungkan ke Proyek Supabase Anda Sendiri:',
              'How to Connect Your Own Supabase Project:'
            )}
          </div>
          <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 dark:text-slate-200">
            <li>
              {t(
                'Klik "Salin SQL Supabase" atau "Unduh Skema Supabase (.sql)", lalu jalankan di Supabase Dashboard → SQL Editor (seluruh 15 tabel, indeks, trigger updated_at, dan publikasi supabase_realtime otomatis terbuat).',
                'Click "Copy Supabase SQL" or "Download Supabase Schema (.sql)", then execute it in Supabase Dashboard → SQL Editor (creates all 15 tables, indexes, updated_at triggers, and supabase_realtime publication).'
              )}
            </li>
            <li>
              {t(
                'Atur environment variable server SUPABASE_DB_URL dengan Connection String PostgreSQL dari Supabase (SSL otomatis aktif).',
                'Set the server environment variable SUPABASE_DB_URL to your Supabase PostgreSQL Connection String (SSL is auto-enabled).'
              )}
            </li>
            <li>
              {t(
                'Jika SUPABASE_DB_URL belum diisi, sistem secara otomatis menggunakan database PostgreSQL terkelola bawaan sehingga seluruh fitur tetap berjalan 100% online tanpa penyimpanan lokal.',
                'If SUPABASE_DB_URL is not set, the system seamlessly uses the built-in managed PostgreSQL database so all features remain 100% server-persisted with zero local storage.'
              )}
            </li>
          </ol>
        </div>

        {/* Operational Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/70 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-200">
            {t('Zona waktu standar:', 'Standard timezone:')}{' '}
            <span className="font-mono">{info.timezone || 'Asia/Jakarta'}</span> ·{' '}
            {t('Koordinat Pabrik:', 'Factory Coordinates:')}{' '}
            <span className="font-mono">
              {coords.lat}, {coords.lng} (Radius {coords.maxRadiusMeters} m)
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSyncTalent}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t('Sinkronkan Talent', 'Sync Talent Scores')}
            </button>
            <button
              type="button"
              onClick={handleExportFullDatabase}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              <Download className="h-3.5 w-3.5" />
              {t('Export Master Excel', 'Export Master Excel')}
            </button>
          </div>
        </div>
      </div>

      {/* Geofence Radius Configuration */}
      <form
        onSubmit={handleSaveGeofence}
        className="surface-card p-6 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-theme-accent" />
            <h3 className="font-display text-sm font-bold">
              {t(
                'Konfigurasi Radius Geofence PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory',
                'Geofence Radius Configuration — PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory'
              )}
            </h3>
          </div>
          <span className="font-mono text-xs text-slate-500 dark:text-slate-200">
            {t('Titik Pusat:', 'Center Point:')} {coords.lat}, {coords.lng}
          </span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-200">
          {t(
            'Atur batas radius valid (100 – 5.000 meter) untuk Kios Absensi dan Radar Geofence HR. Perubahan langsung tersimpan di PostgreSQL dan berlaku secara real-time di seluruh portal.',
            'Configure the valid attendance radius (100 – 5,000 meters) for the Attendance Kiosk and HR Geofence Radar. Updates save to PostgreSQL and take effect immediately across the entire portal.'
          )}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={100}
              max={5000}
              step={50}
              required
              value={radiusInput}
              onChange={(e) => setRadiusInput(Number(e.target.value) || 100)}
              className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums input-theme-focus dark:border-slate-700 dark:bg-slate-950"
            />
            <span className="text-xs font-medium text-slate-600 dark:text-slate-200">
              {t('meter', 'meters')}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {[300, 650, 1000, 1500].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setRadiusInput(preset)}
                className={`rounded-md border px-2.5 py-1.5 text-[11px] font-mono font-semibold transition-colors ${
                  radiusInput === preset
                    ? 'border-theme-accent bg-theme-soft text-theme-accent'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {preset} m
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={savingRadius}
            className="sm:ml-auto rounded-lg btn-theme-primary px-4 py-2 text-xs font-semibold disabled:opacity-50 whitespace-nowrap"
          >
            {savingRadius ? t('Menyimpan...', 'Saving...') : t('Simpan Radius Geofence', 'Save Geofence Radius')}
          </button>
        </div>
      </form>

      {/* GAS Bridge Configuration */}
      <form
        onSubmit={handleSaveGasUrl}
        className="surface-card p-6 space-y-3"
      >
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-theme-accent shrink-0" />
          <h3 className="font-display text-sm font-bold">
            {t('Konfigurasi Integrasi Google Apps Script (Opsional)', 'Google Apps Script Integration (Optional)')}
          </h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-200">
          {t(
            'Tautkan URL Web App GAS (`/exec`) apabila Anda menjalankan sinkronisasi hybrid dengan Google Sheets.',
            'Link a GAS Web App URL (`/exec`) if you run hybrid synchronization with Google Sheets.'
          )}
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            value={gasUrl}
            onChange={(e) => setGasUrl(e.target.value)}
            placeholder="https://script.google.com/macros/s/.../exec"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-mono input-theme-focus dark:border-slate-700 dark:bg-slate-950"
          />
          <button
            type="submit"
            className="rounded-lg btn-theme-primary px-4 py-2 text-xs font-semibold whitespace-nowrap"
          >
            {t('Simpan Konfigurasi', 'Save Configuration')}
          </button>
        </div>
      </form>

      {/* Audit Logs: AI & Email */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="surface-card p-5 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg icon-theme-plinth shrink-0">
              <Bot className="h-4 w-4" />
            </div>
            <h3 className="font-display text-sm font-bold">
              {t('Log Audit Pemanggilan AI', 'AI Invocation Audit Logs')}
            </h3>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {aiAuditLogs.length === 0 ? (
              <div className="py-4 text-slate-500 dark:text-slate-200">
                {t('Belum ada log pemanggilan AI.', 'No AI invocation logs recorded yet.')}
              </div>
            ) : (
              aiAuditLogs.map((log) => (
                <div key={log.id} className="py-2.5 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {localizeAiFeature(log.fitur, lang)}
                    </span>
                    <span className={log.status === 'Sukses' ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
                      {localizeStatus(log.status, lang)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-200">
                    {localizeAiPromptSummary(log.ringkasanPrompt, lang)}
                  </div>
                  <div className="font-mono text-[10px] text-slate-400 dark:text-slate-300">
                    {log.timestamp} · {log.adminUser}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="surface-card p-5 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200/80 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700 shrink-0">
              <Mail className="h-4 w-4" />
            </div>
            <h3 className="font-display text-sm font-bold">
              {t('Log Notifikasi Email Otomatis', 'Automated Email Notification Logs')}
            </h3>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {emailLogs.length === 0 ? (
              <div className="py-4 text-slate-500 dark:text-slate-200">
                {t('Belum ada log notifikasi email.', 'No email notification logs yet.')}
              </div>
            ) : (
              emailLogs.map((mail) => (
                <div key={mail.id} className="py-2.5 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {localizeEmailType(mail.jenis, lang)}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400 dark:text-slate-300">{mail.timestamp}</span>
                  </div>
                  <div className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                    {localizeEmailSubject(mail.subjek, lang)}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-200">
                    {t('Kepada:', 'To:')} {mail.kepada}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Actions Footer */}
      <div className="surface-card flex flex-wrap items-center justify-between gap-3 p-4">
        <button
          type="button"
          onClick={handleResetDemo}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {t('Reset Data Demo Awal', 'Restore Initial Seed Data')}
        </button>

        <button
          type="button"
          onClick={onLogout}
          className="inline-flex items-center gap-1.5 rounded-lg btn-theme-primary px-4 py-2 text-xs font-semibold"
        >
          <LogOut className="h-3.5 w-3.5" />
          {t('Keluar dari Sesi Admin', 'Sign Out of Admin Session')}
        </button>
      </div>
    </div>
  );
};
