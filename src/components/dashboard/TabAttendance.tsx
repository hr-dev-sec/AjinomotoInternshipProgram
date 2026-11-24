import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  FileClock,
  FileDown,
  FileSpreadsheet,
  LogIn,
  RefreshCw,
  Search,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { apiRequest, getCachedApiResponse } from '../../lib/api';
import { exportAttendancePdf, exportToExcel } from '../../lib/exports';
import { localizeApiMessage, localizeAttendanceNote, localizeStatus } from '../../lib/localizeData';
import { useRealtimeSync } from '../../lib/realtime';
import type { DailyAttendanceSummary } from '../../types/internship';
import { AttendanceCompositionBar, CohortPin, GeofenceCohortRadar } from '../Infographics';

interface AnomalyResult {
  ringkasan: string;
  temuan: Array<{ kodePeserta: string; nama: string; tingkatRisiko: string; alasan: string }>;
}

type AttendanceFilter = 'ALL' | 'Masuk' | 'Pulang' | 'Izin' | 'Belum Absen' | 'Anomali';

export const TabAttendance: React.FC = () => {
  const { lang, t } = useAppPreferences();
  const [tanggal, setTanggal] = useState(() =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
  );
  const initialSummary = getCachedApiResponse<DailyAttendanceSummary>(
    `/api/absensi/harian?tanggal=${encodeURIComponent(tanggal)}`
  );
  const [summary, setSummary] = useState<DailyAttendanceSummary | null>(initialSummary);
  const [loading, setLoading] = useState(!initialSummary);
  const [loadError, setLoadError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [photoModal, setPhotoModal] = useState<{ nama: string; src: string; info: string } | null>(null);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AttendanceFilter>('ALL');
  const [selectedNim, setSelectedNim] = useState<string | null>(null);

  const [anomaly, setAnomaly] = useState<AnomalyResult | null>(null);
  const [anomalyLoading, setAnomalyLoading] = useState(false);
  const [anomalyError, setAnomalyError] = useState('');

  const fetchDaily = async (targetDate: string, silent = false) => {
    if (!silent) setLoading(true);
    setLoadError('');
    try {
      const data = await apiRequest<DailyAttendanceSummary>(
        `/api/absensi/harian?tanggal=${encodeURIComponent(targetDate)}`
      );
      setSummary(data);
    } catch (err) {
      if (!silent) {
        setLoadError(
          err instanceof Error
            ? localizeApiMessage(err.message, lang)
            : t('Gagal memuat data absensi harian.', 'Failed to load daily attendance data.')
        );
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    const cached = getCachedApiResponse<DailyAttendanceSummary>(
      `/api/absensi/harian?tanggal=${encodeURIComponent(tanggal)}`
    );
    if (cached) {
      setSummary(cached);
      setLoading(false);
      void fetchDaily(tanggal, true);
    } else {
      void fetchDaily(tanggal, false);
    }
  }, [tanggal]);

  useRealtimeSync(['absensi', 'mahasiswa', 'settings', 'all'], () => {
    if (autoRefresh) {
      void fetchDaily(tanggal, true);
    }
  });

  const maxRadiusMeters = summary?.maxRadiusMeters ?? 650;

  const filteredRecords = useMemo(() => {
    const records = summary?.records ?? [];
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (statusFilter === 'Anomali') {
        const isOut = Boolean(r.anomaliFlag) || (typeof r.jarakMeter === 'number' && r.jarakMeter > maxRadiusMeters);
        if (!isOut) return false;
      } else if (statusFilter !== 'ALL' && r.statusFinal !== statusFilter) {
        return false;
      }
      if (
        q &&
        !`${r.nim} ${r.nama} ${r.department} ${r.universitas}`.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [summary, search, statusFilter, maxRadiusMeters]);

  const handleSelectRadarPin = (pin: CohortPin) => {
    setSelectedNim(pin.nim);
    const rec = summary?.records.find((r) => r.nim === pin.nim);
    if (rec?.linkFoto) {
      setPhotoModal({
        nama: rec.nama,
        src: rec.linkFoto,
        info: `${localizeStatus(rec.statusFinal, lang)} · ${rec.lokasi || ''} (${rec.jarakMeter ?? 0} m)`,
      });
    }
  };

  const handleAnalyzeAnomalies = async () => {
    setAnomalyLoading(true);
    setAnomalyError('');
    try {
      const res = await apiRequest<AnomalyResult>('/api/ai/anomaly', {
        method: 'POST',
        body: JSON.stringify({ tanggal, lang }),
      });
      setAnomaly(res);
    } catch (err) {
      setAnomalyError(
        err instanceof Error
          ? localizeApiMessage(err.message, lang)
          : t('Gagal menganalisis anomali absensi.', 'Failed to analyze attendance anomalies.')
      );
    } finally {
      setAnomalyLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (!summary) return;
    exportToExcel(
      `Absensi_Magang_${summary.tanggal}.xlsx`,
      t('Absensi Harian', 'Daily Attendance'),
      filteredRecords.map((r) => ({
        NIM: r.nim,
        Nama: r.nama,
        Program: r.program,
        Departemen: r.department,
        Universitas: r.universitas,
        Status_Harian: localizeStatus(r.statusFinal, lang),
        Waktu_Masuk: r.waktuMasuk || '-',
        Waktu_Pulang: r.waktuPulang || '-',
        Waktu_Izin: r.waktuIzin || '-',
        Lokasi_GPS: r.lokasi || '-',
        Jarak_Meter: r.jarakMeter ?? '-',
        Catatan: localizeAttendanceNote(r.anomaliFlag || r.keterangan, lang) || '-',
      }))
    );
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="surface-card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {t('Tanggal (WIB):', 'Date (WIB):')}
            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono input-theme-focus dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="accent-theme"
            />
            {t('Auto-refresh 30 detik', 'Auto-refresh 30s')}
          </label>
          <button
            type="button"
            onClick={() => fetchDaily(tanggal)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {t('Muat Ulang', 'Reload')}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleAnalyzeAnomalies}
            disabled={anomalyLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-900/60 whitespace-nowrap"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            {anomalyLoading ? t('Memindai...', 'Scanning...') : t('Deteksi Anomali AI', 'AI Anomaly Detection')}
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 whitespace-nowrap"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />
            {t('Export Excel', 'Export Excel')}
          </button>
          <button
            type="button"
            onClick={() => setPdfPreviewOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg btn-theme-primary px-3.5 py-2 text-xs font-semibold whitespace-nowrap"
          >
            <FileDown className="h-3.5 w-3.5" />
            {t('Preview & PDF', 'Preview & PDF')}
          </button>
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {loadError}
        </div>
      )}

      {/* KPI Strip + Composition Infographic Bar */}
      {summary && (
        <div className="surface-card p-6 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <div className="kpi-tile p-3.5 flex flex-col justify-between gap-2">
              <Users
                className="pointer-events-none absolute -right-2 -bottom-2 h-16 w-16 text-slate-900/[0.04] dark:text-white/[0.04]"
                strokeWidth={1.4}
                aria-hidden="true"
              />
              <div className="relative z-10 flex items-center justify-between gap-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-200">
                  {t('Total Aktif', 'Total Active')}
                </div>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200/80 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700 shrink-0">
                  <Users className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="relative z-10 font-display text-2xl font-extrabold tabular-nums">{summary.kpi.totalAktif}</div>
            </div>

            <div className="kpi-tile p-3.5 flex flex-col justify-between gap-2">
              <LogIn
                className="pointer-events-none absolute -right-2 -bottom-2 h-16 w-16 text-theme-accent opacity-[0.06]"
                strokeWidth={1.4}
                aria-hidden="true"
              />
              <div className="relative z-10 flex items-center justify-between gap-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-200">
                  {t('Masuk', 'Check-In')}
                </div>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg icon-theme-plinth shrink-0">
                  <LogIn className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="relative z-10 font-display text-2xl font-extrabold tabular-nums text-theme-accent">
                {summary.kpi.masuk}
              </div>
            </div>

            <div className="kpi-tile p-3.5 flex flex-col justify-between gap-2">
              <CheckCircle2
                className="pointer-events-none absolute -right-2 -bottom-2 h-16 w-16 text-emerald-600/[0.045] dark:text-emerald-500/[0.05]"
                strokeWidth={1.4}
                aria-hidden="true"
              />
              <div className="relative z-10 flex items-center justify-between gap-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-200">
                  {t('Pulang', 'Check-Out')}
                </div>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:text-emerald-300 ring-1 ring-inset ring-emerald-200/70 dark:bg-emerald-950/50 dark:ring-emerald-900/60 shrink-0">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="relative z-10 font-display text-2xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-300">
                {summary.kpi.pulang}
              </div>
            </div>

            <div className="kpi-tile p-3.5 flex flex-col justify-between gap-2">
              <FileClock
                className="pointer-events-none absolute -right-2 -bottom-2 h-16 w-16 text-amber-600/[0.045] dark:text-amber-500/[0.05]"
                strokeWidth={1.4}
                aria-hidden="true"
              />
              <div className="relative z-10 flex items-center justify-between gap-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-200">
                  {t('Izin / Sakit', 'Leave / Sick')}
                </div>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:text-amber-300 ring-1 ring-inset ring-amber-200/70 dark:bg-amber-950/50 dark:ring-amber-900/60 shrink-0">
                  <FileClock className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="relative z-10 font-display text-2xl font-extrabold tabular-nums text-amber-600 dark:text-amber-300">
                {summary.kpi.izin}
              </div>
            </div>

            <div className="kpi-tile p-3.5 flex flex-col justify-between gap-2">
              <Clock
                className="pointer-events-none absolute -right-2 -bottom-2 h-16 w-16 text-slate-900/[0.04] dark:text-white/[0.04]"
                strokeWidth={1.4}
                aria-hidden="true"
              />
              <div className="relative z-10 flex items-center justify-between gap-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-200">
                  {t('Belum Absen', 'Absent')}
                </div>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 shrink-0">
                  <Clock className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="relative z-10 font-display text-2xl font-extrabold tabular-nums text-slate-700 dark:text-slate-300">
                {summary.kpi.belumAbsen}
              </div>
            </div>

            <div className="kpi-tile p-3.5 flex flex-col justify-between gap-2">
              <Activity
                className="pointer-events-none absolute -right-2 -bottom-2 h-16 w-16 text-slate-900/[0.04] dark:text-white/[0.04]"
                strokeWidth={1.4}
                aria-hidden="true"
              />
              <div className="relative z-10 flex items-center justify-between gap-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-200">
                  {t('Attendance Rate', 'Attendance Rate')}
                </div>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white ring-1 ring-inset ring-slate-900/10 dark:bg-slate-800 dark:text-slate-200 shrink-0">
                  <Activity className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="relative z-10 font-display text-2xl font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
                {summary.kpi.attendanceRate}%
              </div>
            </div>
          </div>

          <AttendanceCompositionBar
            pulang={summary.kpi.pulang}
            masuk={summary.kpi.masuk}
            izin={summary.kpi.izin}
            belumAbsen={summary.kpi.belumAbsen}
            total={summary.kpi.totalAktif}
          />
        </div>
      )}

      {/* Geofence Radar Sebaran Harian */}
      {summary && (
        <GeofenceCohortRadar
          records={summary.records}
          maxRadiusMeters={maxRadiusMeters}
          onSelectRecord={handleSelectRadarPin}
        />
      )}

      {/* AI Anomaly Result */}
      {anomalyError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {anomalyError}
        </div>
      )}
      {anomaly && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 dark:border-amber-900/50 dark:bg-amber-950/20 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-amber-950 dark:text-amber-200">
                {t('Hasil Deteksi Anomali Absensi (AI + Geofence)', 'Attendance Anomaly Detection Results (AI + Geofence)')}
              </h3>
              <p className="mt-1 text-xs text-amber-900 dark:text-amber-300">{anomaly.ringkasan}</p>
            </div>
            <button type="button" onClick={() => setAnomaly(null)} className="text-xs text-amber-800 dark:text-amber-300">
              {t('Tutup', 'Close')}
            </button>
          </div>
          {anomaly.temuan.length > 0 && (
            <div className="divide-y divide-amber-200/70 dark:divide-amber-900/40 text-xs">
              {anomaly.temuan.map((item, i) => (
                <div key={i} className="py-2 flex items-start justify-between gap-4">
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{item.nama}</span>
                    <span className="text-slate-500 dark:text-slate-200"> · {item.alasan}</span>
                  </div>
                  <span className="font-mono font-semibold text-amber-800 dark:text-amber-300 shrink-0">
                    {t('Risiko', 'Risk')} {localizeStatus(item.tingkatRisiko, lang)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filter & Search Bar for Attendance Table */}
      <div className="surface-card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="relative min-w-0 w-full sm:min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-slate-300" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('Cari NIM, nama, departemen...', 'Search NIM, name, department...')}
            className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs input-theme-focus dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          {(
            [
              { id: 'ALL', label: t('Semua', 'All') },
              { id: 'Masuk', label: t('Masuk', 'Check-In') },
              { id: 'Pulang', label: t('Pulang', 'Check-Out') },
              { id: 'Izin', label: t('Izin', 'Leave') },
              { id: 'Belum Absen', label: t('Belum Absen', 'Absent') },
              { id: 'Anomali', label: t('Luar Radius', 'Outside Radius') },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                statusFilter === f.id
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Detail Table */}
      <div className="table-shell">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200/80 bg-stone-50/90 text-slate-600 dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-200">
            <tr>
              <th className="px-4 py-3 font-semibold">{t('NIM & Nama', 'NIM & Name')}</th>
              <th className="px-4 py-3 font-semibold">{t('Program / Dept', 'Program / Dept')}</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">{t('Masuk', 'Check-In')}</th>
              <th className="px-4 py-3 font-semibold">{t('Pulang', 'Check-Out')}</th>
              <th className="px-4 py-3 font-semibold">{t('GPS & Jarak', 'GPS & Distance')}</th>
              <th className="px-4 py-3 font-semibold text-right">{t('Bukti', 'Proof')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500 dark:text-slate-200">
                  {t('Tidak ada catatan presensi yang sesuai filter saat ini.', 'No attendance records match the current filter.')}
                </td>
              </tr>
            ) : (
              filteredRecords.map((r) => {
                const localizedNote = localizeAttendanceNote(r.keterangan, lang);
                const localizedStatus = localizeStatus(r.statusFinal, lang);
                return (
                  <tr
                    key={r.nim}
                    className={`transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40 ${
                      selectedNim === r.nim ? 'bg-theme-soft' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{r.nama}</div>
                      <div className="font-mono text-[11px] text-slate-500 dark:text-slate-200">{r.nim}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      <div>
                        {r.program} · {r.department}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-200">{r.universitas}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-semibold ${
                          r.statusFinal === 'Pulang'
                            ? 'text-emerald-600 dark:text-emerald-300'
                            : r.statusFinal === 'Masuk'
                              ? 'text-theme-accent'
                              : r.statusFinal === 'Izin'
                                ? 'text-amber-600 dark:text-amber-300'
                                : 'text-slate-400 dark:text-slate-300'
                        }`}
                      >
                        {localizedStatus}
                      </span>
                      {localizedNote && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-200 max-w-[180px] truncate" title={localizedNote}>
                          {localizedNote}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums">{r.waktuMasuk || '-'}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">{r.waktuPulang || '-'}</td>
                    <td className="px-4 py-3">
                      {r.lokasi ? (
                        <div className="space-y-0.5">
                          <div className="font-mono text-[11px]">{r.lokasi}</div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-200">
                            {r.jarakMeter} {t('m dari pabrik', 'm from factory')}
                          </div>
                          {r.anomaliFlag && (
                            <div
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300"
                              title={localizeAttendanceNote(r.anomaliFlag, lang)}
                            >
                              <AlertTriangle className="h-3 w-3" />
                              <span>{t('Luar Radius', 'Outside Radius')}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.linkFoto ? (
                        <button
                          type="button"
                          onClick={() =>
                            setPhotoModal({
                              nama: r.nama,
                              src: r.linkFoto || '',
                              info: `${localizedStatus} · ${r.lokasi || ''} (${r.jarakMeter ?? 0} m)`,
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <Eye className="h-3 w-3" />
                          {t('Foto', 'Photo')}
                        </button>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Photo Preview Modal */}
      {photoModal && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center modal-backdrop p-3 sm:p-4 overflow-y-auto">
          <div className="surface-card w-full max-w-md my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{photoModal.nama}</h4>
                <p className="text-xs font-mono text-slate-500 dark:text-slate-200">{photoModal.info}</p>
              </div>
              <button type="button" onClick={() => setPhotoModal(null)} className="p-1 text-slate-500 dark:text-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            {photoModal.src.startsWith('data:application/pdf') ? (
              <iframe src={photoModal.src} title={t('Surat Izin PDF', 'Leave Document PDF')} className="h-80 w-full rounded-lg border" />
            ) : (
              <img
                src={photoModal.src}
                alt={`${t('Foto absensi', 'Attendance photo')} ${photoModal.nama}`}
                className="max-h-80 w-full rounded-lg object-contain bg-slate-100 dark:bg-slate-900"
              />
            )}
          </div>
        </div>
      )}

      {/* PDF Export Preview Modal */}
      {pdfPreviewOpen && summary && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center modal-backdrop p-3 sm:p-4 overflow-y-auto">
          <div className="surface-card w-full max-w-2xl my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {t('Pratinjau Laporan Absensi PDF', 'Attendance PDF Report Preview')}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-200">
                  {t('Tanggal', 'Date')} {summary.tanggal} · {summary.records.length} {t('peserta aktif', 'active interns')}
                </p>
              </div>
              <button type="button" onClick={() => setPdfPreviewOpen(false)} className="p-1 text-slate-500 dark:text-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-lg dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-100">
                  <tr>
                    <th className="px-3 py-2 font-semibold">{t('Nama', 'Name')}</th>
                    <th className="px-3 py-2 font-semibold">{t('Program', 'Program')}</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">{t('Masuk / Pulang', 'In / Out')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-100">
                  {summary.records.map((r) => (
                    <tr key={r.nim}>
                      <td className="px-3 py-2">{r.nama}</td>
                      <td className="px-3 py-2">{r.program}</td>
                      <td className="px-3 py-2">{localizeStatus(r.statusFinal, lang)}</td>
                      <td className="px-3 py-2 font-mono">
                        {r.waktuMasuk || '-'} / {r.waktuPulang || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPdfPreviewOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium dark:border-slate-700"
              >
                {t('Batal', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  exportAttendancePdf(summary);
                  setPdfPreviewOpen(false);
                }}
                className="rounded-lg btn-theme-primary px-4 py-2 text-xs font-semibold"
              >
                {t('Unduh PDF Sekarang', 'Download PDF Now')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
