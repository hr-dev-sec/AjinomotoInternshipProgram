import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock,
  Edit2,
  FileDown,
  FileText,
  FileUp,
  Plus,
  Search,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  X,
} from 'lucide-react';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { apiRequest, getCachedApiResponse } from '../../lib/api';
import { exportPksCsv } from '../../lib/exports';
import { localizeApiMessage, localizePksNote } from '../../lib/localizeData';
import { useRealtimeSync } from '../../lib/realtime';
import type { UniversitasPKS } from '../../types/internship';
import { PksDonutChart } from '../Charts';

function daysRemaining(endDate: string): number {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  const a = new Date(`${today}T00:00:00Z`).getTime();
  const b = new Date(`${endDate}T00:00:00Z`).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

export const TabPks: React.FC = () => {
  const { lang, t } = useAppPreferences();
  const initialRows = getCachedApiResponse<UniversitasPKS[]>('/api/pks');
  const [rows, setRows] = useState<UniversitasPKS[]>(Array.isArray(initialRows) ? initialRows : []);
  const [loading, setLoading] = useState(!Array.isArray(initialRows));
  const [errorMsg, setErrorMsg] = useState('');
  const [search, setSearch] = useState('');
  const [reminderNotice, setReminderNotice] = useState('');

  const [pksModalOpen, setPksModalOpen] = useState(false);
  const [editingPksId, setEditingPksId] = useState<string | null>(null);
  const [fUniv, setFUniv] = useState('');
  const [fMulai, setFMulai] = useState('');
  const [fBerakhir, setFBerakhir] = useState('');
  const [fKet, setFKet] = useState('');
  const [fDokNama, setFDokNama] = useState('');
  const [saving, setSaving] = useState(false);

  const loadRows = async (silentArg?: unknown) => {
    const silent = silentArg === true;
    if (!silent) setLoading(true);
    setErrorMsg('');
    try {
      const data = await apiRequest<UniversitasPKS[]>('/api/pks');
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      if (!silent) {
        setErrorMsg(
          err instanceof Error
            ? localizeApiMessage(err.message, lang)
            : t('Gagal memuat data PKS universitas.', 'Failed to load university MoA records.')
        );
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows(Array.isArray(initialRows));
  }, []);

  useRealtimeSync(['universitas_pks', 'all'], () => {
    void loadRows(true);
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const locNote = localizePksNote(r.keterangan, lang);
      return !q || `${r.universitas} ${r.keterangan} ${locNote}`.toLowerCase().includes(q);
    });
  }, [rows, search, lang]);

  const activeCount = rows.filter((r) => r.status === 'Active').length;
  const expiredCount = rows.filter((r) => r.status === 'Expired').length;
  const h30Count = rows.filter((r) => {
    if (r.status !== 'Active') return false;
    const rem = daysRemaining(r.tanggalBerakhir);
    return rem >= 0 && rem <= 30;
  }).length;
  const activeSafeCount = Math.max(0, activeCount - h30Count);

  const openAdd = () => {
    setEditingPksId(null);
    setFUniv('');
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
    setFMulai(today);
    setFBerakhir(today);
    setFKet('');
    setFDokNama('');
    setPksModalOpen(true);
  };

  const openEdit = (p: UniversitasPKS) => {
    setEditingPksId(p.id);
    setFUniv(p.universitas);
    setFMulai(p.tanggalMulai);
    setFBerakhir(p.tanggalBerakhir);
    setFKet(p.keterangan);
    setFDokNama(p.dokumenNama || '');
    setPksModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    try {
      const payload = {
        universitas: fUniv.trim(),
        tanggalMulai: fMulai,
        tanggalBerakhir: fBerakhir,
        keterangan: fKet.trim(),
        dokumenNama: fDokNama || undefined,
      };
      if (editingPksId) {
        await apiRequest(`/api/pks/${editingPksId}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await apiRequest('/api/pks', { method: 'POST', body: JSON.stringify(payload) });
      }
      setPksModalOpen(false);
      await loadRows();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? localizeApiMessage(err.message, lang)
          : t('Gagal menyimpan data PKS.', 'Failed to save MoA record.')
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string) => {
    setErrorMsg('');
    try {
      await apiRequest(`/api/pks/${id}/status`, { method: 'PATCH' });
      await loadRows();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? localizeApiMessage(err.message, lang)
          : t('Gagal mengubah status PKS.', 'Failed to toggle MoA status.')
      );
    }
  };

  const handleCheckReminders = async () => {
    setErrorMsg('');
    try {
      const res = await apiRequest<{
        updatedExpired: number;
        approachingCount: number;
        approaching: Array<{ universitas: string; sisaHari: number }>;
      }>('/api/pks/check-reminders', { method: 'POST' });

      const names = (res.approaching || []).map((a) => `${a.universitas} (H-${a.sisaHari})`).join(', ');
      setReminderNotice(
        t(
          `Pemeriksaan selesai: ${res.updatedExpired} PKS diperbarui Expired · ${res.approachingCount} PKS mendekati H-30${names ? ` (${names})` : ''}. Log pengingat tercatat.`,
          `Audit complete: ${res.updatedExpired} MoA(s) marked Expired · ${res.approachingCount} MoA(s) nearing H-30${names ? ` (${names})` : ''}. Reminder logs recorded.`
        )
      );
      await loadRows();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? localizeApiMessage(err.message, lang)
          : t('Gagal memeriksa reminder PKS.', 'Failed to run MoA reminder check.')
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI + Donut Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="kpi-tile p-4 flex flex-col justify-between gap-2.5">
            <FileText
              className="pointer-events-none absolute -right-2 -bottom-2 h-18 w-18 text-slate-900/[0.04] dark:text-white/[0.04]"
              strokeWidth={1.4}
              aria-hidden="true"
            />
            <div className="relative z-10 flex items-start justify-between gap-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-200">
                {t('Total PKS', 'Total MoAs')}
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white ring-1 ring-inset ring-slate-900/10 dark:bg-slate-800 dark:text-slate-200 shrink-0">
                <FileText className="h-4 w-4" />
              </div>
            </div>
            <div className="relative z-10 font-display text-3xl font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
              {rows.length}
            </div>
            <div className="relative z-10 text-[10px] text-slate-500 dark:text-slate-200">
              {t('Mitra universitas', 'University partners')}
            </div>
          </div>

          <div className="kpi-tile p-4 flex flex-col justify-between gap-2.5">
            <ShieldCheck
              className="pointer-events-none absolute -right-2 -bottom-2 h-18 w-18 text-emerald-600/[0.045] dark:text-emerald-500/[0.05]"
              strokeWidth={1.4}
              aria-hidden="true"
            />
            <div className="relative z-10 flex items-start justify-between gap-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-200">Active</div>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:text-emerald-300 ring-1 ring-inset ring-emerald-200/70 dark:bg-emerald-950/50 dark:ring-emerald-900/60 shrink-0">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
            <div className="relative z-10 font-display text-3xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-300">
              {activeCount}
            </div>
            <div className="relative z-10 inline-flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-3 w-3 shrink-0" />
              <span>{t('Berlaku aktif', 'Currently valid')}</span>
            </div>
          </div>

          <div className="kpi-tile p-4 flex flex-col justify-between gap-2.5">
            <BellRing
              className="pointer-events-none absolute -right-2 -bottom-2 h-18 w-18 text-amber-600/[0.045] dark:text-amber-500/[0.05]"
              strokeWidth={1.4}
              aria-hidden="true"
            />
            <div className="relative z-10 flex items-start justify-between gap-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-200">
                {t('Mendekati H-30', 'Near H-30')}
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:text-amber-300 ring-1 ring-inset ring-amber-200/70 dark:bg-amber-950/50 dark:ring-amber-900/60 shrink-0">
                <BellRing className="h-4 w-4" />
              </div>
            </div>
            <div className="relative z-10 font-display text-3xl font-extrabold tabular-nums text-amber-600 dark:text-amber-300">
              {h30Count}
            </div>
            <div className="relative z-10 inline-flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-300">
              <Clock className="h-3 w-3 shrink-0" />
              <span>{t('Perlu perpanjangan', 'Needs renewal')}</span>
            </div>
          </div>

          <div className="kpi-tile p-4 flex flex-col justify-between gap-2.5">
            <AlertTriangle
              className="pointer-events-none absolute -right-2 -bottom-2 h-18 w-18 text-red-600/[0.045] dark:text-red-500/[0.05]"
              strokeWidth={1.4}
              aria-hidden="true"
            />
            <div className="relative z-10 flex items-start justify-between gap-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-200">Expired</div>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:text-red-300 ring-1 ring-inset ring-red-200/70 dark:bg-red-950/50 dark:ring-red-900/60 shrink-0">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            <div className="relative z-10 font-display text-3xl font-extrabold tabular-nums text-red-600 dark:text-red-300">
              {expiredCount}
            </div>
            <div className="relative z-10 text-[10px] text-red-600 dark:text-red-300">
              {t('Masa kontrak habis', 'Contract ended')}
            </div>
          </div>
        </div>

        <div className="surface-card lg:col-span-5 p-4 flex items-center justify-center">
          <PksDonutChart activeSafe={activeSafeCount} h30={h30Count} expired={expiredCount} />
        </div>
      </div>

      {/* Controls */}
      <div className="surface-card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="relative min-w-0 w-full sm:min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-slate-300" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('Cari universitas mitra atau keterangan...', 'Search partner university or scope...')}
            className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs input-theme-focus dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCheckReminders}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-900/60 whitespace-nowrap"
          >
            <BellRing className="h-3.5 w-3.5" />
            {t('Jalankan Cek H-30 & Expired', 'Run H-30 & Expiry Audit')}
          </button>
          <button
            type="button"
            onClick={() =>
              exportPksCsv(
                filtered.map((item) => ({
                  ...item,
                  keterangan: localizePksNote(item.keterangan, lang),
                }))
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 whitespace-nowrap"
          >
            <FileDown className="h-3.5 w-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 rounded-lg btn-theme-primary px-3.5 py-2 text-xs font-semibold whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('Tambah PKS', 'Add MoA')}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {errorMsg}
        </div>
      )}

      {reminderNotice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
          {reminderNotice}
        </div>
      )}

      {/* PKS Table with Lifespan Timeline Bar */}
      <div className="table-shell">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200/80 bg-stone-50/90 text-slate-600 dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-200">
            <tr>
              <th className="px-4 py-3 font-semibold">{t('Universitas Mitra', 'Partner University')}</th>
              <th className="px-4 py-3 font-semibold">{t('Masa Berlaku & Progres', 'Validity & Progress')}</th>
              <th className="px-4 py-3 font-semibold">{t('Durasi', 'Duration')}</th>
              <th className="px-4 py-3 font-semibold">{t('Dokumen PKS', 'MoA Document')}</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold text-right">{t('Aksi', 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500 dark:text-slate-200">
                  {t('Memuat data PKS...', 'Loading MoA records...')}
                </td>
              </tr>
            ) : (
              filtered.map((p) => {
                const rem = daysRemaining(p.tanggalBerakhir);
                const totalD = Math.max(1, p.durasiHari);
                const remainingRatio =
                  p.status === 'Expired' || rem <= 0 ? 0 : Math.min(100, Math.round((rem / totalD) * 100));
                const localizedNote = localizePksNote(p.keterangan, lang);
                return (
                  <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{p.universitas}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-200 max-w-xs truncate" title={localizedNote}>
                        {localizedNote}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-[11px] min-w-[200px]">
                      <div className="flex items-center justify-between">
                        <span>
                          {p.tanggalMulai} {t('s/d', 'to')} {p.tanggalBerakhir}
                        </span>
                        {p.status === 'Active' && (
                          <span className={rem <= 30 ? 'text-amber-600 font-bold' : 'text-slate-500'}>
                            {rem}
                            {t('h', 'd')}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 h-1.5 w-full rounded-xs bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full ${
                            p.status === 'Expired' ? 'bg-red-600' : rem <= 30 ? 'bg-amber-500' : 'bg-emerald-600'
                          }`}
                          style={{ width: `${p.status === 'Expired' ? 100 : remainingRatio}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums">
                      {p.durasiBulan} {t('bulan', 'mos')} ({p.durasiHari} {t('hr', 'd')})
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600 dark:text-slate-200">
                      {p.dokumenNama || p.linkDataPks}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-semibold ${
                          p.status === 'Active' ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggle(p.id)}
                          className="text-slate-600 hover:text-theme-accent dark:text-slate-300"
                          title={t('Ubah status PKS', 'Toggle MoA status')}
                        >
                          {p.status === 'Active' ? (
                            <ToggleRight className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                          ) : (
                            <ToggleLeft className="h-4 w-4 text-slate-400 dark:text-slate-300" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                        >
                          <Edit2 className="inline h-3 w-3 mr-1" />
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit PKS Modal */}
      {pksModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center modal-backdrop p-3 sm:p-4 overflow-y-auto">
          <form
            onSubmit={handleSave}
            className="surface-card w-full max-w-lg my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">
                {editingPksId ? t('Edit PKS Universitas', 'Edit University MoA') : t('Tambah PKS Universitas Baru', 'Add New University MoA')}
              </h3>
              <button type="button" onClick={() => setPksModalOpen(false)} className="p-1 text-slate-500 dark:text-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">
                  {t('Nama Universitas / Perguruan Tinggi', 'University / Higher Education Institution')}
                </label>
                <input
                  type="text"
                  required
                  value={fUniv}
                  onChange={(e) => setFUniv(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 input-theme-focus dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">{t('Tanggal Mulai', 'Start Date')}</label>
                  <input
                    type="date"
                    required
                    value={fMulai}
                    onChange={(e) => setFMulai(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono input-theme-focus dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">{t('Tanggal Berakhir', 'End Date')}</label>
                  <input
                    type="date"
                    required
                    value={fBerakhir}
                    onChange={(e) => setFBerakhir(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono input-theme-focus dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">{t('Keterangan / Ruang Lingkup', 'Notes / Scope of Cooperation')}</label>
                <textarea
                  rows={2}
                  value={fKet}
                  onChange={(e) => setFKet(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 input-theme-focus dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">{t('Unggah Dokumen PKS (PDF)', 'Upload MoA Document (PDF)')}</label>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-950">
                  <FileUp className="h-4 w-4 text-theme-accent" />
                  <span>{fDokNama || t('Pilih file dokumen PKS (.pdf)', 'Choose MoA document file (.pdf)')}</span>
                  <input
                    type="file"
                    accept="application/pdf"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setFDokNama(file.name);
                    }}
                  />
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPksModalOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium dark:border-slate-700"
              >
                {t('Batal', 'Cancel')}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg btn-theme-primary px-4 py-2 text-xs font-semibold disabled:opacity-50"
              >
                {saving ? t('Menyimpan...', 'Saving...') : t('Simpan PKS', 'Save MoA')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
