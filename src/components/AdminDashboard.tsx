import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Bot,
  Briefcase,
  CalendarCheck,
  Command,
  FileText,
  GraduationCap,
  Image as ImageIcon,
  Keyboard,
  LogOut,
  Maximize2,
  Menu,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Share2,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { useAppPreferences } from '../contexts/AppPreferencesContext';
import { apiRequest, getCachedApiResponse, prefetchApiGet, setAdminToken, setFirebaseIdToken } from '../lib/api';
import { auth } from '../lib/firebase';
import { localizeAccountRole } from '../lib/localizeData';
import { useRealtimeSync } from '../lib/realtime';
import type { DashboardStatsResponse } from '../types/internship';
import type { AdminUser } from './AdminLogin';
import { ThemeLanguageControls } from './ThemeLanguageControls';
import {
  DatabaseStatusBadge,
  LiveClockPill,
  NotificationsBell,
  SharePortalModal,
  ShortcutsModal,
} from './dashboard/DashboardHeaderTools';
import { EditProfileModal } from './dashboard/EditProfileModal';
import { HrAssistantDrawer } from './dashboard/HrAssistantDrawer';
import { SessionTimeoutModal } from './dashboard/SessionTimeoutModal';
import { TabApplicants } from './dashboard/TabApplicants';
import { TabAttendance } from './dashboard/TabAttendance';
import { TabInterns } from './dashboard/TabInterns';
import { TabMedia } from './dashboard/TabMedia';
import { TabOverview } from './dashboard/TabOverview';
import { TabPks } from './dashboard/TabPks';
import { TabSettings } from './dashboard/TabSettings';
import { TabUsers } from './dashboard/TabUsers';
import { TabVacancies } from './dashboard/TabVacancies';

export type DashboardTab =
  | 'overview'
  | 'attendance'
  | 'interns'
  | 'vacancies'
  | 'pks'
  | 'applicants'
  | 'media'
  | 'users'
  | 'settings';

export const AdminDashboard: React.FC<{
  user: AdminUser;
  onUserUpdated: (user: AdminUser) => void;
  onLoggedOut: (reason?: 'manual' | 'timeout') => void;
  onGoPortal: () => void;
}> = ({ user, onUserUpdated, onLoggedOut, onGoPortal }) => {
  const { lang, t } = useAppPreferences();
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [navBadges, setNavBadges] = useState<{ applicants?: number; pks?: number }>({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const prevSidebarCollapsedRef = useRef<boolean | null>(null);

  const getNativeFullscreenElement = () => {
    const doc = document as Document & { webkitFullscreenElement?: Element | null };
    return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
  };

  const restoreSidebarAfterFullscreen = useCallback(() => {
    if (prevSidebarCollapsedRef.current !== null) {
      setSidebarCollapsed(prevSidebarCollapsedRef.current);
      prevSidebarCollapsedRef.current = null;
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    const rootEl = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    const nativeActive = Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement);

    if (isFullscreen || nativeActive) {
      setIsFullscreen(false);
      restoreSidebarAfterFullscreen();
      if (nativeActive) {
        try {
          if (doc.exitFullscreen) {
            await doc.exitFullscreen();
          } else if (doc.webkitExitFullscreen) {
            await doc.webkitExitFullscreen();
          }
        } catch {
          // ignore browser exit errors
        }
      }
      return;
    }

    prevSidebarCollapsedRef.current = sidebarCollapsed;
    setSidebarCollapsed(true);
    setIsFullscreen(true);

    try {
      if (rootEl.requestFullscreen) {
        await rootEl.requestFullscreen();
      } else if (rootEl.webkitRequestFullscreen) {
        await rootEl.webkitRequestFullscreen();
      }
    } catch {
      // Graceful fallback: keep expanded full-width workspace mode if iframe/browser blocks native fullscreen
    }
  }, [isFullscreen, sidebarCollapsed, restoreSidebarAfterFullscreen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const nativeActive = Boolean(getNativeFullscreenElement());
      if (nativeActive) {
        setIsFullscreen(true);
      } else {
        setIsFullscreen(false);
        restoreSidebarAfterFullscreen();
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      const doc = document as Document & {
        webkitFullscreenElement?: Element | null;
        webkitExitFullscreen?: () => Promise<void> | void;
      };
      if (doc.fullscreenElement || doc.webkitFullscreenElement) {
        try {
          if (doc.exitFullscreen) {
            void doc.exitFullscreen();
          } else if (doc.webkitExitFullscreen) {
            void doc.webkitExitFullscreen();
          }
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, [restoreSidebarAfterFullscreen]);

  const canManageUsers = useMemo(() => {
    const r = (user.role || '').trim().toLowerCase();
    return r === 'hr development admin' || r === 'super admin' || r === 'admin' || r === 'admin sistem';
  }, [user.role]);

  const canManageMedia = useMemo(() => {
    const r = (user.role || '').trim().toLowerCase();
    return canManageUsers || r.includes('admin');
  }, [user.role, canManageUsers]);

  const tabs = useMemo<
    Array<{
      id: DashboardTab;
      label: string;
      desc: string;
      icon: React.ComponentType<{ className?: string }>;
    }>
  >(
    () => {
      const baseTabs: Array<{
        id: DashboardTab;
        label: string;
        desc: string;
        icon: React.ComponentType<{ className?: string }>;
      }> = [
        {
          id: 'overview',
          label: t('Dashboard', 'Dashboard'),
          desc: t('KPI, AI Insight & Evaluasi Talent', 'KPIs, AI Insight & Talent Evaluation'),
          icon: BarChart3,
        },
        {
          id: 'attendance',
          label: t('Tracking Absensi', 'Attendance Tracking'),
          desc: t('Absensi Harian & Anomali GPS', 'Daily Attendance & GPS Anomalies'),
          icon: CalendarCheck,
        },
        {
          id: 'interns',
          label: t('Data Peserta Magang', 'Internship Records'),
          desc: t('Master Peserta & Sertifikat QR', 'Master Roster & QR Certificates'),
          icon: GraduationCap,
        },
        {
          id: 'vacancies',
          label: t('Manajemen Lowongan', 'Vacancy Management'),
          desc: t('Kelola Lowongan MBKM & PKL', 'Manage MBKM & PKL Vacancies'),
          icon: Briefcase,
        },
        {
          id: 'pks',
          label: t('PKS Universitas', 'University MoAs'),
          desc: t('Kontrak Kampus & Reminder H-30', 'Campus Agreements & H-30 Reminders'),
          icon: FileText,
        },
        {
          id: 'applicants',
          label: t('Data Pelamar', 'Applicant Records'),
          desc: t('Seleksi Pelamar & Screening CV', 'Applicant Selection & CV Screening'),
          icon: Users,
        },
      ];

      if (canManageMedia) {
        baseTabs.push({
          id: 'media',
          label: t('Kelola Media & Gambar', 'Media & Banner Manager'),
          desc: t(
            'Upload Gambar Landing Page, Poster & Panduan Magang / PKL',
            'Upload Landing Page Images, Internship & PKL Posters'
          ),
          icon: ImageIcon,
        });
      }

      if (canManageUsers) {
        baseTabs.push({
          id: 'users',
          label: t('Manajemen Pengguna', 'User Management'),
          desc: t(
            'Buat & Kelola Akun Admin, Pimpinan Perusahaan / Dept. / Seksi',
            'Create & Manage Admin, Company & Dept./Section Leader Accounts'
          ),
          icon: ShieldCheck,
        });
      }

      baseTabs.push({
        id: 'settings',
        label: t('Pengaturan Sistem', 'System Settings'),
        desc: t('Tema, Bahasa, Konfigurasi & Log AI', 'Themes, Language, Config & AI Logs'),
        icon: Settings,
      });

      return baseTabs;
    },
    [t, canManageMedia, canManageUsers]
  );

  const applyNavBadgesFromStats = (res?: DashboardStatsResponse | null) => {
    if (res?.actionQueue) {
      setNavBadges({
        applicants: res.actionQueue.pendingApplicants,
        pks: res.actionQueue.expiringOrExpiredPks,
      });
    }
  };

  const refreshNavBadges = () => {
    const cachedStats = getCachedApiResponse<DashboardStatsResponse>('/api/dashboard/stats');
    if (cachedStats) {
      applyNavBadgesFromStats(cachedStats);
      return;
    }
    apiRequest<DashboardStatsResponse>('/api/dashboard/stats')
      .then((res) => applyNavBadgesFromStats(res))
      .catch(() => {});
  };

  useEffect(() => {
    const cachedStats = getCachedApiResponse<DashboardStatsResponse>('/api/dashboard/stats');
    if (cachedStats) {
      applyNavBadgesFromStats(cachedStats);
    }

    const onStatsPrimed = (e: Event) => {
      const detail = (e as CustomEvent<DashboardStatsResponse>).detail;
      if (detail) applyNavBadgesFromStats(detail);
    };
    window.addEventListener('ajinomoto:dashboard-stats-primed', onStatsPrimed);

    // Gently warm up core sidebar tabs in the background after initial overview settles so tab switches are instant (0ms)
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
    const wave1 = window.setTimeout(() => {
      prefetchApiGet(`/api/absensi/harian?tanggal=${encodeURIComponent(today)}`);
      prefetchApiGet('/api/pendaftar');
    }, 350);
    const wave2 = window.setTimeout(() => {
      prefetchApiGet('/api/lowongan/admin');
      prefetchApiGet('/api/pks');
    }, 800);

    return () => {
      window.removeEventListener('ajinomoto:dashboard-stats-primed', onStatsPrimed);
      window.clearTimeout(wave1);
      window.clearTimeout(wave2);
    };
  }, []);

  useRealtimeSync(['pendaftaran', 'universitas_pks', 'all'], () => {
    refreshNavBadges();
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        Boolean(target) &&
        (target?.tagName === 'INPUT' ||
          target?.tagName === 'TEXTAREA' ||
          target?.tagName === 'SELECT' ||
          target?.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
        return;
      }

      if (e.key === 'Escape') {
        setCmdOpen(false);
        setShareOpen(false);
        setShortcutsOpen(false);
        return;
      }

      if (isTyping) return;

      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
        return;
      }

      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const lower = e.key.toLowerCase();
        if (lower === 'f') {
          e.preventDefault();
          void toggleFullscreen();
          return;
        }
        if (lower === 'a') {
          e.preventDefault();
          setAssistantOpen((prev) => !prev);
          return;
        }
        if (lower === 's') {
          e.preventDefault();
          setShareOpen((prev) => !prev);
          return;
        }
        const digit = Number(e.key);
        if (digit >= 1 && digit <= 9 && tabs[digit - 1]) {
          e.preventDefault();
          setActiveTab(tabs[digit - 1].id);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [tabs, toggleFullscreen]);

  const handleLogout = async (reason: 'manual' | 'timeout' = 'manual') => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // proceed with client logout
    }
    try {
      await signOut(auth);
    } catch {
      // ignore firebase signout if corporate-only session
    }
    setAdminToken(null);
    setFirebaseIdToken(null);
    onLoggedOut(reason);
  };

  const activeMeta = tabs.find((tab) => tab.id === activeTab) || tabs[0];
  const ActiveIcon = activeMeta.icon;

  const filteredCmdTabs = tabs.filter((tab) =>
    `${tab.label} ${tab.desc}`.toLowerCase().includes(cmdQuery.trim().toLowerCase())
  );

  return (
    <div className="min-h-screen w-full overflow-x-clip bg-executive-canvas text-slate-900 dark:text-slate-100 flex">
      {/* Desktop Sidebar (Sticky, independent scroll) */}
      <aside
        className={`hidden lg:flex lg:sticky lg:top-0 lg:h-[100dvh] lg:max-h-[100dvh] flex-col border-r border-slate-200/85 bg-theme-sidebar backdrop-blur-md dark:border-slate-800/90 transition-all duration-200 shrink-0 shadow-[1px_0_0_rgba(15,23,42,0.03)] ${
          sidebarCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200/80 px-3.5 py-3.5 dark:border-slate-800/90 shrink-0">
          {!sidebarCollapsed ? (
            <button
              type="button"
              onClick={onGoPortal}
              className="flex items-center gap-2.5 font-display text-sm font-extrabold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap min-w-0"
              title="PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory"
            >
              <span className="flex items-center justify-center rounded-lg bg-white px-1.5 py-0.5 ring-1 ring-slate-200/90 shadow-2xs shrink-0">
                <img
                  src="/assets/aistudio/Logo_Ajinomoto_641a64fc.png"
                  alt="Logo Ajinomoto Indonesia"
                  referrerPolicy="no-referrer"
                  className="h-6 w-auto object-contain"
                />
              </span>
              <span className="truncate">HRD Portal</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onGoPortal}
              className="mx-auto flex h-10 w-10 items-center justify-center shrink-0"
              title="PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory"
            >
              <img
                src="/assets/aistudio/logo_ajiu_crisp.png"
                alt="AJIU Crest"
                referrerPolicy="no-referrer"
                className="h-full w-full object-contain drop-shadow-xs"
              />
            </button>
          )}
          {!sidebarCollapsed && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed((c) => !c)}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors shrink-0"
              title={t('Ciutkan sidebar', 'Collapse sidebar')}
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>
        {sidebarCollapsed && (
          <div className="flex justify-center border-b border-slate-200/70 py-2 dark:border-slate-800/80">
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
              title={t('Perluas sidebar', 'Expand sidebar')}
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </div>
        )}

        <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const countBadge =
              tab.id === 'applicants'
                ? navBadges.applicants
                : tab.id === 'pks'
                  ? navBadges.pks
                  : undefined;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                title={tab.label}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-xs font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'btn-theme-primary font-semibold'
                    : 'text-slate-700 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:bg-slate-800/70'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon className="h-4 w-4 shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">{tab.label}</span>}
                </span>
                {!sidebarCollapsed && typeof countBadge === 'number' && countBadge > 0 && (
                  <span
                    className={`font-mono text-[11px] tabular-nums ${
                      isActive ? 'text-white/90' : 'text-theme-accent font-bold'
                    }`}
                  >
                    {countBadge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-3 dark:border-slate-800 space-y-2 shrink-0 max-h-[45dvh] overflow-y-auto">
          {!sidebarCollapsed && (
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/90 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/70 space-y-2">
              <div className="flex items-center gap-2.5">
                <img
                  src="/assets/aistudio/logo_ajiu_crisp.png"
                  alt="Logo Ajinomoto Indonesia University"
                  referrerPolicy="no-referrer"
                  className="h-10 w-10 object-contain shrink-0 drop-shadow-xs"
                />
                <div className="rounded-md bg-white p-1 ring-1 ring-emerald-200/80 shrink-0">
                  <img
                    src="/assets/aistudio/HSE_8e0164a8.png"
                    alt="Logo Safety First"
                    referrerPolicy="no-referrer"
                    className="h-6 w-auto object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold leading-tight text-slate-800 dark:text-slate-100">
                    Ajinomoto Indonesia University
                  </div>
                </div>
              </div>
              <div className="border-t border-slate-200/70 pt-1.5 text-[10px] font-medium leading-snug text-slate-600 dark:border-slate-700 dark:text-slate-200">
                PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => setProfileModalOpen(true)}
            title={t('Edit Profil Admin', 'Edit Admin Profile')}
            className="flex w-full items-center gap-2.5 rounded-xl p-1.5 text-left hover:bg-slate-100/90 dark:hover:bg-slate-800/70 transition-colors"
          >
            <img
              src={user.avatarUrl || '/assets/images/avatar_hr_admin_1794535891951.jpg'}
              alt={user.namaTampilan}
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.src = '/assets/images/avatar_hr_admin_1794535891951.jpg';
              }}
              className="h-9 w-9 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
            />
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {user.namaTampilan}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-300 truncate">
                  {localizeAccountRole(user.role, lang)}
                </div>
              </div>
            )}
          </button>
          {!sidebarCollapsed && (
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setProfileModalOpen(true)}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                <UserCog className="h-3.5 w-3.5 text-theme-accent shrink-0" />
                {t('Edit Profil', 'Edit Profile')}
              </button>
              <button
                type="button"
                onClick={() => void handleLogout('manual')}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                <LogOut className="h-3.5 w-3.5 shrink-0" />
                {t('Keluar', 'Logout')}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden bg-slate-950/60 overflow-y-auto">
          <div className="w-72 max-w-[85vw] min-h-full overflow-y-auto bg-theme-sidebar p-4 flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-white px-1.5 py-0.5 ring-1 ring-slate-200">
                    <img
                      src="/assets/aistudio/Logo_Ajinomoto_641a64fc.png"
                      alt="Logo Ajinomoto Indonesia"
                      referrerPolicy="no-referrer"
                      className="h-5 w-auto object-contain"
                    />
                  </span>
                  <span className="font-display text-sm font-bold">HRD</span>
                </div>
                <button type="button" onClick={() => setMobileMenuOpen(false)}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              <nav className="mt-3 space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(tab.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium ${
                        activeTab === tab.id
                          ? 'btn-theme-primary'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
            <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setProfileModalOpen(true);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 py-2 text-xs font-semibold dark:border-slate-700"
              >
                <UserCog className="h-3.5 w-3.5 text-theme-accent" />
                {t('Edit Profil', 'Edit Profile')}
              </button>
              <button
                type="button"
                onClick={() => void handleLogout('manual')}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 py-2 text-xs font-semibold dark:border-slate-700"
              >
                <LogOut className="h-3.5 w-3.5" />
                {t('Keluar', 'Logout')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 sm:gap-3 border-b border-slate-200/80 bg-theme-header px-3 py-2.5 sm:px-5 backdrop-blur-md dark:border-slate-800/90">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 shrink-0"
              aria-label={t('Buka menu navigasi', 'Open navigation menu')}
            >
              <Menu className="h-4.5 w-4.5" />
            </button>
            <div className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg icon-theme-plinth shrink-0">
              <ActiveIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10.5px] font-medium text-slate-500 dark:text-slate-300 truncate leading-tight">
                <span className="hidden 2xl:inline">
                  PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory ·{' '}
                </span>
                <span className="2xl:hidden">Mojokerto Factory · </span>
                {activeMeta.label}
              </div>
              <h1 className="font-display text-sm sm:text-base font-extrabold tracking-tight text-slate-900 dark:text-white truncate leading-snug">
                {activeMeta.label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Group 1: Live WIB Clock & Database Activation Status */}
            <LiveClockPill />
            <DatabaseStatusBadge onOpenSettings={() => setActiveTab('settings')} />

            <span
              className="hidden sm:block h-4.5 w-px bg-slate-200/90 dark:bg-slate-700/80 mx-0.5 shrink-0"
              aria-hidden="true"
            />

            {/* Group 2: Share, Shortcuts, Notifications, Quick Jump & AI Assistant */}
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              aria-label={t('Berbagi Tautan & Kode QR', 'Share Link & QR Code')}
              title={t('Akses & Berbagi ke Perangkat Lain (Alt+S)', 'Access & Share to Another Device (Alt+S)')}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/90 bg-white/95 text-slate-600 shadow-2xs hover:border-slate-300 hover:bg-slate-50 hover:text-theme-accent dark:border-slate-700/90 dark:bg-slate-900/95 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800 transition-all shrink-0"
            >
              <Share2 className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setShortcutsOpen(true)}
              aria-label={t('Pintasan Keyboard', 'Keyboard Shortcuts')}
              title={t('Pintasan Keyboard Dashboard (Shift+?)', 'Dashboard Keyboard Shortcuts (Shift+?)')}
              className="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/90 bg-white/95 text-slate-600 shadow-2xs hover:border-slate-300 hover:bg-slate-50 hover:text-theme-accent dark:border-slate-700/90 dark:bg-slate-900/95 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800 transition-all shrink-0"
            >
              <Keyboard className="h-3.5 w-3.5" />
            </button>

            <NotificationsBell onNavigateTab={setActiveTab} />

            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              className="hidden 2xl:inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200/90 bg-white/95 px-2.5 text-[11px] font-semibold text-slate-600 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
              title={t('Navigasi Cepat (Ctrl+K)', 'Quick Jump (Ctrl+K)')}
            >
              <Command className="h-3.5 w-3.5" />
              <span className="font-mono text-[10px] text-slate-500 dark:text-slate-300">⌘K</span>
            </button>

            <button
              type="button"
              onClick={() => setAssistantOpen(true)}
              title={t('Buka Asisten HR AI (Alt+A)', 'Open HR AI Assistant (Alt+A)')}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg btn-theme-primary px-2.5 text-[11px] font-semibold whitespace-nowrap shrink-0"
            >
              <Bot className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden xl:inline">{t('Asisten HR', 'HR Assistant')}</span>
            </button>

            <span
              className="hidden sm:block h-4.5 w-px bg-slate-200/90 dark:bg-slate-700/80 mx-0.5 shrink-0"
              aria-hidden="true"
            />

            {/* Group 3: Language, Theme & Timeout, Full Screen, Profile */}
            <ThemeLanguageControls variant="compact" align="right" showSessionTimeout />

            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              aria-pressed={isFullscreen}
              aria-label={
                isFullscreen
                  ? t('Keluar dari Mode Layar Penuh', 'Exit Full Screen Mode')
                  : t('Masuk Mode Layar Penuh', 'Enter Full Screen Mode')
              }
              title={
                isFullscreen
                  ? t('Keluar dari Mode Layar Penuh (ESC / Alt+F)', 'Exit Full Screen Mode (ESC / Alt+F)')
                  : t('Mode Layar Penuh Semua Tab (Alt+F)', 'Full Screen Mode All Tabs (Alt+F)')
              }
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2 sm:px-2.5 text-[11px] font-semibold shadow-2xs transition-all whitespace-nowrap shrink-0 ${
                isFullscreen
                  ? 'border-theme-accent bg-theme-soft text-theme-accent ring-1 ring-[var(--theme-accent-soft-border)] hover:opacity-90'
                  : 'border-slate-200/90 bg-white/95 text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700/90 dark:bg-slate-900/95 dark:text-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-800'
              }`}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">{t('Keluar', 'Exit')}</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-3.5 w-3.5 text-theme-accent shrink-0" />
                  <span className="hidden 2xl:inline">{t('Layar Penuh', 'Full Screen')}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setProfileModalOpen(true)}
              title={`${user.namaTampilan} · ${t('Edit Profil HR Admin', 'Edit HR Admin Profile')}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200/90 bg-white/95 px-1.5 text-[11px] font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              <img
                src={user.avatarUrl || '/assets/images/avatar_hr_admin_1794535891951.jpg'}
                alt={user.namaTampilan}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.src = '/assets/images/avatar_hr_admin_1794535891951.jpg';
                }}
                className="h-5.5 w-5.5 rounded-full object-cover shrink-0"
              />
              <span className="hidden 2xl:inline max-w-[96px] truncate pr-1">{user.namaTampilan}</span>
            </button>
          </div>
        </header>

        {/* Tab Body */}
        <main
          className={`flex-1 min-w-0 p-3 sm:p-6 w-full mx-auto transition-[max-width] duration-200 ${
            isFullscreen ? 'max-w-none' : 'max-w-[1520px] 2xl:max-w-[1720px]'
          }`}
        >
          <div key={activeTab} className="tab-panel-enter">
            {activeTab === 'overview' && (
              <TabOverview
                onOpenAssistant={() => setAssistantOpen(true)}
                onNavigateTab={(tab) => setActiveTab(tab)}
              />
            )}
            {activeTab === 'attendance' && <TabAttendance />}
            {activeTab === 'interns' && <TabInterns />}
            {activeTab === 'vacancies' && <TabVacancies />}
            {activeTab === 'pks' && <TabPks />}
            {activeTab === 'applicants' && <TabApplicants />}
            {activeTab === 'media' && canManageMedia && <TabMedia />}
            {activeTab === 'users' && canManageUsers && <TabUsers currentUser={user} />}
            {activeTab === 'settings' && <TabSettings onLogout={() => void handleLogout('manual')} />}
          </div>
        </main>
      </div>

      <HrAssistantDrawer open={assistantOpen} onClose={() => setAssistantOpen(false)} />

      <EditProfileModal
        open={profileModalOpen}
        user={user}
        onClose={() => setProfileModalOpen(false)}
        onSaved={onUserUpdated}
      />

      <SessionTimeoutModal
        onTimeoutLogout={() => handleLogout('timeout')}
        onManualLogout={() => handleLogout('manual')}
      />

      <SharePortalModal open={shareOpen} onClose={() => setShareOpen(false)} />

      <ShortcutsModal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        onOpenCommandPalette={() => setCmdOpen(true)}
        onToggleFullscreen={() => void toggleFullscreen()}
        onOpenAssistant={() => setAssistantOpen(true)}
        onOpenShare={() => setShareOpen(true)}
        tabs={tabs}
        onNavigateTab={setActiveTab}
      />

      {/* Command Palette (Ctrl/Cmd + K) */}
      {cmdOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center modal-backdrop pt-[min(6rem,10vh)] p-3 sm:p-4 overflow-y-auto">
          <div className="surface-card w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <div className="flex items-center border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <Command className="h-4 w-4 text-slate-500 dark:text-slate-300 mr-2.5" />
              <input
                type="text"
                autoFocus
                value={cmdQuery}
                onChange={(e) => setCmdQuery(e.target.value)}
                placeholder={t('Ketik nama tab atau fitur dashboard...', 'Type tab name or dashboard feature...')}
                className="flex-1 bg-transparent text-xs text-slate-900 dark:text-white outline-none"
              />
              <button type="button" onClick={() => setCmdOpen(false)} className="text-xs text-slate-500 dark:text-slate-300">
                ESC
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto p-2 space-y-1">
              {filteredCmdTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id);
                      setCmdOpen(false);
                      setCmdQuery('');
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Icon className="h-4 w-4 text-theme-accent shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white">{tab.label}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-300">{tab.desc}</div>
                    </div>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setCmdOpen(false);
                  setProfileModalOpen(true);
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <UserCog className="h-4 w-4 text-theme-accent shrink-0" />
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">{t('Edit Profil HR Admin', 'Edit HR Admin Profile')}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-300">
                    {t('Ubah nama, jabatan, kontak, foto & password', 'Update name, title, contact, photo & password')}
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCmdOpen(false);
                  setAssistantOpen(true);
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Bot className="h-4 w-4 text-theme-accent shrink-0" />
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">{t('Buka Asisten HR (AI)', 'Open HR Assistant (AI)')}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-300">
                    {t('Tanya jawab data operasional', 'Ask operational HR questions')}
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
