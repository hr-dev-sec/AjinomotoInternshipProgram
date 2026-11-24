import React, { useEffect, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Award,
  BellRing,
  Bot,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileDown,
  FileWarning,
  GraduationCap,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Trophy,
  UserCheck,
  Users,
} from 'lucide-react';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { apiRequest, getCachedApiResponse, primeApiGetCache } from '../../lib/api';
import { exportExecutivePdf } from '../../lib/exports';
import { localizeApiMessage, localizeTalent } from '../../lib/localizeData';
import { useRealtimeSync } from '../../lib/realtime';
import type { DashboardStatsResponse, Mahasiswa } from '../../types/internship';
import type { DashboardTab } from '../AdminDashboard';
import {
  AttendanceTrendChart,
  CompetencyRadarChart,
  TalentAssessmentCharts,
  UniversityBarChart,
} from '../Charts';
import { DepartmentCapacityChart, KpiSparkline } from '../Infographics';

interface InsightState {
  ringkasanEksekutif: string;
  sorotanKehadiran: string;
  risikoPks: string;
  rekomendasiTalent: string;
  langkahPrioritas: string[];
}

interface DashboardOverviewResponse {
  stats: DashboardStatsResponse;
  mahasiswa: Mahasiswa[];
}

export const TabOverview: React.FC<{
  onOpenAssistant: () => void;
  onNavigateTab?: (tab: DashboardTab) => void;
}> = ({ onOpenAssistant, onNavigateTab }) => {
  const { lang, t } = useAppPreferences();
  const cachedOverview = getCachedApiResponse<DashboardOverviewResponse>('/api/dashboard/overview');
  const initialStats = cachedOverview?.stats ?? getCachedApiResponse<DashboardStatsResponse>('/api/dashboard/stats');
  const initialAllInterns = cachedOverview?.mahasiswa ?? getCachedApiResponse<Mahasiswa[]>('/api/mahasiswa') ?? [];
  const initialActiveInterns = initialAllInterns.filter((item) => item.status === 'Aktif');

  const [stats, setStats] = useState<DashboardStatsResponse | null>(initialStats);
  const [interns, setInterns] = useState<Mahasiswa[]>(initialActiveInterns);
  const [allInterns, setAllInterns] = useState<Mahasiswa[]>(initialAllInterns);
  const [loading, setLoading] = useState(!initialStats);
  const [loadError, setLoadError] = useState('');
  const [uniFilter, setUniFilter] = useState<'ALL' | 'MBKM' | 'PKL'>('ALL');

  const [insight, setInsight] = useState<InsightState | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState('');

  // Quick Assessment state
  const [selectedNim, setSelectedNim] = useState(initialActiveInterns[0]?.nim || '');
  const [skorBk, setSkorBk] = useState(8);
  const [skorPs, setSkorPs] = useState(8);
  const [skorTw, setSkorTw] = useState(8);
  const [skorIs, setSkorIs] = useState(8);
  const [evalSaving, setEvalSaving] = useState(false);
  const [evalMessage, setEvalMessage] = useState('');

  const loadData = async (silentArg?: unknown) => {
    const silent = silentArg === true;
    if (!silent) setLoading(true);
    setLoadError('');
    try {
      const overview = await apiRequest<DashboardOverviewResponse>('/api/dashboard/overview');
      const s = overview.stats;
      const list = Array.isArray(overview.mahasiswa) ? overview.mahasiswa : [];
      primeApiGetCache('/api/dashboard/stats', s);
      primeApiGetCache('/api/mahasiswa', list);
      window.dispatchEvent(new CustomEvent('ajinomoto:dashboard-stats-primed', { detail: s }));

      setStats(s);
      setAllInterns(list);
      const activeList = list.filter((item) => item.status === 'Aktif');
      setInterns(activeList);
      if (!selectedNim && activeList.length > 0) {
        setSelectedNim(activeList[0].nim);
      }
    } catch (err) {
      if (!silent) {
        setLoadError(
          err instanceof Error
            ? localizeApiMessage(err.message, lang)
            : t('Gagal memuat ringkasan dashboard.', 'Failed to load dashboard overview.')
        );
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useRealtimeSync(
    ['mahasiswa', 'absensi', 'evaluasi', 'pendaftaran', 'universitas_pks', 'lowongan', 'settings', 'all'],
    () => {
      void loadData(true);
    }
  );

  useEffect(() => {
    if (initialStats) {
      window.dispatchEvent(new CustomEvent('ajinomoto:dashboard-stats-primed', { detail: initialStats }));
      void loadData(true);
    } else {
      void loadData(false);
    }
  }, []);

  const handleGenerateInsight = async () => {
    setInsightLoading(true);
    setInsightError('');
    try {
      const res = await apiRequest<InsightState>('/api/ai/insight', {
        method: 'POST',
        body: JSON.stringify({ lang }),
      });
      setInsight(res);
    } catch (err) {
      setInsightError(
        err instanceof Error
          ? localizeApiMessage(err.message, lang)
          : t('Gagal memuat AI Executive Insight.', 'Failed to load AI Executive Insight.')
      );
    } finally {
      setInsightLoading(false);
    }
  };

  const totalQuick = skorBk + skorPs + skorTw + skorIs;
  const quickCategoryRaw =
    totalQuick >= 30
      ? 'Sangat Direkomendasikan'
      : totalQuick >= 21
        ? 'Dipertimbangkan'
        : 'Tidak Direkomendasikan';
  const quickCategory = localizeTalent(quickCategoryRaw, lang);

  const handleSubmitQuickEval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNim) return;
    setEvalSaving(true);
    setEvalMessage('');
    try {
      await apiRequest('/api/evaluasi', {
        method: 'POST',
        body: JSON.stringify({ nim: selectedNim, skorBk, skorPs, skorTw, skorIs }),
      });
      setEvalMessage(
        t(
          `Evaluasi tersimpan (${totalQuick}/40 · ${quickCategory}) & disinkronkan ke master peserta.`,
          `Evaluation saved (${totalQuick}/40 · ${quickCategory}) & synced to intern master records.`
        )
      );
      await loadData();
    } catch (err) {
      setEvalMessage(
        err instanceof Error
          ? localizeApiMessage(err.message, lang)
          : t('Gagal menyimpan evaluasi.', 'Failed to save evaluation.')
      );
    } finally {
      setEvalSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="kpi-tile p-5 h-36 flex flex-col justify-between"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-2.5 flex-1">
                  <div className="h-3 w-28 rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="h-8 w-16 rounded bg-slate-200 dark:bg-slate-800" />
                </div>
                <div className="h-10 w-10 rounded-xl bg-slate-200 dark:bg-slate-800" />
              </div>
              <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-800/80" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="surface-card h-16 px-4 py-3 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-slate-200 dark:bg-slate-800 shrink-0" />
              <div className="space-y-1.5 flex-1">
                <div className="h-2.5 w-24 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-3 w-32 rounded bg-slate-100 dark:bg-slate-800/80" />
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="surface-card lg:col-span-7 h-72 p-6" />
          <div className="surface-card lg:col-span-5 h-72 p-6" />
        </div>
      </div>
    );
  }

  if (loadError && !stats) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200 space-y-3">
        <div>{loadError}</div>
        <button
          type="button"
          onClick={loadData}
          className="inline-flex items-center gap-1.5 rounded-lg btn-theme-primary px-3.5 py-2 text-xs font-semibold"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t('Muat Ulang Data', 'Reload Data')}
        </button>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-200">
        {t('Data dashboard belum tersedia.', 'Dashboard data is not available yet.')}
      </div>
    );
  }

  const attendanceSpark = (stats.attendanceTrend || []).map((pt) => pt.masuk + pt.pulang);
  const mbkmShare = stats.kpi?.totalAktif > 0 ? Math.round((stats.kpi.mbkmAktif / stats.kpi.totalAktif) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* 4 Luxury Executive KPI Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-tile p-5 flex flex-col justify-between gap-4">
          <GraduationCap
            className="pointer-events-none absolute -right-2.5 -bottom-2.5 h-22 w-22 text-theme-accent opacity-[0.06]"
            strokeWidth={1.4}
            aria-hidden="true"
          />
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-200">
                {t('Peserta MBKM Aktif', 'Active MBKM Interns')}
              </div>
              <div className="mt-2 font-display text-3xl font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
                {stats.kpi.mbkmAktif}
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl icon-theme-plinth shrink-0">
              <GraduationCap className="h-5 w-5" />
            </div>
          </div>
          <div className="relative z-10 border-t border-slate-100 dark:border-slate-800/80 pt-2.5 flex items-center justify-between text-[11px]">
            <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-200">
              <TrendingUp className="h-3 w-3 text-theme-accent shrink-0" />
              {t('Porsi Kampus Merdeka', 'Kampus Merdeka Share')}
            </span>
            <span className="font-mono font-bold tabular-nums text-theme-accent">{mbkmShare}% cohort</span>
          </div>
        </div>

        <div className="kpi-tile p-5 flex flex-col justify-between gap-4">
          <Users
            className="pointer-events-none absolute -right-2.5 -bottom-2.5 h-22 w-22 text-slate-900/[0.04] dark:text-white/[0.04]"
            strokeWidth={1.4}
            aria-hidden="true"
          />
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-200">
                {t('Peserta PKL Aktif', 'Active PKL Interns')}
              </div>
              <div className="mt-2 font-display text-3xl font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
                {stats.kpi.pklAktif}
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white ring-1 ring-inset ring-slate-900/10 dark:bg-slate-800 dark:text-slate-200 shrink-0">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="relative z-10 border-t border-slate-100 dark:border-slate-800/80 pt-2.5 flex items-center justify-between text-[11px]">
            <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-200">
              <UserCheck className="h-3 w-3 text-slate-500 dark:text-slate-200 shrink-0" />
              {t('Total magang berjalan', 'Total ongoing interns')}
            </span>
            <span className="font-mono font-bold tabular-nums text-slate-800 dark:text-slate-200">
              {stats.kpi.totalAktif} {t('peserta', 'interns')}
            </span>
          </div>
        </div>

        <div className="kpi-tile p-5 flex flex-col justify-between gap-4">
          <CalendarCheck
            className="pointer-events-none absolute -right-2.5 -bottom-2.5 h-22 w-22 text-emerald-600/[0.045] dark:text-emerald-500/[0.05]"
            strokeWidth={1.4}
            aria-hidden="true"
          />
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-200">
                {t('Kehadiran Hari Ini', "Today's Attendance")}
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-display text-3xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-300">
                  {stats.kpi.kehadiranHariIniRate}%
                </span>
                <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-200">
                  {stats.kpi.kehadiranHariIniCount}/{stats.kpi.totalAktif}
                </span>
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:text-emerald-300 ring-1 ring-inset ring-emerald-200/70 dark:bg-emerald-950/50 dark:ring-emerald-900/60 shrink-0">
              <CalendarCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="relative z-10 border-t border-slate-100 dark:border-slate-800/80 pt-2 flex items-center justify-between text-[11px]">
            <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-200">
              <Activity className="h-3 w-3 text-emerald-600 dark:text-emerald-300 shrink-0" />
              {t('Tren 7 hari', '7-day trend')}
            </span>
            <KpiSparkline values={attendanceSpark} color="#16A34A" />
          </div>
        </div>

        <div className="kpi-tile p-5 flex flex-col justify-between gap-4">
          <Award
            className="pointer-events-none absolute -right-2.5 -bottom-2.5 h-22 w-22 text-theme-accent opacity-[0.06]"
            strokeWidth={1.4}
            aria-hidden="true"
          />
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-200">
                {t('Talent Pool (Skor ≥ 30)', 'Talent Pool (Score ≥ 30)')}
              </div>
              <div className="mt-2 font-display text-3xl font-extrabold tabular-nums text-theme-accent">
                {stats.kpi.talentPoolCount}
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl icon-theme-plinth shrink-0">
              <Award className="h-5 w-5" />
            </div>
          </div>
          <div className="relative z-10 border-t border-slate-100 dark:border-slate-800/80 pt-2.5 flex items-center justify-between text-[11px]">
            <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-200">
              <BellRing className="h-3 w-3 text-amber-600 dark:text-amber-300 shrink-0" />
              {t('Status kontrak kampus', 'Campus MoA status')}
            </span>
            <span className="font-mono font-semibold text-amber-600 dark:text-amber-300">
              {stats.kpi.pksMendekatiH30} {t('PKS H-30', 'MoA H-30')}
            </span>
          </div>
        </div>
      </div>

      {/* Action Queue Strip */}
      {stats.actionQueue && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              title: t('Pelamar Menunggu Review', 'Applicants Awaiting Review'),
              count: stats.actionQueue.pendingApplicants,
              unit: t('kandidat Pending', 'Pending candidates'),
              icon: UserCheck,
              tab: 'applicants' as DashboardTab,
              tone: stats.actionQueue.pendingApplicants > 0 ? 'text-theme-accent' : 'text-emerald-600',
            },
            {
              title: t('PKS H-30 / Expired', 'MoA H-30 / Expired'),
              count: stats.actionQueue.expiringOrExpiredPks,
              unit: t('dokumen PKS kampus', 'campus MoA docs'),
              icon: FileWarning,
              tab: 'pks' as DashboardTab,
              tone: stats.actionQueue.expiringOrExpiredPks > 0 ? 'text-amber-600' : 'text-emerald-600',
            },
            {
              title: t('Peserta Belum Dievaluasi', 'Unevaluated Interns'),
              count: stats.actionQueue.unEvaluatedActiveInterns,
              unit: t('peserta aktif', 'active interns'),
              icon: ClipboardCheck,
              tab: 'interns' as DashboardTab,
              tone: stats.actionQueue.unEvaluatedActiveInterns > 0 ? 'text-amber-600' : 'text-emerald-600',
            },
            {
              title: t('Selesai ≤ 30 Hari', 'Ending ≤ 30 Days'),
              count: stats.actionQueue.endingSoonInterns,
              unit: t('siapkan sertifikat QR', 'prepare QR certificates'),
              icon: Clock,
              tab: 'interns' as DashboardTab,
              tone: 'text-slate-900 dark:text-slate-100',
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.title}
                type="button"
                onClick={() => onNavigateTab?.(item.tab)}
                className="surface-card flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:border-theme-accent transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] text-slate-500 dark:text-slate-200 truncate">{item.title}</div>
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      <span className={`font-mono tabular-nums mr-1 ${item.tone}`}>{item.count}</span>
                      <span className="font-normal text-slate-500 dark:text-slate-200">{item.unit}</span>
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400 dark:text-slate-300 shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      {/* AI Executive Insight + Export PDF */}
      <section className="surface-card p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl icon-theme-plinth shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                {t('AI Executive Insight (Data Teranonimkan)', 'AI Executive Insight (Anonymized Data)')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-200">
                {t(
                  'Ringkasan strategis tren kehadiran, kesiapan PKS kampus, dan kandidat terbaik tanpa data pribadi mentah.',
                  'Strategic brief on attendance trends, campus MoA readiness, and top candidates without raw personal PII.'
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleGenerateInsight}
              disabled={insightLoading}
              className="inline-flex items-center gap-1.5 rounded-lg btn-theme-primary px-3.5 py-2 text-xs font-semibold disabled:opacity-50 whitespace-nowrap"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${insightLoading ? 'animate-spin' : ''}`} />
              {insightLoading
                ? t('Menganalisis...', 'Analyzing...')
                : insight
                  ? t('Perbarui AI Insight', 'Refresh AI Insight')
                  : t('Hasilkan AI Insight', 'Generate AI Insight')}
            </button>
            <button
              type="button"
              onClick={onOpenAssistant}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 whitespace-nowrap"
            >
              <Bot className="h-3.5 w-3.5 text-theme-accent" />
              {t('Tanya Asisten HR', 'Ask HR Assistant')}
            </button>
            <button
              type="button"
              onClick={() => exportExecutivePdf(stats, insight)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white whitespace-nowrap"
            >
              <FileDown className="h-3.5 w-3.5" />
              {t('Export Executive PDF', 'Export Executive PDF')}
            </button>
          </div>
        </div>

        {insightError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            {insightError}
          </div>
        )}

        {insight ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-4 dark:border-slate-800 text-xs">
            <div className="space-y-3">
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {t('Ringkasan Eksekutif', 'Executive Summary')}
                </div>
                <p className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">{insight.ringkasanEksekutif}</p>
              </div>
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {t('Sorotan Kehadiran', 'Attendance Highlight')}
                </div>
                <p className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">{insight.sorotanKehadiran}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {t('Risiko PKS & Talent', 'MoA Risk & Talent')}
                </div>
                <p className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
                  {insight.risikoPks} {insight.rekomendasiTalent}
                </p>
              </div>
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {t('Langkah Prioritas HR', 'HR Priority Actions')}
                </div>
                <ul className="mt-1 list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-300">
                  {insight.langkahPrioritas.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-neutral-50 px-4 py-5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
            {lang === 'en' ? (
              <>
                Click <strong>Generate AI Insight</strong> to synthesize an automatic executive brief from current aggregate metrics, or click <strong>Export Executive PDF</strong> directly.
              </>
            ) : (
              <>
                Klik <strong>Hasilkan AI Insight</strong> untuk menyusun ringkasan eksekutif otomatis menggunakan AI Analitik dari data agregat terkini, atau langsung klik <strong>Export Executive PDF</strong>.
              </>
            )}
          </div>
        )}
      </section>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="surface-card lg:col-span-7 p-6 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl icon-theme-plinth shrink-0">
              <CalendarCheck className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                {t('Grafik Absensi per Tanggal', 'Daily Attendance Trend Chart')}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-200">
                {t(
                  'Pergerakan harian presensi masuk, pulang, & izin peserta magang',
                  'Daily movement of intern check-in, check-out, & leave logs'
                )}
              </p>
            </div>
          </div>
          <AttendanceTrendChart data={stats.attendanceTrend} />
        </div>

        <div className="surface-card lg:col-span-5 p-6 space-y-4 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-800 ring-1 ring-inset ring-slate-200/80 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700 shrink-0">
                <GraduationCap className="h-4.5 w-4.5" />
              </div>
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                {t('Distribusi Universitas', 'University Distribution')}
              </h3>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
              {(['ALL', 'MBKM', 'PKL'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setUniFilter(f)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    uniFilter === f
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                      : 'text-slate-600 dark:text-slate-200'
                  }`}
                >
                  {f === 'ALL' ? t('Semua', 'All') : f}
                </button>
              ))}
            </div>
          </div>
          <UniversityBarChart data={stats.universityDistribution} filter={uniFilter} />
        </div>
      </div>

      {/* Talent Assessment Interactive Pie & Bar Charts */}
      <TalentAssessmentCharts interns={allInterns} radarAverage={stats.radarAverage} />

      {/* Quick Assessment + Talent Radar & Top 5 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleSubmitQuickEval}
          className="surface-card lg:col-span-5 p-6 space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-800 ring-1 ring-inset ring-slate-200/80 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700 shrink-0">
              <ClipboardCheck className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                {t('Quick Assessment Kompetensi', 'Quick Competency Assessment')}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-200">
                {t(
                  '≥30 Sangat Direkomendasikan · 21–29 Dipertimbangkan · <21 Tidak Direkomendasikan',
                  '≥30 Highly Recommended · 21–29 Considered · <21 Not Recommended'
                )}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('Peserta Magang Aktif', 'Active Intern')}
            </label>
            <select
              value={selectedNim}
              onChange={(e) => setSelectedNim(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs input-theme-focus dark:border-slate-700 dark:bg-slate-950"
            >
              {interns.map((m) => (
                <option key={m.nim} value={m.nim}>
                  {m.nama} ({m.program} · {m.department})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: 'Business Knowledge (BK)', val: skorBk, set: setSkorBk },
              { label: 'Problem Solving (PS)', val: skorPs, set: setSkorPs },
              { label: 'Teamwork (TW)', val: skorTw, set: setSkorTw },
              { label: 'Interpersonal Skill (IS)', val: skorIs, set: setSkorIs },
            ].map((field) => (
              <div key={field.label}>
                <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-200 mb-1">
                  <span>{field.label}</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{field.val}/10</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={field.val}
                  onChange={(e) => field.set(Number(e.target.value))}
                  className="w-full accent-theme"
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-neutral-50 px-3.5 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-950">
            <span className="text-slate-600 dark:text-slate-200">
              {t('Total Skor:', 'Total Score:')}{' '}
              <strong className="font-mono text-slate-900 dark:text-slate-100">{totalQuick}/40</strong>
            </span>
            <span className="font-semibold text-theme-accent">{quickCategory}</span>
          </div>

          {evalMessage && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span>{evalMessage}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={evalSaving || !selectedNim}
            className="w-full rounded-lg btn-theme-primary px-4 py-2.5 text-xs font-semibold disabled:opacity-50"
          >
            {evalSaving
              ? t('Menyimpan...', 'Saving...')
              : t('Simpan Evaluasi & Sinkronkan', 'Save & Sync Evaluation')}
          </button>
        </form>

        {/* Talent Insight Radar + Top 5 */}
        <div className="surface-card lg:col-span-7 p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:text-amber-300 ring-1 ring-inset ring-amber-200/70 dark:bg-amber-950/40 dark:ring-amber-900/60 shrink-0">
              <Trophy className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                {t('Talent Insight & Top 5 Peserta Magang', 'Talent Insight & Top 5 Interns')}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-200">
                {t(
                  'Profil radar kompetensi kolektif & peringkat skor evaluasi tertinggi',
                  'Collective competency radar profile & highest evaluation rankings'
                )}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <div className="md:col-span-5">
              <CompetencyRadarChart
                bk={stats.radarAverage.bk}
                ps={stats.radarAverage.ps}
                tw={stats.radarAverage.tw}
                is={stats.radarAverage.is}
              />
            </div>
            <div className="md:col-span-7 divide-y divide-slate-100 dark:divide-slate-800">
              {stats.top5Talent.map((talentItem, idx) => (
                <div key={talentItem.nim} className="flex items-center justify-between py-2.5 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-md font-mono text-[11px] font-bold shrink-0 ${
                        idx === 0
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {talentItem.nama}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-200 truncate">
                        {talentItem.program} · {talentItem.universitas} · {talentItem.department}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="inline-flex items-center gap-1 text-xs font-mono font-bold tabular-nums text-theme-accent">
                      <Award className="h-3 w-3 shrink-0" />
                      {talentItem.skor}/40
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-200">
                      {localizeTalent(talentItem.talent, lang)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Department Capacity Breakdown Infographic */}
      <div className="surface-card p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl icon-theme-plinth">
              <Building2 className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                {t('Distribusi Peserta & Rata-Rata Skor per Departemen', 'Intern Distribution & Average Score by Department')}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-200">
                {t(
                  'Komposisi program MBKM vs PKL Mandiri di setiap unit operasional PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory',
                  'MBKM vs. Independent PKL composition across operational units of PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory'
                )}
              </p>
            </div>
          </div>
        </div>
        <DepartmentCapacityChart data={stats.departmentBreakdown || []} />
      </div>
    </div>
  );
};
