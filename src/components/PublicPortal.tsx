import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  Briefcase,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Cpu,
  Download,
  Eye,
  FileCheck2,
  FileSearch,
  FileText,
  FlaskConical,
  GraduationCap,
  Leaf,
  MapPin,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useAppPreferences } from '../contexts/AppPreferencesContext';
import { apiRequest } from '../lib/api';
import { localizeApiMessage, localizeStatus, localizeVacancy } from '../lib/localizeData';
import { useRealtimeSync } from '../lib/realtime';
import type { Lowongan, PublicSummary, PublicTrackStatusResponse } from '../types/internship';
import { AttendanceKiosk } from './AttendanceKiosk';
import { EcosystemFlowInfographic, MojokertoGlobalMapInfographic } from './Infographics';
import { RegistrationForms } from './RegistrationForms';
import { ThemeLanguageControls } from './ThemeLanguageControls';

export type PublicRoute = 'landing' | 'index' | 'formmbkm' | 'formpkl' | 'absensi';

function getVacancyIcon(title: string) {
  const t = title.toLowerCase();
  if (t.includes('quality') || t.includes('food')) return FlaskConical;
  if (t.includes('production') || t.includes('automation')) return Cpu;
  if (t.includes('environment') || t.includes('waste')) return Leaf;
  if (t.includes('hr') || t.includes('people')) return UserCheck;
  return Briefcase;
}

export const PublicPortal: React.FC<{
  route: PublicRoute;
  onNavigate: (r: PublicRoute | 'login') => void;
}> = ({ route, onNavigate }) => {
  const { lang, t } = useAppPreferences();

  const [summary, setSummary] = useState<PublicSummary>({
    totalMahasiswaAktif: 0,
    totalUniversitasMitra: 0,
    divisiOpen: 0,
    pksAktif: 0,
    maxRadiusMeters: 650,
  });
  const [vacancies, setVacancies] = useState<Lowongan[]>([]);
  const [detailVacancy, setDetailVacancy] = useState<Lowongan | null>(null);
  const [vacancySearch, setVacancySearch] = useState('');
  const [vacancyTrack, setVacancyTrack] = useState<'ALL' | 'TECH' | 'LAB' | 'PEOPLE'>('ALL');

  // Application Status Tracker Modal
  const [trackerOpen, setTrackerOpen] = useState(false);
  const [trackNim, setTrackNim] = useState('');
  const [trackEmail, setTrackEmail] = useState('');
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackError, setTrackError] = useState('');
  const [trackResult, setTrackResult] = useState<PublicTrackStatusResponse | null>(null);

  const [mediaMap, setMediaMap] = useState<
    Record<string, { currentUrl: string; altText?: string; objectPosition?: string; mimeType?: string }>
  >({});
  const [posterPreviewOpen, setPosterPreviewOpen] = useState(false);

  const refreshPublicData = () => {
    apiRequest<PublicSummary>('/api/public/summary').then(setSummary).catch(() => {});
    apiRequest<Lowongan[]>('/api/lowongan').then(setVacancies).catch(() => {});
    apiRequest<{
      media: Record<string, { currentUrl: string; altText?: string; objectPosition?: string; mimeType?: string }>;
    }>('/api/public/media')
      .then((res) => {
        if (res?.media) setMediaMap(res.media);
      })
      .catch(() => {});
  };

  useEffect(() => {
    refreshPublicData();
  }, [route]);

  useRealtimeSync(['lowongan', 'mahasiswa', 'universitas_pks', 'media', 'settings', 'all'], () => {
    refreshPublicData();
  });

  const logoAjinomoto = mediaMap.brand_logo_ajinomoto?.currentUrl || '/assets/aistudio/Logo_Ajinomoto_641a64fc.png';
  const logoAjiu = mediaMap.brand_logo_ajiu?.currentUrl || '/assets/aistudio/logo_ajiu_crisp.png';
  const logoSafety = mediaMap.brand_logo_safety?.currentUrl || '/assets/aistudio/HSE_8e0164a8.png';
  const heroFactoryImg =
    mediaMap.landing_hero?.currentUrl || '/assets/aistudio/grup_ajinomoto_indonesia-dmQw_large_0e1fe3a6.jpeg';
  const mbkmCardImg = mediaMap.portal_mbkm_card?.currentUrl || '/assets/images/ajinomoto_mbkm_lab_real.png';
  const pklCardImg = mediaMap.portal_pkl_card?.currentUrl || '/assets/images/ajinomoto_pkl_production_real.webp';
  const infoPoster = mediaMap.info_poster_pendaftaran?.currentUrl ? mediaMap.info_poster_pendaftaran : null;
  const infoPosterIsPdf = Boolean(
    infoPoster && (infoPoster.currentUrl.startsWith('data:application/pdf') || infoPoster.mimeType === 'application/pdf')
  );

  const localizedVacancies = useMemo(
    () => vacancies.map((v) => localizeVacancy(v, lang)),
    [vacancies, lang]
  );

  const filteredVacancies = useMemo(() => {
    const q = vacancySearch.trim().toLowerCase();
    return localizedVacancies.filter((v, idx) => {
      const raw = vacancies[idx] || v;
      const hay = `${v.namaPosisi} ${v.prodi} ${v.skill} ${v.tugas} ${raw.prodi} ${raw.skill}`.toLowerCase();
      if (
        vacancyTrack === 'LAB' &&
        !hay.includes('pangan') &&
        !hay.includes('food') &&
        !hay.includes('kimia') &&
        !hay.includes('chem') &&
        !hay.includes('quality') &&
        !hay.includes('lingkungan') &&
        !hay.includes('environment')
      ) {
        return false;
      }
      if (
        vacancyTrack === 'TECH' &&
        !hay.includes('mesin') &&
        !hay.includes('mechanical') &&
        !hay.includes('elektro') &&
        !hay.includes('electrical') &&
        !hay.includes('industri') &&
        !hay.includes('automation')
      ) {
        return false;
      }
      if (
        vacancyTrack === 'PEOPLE' &&
        !hay.includes('psikologi') &&
        !hay.includes('psychology') &&
        !hay.includes('hr') &&
        !hay.includes('manajemen') &&
        !hay.includes('human resource')
      ) {
        return false;
      }
      if (q && !hay.includes(q)) return false;
      return true;
    });
  }, [localizedVacancies, vacancies, vacancySearch, vacancyTrack]);

  const handleTrackStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrackLoading(true);
    setTrackError('');
    setTrackResult(null);
    try {
      const res = await apiRequest<PublicTrackStatusResponse>(
        `/api/public/track-status?nim=${encodeURIComponent(trackNim.trim())}&email=${encodeURIComponent(trackEmail.trim())}`
      );
      setTrackResult(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('Gagal melacak status lamaran.', 'Failed to track application status.');
      setTrackError(localizeApiMessage(msg, lang));
    } finally {
      setTrackLoading(false);
    }
  };

  const localizedDetailVacancy = detailVacancy ? localizeVacancy(detailVacancy, lang) : null;

  return (
    <div className="min-h-screen bg-executive-canvas text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Top Bar: Clean 3-zone header with Theme & Language controls */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-theme-header dark:border-slate-800/90 shadow-[0_1px_0_rgba(15,23,42,0.03)]">
        <div className="mx-auto flex max-w-7xl 2xl:max-w-[1440px] items-center justify-between gap-2.5 sm:gap-5 px-3 py-3 sm:px-6 sm:py-3.5">
          <button
            type="button"
            onClick={() => onNavigate('landing')}
            className="flex items-center gap-2 sm:gap-2.5 font-display text-sm sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100 min-w-0"
            title="PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory"
          >
            <span className="flex items-center justify-center rounded-lg bg-white px-1.5 sm:px-2 py-1 ring-1 ring-slate-200/90 shadow-2xs shrink-0">
              <img
                src={logoAjinomoto}
                alt="Logo PT Ajinomoto Indonesia"
                referrerPolicy="no-referrer"
                className="h-5 sm:h-6 w-auto object-contain"
              />
            </span>
            <span className="truncate">Ajinomoto Internship</span>
          </button>

          <nav className="hidden lg:flex items-center gap-6 text-[13px] font-semibold text-slate-600 dark:text-slate-300">
            <button
              type="button"
              onClick={() => onNavigate('landing')}
              className={`relative py-1 hover:text-theme-accent transition-colors whitespace-nowrap shrink-0 ${
                route === 'landing' ? 'text-theme-accent' : ''
              }`}
            >
              {t('Beranda', 'Home')}
              {route === 'landing' && (
                <span className="absolute inset-x-0 -bottom-[15px] h-0.5 bg-theme-accent" />
              )}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('index')}
              className={`relative py-1 hover:text-theme-accent transition-colors whitespace-nowrap shrink-0 ${
                route === 'index' ? 'text-theme-accent' : ''
              }`}
            >
              {t('Portal Program', 'Program Portal')}
              {route === 'index' && (
                <span className="absolute inset-x-0 -bottom-[15px] h-0.5 bg-theme-accent" />
              )}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('formmbkm')}
              className={`relative py-1 hover:text-theme-accent transition-colors whitespace-nowrap shrink-0 ${
                route === 'formmbkm' || route === 'formpkl' ? 'text-theme-accent' : ''
              }`}
            >
              {t('Pendaftaran', 'Registration')}
              {(route === 'formmbkm' || route === 'formpkl') && (
                <span className="absolute inset-x-0 -bottom-[15px] h-0.5 bg-theme-accent" />
              )}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('absensi')}
              className={`relative py-1 hover:text-theme-accent transition-colors whitespace-nowrap shrink-0 ${
                route === 'absensi' ? 'text-theme-accent' : ''
              }`}
            >
              {t('Absensi', 'Attendance')}
              {route === 'absensi' && (
                <span className="absolute inset-x-0 -bottom-[15px] h-0.5 bg-theme-accent" />
              )}
            </button>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <ThemeLanguageControls variant="compact" align="right" />
            <button
              type="button"
              onClick={() => onNavigate('login')}
              className="btn-theme-primary rounded-lg px-3 sm:px-4 py-2 text-xs font-semibold whitespace-nowrap shrink-0"
            >
              {t('Login HR Admin', 'HR Admin Login')}
            </button>
          </div>
        </div>

        {/* Mobile / Tablet sub-nav */}
        <div className="flex lg:hidden items-center justify-around gap-1 overflow-x-auto border-t border-slate-100 bg-white/95 dark:border-slate-800 dark:bg-slate-950/90 px-2 py-2 text-xs font-medium text-slate-600 dark:text-slate-300">
          <button
            type="button"
            onClick={() => onNavigate('landing')}
            className={`px-2 py-0.5 whitespace-nowrap ${route === 'landing' ? 'text-theme-accent font-semibold' : ''}`}
          >
            {t('Beranda', 'Home')}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('index')}
            className={`px-2 py-0.5 whitespace-nowrap ${route === 'index' ? 'text-theme-accent font-semibold' : ''}`}
          >
            {t('Portal', 'Portal')}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('formmbkm')}
            className={`px-2 py-0.5 whitespace-nowrap ${route === 'formmbkm' || route === 'formpkl' ? 'text-theme-accent font-semibold' : ''}`}
          >
            {t('Daftar', 'Apply')}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('absensi')}
            className={`px-2 py-0.5 whitespace-nowrap ${route === 'absensi' ? 'text-theme-accent font-semibold' : ''}`}
          >
            {t('Absensi', 'Attendance')}
          </button>
        </div>
      </header>

      <main className="flex-1 min-w-0">
        {route === 'absensi' && (
          <AttendanceKiosk
            onBack={() => onNavigate('index')}
            defaultRadiusMeters={summary.maxRadiusMeters ?? 650}
          />
        )}

        {(route === 'formmbkm' || route === 'formpkl') && (
          <RegistrationForms
            program={route === 'formmbkm' ? 'MBKM' : 'PKL'}
            vacancies={vacancies}
            mediaMap={mediaMap}
            onBack={() => onNavigate('index')}
            onSwitchProgram={(p) => onNavigate(p === 'MBKM' ? 'formmbkm' : 'formpkl')}
          />
        )}

        {route === 'index' && (
          <div className="mx-auto max-w-7xl 2xl:max-w-[1440px] px-4 py-8 sm:py-10 sm:px-6 space-y-8 sm:space-y-10">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-6">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-theme-accent">
                  HR Development Section · PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory
                </p>
                <h1 className="mt-1.5 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                  {t('Portal Program Magang Mahasiswa', 'Student Internship Program Portal')}
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-200 leading-relaxed">
                  {t(
                    'Pilih jalur pendaftaran program MBKM, Praktik Kerja Lapangan (PKL) Mandiri, lacak status lamaran, atau akses Kiosk Absensi Harian berbasis foto selfie dan GPS.',
                    'Choose your MBKM or Independent Fieldwork (PKL) registration track, check application status, or access the Daily Attendance Kiosk with selfie and GPS verification.'
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setTrackError('');
                    setTrackerOpen(true);
                  }}
                  className="btn-theme-soft inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold shadow-2xs whitespace-nowrap"
                >
                  <ClipboardCheck className="h-4 w-4" />
                  {t('Cek Status Lamaran', 'Track Application')}
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('login')}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300/90 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                  <ShieldCheck className="h-4 w-4 text-theme-accent" />
                  {t('Dashboard HR Admin', 'HR Admin Dashboard')}
                </button>
              </div>
            </div>

            {/* 3 Live KPI Strip with Executive Plinths */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="kpi-tile p-6 flex flex-col justify-between gap-4">
                <Users
                  className="pointer-events-none absolute -right-3 -bottom-3 h-24 w-24 text-slate-900/[0.035] dark:text-white/[0.04]"
                  strokeWidth={1.4}
                  aria-hidden="true"
                />
                <div className="relative z-10 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-200">
                      {t('Mahasiswa Magang Aktif', 'Active Student Interns')}
                    </div>
                    <div className="mt-2 font-display text-3xl sm:text-4xl font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
                      {summary.totalMahasiswaAktif}
                    </div>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white ring-1 ring-inset ring-slate-900/10 dark:bg-slate-800 dark:text-slate-100 shadow-xs shrink-0">
                    <Users className="h-5 w-5" />
                  </div>
                </div>
                <div className="relative z-10 border-t border-slate-100 dark:border-slate-800 pt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-200">
                  <span className="inline-flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300 shrink-0" />
                    {t('Peserta MBKM & PKL aktif', 'Active MBKM & PKL interns')}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-3 w-3 shrink-0" />
                    {t('Terverifikasi', 'Verified')}
                  </span>
                </div>
              </div>

              <div className="kpi-tile p-6 flex flex-col justify-between gap-4">
                <GraduationCap
                  className="pointer-events-none absolute -right-3 -bottom-3 h-24 w-24 text-slate-900/[0.035] dark:text-white/[0.04]"
                  strokeWidth={1.4}
                  aria-hidden="true"
                />
                <div className="relative z-10 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-200">
                      {t('Universitas Mitra PKS', 'MoA Partner Universities')}
                    </div>
                    <div className="mt-2 font-display text-3xl sm:text-4xl font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
                      {summary.totalUniversitasMitra}
                    </div>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-800 ring-1 ring-inset ring-slate-200/80 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700 shrink-0">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                </div>
                <div className="relative z-10 border-t border-slate-100 dark:border-slate-800 pt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-200">
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-slate-500 dark:text-slate-200 shrink-0" />
                    {t('Kemitraan resmi kampus', 'Official campus partnerships')}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    <FileCheck2 className="h-3 w-3 text-emerald-600 dark:text-emerald-300 shrink-0" />
                    {summary.pksAktif} {t('PKS Aktif', 'Active MoAs')}
                  </span>
                </div>
              </div>

              <div className="kpi-tile p-6 flex flex-col justify-between gap-4">
                <Briefcase
                  className="pointer-events-none absolute -right-3 -bottom-3 h-24 w-24 text-slate-900/[0.035] dark:text-white/[0.04]"
                  strokeWidth={1.4}
                  aria-hidden="true"
                />
                <div className="relative z-10 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-200">
                      {t('Divisi & Lowongan Terbuka', 'Open Divisions & Positions')}
                    </div>
                    <div className="mt-2 font-display text-3xl sm:text-4xl font-extrabold tabular-nums text-theme-accent">
                      {summary.divisiOpen}
                    </div>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl icon-theme-plinth shrink-0">
                    <Briefcase className="h-5 w-5" />
                  </div>
                </div>
                <div className="relative z-10 border-t border-slate-100 dark:border-slate-800 pt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-200">
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-theme-accent shrink-0" />
                    {t('Menerima pendaftar baru', 'Accepting new applicants')}
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-theme-accent">Batch 2026</span>
                </div>
              </div>
            </div>

            {/* 3 Main Portal Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <article className="surface-card flex flex-col overflow-hidden group hover:-translate-y-0.5 transition-transform">
                <div className="relative h-52 w-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-900 overflow-hidden">
                  <img
                    src={mbkmCardImg}
                    alt=""
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                    style={{ objectPosition: mediaMap.portal_mbkm_card?.objectPosition || 'center 20%' }}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                  <div className="absolute top-3 right-3 h-14 w-14 shrink-0">
                    <img
                      src={logoAjiu}
                      alt="Logo AJIU Ajinomoto Indonesia University"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.45)]"
                    />
                  </div>
                  <div className="absolute bottom-3 left-4 right-4 text-white">
                    <div className="text-[11px] text-slate-200">
                      {t('Kampus Merdeka · AJIU Partner · 4–6 Bulan', 'Kampus Merdeka · AJIU Partner · 4–6 Months')}
                    </div>
                    <div className="text-base font-bold">{t('Jalur Program MBKM', 'MBKM Program Track')}</div>
                  </div>
                </div>
                <div className="flex flex-1 flex-col justify-between p-6 space-y-5">
                  <div className="space-y-3">
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {t(
                        'Magang terstruktur terhubung dengan kemitraan kampus dan mentor proyek pabrik.',
                        'Structured internship aligned with university partnerships and dedicated factory project mentors.'
                      )}
                    </p>
                    <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-theme-accent shrink-0" />
                        <span>{t('Pilih posisi lintas divisi manufaktur & QA', 'Select roles across manufacturing & QA divisions')}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-theme-accent shrink-0" />
                        <span>{t('Unggah CV PDF (maks 2 MB) untuk kurasi HR', 'Upload PDF CV (max 2 MB) for HR curation')}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-theme-accent shrink-0" />
                        <span>{t('Evaluasi 4 pilar kompetensi & sertifikat QR', '4-pillar competency evaluation & QR certificate')}</span>
                      </li>
                    </ul>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('formmbkm')}
                    className="btn-theme-primary inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold"
                  >
                    <span>{t('Daftar Program MBKM', 'Apply for MBKM Program')}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>

              <article className="surface-card flex flex-col overflow-hidden group hover:-translate-y-0.5 transition-transform">
                <div className="relative h-52 w-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-900 overflow-hidden">
                  <img
                    src={pklCardImg}
                    alt=""
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                    style={{ objectPosition: mediaMap.portal_pkl_card?.objectPosition || 'center 25%' }}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                  <div className="absolute top-3 right-3 rounded-lg bg-white/95 px-2 py-1 shadow-md ring-1 ring-slate-200/80">
                    <img
                      src={logoAjinomoto}
                      alt="Logo PT Ajinomoto Indonesia"
                      referrerPolicy="no-referrer"
                      className="h-5 w-auto object-contain"
                    />
                  </div>
                  <div className="absolute bottom-3 left-4 right-4 text-white">
                    <div className="text-[11px] text-slate-200">
                      {t('Praktik Kerja Lapangan · Reguler', 'Fieldwork Practice (PKL) · Regular')}
                    </div>
                    <div className="text-base font-bold">{t('Jalur PKL Mandiri', 'Independent PKL Track')}</div>
                  </div>
                </div>
                <div className="flex flex-1 flex-col justify-between p-6 space-y-5">
                  <div className="space-y-3">
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {t(
                        'Registrasi cepat untuk praktik kerja lapangan vokasi, sarjana, maupun riset tugas akhir.',
                        'Streamlined registration for vocational, undergraduate fieldwork, and final thesis research.'
                      )}
                    </p>
                    <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-slate-800 dark:text-slate-200 shrink-0" />
                        <span>{t('Formulir ringkas tanpa kewajiban unggah CV', 'Concise registration form without mandatory CV upload')}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-slate-800 dark:text-slate-200 shrink-0" />
                        <span>{t('Penempatan operasional langsung di unit pabrik', 'Direct operational placement inside factory units')}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-slate-800 dark:text-slate-200 shrink-0" />
                        <span>{t('Notifikasi hasil seleksi resmi via email', 'Official selection result notification via email')}</span>
                      </li>
                    </ul>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('formpkl')}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white transition-colors"
                  >
                    <span>{t('Daftar PKL Mandiri', 'Apply for Independent PKL')}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>

              <article className="surface-card flex flex-col justify-between p-6 space-y-5 hover:-translate-y-0.5 transition-transform">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl icon-theme-plinth">
                      <CalendarCheck className="h-6 w-6" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-200">WIB · Selfie + GPS</span>
                      <div className="rounded-lg bg-white p-1 ring-1 ring-emerald-200/90 shadow-2xs">
                        <img
                          src={logoSafety}
                          alt="Logo Safety First"
                          referrerPolicy="no-referrer"
                          className="h-6 w-auto object-contain"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {t('Kiosk Absensi Harian', 'Daily Attendance Kiosk')}
                    </h2>
                    <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {t(
                        'Portal presensi terpadu bagi peserta aktif MBKM dan PKL selama menjalani masa magang di PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory.',
                        'Unified attendance portal for active MBKM and PKL interns throughout their internship at PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory.'
                      )}
                    </p>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300 pt-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300 shrink-0" />
                      <span>{t('Verifikasi NIM otomatis + foto kamera depan', 'Automatic Student ID (NIM) lookup + front camera selfie')}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300 shrink-0" />
                      <span>
                        {t(
                          `Validasi koordinat geofence Mojokerto Factory (${summary.maxRadiusMeters ?? 650} m)`,
                          `Mojokerto Factory GPS geofence validation (${summary.maxRadiusMeters ?? 650} m)`
                        )}
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300 shrink-0" />
                      <span>{t('Pengajuan izin/sakit dengan lampiran surat', 'Leave/sick request submission with supporting document')}</span>
                    </li>
                  </ul>
                </div>

                <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
                  <div className="flex items-center gap-1.5 text-xs font-mono text-slate-500 dark:text-slate-200">
                    <MapPin className="h-3.5 w-3.5 text-theme-accent shrink-0" />
                    <span>Jl. Raya Mlirip, Mojokerto (-7.4589, 112.4631)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('absensi')}
                    className="btn-theme-outline inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold"
                  >
                    <span>{t('Buka Kiosk Absensi', 'Open Attendance Kiosk')}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>
            </div>
          </div>
        )}

        {route === 'landing' && (
          <div>
            {/* Hero Section */}
            <section className="relative overflow-hidden border-b border-slate-200/80 bg-white/70 dark:border-slate-800/80 dark:bg-slate-950/40 backdrop-blur-[2px]">
              <div className="mx-auto grid max-w-7xl 2xl:max-w-[1440px] grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 px-4 py-10 sm:px-6 lg:py-16 items-stretch">
                <div className="lg:col-span-6 flex flex-col justify-center space-y-5 sm:space-y-6 min-w-0">
                  <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-theme-accent">
                    <Building2 className="h-4 w-4 shrink-0" />
                    <span className="min-w-0">PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory</span>
                  </div>
                  <h1 className="font-display text-2xl sm:text-4xl lg:text-[clamp(2.25rem,3.3vw,3.3rem)] font-extrabold tracking-tight text-slate-900 dark:text-slate-100 text-balance leading-[1.08]">
                    {t(
                      'Bangun Karier Industri Bersama Talenta Muda Mojokerto',
                      'Build Your Industrial Career with Mojokerto Emerging Talent'
                    )}
                  </h1>
                  <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                    {t(
                      'Portal resmi HR Development PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory untuk pengelolaan program magang MBKM dan PKL Mandiri dengan budaya inovasi AminoScience dan standar Safety First.',
                      'Official HR Development portal of PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory for managing MBKM and Independent PKL internship programs with AminoScience innovation and Safety First standards.'
                    )}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => onNavigate('index')}
                      className="btn-theme-primary inline-flex items-center gap-2 rounded-lg px-5 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold whitespace-nowrap"
                    >
                      <span>{t('Jelajahi Portal Program', 'Explore Program Portal')}</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTrackError('');
                        setTrackerOpen(true);
                      }}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300/90 bg-white px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-slate-800 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                    >
                      <ClipboardCheck className="h-4 w-4 text-theme-accent" />
                      {t('Lacak Lamaran', 'Track Application')}
                    </button>
                  </div>

                  {/* Official Institutional Emblem Bar */}
                  <div className="pt-2 max-w-full">
                    <div className="inline-flex max-w-full flex-wrap items-center gap-3 sm:gap-4 rounded-2xl border border-slate-200/90 bg-white/95 dark:border-slate-700/80 dark:bg-slate-900/90 px-3.5 sm:px-4 py-2.5 shadow-[0_4px_14px_-6px_rgba(15,23,42,0.08)]">
                      <div className="flex items-center gap-2 sm:pr-3.5 sm:border-r sm:border-slate-200/80 dark:sm:border-slate-700/80">
                        <span className="rounded-md bg-white px-1.5 py-0.5">
                          <img
                            src={logoAjinomoto}
                            alt="Logo PT Ajinomoto Indonesia"
                            referrerPolicy="no-referrer"
                            className="h-7 sm:h-8 w-auto object-contain"
                          />
                        </span>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-2.5 sm:pr-3.5 sm:border-r sm:border-slate-200/80 dark:sm:border-slate-700/80">
                        <img
                          src={logoAjiu}
                          alt="Logo Ajinomoto Indonesia University (AJIU)"
                          referrerPolicy="no-referrer"
                          className="h-10 w-10 sm:h-11 sm:w-11 object-contain shrink-0 drop-shadow-xs"
                        />
                        <div className="leading-tight">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">AJIU</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-200">Corporate University</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-white p-1">
                          <img
                            src={logoSafety}
                            alt="Logo Safety First"
                            referrerPolicy="no-referrer"
                            className="h-6 sm:h-7 w-auto object-contain shrink-0"
                          />
                        </span>
                        <div className="leading-tight">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Safety First</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-200">
                            {t('Standar K3 Pabrik', 'Factory OHS Standard')}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-6 min-w-0">
                  <div className="relative h-64 sm:h-96 lg:h-full lg:min-h-[420px] w-full overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-900 shadow-[0_20px_45px_-22px_rgba(15,23,42,0.28)]">
                    <img
                      src={heroFactoryImg}
                      alt=""
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                      style={{ objectPosition: mediaMap.landing_hero?.objectPosition || 'center' }}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent" />
                    <div className="absolute bottom-4 sm:bottom-5 left-4 sm:left-5 right-4 sm:right-5 flex flex-wrap items-end justify-between gap-2 sm:gap-4 text-white">
                      <div className="min-w-0">
                        <div className="text-[10px] sm:text-[11px] uppercase tracking-wider text-slate-100">
                          PT Ajinomoto Indonesia - PT Ajinex International
                        </div>
                        <div className="font-display text-base sm:text-lg font-bold tracking-tight text-white">
                          Mojokerto Eco-Factory Campus
                        </div>
                      </div>
                      <div className="text-right font-mono text-[11px] sm:text-xs text-slate-100">
                        {summary.totalMahasiswaAktif} {t('Peserta Aktif', 'Active Interns')} · {summary.divisiOpen}{' '}
                        {t('Posisi Open', 'Open Roles')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Full-width Proof Strip below Hero */}
              <div className="border-t border-slate-200/70 bg-white/55 dark:border-slate-800/80 dark:bg-slate-900/50">
                <div className="mx-auto grid max-w-7xl 2xl:max-w-[1440px] grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 lg:divide-x divide-slate-200/80 dark:divide-slate-800/80 px-4 sm:px-6">
                  <div className="py-5 md:pr-6 flex items-center gap-3.5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl icon-theme-plinth shrink-0">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-200">
                        {t('Mahasiswa Aktif', 'Active Students')}
                      </div>
                      <div className="font-display text-xl font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
                        {summary.totalMahasiswaAktif} {t('Peserta', 'Interns')}
                      </div>
                    </div>
                  </div>
                  <div className="py-5 md:px-6 flex items-center gap-3.5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-2xs text-slate-800 dark:text-slate-200 shrink-0">
                      <GraduationCap className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-200">
                        {t('Kampus Mitra PKS', 'MoA Partner Campuses')}
                      </div>
                      <div className="font-display text-xl font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
                        {summary.totalUniversitasMitra} {t('Kampus', 'Campuses')}
                      </div>
                    </div>
                  </div>
                  <div className="py-5 md:px-6 flex items-center gap-3.5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl icon-theme-plinth shrink-0">
                      <Briefcase className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-200">
                        {t('Lowongan Terbuka', 'Open Vacancies')}
                      </div>
                      <div className="font-display text-xl font-extrabold tabular-nums text-theme-accent">
                        {summary.divisiOpen} {t('Divisi', 'Divisions')}
                      </div>
                    </div>
                  </div>
                  <div className="py-5 md:pl-6 flex items-center gap-3.5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-2xs text-emerald-700 dark:text-emerald-300 shrink-0">
                      <Award className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-200">
                        {t('Sertifikasi Mutu', 'Quality Certification')}
                      </div>
                      <div className="font-display text-xl font-extrabold text-slate-900 dark:text-slate-100">
                        ISO 22000 &amp; Halal
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Uploaded Official Registration Poster / Brochure Section (Managed via Admin Media Manager) */}
            {infoPoster && (
              <section className="mx-auto max-w-7xl 2xl:max-w-[1440px] px-4 pt-12 sm:pt-14 sm:px-6">
                <div className="surface-card overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
                  <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between gap-5">
                    <div className="space-y-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-theme-accent">
                        {t('Pengumuman & Brosur Resmi', 'Official Announcement & Brochure')}
                      </p>
                      <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                        {t(
                          'Informasi Pendaftaran Magang MBKM & PKL',
                          'MBKM & PKL Internship Registration Information'
                        )}
                      </h2>
                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        {infoPoster.altText ||
                          t(
                            'Simak jadwal pembukaan, persyaratan berkas, dan alur pendaftaran resmi program magang PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory.',
                            'Review the official schedule, document requirements, and registration guidelines for the PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory internship program.'
                          )}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => setPosterPreviewOpen(true)}
                        className="inline-flex items-center gap-2 rounded-lg btn-theme-primary px-4 py-2.5 text-xs font-semibold"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {infoPosterIsPdf
                          ? t('Buka Pratinjau Brosur PDF', 'Open PDF Brochure Preview')
                          : t('Perbesar Poster Informasi', 'Enlarge Info Poster')}
                      </button>
                      <a
                        href={infoPoster.currentUrl}
                        download={infoPosterIsPdf ? 'Brosur_Magang_PKL_Ajinomoto.pdf' : 'Poster_Magang_PKL_Ajinomoto.png'}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {t('Unduh Dokumen', 'Download File')}
                      </a>
                    </div>
                  </div>
                  <div className="lg:col-span-7 bg-slate-100 dark:bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-200/80 dark:border-slate-800 min-h-[260px] max-h-[420px] flex items-center justify-center overflow-hidden">
                    {infoPosterIsPdf ? (
                      <div className="p-8 text-center space-y-3">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-600 text-white shadow-sm">
                          <FileText className="h-7 w-7" />
                        </div>
                        <div className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                          {t('Dokumen Panduan & Pengumuman PDF Tersedia', 'Official PDF Guide & Announcement Available')}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-200 max-w-sm mx-auto">
                          {t(
                            'Klik tombol "Buka Pratinjau Brosur PDF" atau "Unduh Dokumen" untuk membaca informasi lengkap.',
                            'Click "Open PDF Brochure Preview" or "Download File" to read the complete guidelines.'
                          )}
                        </p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPosterPreviewOpen(true)}
                        className="h-full w-full block cursor-zoom-in"
                      >
                        <img
                          src={infoPoster.currentUrl}
                          alt={infoPoster.altText || 'Poster Informasi Pendaftaran Magang MBKM & PKL'}
                          referrerPolicy="no-referrer"
                          style={{ objectPosition: infoPoster.objectPosition || 'center' }}
                          className="h-full w-full object-cover max-h-[420px]"
                        />
                      </button>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* Infografik Ekosistem Magang */}
            <section className="mx-auto max-w-7xl 2xl:max-w-[1440px] px-4 py-12 sm:py-14 sm:px-6">
              <EcosystemFlowInfographic
                universities={summary.totalUniversitasMitra}
                divisiOpen={summary.divisiOpen}
                activeInterns={summary.totalMahasiswaAktif}
                pksAktif={summary.pksAktif}
              />
            </section>

            {/* Open Vacancies Bento */}
            <section className="border-y border-slate-200/80 bg-white/75 dark:border-slate-800/80 dark:bg-slate-950/35 backdrop-blur-xs py-12 sm:py-14">
              <div className="mx-auto max-w-7xl 2xl:max-w-[1440px] px-4 sm:px-6 space-y-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-theme-accent">
                      {t('Kesempatan Karier Awal', 'Early Career Opportunities')}
                    </p>
                    <h2 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                      {t('Lowongan Magang Terbuka Saat Ini', 'Currently Open Internship Positions')}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-200">
                      {t(
                        'Eksplorasi divisi operasional PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory.',
                        'Explore operational divisions at PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory.'
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('formmbkm')}
                    className="btn-theme-primary inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold whitespace-nowrap"
                  >
                    <span>{t('Lamar Posisi Sekarang', 'Apply Now')}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="surface-inset flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="relative min-w-0 w-full sm:min-w-[220px] flex-1 sm:max-w-sm">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-slate-300" />
                    <input
                      type="text"
                      value={vacancySearch}
                      onChange={(e) => setVacancySearch(e.target.value)}
                      placeholder={t('Cari jurusan, posisi, atau keahlian...', 'Search major, role, or skills...')}
                      className="input-theme-focus w-full rounded-lg border border-slate-200/90 bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 pl-8 pr-3 py-1.5 text-xs"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-1">
                    {(
                      [
                        { id: 'ALL', label: t('Semua Bidang', 'All Tracks') },
                        { id: 'LAB', label: t('Pangan & QA', 'Food & QA') },
                        { id: 'TECH', label: t('Teknik & Otomasi', 'Engineering & Automation') },
                        { id: 'PEOPLE', label: t('HR & Manajemen', 'HR & Management') },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setVacancyTrack(f.id)}
                        className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                          vacancyTrack === f.id
                            ? 'bg-theme-accent text-white'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-200 dark:hover:text-slate-100'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredVacancies.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-stone-50 dark:bg-slate-900/50 py-10 text-center text-xs text-slate-500 dark:text-slate-200">
                    {t(
                      'Tidak ada lowongan terbuka yang sesuai dengan kata kunci pencarian Anda.',
                      'No open internship vacancies match your current search filter.'
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredVacancies.map((v) => {
                      const RoleIcon = getVacancyIcon(v.namaPosisi);
                      return (
                        <div
                          key={v.id}
                          className="kpi-tile flex flex-col justify-between p-6 space-y-4"
                        >
                          <RoleIcon
                            className="pointer-events-none absolute -right-3 -bottom-3 h-20 w-20 text-slate-900/[0.03] dark:text-white/[0.04]"
                            strokeWidth={1.4}
                            aria-hidden="true"
                          />
                          <div className="relative z-10 flex items-start gap-4">
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl icon-theme-plinth shrink-0">
                              <RoleIcon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-200">
                                <GraduationCap className="h-3 w-3 text-slate-400 dark:text-slate-300 shrink-0" />
                                <span>{v.pendidikan} · {v.prodi}</span>
                              </div>
                              <h3 className="mt-1 font-display text-base font-bold text-slate-900 dark:text-slate-100">
                                {v.namaPosisi}
                              </h3>
                              <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                                {v.tugas.replace(/;/g, ' · ')}
                              </p>
                            </div>
                          </div>
                          <div className="relative z-10 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
                            <button
                              type="button"
                              onClick={() => setDetailVacancy(v)}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-theme-accent"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              {t('Lihat Detail Posisi', 'View Role Details')}
                            </button>
                            <button
                              type="button"
                              onClick={() => onNavigate('formmbkm')}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-theme-accent hover:underline"
                            >
                              <span>{t('Daftar MBKM', 'Apply MBKM')}</span>
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            {/* Panduan Langkah Seleksi & Onboarding */}
            <section className="mx-auto max-w-7xl 2xl:max-w-[1440px] px-4 py-12 sm:py-14 sm:px-6 space-y-12">
              <div className="space-y-6 border-b border-slate-200 dark:border-slate-800 pb-12">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-theme-accent">{t('Alur Terstruktur', 'Structured Journey')}</p>
                    <h3 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                      {t('4 Langkah Menjadi Bagian Tim Mojokerto', '4 Steps to Join the Mojokerto Factory Team')}
                    </h3>
                  </div>
                  <p className="max-w-md text-xs text-slate-600 dark:text-slate-200 leading-relaxed">
                    {t(
                      'Setiap kandidat diproses transparan oleh HR Development Section dengan konfirmasi email dan pelacakan status mandiri.',
                      'Every candidate is reviewed transparently by HR Development Section with email notifications and self-service status tracking.'
                    )}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    {
                      num: '01.',
                      title: t('Registrasi Portal', 'Portal Registration'),
                      desc: t(
                        'Pilih jalur MBKM (dengan CV PDF) atau PKL Mandiri lalu setujui kebijakan privasi.',
                        'Choose the MBKM track (with PDF CV) or Independent PKL and accept the privacy notice.'
                      ),
                      icon: UserPlus,
                      useThemeAccent: true,
                    },
                    {
                      num: '02.',
                      title: t('Screening & Keputusan', 'Screening & Decision'),
                      desc: t(
                        'Tim HR meninjau profil akademik dan mengirimkan pengumuman via email & pelacak status.',
                        'HR reviews your academic profile and delivers updates via email & the status tracker.'
                      ),
                      icon: FileSearch,
                      useThemeAccent: false,
                    },
                    {
                      num: '03.',
                      title: t('Orientasi K3 & Geofence', 'Safety Induction & Geofence'),
                      desc: t(
                        'Induksi keselamatan pabrik serta aktivasi NIM pada Kiosk Absensi Selfie & GPS.',
                        'Factory safety induction and Student ID activation on the Selfie & GPS Attendance Kiosk.'
                      ),
                      icon: Radar,
                      useThemeAccent: true,
                    },
                    {
                      num: '04.',
                      title: t('Evaluasi & Sertifikat QR', 'Evaluation & QR Certificate'),
                      desc: t(
                        'Penilaian 4 pilar kompetensi oleh mentor dan penerbitan sertifikat industri ber-QR.',
                        '4-pillar competency assessment by mentors and issuance of QR-verified industrial certificates.'
                      ),
                      icon: Award,
                      useThemeAccent: false,
                    },
                  ].map((s) => {
                    const StepIcon = s.icon;
                    return (
                      <div key={s.num} className="kpi-tile p-5 space-y-3">
                        <StepIcon
                          className="pointer-events-none absolute -right-2.5 -bottom-2.5 h-20 w-20 text-slate-900/[0.03] dark:text-white/[0.04]"
                          strokeWidth={1.4}
                          aria-hidden="true"
                        />
                        <div className="relative z-10 flex items-center justify-between">
                          <div
                            className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                              s.useThemeAccent
                                ? 'icon-theme-plinth'
                                : 'bg-slate-100 text-slate-800 ring-1 ring-inset ring-slate-200/80 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700'
                            }`}
                          >
                            <StepIcon className="h-4.5 w-4.5" />
                          </div>
                          <span className="font-mono text-xs font-bold text-theme-accent">{s.num}</span>
                        </div>
                        <div className="relative z-10 font-display text-base font-bold text-slate-900 dark:text-slate-100">
                          {s.title}
                        </div>
                        <p className="relative z-10 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {s.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <MojokertoGlobalMapInfographic />
            </section>
          </div>
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200/80 bg-theme-header dark:border-slate-800/90 py-7">
        <div className="mx-auto flex max-w-7xl 2xl:max-w-[1440px] flex-col md:flex-row items-center justify-between gap-5 px-4 sm:px-6 text-xs text-slate-500 dark:text-slate-200">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white px-3.5 py-2 shadow-2xs">
              <img
                src={logoAjinomoto}
                alt="Logo Ajinomoto Indonesia"
                referrerPolicy="no-referrer"
                className="h-6 w-auto object-contain"
              />
              <span className="h-5 w-px bg-slate-200" />
              <img
                src={logoAjiu}
                alt="Logo AJIU"
                referrerPolicy="no-referrer"
                className="h-9 w-9 object-contain shrink-0"
              />
              <span className="h-5 w-px bg-slate-200" />
              <img
                src={logoSafety}
                alt="Logo Safety First"
                referrerPolicy="no-referrer"
                className="h-6 w-auto object-contain"
              />
            </div>
            <span className="font-medium text-slate-600 dark:text-slate-300 text-center md:text-left">
              PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory · HR Development Section
            </span>
          </div>
          <div className="flex items-center gap-5 shrink-0 font-medium">
            <button
              type="button"
              onClick={() => onNavigate('index')}
              className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap"
            >
              {t('Portal Program', 'Program Portal')}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('absensi')}
              className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap"
            >
              {t('Absensi', 'Attendance')}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('login')}
              className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap"
            >
              {t('Admin Login', 'Admin Login')}
            </button>
          </div>
        </div>
      </footer>

      {/* Official Poster / Brochure Lightbox Modal */}
      {posterPreviewOpen && infoPoster && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop p-4"
          onClick={() => setPosterPreviewOpen(false)}
        >
          <div
            className="surface-card w-full max-w-4xl max-h-[90dvh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <div className="font-display text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                {t('Informasi Resmi Pendaftaran Magang MBKM & PKL', 'Official MBKM & PKL Registration Information')}
              </div>
              <button
                type="button"
                onClick={() => setPosterPreviewOpen(false)}
                className="rounded-lg p-1 text-slate-500 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-slate-950/90 p-4 flex items-center justify-center min-h-[340px]">
              {infoPosterIsPdf ? (
                <iframe
                  src={infoPoster.currentUrl}
                  title="Brosur Pendaftaran Magang MBKM & PKL"
                  className="h-[72dvh] w-full rounded-lg bg-white"
                />
              ) : (
                <img
                  src={infoPoster.currentUrl}
                  alt={infoPoster.altText || 'Poster Informasi Pendaftaran'}
                  referrerPolicy="no-referrer"
                  className="max-h-[75dvh] max-w-full object-contain rounded-lg"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Detail Vacancy Modal */}
      {localizedDetailVacancy && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center modal-backdrop p-3 sm:p-4 overflow-y-auto">
          <div className="surface-card w-full max-w-lg my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-theme-accent">
                  {t('Spesifikasi Posisi Magang', 'Internship Role Specification')}
                </p>
                <h3 className="mt-0.5 text-lg font-bold text-slate-900 dark:text-slate-100">
                  {localizedDetailVacancy.namaPosisi}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-200 mt-0.5">
                  {localizedDetailVacancy.pendidikan} · {localizedDetailVacancy.prodi}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailVacancy(null)}
                className="rounded-lg p-1.5 text-slate-500 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800 pt-3">
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {t('Skill Dibutuhkan', 'Required Skills')}
                </div>
                <p className="mt-1 leading-relaxed">{localizedDetailVacancy.skill.replace(/;/g, ' · ')}</p>
              </div>
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {t('Tugas Utama', 'Key Responsibilities')}
                </div>
                <p className="mt-1 leading-relaxed">{localizedDetailVacancy.tugas.replace(/;/g, ' · ')}</p>
              </div>
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {t('Benefit', 'Program Benefits')}
                </div>
                <p className="mt-1 leading-relaxed">{localizedDetailVacancy.benefit.replace(/;/g, ' · ')}</p>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDetailVacancy(null)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                {t('Tutup', 'Close')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDetailVacancy(null);
                  onNavigate('formmbkm');
                }}
                className="btn-theme-primary rounded-lg px-4 py-2 text-xs font-semibold"
              >
                {t('Lamar Sekarang', 'Apply Now')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pelacak Status Lamaran Modal */}
      {trackerOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center modal-backdrop p-3 sm:p-4 overflow-y-auto">
          <div className="surface-card w-full max-w-lg my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-theme-accent">
                  {t('Pelacakan Mandiri Pelamar', 'Self-Service Applicant Tracker')}
                </p>
                <h3 className="mt-0.5 text-lg font-bold text-slate-900 dark:text-slate-100">
                  {t('Cek Status Lamaran Magang', 'Check Internship Application Status')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-200">
                  {t(
                    'Masukkan NIM dan Email yang digunakan saat mengisi formulir MBKM atau PKL.',
                    'Enter the Student ID (NIM) and Email used when submitting your MBKM or PKL form.'
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTrackerOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleTrackStatus} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('NIM', 'Student ID (NIM)')}
                  </label>
                  <input
                    type="text"
                    required
                    value={trackNim}
                    onChange={(e) => setTrackNim(e.target.value)}
                    placeholder={t('Contoh: 215100100111033', 'e.g., 215100100111033')}
                    className="input-theme-focus w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('Email Pendaftaran', 'Registered Email')}
                  </label>
                  <input
                    type="email"
                    required
                    value={trackEmail}
                    onChange={(e) => setTrackEmail(e.target.value)}
                    placeholder="email@kampus.ac.id"
                    className="input-theme-focus w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 px-3 py-2"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setTrackNim('215100100111033');
                    setTrackEmail('aulia.maharani@student.ub.ac.id');
                  }}
                  className="text-[11px] text-slate-500 dark:text-slate-200 underline-offset-2 hover:underline"
                >
                  {t('Isi contoh data pelamar', 'Fill sample applicant data')}
                </button>
                <button
                  type="submit"
                  disabled={trackLoading}
                  className="btn-theme-primary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 font-semibold disabled:opacity-50"
                >
                  <ClipboardCheck className="h-3.5 w-3.5" />
                  {trackLoading ? t('Mencari...', 'Searching...') : t('Periksa Status', 'Check Status')}
                </button>
              </div>
            </form>

            {trackError && (
              <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-300">
                {trackError}
              </div>
            )}

            {trackResult && (
              <div className="surface-inset p-4 space-y-3 text-xs">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-[11px] text-slate-500 dark:text-slate-200">
                      {trackResult.id} · {trackResult.jenis}
                    </div>
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">{trackResult.nama}</div>
                    <div className="text-slate-600 dark:text-slate-300">
                      {trackResult.universitas} · {trackResult.lowongan}
                    </div>
                  </div>
                  <div
                    className={`font-bold text-sm shrink-0 ${
                      trackResult.status === 'Diterima'
                        ? 'text-emerald-600 dark:text-emerald-300'
                        : trackResult.status === 'Ditolak'
                          ? 'text-red-600 dark:text-red-300'
                          : 'text-amber-600 dark:text-amber-300'
                    }`}
                  >
                    {localizeStatus(trackResult.status, lang)}
                  </div>
                </div>

                {/* Progress Stepper */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 border-t border-slate-200 dark:border-slate-800 pt-3">
                  <div className="space-y-0.5">
                    <div className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>{t('1. Terdaftar', '1. Submitted')}</span>
                    </div>
                    <div className="font-mono text-[10px] text-slate-500 dark:text-slate-200">{trackResult.timestamp}</div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="inline-flex items-center gap-1 font-semibold text-slate-900 dark:text-slate-100">
                      <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300" />
                      <span>{t('2. Seleksi HR', '2. HR Review')}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-200">
                      {trackResult.status === 'Pending'
                        ? t('Sedang ditinjau HR', 'Under HR review')
                        : t('Review selesai', 'Review completed')}
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <div
                      className={`inline-flex items-center gap-1 font-semibold ${
                        trackResult.status === 'Diterima'
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : trackResult.status === 'Ditolak'
                            ? 'text-red-600 dark:text-red-300'
                            : 'text-slate-400 dark:text-slate-300'
                      }`}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>{t('3. Keputusan', '3. Decision')}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-200">
                      {localizeStatus(trackResult.status, lang)}
                    </div>
                  </div>
                </div>

                {trackResult.mahasiswaAktif && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30 p-3 text-[11px] text-emerald-950 dark:text-emerald-200 space-y-1">
                    <div className="font-semibold">
                      {t('Akses Peserta Aktif Telah Diaktifkan', 'Active Intern Access Enabled')}
                    </div>
                    <div>
                      {t('Departemen', 'Department')}: <strong>{trackResult.mahasiswaAktif.department}</strong> ·{' '}
                      {t('Periode', 'Period')}:{' '}
                      <span className="font-mono">
                        {trackResult.mahasiswaAktif.tglMasuk} {t('s/d', 'to')} {trackResult.mahasiswaAktif.tanggalBerakhir}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setTrackerOpen(false);
                        onNavigate('absensi');
                      }}
                      className="mt-1 inline-flex items-center gap-1 font-semibold text-theme-accent hover:underline"
                    >
                      {t('Buka Kiosk Absensi Sekarang →', 'Open Attendance Kiosk Now →')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
