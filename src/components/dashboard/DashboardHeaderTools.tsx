import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  AlertTriangle,
  Bell,
  CalendarCheck,
  Check,
  Clock,
  Copy,
  Database,
  Download,
  FileText,
  Globe,
  Keyboard,
  MonitorSmartphone,
  QrCode,
  RefreshCw,
  Share2,
  ShieldCheck,
  Smartphone,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { apiRequest, getCachedApiResponse } from '../../lib/api';
import { useRealtimeSync } from '../../lib/realtime';
import type { DashboardStatsResponse } from '../../types/internship';
import type { DashboardTab } from '../AdminDashboard';

interface DbHealthStatus {
  ok: boolean;
  dbConnected?: boolean;
  provider?: string;
  hostLabel?: string;
  sslEnabled?: boolean;
  serverTime?: string | null;
  userAccountsCount?: number;
  error?: string;
}

function formatWibClock(date: Date): string {
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
  return `${formatted} WIB`;
}

function formatWibDateLabel(date: Date, lang: 'id' | 'en'): string {
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/* ==================== 1. LIVE CLOCK (WIB) ==================== */
export const LiveClockPill: React.FC = () => {
  const { lang } = useAppPreferences();
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const clockStr = formatWibClock(now);
  const dateLabel = formatWibDateLabel(now, lang);

  return (
    <div
      title={dateLabel}
      className="hidden md:inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200/90 bg-white/95 px-2.5 text-[11px] font-semibold text-slate-700 shadow-2xs dark:border-slate-700/90 dark:bg-slate-900/95 dark:text-slate-100 whitespace-nowrap shrink-0 select-none"
    >
      <Clock className="h-3.5 w-3.5 text-theme-accent shrink-0" />
      <span className="font-mono tabular-nums tracking-tight">{clockStr}</span>
    </div>
  );
};

/* ==================== 2. DATABASE ACTIVATION / SYNC STATUS ==================== */
export const DatabaseStatusBadge: React.FC<{
  onOpenSettings: () => void;
}> = ({ onOpenSettings }) => {
  const { lang, t } = useAppPreferences();
  const [status, setStatus] = useState<'checking' | 'connected' | 'syncing' | 'error'>('checking');
  const [health, setHealth] = useState<DbHealthStatus | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const checkHealth = useCallback(async (showSyncingState = false) => {
    if (showSyncingState) setStatus('syncing');
    try {
      const res = await apiRequest<DbHealthStatus>('/api/health?db=1');
      setHealth(res);
      setLastChecked(new Date());
      setStatus(res?.ok && res?.dbConnected ? 'connected' : 'error');
    } catch (err) {
      setHealth({
        ok: false,
        dbConnected: false,
        error: err instanceof Error ? err.message : 'Database unreachable',
      });
      setLastChecked(new Date());
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void checkHealth(false);
    const intervalId = window.setInterval(() => {
      void checkHealth(false);
    }, 60_000);

    let syncTimer: number | undefined;
    const onMutated = () => {
      setStatus((prev) => (prev === 'error' ? prev : 'syncing'));
      window.clearTimeout(syncTimer);
      syncTimer = window.setTimeout(() => {
        setStatus((prev) => (prev === 'syncing' ? 'connected' : prev));
        setLastChecked(new Date());
      }, 900);
    };

    window.addEventListener('ajinomoto:mutated', onMutated);
    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(syncTimer);
      window.removeEventListener('ajinomoto:mutated', onMutated);
    };
  }, [checkHealth]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const badgeTone =
    status === 'connected'
      ? 'border-emerald-300/80 bg-emerald-50/90 text-emerald-800 hover:bg-emerald-100/80 dark:border-emerald-700/70 dark:bg-emerald-950/55 dark:text-emerald-200 dark:hover:bg-emerald-900/60'
      : status === 'error'
        ? 'border-red-300/80 bg-red-50/90 text-red-800 hover:bg-red-100/80 dark:border-red-800/70 dark:bg-red-950/60 dark:text-red-200 dark:hover:bg-red-900/60'
        : 'border-amber-300/80 bg-amber-50/90 text-amber-800 hover:bg-amber-100/80 dark:border-amber-700/70 dark:bg-amber-950/55 dark:text-amber-200 dark:hover:bg-amber-900/60';

  const dotColor =
    status === 'connected'
      ? 'bg-emerald-500'
      : status === 'error'
        ? 'bg-red-500'
        : 'bg-amber-500 animate-pulse';

  const labelText =
    status === 'connected'
      ? t('DB Aktif', 'DB Active')
      : status === 'error'
        ? t('DB Terputus', 'DB Offline')
        : t('Sinkronisasi...', 'Syncing...');

  const providerShort =
    health?.provider?.includes('Supabase')
      ? 'Supabase'
      : health?.provider?.includes('Cloud SQL')
        ? 'Cloud SQL'
        : 'PostgreSQL';

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={t('Status Aktivasi & Koneksi Database PostgreSQL', 'PostgreSQL Database Activation & Connection Status')}
        className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2 sm:px-2.5 text-[11px] font-semibold shadow-2xs transition-all whitespace-nowrap ${badgeTone}`}
      >
        {status === 'syncing' || status === 'checking' ? (
          <RefreshCw className="h-3.5 w-3.5 animate-spin shrink-0" />
        ) : status === 'error' ? (
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <span className={`h-2 w-2 rounded-full shrink-0 ${dotColor}`} />
        )}
        <span className="hidden sm:inline">{labelText}</span>
        {status === 'connected' && (
          <span className="hidden 2xl:inline text-[10px] font-medium opacity-80">· {providerShort}</span>
        )}
        <ShieldCheck className="hidden sm:inline h-3.5 w-3.5 opacity-80 shrink-0" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-76 rounded-2xl border border-slate-200/90 bg-white/98 p-3.5 shadow-2xl backdrop-blur-md dark:border-slate-700/90 dark:bg-[#0D131F]/98 space-y-3">
          <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5 dark:border-slate-800">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg icon-theme-plinth shrink-0">
                <Database className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {t('Status Aktivasi Database', 'Database Activation Status')}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-300 truncate">
                  {health?.provider || 'PostgreSQL'}
                </div>
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                status === 'connected'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200'
                  : status === 'error'
                    ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
              {labelText}
            </span>
          </div>

          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 dark:text-slate-400">{t('Host Database', 'Database Host')}</span>
              <span className="font-mono text-[10.5px] font-semibold text-slate-800 dark:text-slate-100 truncate max-w-[155px]">
                {health?.hostLabel || '-'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 dark:text-slate-400">{t('Enkripsi SSL/TLS', 'SSL/TLS Encryption')}</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                {health?.sslEnabled ? t('Aktif (Terverifikasi)', 'Active (Verified)') : t('Jaringan Internal', 'Internal Network')}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 dark:text-slate-400">{t('Pemeriksaan Terakhir', 'Last Checked')}</span>
              <span className="font-mono text-[10.5px] tabular-nums text-slate-700 dark:text-slate-200">
                {lastChecked ? formatWibClock(lastChecked) : '-'}
              </span>
            </div>
            {typeof health?.userAccountsCount === 'number' && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">{t('Akun Terdaftar', 'Registered Accounts')}</span>
                <span className="font-mono font-bold tabular-nums text-slate-800 dark:text-slate-100">
                  {health.userAccountsCount}
                </span>
              </div>
            )}
          </div>

          {status === 'error' && health?.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-[11px] leading-snug text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
              {health.error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => void checkHealth(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <RefreshCw className={`h-3 w-3 ${status === 'syncing' ? 'animate-spin' : ''}`} />
              {t('Cek Ulang', 'Re-check')}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenSettings();
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg btn-theme-primary px-2.5 py-1.5 text-[11px] font-semibold"
            >
              <Database className="h-3 w-3" />
              {lang === 'en' ? 'DB Details' : 'Detail DB'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ==================== 3. OPERATIONAL NOTIFICATIONS BELL ==================== */
export const NotificationsBell: React.FC<{
  onNavigateTab: (tab: DashboardTab) => void;
}> = ({ onNavigateTab }) => {
  const { t } = useAppPreferences();
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<DashboardStatsResponse | null>(
    () => getCachedApiResponse<DashboardStatsResponse>('/api/dashboard/stats') ?? null
  );
  const containerRef = useRef<HTMLDivElement | null>(null);

  const loadStats = useCallback(() => {
    const cached = getCachedApiResponse<DashboardStatsResponse>('/api/dashboard/stats');
    if (cached) {
      setStats(cached);
      return;
    }
    apiRequest<DashboardStatsResponse>('/api/dashboard/stats')
      .then((res) => setStats(res))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadStats();
    const onPrimed = (e: Event) => {
      const detail = (e as CustomEvent<DashboardStatsResponse>).detail;
      if (detail) setStats(detail);
    };
    window.addEventListener('ajinomoto:dashboard-stats-primed', onPrimed);
    return () => window.removeEventListener('ajinomoto:dashboard-stats-primed', onPrimed);
  }, [loadStats]);

  useRealtimeSync(['pendaftaran', 'universitas_pks', 'absensi', 'all'], () => {
    apiRequest<DashboardStatsResponse>('/api/dashboard/stats')
      .then((res) => setStats(res))
      .catch(() => {});
  });

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const alerts = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      desc: string;
      count: number;
      tab: DashboardTab;
      tone: 'amber' | 'red' | 'blue';
      icon: React.ComponentType<{ className?: string }>;
    }> = [];

    const pendingApplicants = stats?.actionQueue?.pendingApplicants ?? 0;
    const expiringPks = stats?.actionQueue?.expiringOrExpiredPks ?? 0;
    const belumAbsen = Math.max(
      0,
      (stats?.kpi?.totalAktif ?? 0) - (stats?.kpi?.kehadiranHariIniCount ?? 0)
    );

    if (pendingApplicants > 0) {
      list.push({
        id: 'applicants',
        title: t('Pelamar Menunggu Seleksi', 'Applicants Awaiting Review'),
        desc: t(
          `${pendingApplicants} berkas pendaftaran MBKM/PKL perlu ditinjau HRD.`,
          `${pendingApplicants} MBKM/PKL applications need HR review.`
        ),
        count: pendingApplicants,
        tab: 'applicants',
        tone: 'blue',
        icon: Users,
      });
    }

    if (expiringPks > 0) {
      list.push({
        id: 'pks',
        title: t('PKS Universitas Mendekati H-30', 'University MoAs Expiring (H-30)'),
        desc: t(
          `${expiringPks} kontrak kerja sama kampus perlu tindak lanjut perpanjangan.`,
          `${expiringPks} campus agreements require renewal follow-up.`
        ),
        count: expiringPks,
        tab: 'pks',
        tone: 'red',
        icon: FileText,
      });
    }

    if (belumAbsen > 0) {
      list.push({
        id: 'attendance',
        title: t('Peserta Belum Absen Hari Ini', 'Interns Not Checked In Today'),
        desc: t(
          `${belumAbsen} peserta aktif belum tercatat masuk/pulang hari ini.`,
          `${belumAbsen} active interns have no attendance record today.`
        ),
        count: belumAbsen,
        tab: 'attendance',
        tone: 'amber',
        icon: CalendarCheck,
      });
    }

    return list;
  }, [stats, t]);

  const totalCount = alerts.reduce((sum, item) => sum + item.count, 0);
  const badgeLabel = totalCount > 9 ? '9+' : String(totalCount);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t('Notifikasi Operasional HRD', 'HR Operational Notifications')}
        title={t('Notifikasi & Antrean Tindak Lanjut HRD', 'HR Action Queue & Notifications')}
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/90 bg-white/95 text-slate-600 shadow-2xs hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700/90 dark:bg-slate-900/95 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800 transition-all"
      >
        <Bell className="h-3.5 w-3.5" />
        {totalCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-theme-accent px-1 font-mono text-[9.5px] font-bold leading-none text-white ring-2 ring-white dark:ring-slate-900 tabular-nums">
            {badgeLabel}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-2xl border border-slate-200/90 bg-white/98 p-3.5 shadow-2xl backdrop-blur-md dark:border-slate-700/90 dark:bg-[#0D131F]/98 space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                {t('Notifikasi Operasional', 'Operational Alerts')}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-300">
                {t('Klik item untuk langsung membuka tab terkait', 'Click an item to jump directly to its tab')}
              </div>
            </div>
            {totalCount > 0 && (
              <span className="rounded-md bg-theme-soft px-2 py-0.5 font-mono text-[10.5px] font-bold text-theme-accent tabular-nums">
                {totalCount}
              </span>
            )}
          </div>

          {alerts.length === 0 ? (
            <div className="py-5 text-center space-y-1.5">
              <Check className="mx-auto h-5 w-5 text-emerald-500" />
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                {t('Semua Operasional Terkendali', 'All Operations On Track')}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-300">
                {t('Tidak ada antrean mendesak saat ini.', 'No urgent pending items right now.')}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {alerts.map((item) => {
                const Icon = item.icon;
                const iconStyle =
                  item.tone === 'red'
                    ? 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-300'
                    : item.tone === 'amber'
                      ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300'
                      : 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300';
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onNavigateTab(item.tab);
                    }}
                    className="flex w-full items-start gap-2.5 rounded-xl border border-slate-200/70 bg-slate-50/70 p-2.5 text-left hover:border-slate-300 hover:bg-slate-100/80 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700 dark:hover:bg-slate-800/80 transition-colors"
                  >
                    <div className={`flex h-7 w-7 items-center justify-center rounded-lg shrink-0 ${iconStyle}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {item.title}
                        </span>
                        <span className="font-mono text-[11px] font-bold text-theme-accent tabular-nums shrink-0">
                          {item.count}
                        </span>
                      </div>
                      <p className="text-[11px] leading-snug text-slate-600 dark:text-slate-300 mt-0.5">
                        {item.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ==================== 4. ACCESS & SHARE TO ANOTHER DEVICE MODAL ==================== */
type ShareTargetKey = 'portal' | 'absensi' | 'mbkm' | 'pkl' | 'dashboard';

export const SharePortalModal: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  const { lang, t } = useAppPreferences();
  const [modalTab, setModalTab] = useState<'qr' | 'summary'>('qr');
  const [target, setTarget] = useState<ShareTargetKey>('portal');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [stats, setStats] = useState<DashboardStatsResponse | null>(
    () => getCachedApiResponse<DashboardStatsResponse>('/api/dashboard/stats') ?? null
  );
  const [loadingStats, setLoadingStats] = useState(false);

  const shareTargets = useMemo<Array<{ key: ShareTargetKey; label: string; hash: string }>>(
    () => [
      { key: 'portal', label: t('Portal Utama', 'Main Portal'), hash: '' },
      { key: 'absensi', label: t('Kios Absensi GPS', 'GPS Attendance'), hash: '#absensi' },
      { key: 'mbkm', label: t('Form MBKM', 'MBKM Form'), hash: '#formmbkm' },
      { key: 'pkl', label: t('Form PKL', 'PKL Form'), hash: '#formpkl' },
      { key: 'dashboard', label: t('Login HRD', 'HRD Login'), hash: '#login' },
    ],
    [t]
  );

  const shareUrl = useMemo(() => {
    const base =
      typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname.replace(/\/+$/, '')}`
        : 'https://ajinomotointernshipprogram.vercel.app';
    const selected = shareTargets.find((item) => item.key === target);
    return `${base}${selected?.hash || ''}`;
  }, [shareTargets, target]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    QRCode.toDataURL(shareUrl, {
      width: 280,
      margin: 2,
      color: { dark: '#0F172A', light: '#FFFFFF' },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [open, shareUrl]);

  const refreshSummaryStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const res = await apiRequest<DashboardStatsResponse>('/api/dashboard/stats');
      setStats(res);
    } catch {
      // keep cached stats
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (!stats) {
      void refreshSummaryStats();
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, stats, refreshSummaryStats, onClose]);

  const summaryText = useMemo(() => {
    const today = stats?.todayDate || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
    const nowTime = formatWibClock(new Date());
    const kpi = stats?.kpi;
    const aq = stats?.actionQueue;

    if (lang === 'en') {
      return [
        `PT AJINOMOTO INDONESIA - PT AJINEX INTERNATIONAL, MOJOKERTO FACTORY`,
        `Internship Program Executive Summary (${today} · ${nowTime})`,
        `--------------------------------------------------`,
        `• Active Interns Total : ${kpi?.totalAktif ?? 0} (MBKM: ${kpi?.mbkmAktif ?? 0} | PKL: ${kpi?.pklAktif ?? 0})`,
        `• Attendance Today     : ${kpi?.kehadiranHariIniCount ?? 0} (${kpi?.kehadiranHariIniRate ?? 0}%)`,
        `• Talent Pool (≥30/40) : ${kpi?.talentPoolCount ?? 0} interns`,
        `• Pending Applicants   : ${aq?.pendingApplicants ?? 0}`,
        `• Expiring MoAs (H-30) : ${aq?.expiringOrExpiredPks ?? kpi?.pksMendekatiH30 ?? 0}`,
        `--------------------------------------------------`,
        `Live Portal URL: ${shareUrl}`,
      ].join('\n');
    }

    return [
      `PT AJINOMOTO INDONESIA - PT AJINEX INTERNATIONAL, MOJOKERTO FACTORY`,
      `Ringkasan Eksekutif Program Magang (${today} · ${nowTime})`,
      `--------------------------------------------------`,
      `• Total Peserta Aktif  : ${kpi?.totalAktif ?? 0} orang (MBKM: ${kpi?.mbkmAktif ?? 0} | PKL: ${kpi?.pklAktif ?? 0})`,
      `• Kehadiran Hari Ini   : ${kpi?.kehadiranHariIniCount ?? 0} orang (${kpi?.kehadiranHariIniRate ?? 0}%)`,
      `• Talent Pool (≥30/40) : ${kpi?.talentPoolCount ?? 0} peserta`,
      `• Pelamar Pending      : ${aq?.pendingApplicants ?? 0} berkas`,
      `• PKS Mendekati H-30   : ${aq?.expiringOrExpiredPks ?? kpi?.pksMendekatiH30 ?? 0} kampus`,
      `--------------------------------------------------`,
      `Tautan Portal Live: ${shareUrl}`,
    ].join('\n');
  }, [stats, lang, shareUrl]);

  if (!open) return null;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedUrl(true);
      window.setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopiedSummary(true);
      window.setTimeout(() => setCopiedSummary(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `QR_Ajinomoto_Internship_${target}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-portal-title"
    >
      <div className="surface-card w-full max-w-xl overflow-hidden shadow-2xl border border-slate-200/90 dark:border-slate-700/80 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl icon-theme-plinth shrink-0">
              <Share2 className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <h2
                id="share-portal-title"
                className="font-display text-base font-extrabold tracking-tight text-slate-900 dark:text-white truncate"
              >
                {t('Akses & Berbagi ke Perangkat Lain', 'Access & Share to Another Device')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-300 truncate">
                {t('Tautan Online, Kode QR, dan Ringkasan Data Magang', 'Online Link, QR Code, and Internship Data Summary')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Tutup', 'Close')}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white transition-colors shrink-0"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[75dvh] overflow-y-auto">
          {/* 2-Tab Switcher */}
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100/90 p-1 dark:bg-slate-900/90 border border-slate-200/70 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setModalTab('qr')}
              className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-all ${
                modalTab === 'qr'
                  ? 'bg-white text-theme-accent shadow-xs ring-1 ring-slate-200/80 dark:bg-slate-800 dark:text-white dark:ring-slate-700'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <QrCode className="h-3.5 w-3.5 shrink-0" />
              {t('Tautan Web & Kode QR', 'Web Link & QR Code')}
            </button>
            <button
              type="button"
              onClick={() => setModalTab('summary')}
              className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-all ${
                modalTab === 'summary'
                  ? 'bg-white text-theme-accent shadow-xs ring-1 ring-slate-200/80 dark:bg-slate-800 dark:text-white dark:ring-slate-700'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <FileText className="h-3.5 w-3.5 shrink-0" />
              {t('Ringkasan Teks Data', 'Data Summary Text')}
            </button>
          </div>

          {modalTab === 'qr' ? (
            <>
              {/* Quick Destination Selector */}
              <div className="flex flex-wrap items-center gap-1.5">
                {shareTargets.map((item) => {
                  const active = target === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setTarget(item.key)}
                      className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                        active
                          ? 'border-theme-accent bg-theme-soft text-theme-accent'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {/* QR Code Card */}
              <div className="rounded-2xl border border-slate-200/90 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60 flex flex-col sm:flex-row items-center gap-5">
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className="rounded-2xl bg-white p-2.5 shadow-sm ring-1 ring-slate-200/90">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="QR Code Portal Ajinomoto Internship"
                        className="h-36 w-36 object-contain"
                      />
                    ) : (
                      <div className="h-36 w-36 flex items-center justify-center text-xs text-slate-400">
                        QR...
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadQr}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 hover:text-theme-accent dark:text-slate-300 dark:hover:text-white transition-colors"
                  >
                    <Download className="h-3 w-3" />
                    {t('Unduh QR (PNG)', 'Download QR (PNG)')}
                  </button>
                </div>

                <div className="space-y-2.5 text-center sm:text-left min-w-0">
                  <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300/80 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:border-emerald-700/70 dark:bg-emerald-950/50 dark:text-emerald-300">
                    <Smartphone className="h-3.5 w-3.5 shrink-0" />
                    {t('Scan via Kamera HP / Tablet', 'Scan via Mobile / Tablet Camera')}
                  </div>
                  <h3 className="font-display text-sm font-extrabold text-slate-900 dark:text-white">
                    {t('Buka Langsung di Smartphone atau Perangkat Lain', 'Open Directly on Smartphone or Another Device')}
                  </h3>
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {t(
                      'Arahkan kamera smartphone ke Kode QR di samping untuk langsung membuka portal Program Magang PT Ajinomoto Indonesia tanpa perlu instalasi aplikasi tambahan.',
                      'Point your smartphone camera at the QR Code to instantly open the PT Ajinomoto Indonesia Internship Portal without installing any extra app.'
                    )}
                  </p>
                </div>
              </div>

              {/* Live Public Web Link */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100">
                    <Globe className="h-3.5 w-3.5 text-theme-accent" />
                    {t('Tautan Web Publik Aktif', 'Live Public Web Link')}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t('Dapat Diakses Kapan Saja', 'Accessible Anytime')}
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white p-1.5 pl-3 dark:border-slate-700 dark:bg-slate-900">
                  <span className="flex-1 truncate font-mono text-xs text-slate-800 dark:text-slate-100 select-all">
                    {shareUrl}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className="inline-flex items-center gap-1.5 rounded-lg btn-theme-primary px-3 py-1.5 text-xs font-semibold shrink-0"
                  >
                    {copiedUrl ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedUrl ? t('Tersalin!', 'Copied!') : t('Salin URL', 'Copy URL')}
                  </button>
                </div>
              </div>

              {/* Multi-device Tips */}
              <div className="rounded-xl border border-amber-200/90 bg-amber-50/75 p-3.5 dark:border-amber-800/60 dark:bg-amber-950/30 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                  <MonitorSmartphone className="h-3.5 w-3.5 shrink-0" />
                  {t('Tips Akses Multi-Perangkat & Berbagi:', 'Multi-Device Access & Sharing Tips:')}
                </div>
                <ul className="space-y-1 text-[11.5px] leading-relaxed text-amber-900/90 dark:text-amber-100/85 list-disc pl-4">
                  <li>
                    <span className="font-semibold">{t('Akses Perangkat Lain:', 'Other Device Access:')}</span>{' '}
                    {t(
                      'Bagikan tautan di atas via WhatsApp/Email ke rekan HR atau mahasiswa. Tampilan otomatis responsif di PC, laptop, iPad, dan smartphone.',
                      'Share the link above via WhatsApp/Email with HR colleagues or interns. Fully responsive across PC, laptop, iPad, and smartphone.'
                    )}
                  </li>
                  <li>
                    <span className="font-semibold">{t('Absensi & Pendaftaran Cepat:', 'Quick Attendance & Registration:')}</span>{' '}
                    {t(
                      'Pilih tombol tujuan di atas untuk membuat QR khusus Kios Absensi GPS atau Formulir MBKM/PKL lalu unduh sebagai gambar PNG.',
                      'Select a destination tab above to generate a dedicated QR code for the GPS Attendance Kiosk or MBKM/PKL forms and download it as PNG.'
                    )}
                  </li>
                </ul>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {t('Ringkasan Siap Kirim (WhatsApp / Email Manajemen)', 'Ready-to-Send Summary (WhatsApp / Management Email)')}
                </div>
                <button
                  type="button"
                  onClick={() => void refreshSummaryStats()}
                  disabled={loadingStats}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <RefreshCw className={`h-3 w-3 ${loadingStats ? 'animate-spin' : ''}`} />
                  {t('Segarkan', 'Refresh')}
                </button>
              </div>
              <pre className="whitespace-pre-wrap break-words rounded-xl border border-slate-200/90 bg-slate-50 p-4 font-mono text-[11.5px] leading-relaxed text-slate-800 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-100 select-all">
                {summaryText}
              </pre>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="inline-flex items-center gap-1.5 rounded-lg btn-theme-primary px-4 py-2 text-xs font-semibold"
                >
                  {copiedSummary ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedSummary ? t('Ringkasan Tersalin!', 'Summary Copied!') : t('Salin Ringkasan Teks', 'Copy Summary Text')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-slate-200/80 px-5 py-3 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            {t('Tutup', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ==================== 5. KEYBOARD SHORTCUTS MODAL ==================== */
export const ShortcutsModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onOpenCommandPalette: () => void;
  onToggleFullscreen: () => void;
  onOpenAssistant: () => void;
  onOpenShare: () => void;
  tabs: Array<{ id: DashboardTab; label: string }>;
  onNavigateTab: (tab: DashboardTab) => void;
}> = ({
  open,
  onClose,
  onOpenCommandPalette,
  onToggleFullscreen,
  onOpenAssistant,
  onOpenShare,
  tabs,
  onNavigateTab,
}) => {
  const { t } = useAppPreferences();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const actionShortcuts = [
    {
      keys: ['Ctrl / ⌘', 'K'],
      label: t('Buka Navigasi Cepat (Command Palette)', 'Open Quick Jump (Command Palette)'),
      run: () => {
        onClose();
        onOpenCommandPalette();
      },
    },
    {
      keys: ['Alt', 'F'],
      label: t('Masuk / Keluar Mode Layar Penuh (Semua Tab)', 'Toggle Full Screen Mode (All Tabs)'),
      run: () => {
        onClose();
        onToggleFullscreen();
      },
    },
    {
      keys: ['Alt', 'A'],
      label: t('Buka Asisten HR (AI Assistant)', 'Open HR Assistant (AI)'),
      run: () => {
        onClose();
        onOpenAssistant();
      },
    },
    {
      keys: ['Alt', 'S'],
      label: t('Buka Berbagi Tautan & Kode QR', 'Open Share Link & QR Code'),
      run: () => {
        onClose();
        onOpenShare();
      },
    },
    {
      keys: ['Shift', '?'],
      label: t('Tampilkan / Tutup Daftar Shortcut', 'Show / Hide Keyboard Shortcuts'),
      run: onClose,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
    >
      <div className="surface-card w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200/90 dark:border-slate-700/80 my-auto">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl icon-theme-plinth shrink-0">
              <Keyboard className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <h2
                id="shortcuts-modal-title"
                className="font-display text-base font-extrabold tracking-tight text-slate-900 dark:text-white"
              >
                {t('Pintasan Keyboard Dashboard', 'Dashboard Keyboard Shortcuts')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-300">
                {t('Gunakan tombol cepat atau klik baris untuk menjalankan langsung', 'Press shortcut keys or click any row to trigger immediately')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Tutup', 'Close')}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white transition-colors"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70dvh] overflow-y-auto">
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('Aksi Cepat Sistem', 'Quick System Actions')}
            </div>
            <div className="space-y-1">
              {actionShortcuts.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.run}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-2 text-left text-xs hover:border-slate-300 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700 dark:hover:bg-slate-800 transition-colors"
                >
                  <span className="font-medium text-slate-800 dark:text-slate-100">{item.label}</span>
                  <span className="flex items-center gap-1 shrink-0">
                    {item.keys.map((k) => (
                      <kbd
                        key={k}
                        className="rounded-md border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-slate-700 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {k}
                      </kbd>
                    ))}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('Pindah Tab Langsung', 'Direct Tab Navigation')}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {tabs.slice(0, 9).map((tab, idx) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    onNavigateTab(tab.id);
                    onClose();
                  }}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/70 bg-white px-2.5 py-1.5 text-left text-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:bg-slate-800 transition-colors"
                >
                  <span className="truncate font-medium text-slate-700 dark:text-slate-200">{tab.label}</span>
                  <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 shrink-0">
                    Alt+{idx + 1}
                  </kbd>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-slate-100/80 px-3 py-2 text-[11px] text-slate-600 dark:bg-slate-900/80 dark:text-slate-300">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span>
              {t(
                'Pintasan otomatis dinonaktifkan saat kursor sedang mengetik di kolom input/formulir.',
                'Shortcuts are automatically paused while typing inside form inputs.'
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end border-t border-slate-200/80 px-5 py-3 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            {t('Tutup', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
};
