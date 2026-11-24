import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  CheckCircle2,
  FileClock,
  GraduationCap,
  LogIn,
  LogOut,
  PieChart as PieChartIcon,
  Target,
  Users,
  XCircle,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAppPreferences } from '../contexts/AppPreferencesContext';
import { localizeTalent } from '../lib/localizeData';
import type { Mahasiswa } from '../types/internship';

interface TrendPoint {
  tanggal: string;
  masuk: number;
  pulang: number;
  izin: number;
}

interface CustomTooltipPayloadItem {
  name?: string;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
}

const ChartTooltipCard: React.FC<{
  active?: boolean;
  label?: string;
  payload?: readonly CustomTooltipPayloadItem[];
  unit?: string;
}> = ({ active, label, payload, unit = '' }) => {
  const { theme } = useAppPreferences();
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2.5 text-xs shadow-lg backdrop-blur-xs dark:border-slate-700 dark:bg-slate-900/95">
      {label && (
        <div className="mb-1.5 font-mono font-bold text-slate-900 dark:text-slate-100">
          {label}
        </div>
      )}
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <span
                className="h-2.5 w-2.5 rounded-xs shrink-0"
                style={{ backgroundColor: entry.color || theme.accentHex }}
              />
              <span>{entry.name}</span>
            </span>
            <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {entry.value}
              {unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const AttendanceTrendChart: React.FC<{ data: TrendPoint[] }> = ({ data }) => {
  const { theme, t } = useAppPreferences();
  const [chartType, setChartType] = useState<'stacked' | 'grouped'>('stacked');

  const lblPulang = t('Pulang', 'Check-Out');
  const lblMasuk = t('Masuk', 'Check-In');
  const lblIzin = t('Izin', 'Leave');
  const axisTickColor = theme.isDark ? '#E2E8F0' : '#475569';

  const chartData = useMemo(
    () =>
      (data || []).map((d) => ({
        tanggal: d.tanggal,
        label: d.tanggal.slice(5),
        Pulang: d.pulang,
        Masuk: d.masuk,
        Izin: d.izin,
        Total: d.pulang + d.masuk + d.izin,
      })),
    [data]
  );

  const total7Days = chartData.reduce((sum, item) => sum + item.Total, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-200">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5 font-mono tabular-nums text-slate-700 dark:text-slate-300">
            <Activity className="h-3.5 w-3.5 text-theme-accent shrink-0" />
            {t('Total 7 hari:', '7-Day Total:')} <strong>{total7Days}</strong> {t('log', 'logs')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <LogOut className="h-3 w-3 text-emerald-600 dark:text-emerald-300 shrink-0" />
            {lblPulang}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <LogIn className="h-3 w-3 text-theme-accent shrink-0" />
            {lblMasuk}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <FileClock className="h-3 w-3 text-amber-500 shrink-0" />
            {lblIzin}
          </span>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setChartType('stacked')}
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              chartType === 'stacked'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                : 'text-slate-600 dark:text-slate-200'
            }`}
          >
            <BarChart3 className="h-3 w-3 shrink-0" />
            {t('Bertumpuk', 'Stacked')}
          </button>
          <button
            type="button"
            onClick={() => setChartType('grouped')}
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              chartType === 'grouped'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                : 'text-slate-600 dark:text-slate-200'
            }`}
          >
            <BarChart3 className="h-3 w-3 shrink-0" />
            {t('Berdampingan', 'Grouped')}
          </button>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="py-16 text-center text-xs text-slate-500 dark:text-slate-200">
          {t('Belum ada data tren absensi 7 hari terakhir.', 'No attendance trend data in the last 7 days.')}
        </div>
      ) : (
        <div className="h-60 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.22)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: axisTickColor, fontFamily: 'monospace' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: axisTickColor, fontFamily: 'monospace' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
                content={({ active, payload }) => {
                  const first = payload?.[0]?.payload as { tanggal?: string; Total?: number } | undefined;
                  return (
                    <ChartTooltipCard
                      active={active}
                      label={first?.tanggal ? `${first.tanggal} (Total: ${first.Total ?? 0})` : undefined}
                      payload={payload as readonly CustomTooltipPayloadItem[]}
                    />
                  );
                }}
              />
              <Bar
                dataKey="Pulang"
                name={lblPulang}
                stackId={chartType === 'stacked' ? 'att' : undefined}
                fill="#16A34A"
                radius={chartType === 'stacked' ? [0, 0, 0, 0] : [4, 4, 0, 0]}
                maxBarSize={34}
              />
              <Bar
                dataKey="Masuk"
                name={lblMasuk}
                stackId={chartType === 'stacked' ? 'att' : undefined}
                fill={theme.accentHex}
                radius={chartType === 'stacked' ? [0, 0, 0, 0] : [4, 4, 0, 0]}
                maxBarSize={34}
              />
              <Bar
                dataKey="Izin"
                name={lblIzin}
                stackId={chartType === 'stacked' ? 'att' : undefined}
                fill="#D97706"
                radius={[4, 4, 0, 0]}
                maxBarSize={34}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

interface UniDistItem {
  universitas: string;
  mbkm: number;
  pkl: number;
  total: number;
}

export const UniversityBarChart: React.FC<{
  data: UniDistItem[];
  filter: 'ALL' | 'MBKM' | 'PKL';
}> = ({ data, filter }) => {
  const { theme, t } = useAppPreferences();
  const [viewMode, setViewMode] = useState<'pie' | 'bar'>('pie');

  const chartColors = useMemo(
    () => [
      theme.accentHex,
      theme.isDark ? '#94A3B8' : '#1E293B',
      '#16A34A',
      '#D97706',
      '#3B82F6',
      '#8B5CF6',
      '#14B8A6',
    ],
    [theme.accentHex, theme.isDark]
  );

  const axisTickColor = theme.isDark ? '#E2E8F0' : '#475569';
  const yLabelColor = theme.isDark ? '#F1F5F9' : '#334155';

  const mapped = useMemo(
    () =>
      (data || [])
        .map((u, idx) => ({
          universitas: u.universitas,
          shortName:
            u.universitas.length > 20 ? `${u.universitas.slice(0, 18)}…` : u.universitas,
          MBKM: u.mbkm,
          PKL: u.pkl,
          value: filter === 'MBKM' ? u.mbkm : filter === 'PKL' ? u.pkl : u.total,
          color: chartColors[idx % chartColors.length],
        }))
        .filter((u) => u.value > 0)
        .sort((a, b) => b.value - a.value),
    [data, filter, chartColors]
  );

  const totalCount = mapped.reduce((s, m) => s + m.value, 0);

  if (mapped.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-200">
        {t('Belum ada peserta aktif untuk filter program ini.', 'No active interns for this program filter.')}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-200">
        <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
          <GraduationCap className="h-3.5 w-3.5 text-theme-accent shrink-0" />
          <span>
            {mapped.length} {t('kampus', 'universities')} · <strong>{totalCount}</strong> {t('peserta', 'interns')}
          </span>
        </span>
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setViewMode('pie')}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors ${
              viewMode === 'pie'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                : 'text-slate-600 dark:text-slate-200'
            }`}
          >
            <PieChartIcon className="h-3 w-3 shrink-0" />
            Pie Chart
          </button>
          <button
            type="button"
            onClick={() => setViewMode('bar')}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors ${
              viewMode === 'bar'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                : 'text-slate-600 dark:text-slate-200'
            }`}
          >
            <BarChart3 className="h-3 w-3 shrink-0" />
            Bar Chart
          </button>
        </div>
      </div>

      {viewMode === 'pie' ? (
        <div className="space-y-3">
          <div className="relative h-48 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={mapped}
                  dataKey="value"
                  nameKey="universitas"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={78}
                  paddingAngle={2.5}
                >
                  {mapped.map((entry, idx) => (
                    <Cell key={entry.universitas} fill={chartColors[idx % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    const row = payload?.[0]?.payload as (typeof mapped)[number] | undefined;
                    if (!active || !row) return null;
                    const pct = totalCount > 0 ? Math.round((row.value / totalCount) * 100) : 0;
                    return (
                      <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {row.universitas}
                        </div>
                        <div className="mt-1 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                          Total: <strong>{row.value}</strong> ({pct}%) · MBKM {row.MBKM} / PKL {row.PKL}
                        </div>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {totalCount}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-200">{t('Peserta', 'Interns')}</span>
            </div>
          </div>

          <div className="max-h-28 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs pr-1">
            {mapped.map((item, idx) => {
              const pct = totalCount > 0 ? Math.round((item.value / totalCount) * 100) : 0;
              return (
                <div key={item.universitas} className="flex items-center justify-between py-1.5 gap-2">
                  <span className="flex items-center gap-2 min-w-0 text-slate-700 dark:text-slate-300">
                    <span
                      className="h-2.5 w-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: chartColors[idx % chartColors.length] }}
                    />
                    <span className="truncate">{item.universitas}</span>
                  </span>
                  <span className="font-mono tabular-nums text-[11px] text-slate-600 dark:text-slate-200 shrink-0">
                    <strong className="text-slate-900 dark:text-slate-100">{item.value}</strong> ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="h-64 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={mapped}
              layout="vertical"
              margin={{ top: 4, right: 12, left: 4, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(148, 163, 184, 0.2)" />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fontSize: 10.5, fill: axisTickColor, fontFamily: 'monospace' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="shortName"
                width={106}
                tick={{ fontSize: 10.5, fill: yLabelColor }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
                content={({ active, payload }) => {
                  const row = payload?.[0]?.payload as (typeof mapped)[number] | undefined;
                  return (
                    <ChartTooltipCard
                      active={active}
                      label={row?.universitas}
                      payload={payload as readonly CustomTooltipPayloadItem[]}
                      unit={t(' mhs', ' interns')}
                    />
                  );
                }}
              />
              {filter === 'ALL' ? (
                <>
                  <Bar dataKey="MBKM" stackId="uni" fill={theme.accentHex} barSize={16} />
                  <Bar
                    dataKey="PKL"
                    stackId="uni"
                    fill={theme.isDark ? '#64748B' : '#1E293B'}
                    radius={[0, 4, 4, 0]}
                    barSize={16}
                  />
                </>
              ) : (
                <Bar
                  dataKey="value"
                  name={filter}
                  fill={filter === 'MBKM' ? theme.accentHex : theme.isDark ? '#64748B' : '#1E293B'}
                  radius={[0, 4, 4, 0]}
                  barSize={16}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export const TalentAssessmentCharts: React.FC<{
  interns: Mahasiswa[];
  radarAverage: { bk: number; ps: number; tw: number; is: number };
}> = ({ interns, radarAverage }) => {
  const { theme, lang, t } = useAppPreferences();
  const [barMode, setBarMode] = useState<'interns' | 'pillars'>('interns');
  const axisTickColor = theme.isDark ? '#E2E8F0' : '#475569';

  const categoryPieData = useMemo(() => {
    const counts = {
      'Sangat Direkomendasikan': 0,
      Dipertimbangkan: 0,
      'Tidak Direkomendasikan': 0,
      'Belum Dievaluasi': 0,
    };
    for (const m of interns) {
      if (m.talent in counts) {
        counts[m.talent as keyof typeof counts] += 1;
      } else {
        counts['Belum Dievaluasi'] += 1;
      }
    }
    return [
      {
        name: t('Sangat Direkomendasikan (>=30)', 'Highly Recommended (>=30)'),
        short: localizeTalent('Sangat Direkomendasikan', lang),
        value: counts['Sangat Direkomendasikan'],
        color: '#16A34A',
      },
      {
        name: t('Dipertimbangkan (21-29)', 'Considered (21-29)'),
        short: localizeTalent('Dipertimbangkan', lang),
        value: counts.Dipertimbangkan,
        color: '#D97706',
      },
      {
        name: t('Tidak Direkomendasikan (<21)', 'Not Recommended (<21)'),
        short: localizeTalent('Tidak Direkomendasikan', lang),
        value: counts['Tidak Direkomendasikan'],
        color: '#DC2626',
      },
      {
        name: t('Belum Dievaluasi', 'Not Evaluated'),
        short: localizeTalent('Belum Dievaluasi', lang),
        value: counts['Belum Dievaluasi'],
        color: '#94A3B8',
      },
    ].filter((d) => d.value > 0);
  }, [interns, lang, t]);

  const evaluatedBarData = useMemo(
    () =>
      interns
        .filter((m) => m.skor > 0)
        .sort((a, b) => b.skor - a.skor)
        .slice(0, 10)
        .map((m) => ({
          nama: m.nama.split(' ').slice(0, 2).join(' '),
          fullName: m.nama,
          department: m.department,
          program: m.program,
          talent: localizeTalent(m.talent, lang),
          Skor: m.skor,
        })),
    [interns, lang]
  );

  const pillarBarData = useMemo(
    () => [
      { pilar: 'BK', namaPilar: 'Business Knowledge', Skor: radarAverage.bk },
      { pilar: 'PS', namaPilar: 'Problem Solving', Skor: radarAverage.ps },
      { pilar: 'TW', namaPilar: 'Teamwork', Skor: radarAverage.tw },
      { pilar: 'IS', namaPilar: 'Interpersonal Skill', Skor: radarAverage.is },
    ],
    [radarAverage]
  );

  const evaluatedCount = interns.filter((m) => m.skor > 0).length;
  const avgTotalScore =
    evaluatedCount > 0
      ? (interns.filter((m) => m.skor > 0).reduce((s, m) => s + m.skor, 0) / evaluatedCount).toFixed(1)
      : '0.0';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left: Interactive Pie Chart of Talent Recommendations */}
      <div className="surface-card lg:col-span-5 p-6 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl icon-theme-plinth shrink-0">
              <PieChartIcon className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                {t('Proporsi Kategori Evaluasi Talent', 'Talent Evaluation Category Split')}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-200">
                {t(
                  `Distribusi rekomendasi hasil penilaian ${interns.length} peserta magang`,
                  `Recommendation distribution across ${interns.length} interns`
                )}
              </p>
            </div>
          </div>
          <div className="text-right font-mono tabular-nums shrink-0">
            <div className="inline-flex items-center gap-1 text-base font-extrabold text-theme-accent">
              <Award className="h-4 w-4 shrink-0" />
              {avgTotalScore}/40
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-200">{t('Rata-rata Nilai', 'Average Score')}</div>
          </div>
        </div>

        {categoryPieData.length === 0 ? (
          <div className="py-14 text-center text-xs text-slate-500 dark:text-slate-200">
            {t('Belum ada data peserta untuk dianalisis.', 'No intern data available for analysis.')}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative h-52 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={82}
                    paddingAngle={3}
                  >
                    {categoryPieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      const item = payload?.[0]?.payload as (typeof categoryPieData)[number] | undefined;
                      if (!active || !item) return null;
                      const pct = interns.length > 0 ? Math.round((item.value / interns.length) * 100) : 0;
                      return (
                        <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{item.name}</div>
                          <div className="mt-1 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                            {t('Jumlah:', 'Count:')}{' '}
                            <strong>
                              {item.value} {t('peserta', 'interns')}
                            </strong>{' '}
                            ({pct}%)
                          </div>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {evaluatedCount}/{interns.length}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-200">{t('Sudah Dinilai', 'Evaluated')}</span>
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {categoryPieData.map((c) => {
                const pct = interns.length > 0 ? Math.round((c.value / interns.length) * 100) : 0;
                return (
                  <div key={c.name} className="flex items-center justify-between py-1.5 gap-2">
                    <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <span className="h-2.5 w-2.5 rounded-xs shrink-0" style={{ backgroundColor: c.color }} />
                      <span>{c.name}</span>
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                      {c.value} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Right: Interactive Bar Chart of Assessment Scores */}
      <div className="surface-card lg:col-span-7 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-800 ring-1 ring-inset ring-slate-200/80 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700 shrink-0">
              <BarChart3 className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                {t('Analisis Skor Evaluasi Kompetensi', 'Competency Evaluation Score Analysis')}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-200">
                {barMode === 'interns'
                  ? t(
                      'Perbandingan skor total peserta terevaluasi terhadap ambang Talent Pool (30/40)',
                      'Total score comparison of evaluated interns vs. Talent Pool threshold (30/40)'
                    )
                  : t(
                      'Rata-rata skor 4 pilar kompetensi terhadap target standar (7.5/10)',
                      'Average 4-pillar competency scores vs. target benchmark (7.5/10)'
                    )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setBarMode('interns')}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                barMode === 'interns'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-200'
              }`}
            >
              <Users className="h-3 w-3 shrink-0" />
              {t('Skor Peserta', 'Intern Scores')}
            </button>
            <button
              type="button"
              onClick={() => setBarMode('pillars')}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                barMode === 'pillars'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-200'
              }`}
            >
              <Target className="h-3 w-3 shrink-0" />
              {t('4 Pilar (BK/PS/TW/IS)', '4 Pillars (BK/PS/TW/IS)')}
            </button>
          </div>
        </div>

        {barMode === 'interns' ? (
          evaluatedBarData.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-500 dark:text-slate-200">
              {t('Belum ada peserta yang selesai dievaluasi.', 'No evaluated interns yet.')}
            </div>
          ) : (
            <div className="h-64 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={evaluatedBarData} margin={{ top: 12, right: 12, left: -16, bottom: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.22)" />
                  <XAxis
                    dataKey="nama"
                    tick={{ fontSize: 10.5, fill: axisTickColor }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 40]}
                    tick={{ fontSize: 11, fill: axisTickColor, fontFamily: 'monospace' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <ReferenceLine
                    y={30}
                    stroke={theme.isDark ? '#4ADE80' : '#16A34A'}
                    strokeDasharray="4 4"
                    label={{
                      value: t('Target Talent Pool (30)', 'Talent Pool Target (30)'),
                      position: 'insideTopRight',
                      fill: theme.isDark ? '#4ADE80' : '#15803D',
                      fontSize: 10,
                      fontFamily: 'monospace',
                    }}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
                    content={({ active, payload }) => {
                      const row = payload?.[0]?.payload as (typeof evaluatedBarData)[number] | undefined;
                      if (!active || !row) return null;
                      return (
                        <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{row.fullName}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-200">
                            {row.program} · {row.department}
                          </div>
                          <div className="mt-1 font-mono text-[11px] font-bold text-theme-accent">
                            {t('Skor', 'Score')}: {row.Skor}/40 · {row.talent}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="Skor" name={t('Skor', 'Score')} radius={[4, 4, 0, 0]} maxBarSize={36}>
                    {evaluatedBarData.map((entry) => (
                      <Cell
                        key={entry.fullName}
                        fill={
                          entry.Skor >= 30
                            ? '#16A34A'
                            : entry.Skor >= 21
                              ? '#D97706'
                              : '#DC2626'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )
        ) : (
          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pillarBarData} margin={{ top: 12, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.22)" />
                <XAxis
                  dataKey="namaPilar"
                  tick={{ fontSize: 11, fill: axisTickColor }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 10]}
                  tick={{ fontSize: 11, fill: axisTickColor, fontFamily: 'monospace' }}
                  axisLine={false}
                  tickLine={false}
                />
                <ReferenceLine
                  y={7.5}
                  stroke={theme.isDark ? '#4ADE80' : '#16A34A'}
                  strokeDasharray="4 4"
                  label={{
                    value: 'Target (7.5)',
                    position: 'insideTopRight',
                    fill: theme.isDark ? '#4ADE80' : '#15803D',
                    fontSize: 10,
                    fontFamily: 'monospace',
                  }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
                  content={({ active, payload }) => {
                    const row = payload?.[0]?.payload as (typeof pillarBarData)[number] | undefined;
                    if (!active || !row) return null;
                    return (
                      <ChartTooltipCard
                        active={active}
                        label={`${row.namaPilar} (${row.pilar})`}
                        payload={payload as readonly CustomTooltipPayloadItem[]}
                        unit=" / 10"
                      />
                    );
                  }}
                />
                <Bar dataKey="Skor" name={t('Skor', 'Score')} fill={theme.accentHex} radius={[4, 4, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};

export const CompetencyRadarChart: React.FC<{
  bk: number;
  ps: number;
  tw: number;
  is: number;
}> = ({ bk, ps, tw, is }) => {
  const { theme, t } = useAppPreferences();
  const angleTickColor = theme.isDark ? '#F1F5F9' : '#334155';

  const radarData = useMemo(
    () => [
      { axis: `BK (${bk})`, label: 'Business Knowledge', score: bk, target: 7.5 },
      { axis: `PS (${ps})`, label: 'Problem Solving', score: ps, target: 7.5 },
      { axis: `TW (${tw})`, label: 'Teamwork', score: tw, target: 7.5 },
      { axis: `IS (${is})`, label: 'Interpersonal Skill', score: is, target: 7.5 },
    ],
    [bk, ps, tw, is]
  );

  return (
    <div className="flex flex-col items-center space-y-2 w-full">
      <div className="h-56 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="68%" data={radarData}>
            <PolarGrid stroke="rgba(148, 163, 184, 0.3)" />
            <PolarAngleAxis
              dataKey="axis"
              tick={{ fontSize: 10.5, fill: angleTickColor, fontWeight: 700 }}
            />
            <PolarRadiusAxis angle={45} domain={[0, 10]} tick={false} axisLine={false} />
            <Radar
              name={t('Target Talent (7.5)', 'Talent Target (7.5)')}
              dataKey="target"
              stroke="#16A34A"
              strokeDasharray="4 4"
              fill="transparent"
            />
            <Radar
              name={t('Skor Aktual', 'Actual Score')}
              dataKey="score"
              stroke={theme.accentHex}
              strokeWidth={2}
              fill={theme.accentHex}
              fillOpacity={0.22}
            />
            <Tooltip
              content={({ active, payload }) => {
                const row = payload?.[0]?.payload as { label?: string } | undefined;
                return (
                  <ChartTooltipCard
                    active={active}
                    label={row?.label}
                    payload={payload as readonly CustomTooltipPayloadItem[]}
                    unit=" / 10"
                  />
                );
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-200">
        <span className="inline-flex items-center gap-1.5">
          <Activity className="h-3 w-3 text-theme-accent" /> {t('Rata-rata Peserta', 'Intern Average')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Target className="h-3 w-3 text-emerald-600 dark:text-emerald-300" /> {t('Target Talent (7.5)', 'Talent Target (7.5)')}
        </span>
      </div>
    </div>
  );
};

export const PksDonutChart: React.FC<{
  activeSafe: number;
  h30: number;
  expired: number;
}> = ({ activeSafe, h30, expired }) => {
  const { t } = useAppPreferences();
  const total = activeSafe + h30 + expired;
  const donutData = [
    { name: t('Active (>30 hari)', 'Active (>30 days)'), value: activeSafe, color: '#16A34A' },
    { name: t('Mendekati H-30', 'Near H-30'), value: h30, color: '#D97706' },
    { name: 'Expired', value: expired, color: '#DC2626' },
  ].filter((d) => d.value > 0);

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 w-full">
      <div className="relative h-28 w-28 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={donutData.length > 0 ? donutData : [{ name: t('Kosong', 'Empty'), value: 1, color: '#E2E8F0' }]}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={34}
              outerRadius={50}
              paddingAngle={donutData.length > 1 ? 3 : 0}
            >
              {(donutData.length > 0 ? donutData : [{ name: t('Kosong', 'Empty'), value: 1, color: '#E2E8F0' }]).map(
                (entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                )
              )}
            </Pie>
            {donutData.length > 0 && (
              <Tooltip
                content={({ active, payload }) => (
                  <ChartTooltipCard
                    active={active}
                    payload={payload as readonly CustomTooltipPayloadItem[]}
                    unit={t(' kampus', ' campuses')}
                  />
                )}
              />
            )}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="text-base font-bold font-mono tabular-nums">{total}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-200">Total</div>
        </div>
      </div>
      <div className="space-y-2 text-xs w-full sm:w-auto flex-1 min-w-0">
        <div className="flex items-center justify-between gap-6">
          <span className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300 shrink-0" /> {t('Active (>30 hari)', 'Active (>30 days)')}
          </span>
          <span className="font-mono tabular-nums font-semibold">{activeSafe}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300 shrink-0" /> {t('Mendekati H-30', 'Near H-30')}
          </span>
          <span className="font-mono tabular-nums font-semibold">{h30}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-300 shrink-0" /> Expired
          </span>
          <span className="font-mono tabular-nums font-semibold">{expired}</span>
        </div>
      </div>
    </div>
  );
};
