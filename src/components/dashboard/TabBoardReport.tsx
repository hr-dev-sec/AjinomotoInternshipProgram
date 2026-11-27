import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  FileDown,
  FileSpreadsheet,
  Filter,
  GraduationCap,
  Presentation,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { apiRequest, getCachedApiResponse, primeApiGetCache } from '../../lib/api';
import { exportExecutivePdf, exportToCsv } from '../../lib/exports';
import { localizeApiMessage, localizeTalent } from '../../lib/localizeData';
import { useRealtimeSync } from '../../lib/realtime';
import type {
  DashboardStatsResponse,
  Lowongan,
  Mahasiswa,
  Pendaftaran,
  UniversitasPKS,
} from '../../types/internship';
import { BoardPresentationModal } from './BoardPresentationModal';

interface OverviewPayload {
  stats: DashboardStatsResponse;
  mahasiswa: Mahasiswa[];
}

export const TabBoardReport: React.FC = () => {
  const { lang, t } = useAppPreferences();

  const cachedOverview = getCachedApiResponse<OverviewPayload>('/api/dashboard/overview');
  const [stats, setStats] = useState<DashboardStatsResponse | null>(
    cachedOverview?.stats ?? getCachedApiResponse<DashboardStatsResponse>('/api/dashboard/stats') ?? null
  );
  const [allInterns, setAllInterns] = useState<Mahasiswa[]>(
    cachedOverview?.mahasiswa ?? getCachedApiResponse<Mahasiswa[]>('/api/mahasiswa') ?? []
  );
  const [pksList, setPksList] = useState<UniversitasPKS[]>(
    () => getCachedApiResponse<UniversitasPKS[]>('/api/pks') ?? []
  );
  const [applicants, setApplicants] = useState<Pendaftaran[]>(
    () => getCachedApiResponse<Pendaftaran[]>('/api/pendaftar') ?? []
  );
  const [vacancies, setVacancies] = useState<Lowongan[]>(
    () => getCachedApiResponse<Lowongan[]>('/api/lowongan/admin') ?? []
  );
  const [loading, setLoading] = useState(!stats);
  const [error, setError] = useState('');

  // Scope filters (matching Screenshot 1 structure, tailored to Internship Program)
  const [programFilter, setProgramFilter] = useState<'ALL' | 'MBKM' | 'PKL'>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'Aktif' | 'ALL'>('Aktif');

  const [presentationOpen, setPresentationOpen] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const loadData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError('');
      try {
        const [overviewRes, pksRes, appRes, vacRes] = await Promise.all([
          apiRequest<OverviewPayload>('/api/dashboard/overview'),
          apiRequest<UniversitasPKS[]>('/api/pks').catch(() => [] as UniversitasPKS[]),
          apiRequest<Pendaftaran[]>('/api/pendaftar').catch(() => [] as Pendaftaran[]),
          apiRequest<Lowongan[]>('/api/lowongan/admin').catch(() => [] as Lowongan[]),
        ]);
        if (overviewRes?.stats) {
          setStats(overviewRes.stats);
          primeApiGetCache('/api/dashboard/stats', overviewRes.stats);
        }
        if (Array.isArray(overviewRes?.mahasiswa)) {
          setAllInterns(overviewRes.mahasiswa);
          primeApiGetCache('/api/mahasiswa', overviewRes.mahasiswa);
        }
        setPksList(Array.isArray(pksRes) ? pksRes : []);
        setApplicants(Array.isArray(appRes) ? appRes : []);
        setVacancies(Array.isArray(vacRes) ? vacRes : []);
      } catch (err) {
        if (!silent) {
          setError(
            err instanceof Error
              ? localizeApiMessage(err.message, lang)
              : t('Gagal memuat data laporan eksekutif.', 'Failed to load executive briefing data.')
          );
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [lang, t]
  );

  useEffect(() => {
    void loadData(Boolean(stats));
  }, []);

  useRealtimeSync(
    ['mahasiswa', 'absensi', 'evaluasi', 'pendaftaran', 'universitas_pks', 'lowongan', 'all'],
    () => {
      void loadData(true);
    }
  );

  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    for (const m of allInterns) {
      if (m.department) set.add(m.department);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allInterns]);

  const filteredInterns = useMemo(() => {
    return allInterns.filter((m) => {
      if (statusFilter === 'Aktif' && m.status !== 'Aktif') return false;
      if (programFilter !== 'ALL' && m.program !== programFilter) return false;
      if (departmentFilter !== 'ALL' && m.department !== departmentFilter) return false;
      return true;
    });
  }, [allInterns, statusFilter, programFilter, departmentFilter]);

  const summary = useMemo(() => {
    const total = filteredInterns.length;
    const mbkm = filteredInterns.filter((m) => m.program === 'MBKM').length;
    const pkl = filteredInterns.filter((m) => m.program === 'PKL').length;
    const evaluated = filteredInterns.filter((m) => m.skor > 0);
    const avgScore =
      evaluated.length > 0
        ? Math.round((evaluated.reduce((s, m) => s + m.skor, 0) / evaluated.length) * 10) / 10
        : 0;
    const talentPool = filteredInterns.filter(
      (m) => m.talent === 'Sangat Direkomendasikan' || m.skor >= 30
    ).length;
    const talentPct = evaluated.length > 0 ? Math.round((talentPool / evaluated.length) * 100) : 0;
    const uniqueDepts = new Set(filteredInterns.map((m) => m.department).filter(Boolean)).size;
    const uniqueUnis = new Set(filteredInterns.map((m) => m.universitas).filter(Boolean)).size;

    const totalPks = pksList.length;
    const activePks = pksList.filter((p) => p.status === 'Active').length;
    const pksHealthPct = totalPks > 0 ? Math.round((activePks / totalPks) * 100) : 100;
    const expiringPks = stats?.kpi?.pksMendekatiH30 ?? 0;

    const pendingApplicants = applicants.filter((a) => a.status === 'Pending').length;
    const acceptedApplicants = applicants.filter((a) => a.status === 'Diterima').length;
    const openVacancies = vacancies.filter((v) => v.status === 'Open').length;

    const attendanceRate = stats?.kpi?.kehadiranHariIniRate ?? 0;
    const attendanceCount = stats?.kpi?.kehadiranHariIniCount ?? 0;
    const totalActiveGlobal = stats?.kpi?.totalAktif ?? total;
    const unEvaluated = Math.max(0, total - evaluated.length);

    return {
      total,
      mbkm,
      pkl,
      evaluatedCount: evaluated.length,
      unEvaluated,
      avgScore,
      talentPool,
      talentPct,
      uniqueDepts,
      uniqueUnis,
      totalPks,
      activePks,
      pksHealthPct,
      expiringPks,
      pendingApplicants,
      acceptedApplicants,
      openVacancies,
      attendanceRate,
      attendanceCount,
      totalActiveGlobal,
    };
  }, [filteredInterns, pksList, applicants, vacancies, stats]);

  const scopeLabel = useMemo(() => {
    const prog =
      programFilter === 'ALL'
        ? t('Semua Program (MBKM & PKL)', 'All Programs (MBKM & PKL)')
        : programFilter;
    const dept =
      departmentFilter === 'ALL'
        ? t('Semua Departemen', 'All Departments')
        : departmentFilter;
    return `${prog} · ${dept}`;
  }, [programFilter, departmentFilter, t]);

  const refCode = useMemo(() => {
    const year = (stats?.todayDate || '').slice(0, 4) || String(new Date().getFullYear());
    const month = Number((stats?.todayDate || '').slice(5, 7)) || new Date().getMonth() + 1;
    const q = Math.ceil(month / 3);
    return `REF: AJN/BOD-INTERN/${year}/Q${q}`;
  }, [stats?.todayDate]);

  const handleCopySummary = async () => {
    const today = stats?.todayDate || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
    const text =
      lang === 'en'
        ? [
            `PT AJINOMOTO INDONESIA - PT AJINEX INTERNATIONAL, MOJOKERTO FACTORY`,
            `EXECUTIVE INTERNSHIP & TALENT BRIEFING (${refCode} · ${today})`,
            `Scope: ${scopeLabel}`,
            `------------------------------------------------------------`,
            `1. Active Interns Total   : ${summary.total} (${summary.mbkm} MBKM · ${summary.pkl} PKL across ${summary.uniqueDepts} departments)`,
            `2. Site Attendance Today  : ${summary.attendanceRate}% (${summary.attendanceCount}/${summary.totalActiveGlobal} GPS-verified)`,
            `3. Talent Pool Readiness  : ${summary.talentPool} Highly Recommended (Avg ${summary.avgScore}/40)`,
            `4. University MoA Health  : ${summary.pksHealthPct}% (${summary.activePks}/${summary.totalPks} active · ${summary.expiringPks} H-30)`,
            `5. Recruitment Queue      : ${summary.pendingApplicants} pending applicants · ${summary.openVacancies} open vacancies`,
          ].join('\n')
        : [
            `PT AJINOMOTO INDONESIA - PT AJINEX INTERNATIONAL, MOJOKERTO FACTORY`,
            `RINGKASAN EKSEKUTIF PROGRAM MAGANG & TALENTA (${refCode} · ${today})`,
            `Cakupan: ${scopeLabel}`,
            `------------------------------------------------------------`,
            `1. Total Peserta Magang   : ${summary.total} orang (${summary.mbkm} MBKM · ${summary.pkl} PKL di ${summary.uniqueDepts} departemen)`,
            `2. Kehadiran Pabrik Today : ${summary.attendanceRate}% (${summary.attendanceCount}/${summary.totalActiveGlobal} terverifikasi GPS)`,
            `3. Kesiapan Talent Pool   : ${summary.talentPool} Sangat Direkomendasikan (Rerata ${summary.avgScore}/40)`,
            `4. Kepatuhan PKS Kampus   : ${summary.pksHealthPct}% (${summary.activePks}/${summary.totalPks} aktif · ${summary.expiringPks} H-30)`,
            `5. Antrean Rekrutmen      : ${summary.pendingApplicants} pelamar pending · ${summary.openVacancies} lowongan terbuka`,
          ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSummary(true);
      window.setTimeout(() => setCopiedSummary(false), 2000);
    } catch {
      // ignore clipboard error
    }
  };

  const handleExportCsv = () => {
    const today = stats?.todayDate || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
    exportToCsv(
      `Executive_Internship_Briefing_${today}.csv`,
      filteredInterns.map((m) => ({
        NIM: m.nim,
        Nama: m.nama,
        Program: m.program,
        Departemen: m.department,
        Universitas: m.universitas,
        Jurusan: m.jurusan,
        Status: m.status,
        Skor_Evaluasi: m.skor,
        Rekomendasi_Talent: localizeTalent(m.talent, lang),
        Periode_Mulai: m.tglMasuk,
        Periode_Berakhir: m.tanggalBerakhir,
      }))
    );
  };

  if (loading && !stats) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="surface-card h-44 p-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="surface-card h-32 p-5" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="surface-card lg:col-span-7 h-72 p-6" />
          <div className="surface-card lg:col-span-5 h-72 p-6" />
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200 space-y-3">
        <div>{error}</div>
        <button
          type="button"
          onClick={() => void loadData(false)}
          className="inline-flex items-center gap-1.5 rounded-lg btn-theme-primary px-3.5 py-2 text-xs font-semibold"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t('Muat Ulang Data', 'Reload Data')}
        </button>
      </div>
    );
  }

  const strategicPoints = [
    {
      title: t('Keseimbangan Program MBKM & PKL Lintas Departemen', 'MBKM vs. PKL Cohort Balance Across Departments'),
      body: t(
        `Total ${summary.total} peserta (${summary.mbkm} MBKM dan ${summary.pkl} PKL) aktif mendukung operasional di ${summary.uniqueDepts} departemen pabrik dari ${summary.uniqueUnis} universitas mitra, menjaga transfer pengetahuan tanpa mengganggu ritme kerja produksi.`,
        `A total of ${summary.total} interns (${summary.mbkm} MBKM and ${summary.pkl} PKL) actively support ${summary.uniqueDepts} plant departments from ${summary.uniqueUnis} partner universities, sustaining knowledge transfer without disrupting production lines.`
      ),
      tone: 'emerald' as const,
    },
    {
      title: t('Kualitas Kompetensi 4 Pilar AJIU & Pipeline Talenta', 'AJIU 4-Pillar Competency Quality & Talent Pipeline'),
      body: t(
        `Dari ${summary.evaluatedCount} peserta terevaluasi, rata-rata skor mencapai ${summary.avgScore}/40 dengan ${summary.talentPool} kandidat (${summary.talentPct}%) meraih predikat Sangat Direkomendasikan (≥ 30/40) yang siap masuk jalur rekrutmen strategis.`,
        `Among ${summary.evaluatedCount} evaluated interns, the average competency score stands at ${summary.avgScore}/40 with ${summary.talentPool} candidates (${summary.talentPct}%) achieving Highly Recommended (≥ 30/40) status for strategic recruitment.`
      ),
      tone: 'blue' as const,
    },
    {
      title: t('Disiplin Kehadiran Selfie-Geofence & Kepatuhan Safety First', 'Selfie-Geofence Attendance Discipline & Safety First Compliance'),
      body: t(
        `Tingkat kehadiran hari ini tercatat ${summary.attendanceRate}% (${summary.attendanceCount} dari ${summary.totalActiveGlobal} peserta aktif) melalui validasi koordinat GPS pabrik dan foto langsung, mendukung kepatuhan audit HR & HSE.`,
        `Today's site attendance stands at ${summary.attendanceRate}% (${summary.attendanceCount} of ${summary.totalActiveGlobal} active interns) verified via factory GPS coordinates and live selfie capture, strengthening HR & HSE audit integrity.`
      ),
      tone: 'emerald' as const,
    },
    {
      title: t('Tata Kelola PKS Kampus & Efektivitas Funnel Rekrutmen', 'Campus MoA Governance & Recruitment Funnel Efficiency'),
      body: t(
        `${summary.activePks} dari ${summary.totalPks} PKS universitas berstatus aktif (${summary.pksHealthPct}%) dengan ${summary.expiringPks} kontrak memasuki reminder H-30. Terdapat ${summary.pendingApplicants} pelamar pending terhadap ${summary.openVacancies} lowongan terbuka.`,
        `${summary.activePks} of ${summary.totalPks} university MoAs are active (${summary.pksHealthPct}%) with ${summary.expiringPks} entering the H-30 renewal window. ${summary.pendingApplicants} pending applications await screening across ${summary.openVacancies} open vacancies.`
      ),
      tone: 'amber' as const,
    },
  ];

  const boardDecisions = [
    {
      num: 1,
      title: t('Penetapan Jalur Fast-Track Talent Pool', 'Fast-Track Talent Pool Retention Pathway'),
      status: summary.talentPool > 0 ? t('DIREKOMENDASIKAN', 'RECOMMENDED') : t('PEMANTAUAN', 'MONITORING'),
      statusTone: 'blue' as const,
      desc: t(
        `Prioritaskan ${summary.talentPool} kandidat dengan skor ≥ 30/40 untuk wawancara lanjutan pada kebutuhan posisi tetap maupun Management Trainee Mojokerto Factory.`,
        `Prioritize ${summary.talentPool} top-scoring interns (≥ 30/40) for fast-track interviews toward permanent plant roles and Management Trainee pipelines.`
      ),
    },
    {
      num: 2,
      title: t('Perpanjangan Proaktif PKS Universitas (H-30)', 'Proactive University MoA Renewal (H-30)'),
      status: summary.expiringPks > 0 ? t('PRIORITAS H-30', 'H-30 PRIORITY') : t('DISETUJUI', 'APPROVED'),
      statusTone: summary.expiringPks > 0 ? ('amber' as const) : ('emerald' as const),
      desc: t(
        `Proses pembaruan legal untuk ${summary.expiringPks} kontrak PKS kampus yang mendekati masa berakhir agar penerimaan MBKM/PKL semester berikutnya berjalan tanpa jeda.`,
        `Execute timely legal renewals for ${summary.expiringPks} university MoAs approaching expiry so next-semester MBKM/PKL onboarding runs seamlessly.`
      ),
    },
    {
      num: 3,
      title: t('Penuntasan Evaluasi 4 Pilar & Seleksi Pelamar', '4-Pillar Evaluation & Applicant Screening Closure'),
      status:
        summary.pendingApplicants > 0 || summary.unEvaluated > 0
          ? t('TINDAK LANJUT', 'ACTION REQUIRED')
          : t('OPTIMAL', 'OPTIMAL'),
      statusTone:
        summary.pendingApplicants > 0 || summary.unEvaluated > 0 ? ('amber' as const) : ('emerald' as const),
      desc: t(
        `Selesaikan evaluasi bagi ${summary.unEvaluated} peserta aktif yang belum dinilai serta tinjau ${summary.pendingApplicants} berkas pelamar baru bersama Kepala Departemen terkait.`,
        `Complete competency evaluations for ${summary.unEvaluated} unscored active interns and review ${summary.pendingApplicants} new applications with relevant Department Heads.`
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Executive Hero Briefing Card (inspired by Screenshot 1) */}
      <section className="surface-card p-5 sm:p-6 space-y-5">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-white p-2 ring-1 ring-slate-200/90 shadow-xs shrink-0">
              <img
                src="/assets/aistudio/Logo_Ajinomoto_641a64fc.png"
                alt="PT Ajinomoto Indonesia"
                className="h-8 w-auto object-contain"
              />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-bold uppercase tracking-wider">
                <span className="text-theme-accent">
                  {t('RAHASIA · TOP MANAGEMENT', 'CONFIDENTIAL · TOP MANAGEMENT')}
                </span>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                <span className="font-mono text-slate-500 dark:text-slate-400">{refCode}</span>
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {t(
                  'Ringkasan Eksekutif Program Magang & Talenta',
                  'Executive Internship & Talent Briefing'
                )}
              </h2>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                <span>PT Ajinomoto Indonesia · PT Ajinex International · Mojokerto Factory</span>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  {t(`Tanggal Data: ${stats?.todayDate || '-'}`, `Evaluation Date: ${stats?.todayDate || '-'}`)}
                </span>
              </div>
            </div>
          </div>

          {/* 4 Primary Executive Actions */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setPresentationOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 transition-all whitespace-nowrap"
            >
              <Presentation className="h-4 w-4 text-theme-accent shrink-0" />
              <span>{t('Board Presentation Mode', 'Board Presentation Mode')}</span>
            </button>

            <button
              type="button"
              onClick={handleCopySummary}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              {copiedSummary ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedSummary ? t('Tersalin!', 'Copied!') : t('Salin Ringkasan', 'Copy Summary')}</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{t('Ekspor CSV', 'Export CSV')}</span>
            </button>

            <button
              type="button"
              onClick={() => stats && exportExecutivePdf(stats)}
              disabled={!stats}
              className="inline-flex items-center gap-1.5 rounded-xl btn-theme-primary px-4 py-2.5 text-xs font-bold whitespace-nowrap disabled:opacity-50"
            >
              <FileDown className="h-3.5 w-3.5" />
              <span>{t('Cetak PDF Dossier', 'Print PDF Dossier')}</span>
            </button>
          </div>
        </div>

        {/* Organizational & Program Scope Filter Bar */}
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-900/60 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg icon-theme-plinth shrink-0">
                <Filter className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  {t('Cakupan Program & Evaluasi', 'Program & Evaluation Scope')}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-300">
                  {t(
                    'Filter otomatis menyinkronkan KPI, sintesis Direksi, dan seluruh 5 slide Presentasi.',
                    'Filters dynamically sync KPIs, Board synthesis, and all 5 Presentation slides.'
                  )}
                </div>
              </div>
            </div>

            {/* Program Segmented Filter */}
            <div
              role="group"
              aria-label={t('Filter Program', 'Program Filter')}
              className="inline-flex items-center rounded-lg bg-white p-1 ring-1 ring-slate-200/85 dark:bg-slate-950 dark:ring-slate-800"
            >
              {(['ALL', 'MBKM', 'PKL'] as const).map((opt) => {
                const active = programFilter === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setProgramFilter(opt)}
                    className={`rounded-md px-3 py-1 text-xs font-semibold transition-all whitespace-nowrap ${
                      active
                        ? 'btn-theme-primary'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                    }`}
                  >
                    {opt === 'ALL' ? t('Semua Program', 'All Programs') : opt}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 pt-3 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
              <span>{t('Filter Cakupan Organisasi:', 'Organizational Scope Filter:')}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950">
                <GraduationCap className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="text-slate-500 dark:text-slate-400">{t('Status:', 'Status:')}</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'Aktif' | 'ALL')}
                  className="bg-transparent font-semibold text-slate-900 dark:text-white outline-none"
                >
                  <option value="Aktif" className="dark:bg-slate-900">
                    {t('Peserta Aktif', 'Active Interns')}
                  </option>
                  <option value="ALL" className="dark:bg-slate-900">
                    {t('Semua (Aktif + Alumni)', 'All (Active + Alumni)')}
                  </option>
                </select>
              </div>

              <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950">
                <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="text-slate-500 dark:text-slate-400">{t('Departemen:', 'Department:')}</span>
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="bg-transparent font-semibold text-slate-900 dark:text-white outline-none max-w-[200px]"
                >
                  <option value="ALL" className="dark:bg-slate-900">
                    {t('Semua Departemen (Mojokerto Factory)', 'All Departments (Mojokerto Factory)')}
                  </option>
                  {departmentOptions.map((dept) => (
                    <option key={dept} value={dept} className="dark:bg-slate-900">
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Executive KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-tile p-5 space-y-2.5">
          <div className="flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>{t('TOTAL PESERTA MAGANG', 'TOTAL INTERNS')}</span>
            <GraduationCap className="h-4 w-4 text-theme-accent shrink-0" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-3xl font-extrabold tabular-nums text-slate-900 dark:text-white">
              {summary.total}
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t('orang', 'interns')}
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {summary.mbkm} MBKM · {summary.pkl} PKL · {summary.uniqueDepts}{' '}
            {t('departemen aktif', 'active departments')}
          </p>
        </div>

        <div className="kpi-tile p-5 space-y-2.5">
          <div className="flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>{t('KEHADIRAN & DISIPLIN GPS', 'ATTENDANCE & GPS')}</span>
            <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-3xl font-extrabold tabular-nums text-blue-600 dark:text-blue-400">
              {summary.attendanceRate}%
            </span>
            <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">
              ({summary.attendanceCount}/{summary.totalActiveGlobal})
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-600 dark:bg-blue-400 transition-all"
              style={{ width: `${Math.min(100, Math.max(4, summary.attendanceRate))}%` }}
            />
          </div>
        </div>

        <div className="kpi-tile p-5 space-y-2.5">
          <div className="flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>{t('KESIAPAN TALENT POOL', 'TALENT POOL READY')}</span>
            <Award className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-3xl font-extrabold tabular-nums text-slate-900 dark:text-white">
              {summary.talentPool}
            </span>
            <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
              {summary.talentPct}%
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {t(
              `Rerata evaluasi ${summary.avgScore}/40 (${summary.evaluatedCount} dinilai)`,
              `Evaluation avg ${summary.avgScore}/40 (${summary.evaluatedCount} scored)`
            )}
          </p>
        </div>

        <div className="kpi-tile p-5 space-y-2.5">
          <div className="flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>{t('KEPATUHAN PKS & SELEKSI', 'MOA & GOVERNANCE')}</span>
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-3xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">
              {summary.pksHealthPct}%
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {summary.activePks}/{summary.totalPks} PKS
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {summary.expiringPks} {t('mendekati H-30', 'near H-30')} · {summary.pendingApplicants}{' '}
            {t('pelamar pending', 'pending applicants')}
          </p>
        </div>
      </section>

      {/* 2-Column Executive Synthesis & Board Decisions */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Strategic Summary */}
        <div className="surface-card lg:col-span-7 p-6 space-y-4">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3.5 dark:border-slate-800">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                <Sparkles className="h-4 w-4 text-theme-accent shrink-0" />
                <span>
                  {t(
                    'Ringkasan Strategis untuk Direksi & General Management',
                    'Strategic Summary for Board of Directors & General Management'
                  )}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-300">
                {t(
                  `Sintesis operasional program magang berdasarkan verifikasi data live PostgreSQL lintas ${summary.uniqueDepts} departemen.`,
                  `Executive internship operations synthesis based on live PostgreSQL data across ${summary.uniqueDepts} factory departments.`
                )}
              </p>
            </div>
            <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
              {scopeLabel.split('·')[0]}
            </span>
          </div>

          <div className="space-y-3">
            {strategicPoints.map((pt) => (
              <div
                key={pt.title}
                className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/55 space-y-1.5"
              >
                <div className="flex items-center gap-2 text-xs font-extrabold text-slate-900 dark:text-white">
                  <CheckCircle2
                    className={`h-4 w-4 shrink-0 ${
                      pt.tone === 'emerald'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : pt.tone === 'blue'
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-amber-600 dark:text-amber-400'
                    }`}
                  />
                  <span>{pt.title}</span>
                </div>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 pl-6">
                  {pt.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Board of Directors Decisions */}
        <div className="surface-card lg:col-span-5 p-6 space-y-4">
          <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3.5 dark:border-slate-800">
            <div className="flex items-center gap-2 text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
              <Award className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{t('Keputusan & Arahan Direksi', 'Board of Directors Decisions')}</span>
            </div>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
              {t('Ratifikasi Resmi', 'Official Ratification')}
            </span>
          </div>

          <div className="space-y-3">
            {boardDecisions.map((item) => (
              <div
                key={item.num}
                className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/55 space-y-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-xs font-extrabold text-slate-900 dark:text-white leading-snug">
                    {item.num}. {item.title}
                  </h3>
                  <span
                    className={`text-[10px] font-extrabold uppercase tracking-wider shrink-0 ${
                      item.statusTone === 'emerald'
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : item.statusTone === 'amber'
                          ? 'text-amber-700 dark:text-amber-300'
                          : 'text-blue-700 dark:text-blue-300'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Direct Launch Banner */}
          <div className="rounded-xl border border-slate-200/80 bg-theme-soft p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                {t('Siap Paparan Rapat Pimpinan?', 'Ready for Top Management Briefing?')}
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-300">
                {t(
                  'Buka 5 slide interaktif dengan panduan poin bicara presenter.',
                  'Launch 5 interactive slides with built-in presenter talking points.'
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPresentationOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg btn-theme-primary px-3 py-2 text-xs font-bold shrink-0 whitespace-nowrap"
            >
              <Presentation className="h-3.5 w-3.5" />
              {t('Mulai Presentasi', 'Launch Deck')}
            </button>
          </div>
        </div>
      </section>

      {/* Fullscreen 5-Slide Interactive Board Presentation Modal */}
      {stats && (
        <BoardPresentationModal
          open={presentationOpen}
          onClose={() => setPresentationOpen(false)}
          data={{
            stats,
            interns: filteredInterns,
            pksList,
            applicants,
            vacancies,
            scopeLabel,
          }}
        />
      )}
    </div>
  );
};
