import React, { useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  Cpu,
  Edit2,
  FileSpreadsheet,
  FlaskConical,
  FolderOpen,
  Leaf,
  Lock,
  Plus,
  Search,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  UserCheck,
  X,
} from 'lucide-react';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { apiRequest } from '../../lib/api';
import { exportVacanciesExcel } from '../../lib/exports';
import { localizeApiMessage, localizeVacancy } from '../../lib/localizeData';
import { useRealtimeSync } from '../../lib/realtime';
import type { Lowongan, LowonganStatus } from '../../types/internship';

function getRoleIcon(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes('quality') || lower.includes('food')) return FlaskConical;
  if (lower.includes('production') || lower.includes('automation')) return Cpu;
  if (lower.includes('environment') || lower.includes('waste')) return Leaf;
  if (lower.includes('hr') || lower.includes('people')) return UserCheck;
  return Briefcase;
}

export const TabVacancies: React.FC = () => {
  const { lang, t } = useAppPreferences();
  const [rows, setRows] = useState<Lowongan[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | LowonganStatus>('ALL');

  const [vacancyModalOpen, setVacancyModalOpen] = useState(false);
  const [editingVacancyId, setEditingVacancyId] = useState<string | null>(null);

  const [namaPosisi, setNamaPosisi] = useState('');
  const [pendidikan, setPendidikan] = useState('S1 / D4');
  const [prodi, setProdi] = useState('');
  const [skill, setSkill] = useState('');
  const [tugas, setTugas] = useState('');
  const [benefit, setBenefit] = useState('');
  const [status, setStatus] = useState<LowonganStatus>('Open');
  const [saving, setSaving] = useState(false);

  const loadRows = async (silentArg?: unknown) => {
    const silent = silentArg === true;
    if (!silent) setLoading(true);
    setErrorMsg('');
    try {
      const data = await apiRequest<Lowongan[]>('/api/lowongan/admin');
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      if (!silent) {
        setErrorMsg(
          err instanceof Error
            ? localizeApiMessage(err.message, lang)
            : t('Gagal memuat daftar lowongan.', 'Failed to load vacancies.')
        );
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, []);

  useRealtimeSync(['lowongan', 'all'], () => {
    void loadRows(true);
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      const loc = localizeVacancy(r, lang);
      if (q && !`${r.namaPosisi} ${r.prodi} ${r.skill} ${loc.prodi} ${loc.skill}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, statusFilter, lang]);

  const openCount = rows.filter((r) => r.status === 'Open').length;
  const closedCount = rows.filter((r) => r.status === 'Closed').length;

  const openCreate = () => {
    setEditingVacancyId(null);
    setNamaPosisi('');
    setPendidikan('S1 / D4');
    setProdi('');
    setSkill('');
    setTugas('');
    setBenefit('');
    setStatus('Open');
    setVacancyModalOpen(true);
  };

  const openEdit = (item: Lowongan) => {
    setEditingVacancyId(item.id);
    setNamaPosisi(item.namaPosisi);
    setPendidikan(item.pendidikan);
    setProdi(item.prodi);
    setSkill(item.skill);
    setTugas(item.tugas);
    setBenefit(item.benefit);
    setStatus(item.status);
    setVacancyModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    try {
      const payload = { namaPosisi, pendidikan, prodi, skill, tugas, benefit, status };
      if (editingVacancyId) {
        await apiRequest(`/api/lowongan/admin/${editingVacancyId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/api/lowongan/admin', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setVacancyModalOpen(false);
      await loadRows();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? localizeApiMessage(err.message, lang)
          : t('Gagal menyimpan lowongan.', 'Failed to save vacancy.')
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string) => {
    setErrorMsg('');
    try {
      await apiRequest(`/api/lowongan/admin/${id}/status`, { method: 'PATCH' });
      await loadRows();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? localizeApiMessage(err.message, lang)
          : t('Gagal mengubah status lowongan.', 'Failed to toggle vacancy status.')
      );
    }
  };

  return (
    <div className="space-y-5">
      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="kpi-tile p-5 flex flex-col justify-between gap-3">
          <Briefcase
            className="pointer-events-none absolute -right-2.5 -bottom-2.5 h-22 w-22 text-slate-900/[0.04] dark:text-white/[0.04]"
            strokeWidth={1.4}
            aria-hidden="true"
          />
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-200">
                {t('Total Lowongan', 'Total Vacancies')}
              </div>
              <div className="mt-1.5 font-display text-3xl font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
                {rows.length}
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white ring-1 ring-inset ring-slate-900/10 dark:bg-slate-800 dark:text-slate-200 shrink-0">
              <Briefcase className="h-5 w-5" />
            </div>
          </div>
          <div className="relative z-10 border-t border-slate-100 dark:border-slate-800/80 pt-2.5 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-200">
            <Sparkles className="h-3 w-3 text-theme-accent shrink-0" />
            <span>{t('Posisi magang terdaftar', 'Registered internship roles')}</span>
          </div>
        </div>

        <div className="kpi-tile p-5 flex flex-col justify-between gap-3">
          <FolderOpen
            className="pointer-events-none absolute -right-2.5 -bottom-2.5 h-22 w-22 text-emerald-600/[0.045] dark:text-emerald-500/[0.05]"
            strokeWidth={1.4}
            aria-hidden="true"
          />
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-200">
                {t('Status Open', 'Open Status')}
              </div>
              <div className="mt-1.5 font-display text-3xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-300">
                {openCount}
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:text-emerald-300 ring-1 ring-inset ring-emerald-200/70 dark:bg-emerald-950/50 dark:ring-emerald-900/60 shrink-0">
              <FolderOpen className="h-5 w-5" />
            </div>
          </div>
          <div className="relative z-10 border-t border-slate-100 dark:border-slate-800/80 pt-2.5 flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-3 w-3 shrink-0" />
            <span>{t('Aktif tampil di portal pelamar', 'Live on public applicant portal')}</span>
          </div>
        </div>

        <div className="kpi-tile p-5 flex flex-col justify-between gap-3">
          <Lock
            className="pointer-events-none absolute -right-2.5 -bottom-2.5 h-22 w-22 text-slate-900/[0.04] dark:text-white/[0.04]"
            strokeWidth={1.4}
            aria-hidden="true"
          />
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-200">
                {t('Status Closed', 'Closed Status')}
              </div>
              <div className="mt-1.5 font-display text-3xl font-extrabold tabular-nums text-slate-500 dark:text-slate-200">
                {closedCount}
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 shrink-0">
              <Lock className="h-5 w-5" />
            </div>
          </div>
          <div className="relative z-10 border-t border-slate-100 dark:border-slate-800/80 pt-2.5 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-200">
            <Lock className="h-3 w-3 shrink-0" />
            <span>{t('Diarsipkan sementara', 'Temporarily archived')}</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="surface-card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-0 w-full sm:min-w-[220px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-slate-300" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('Cari posisi, prodi, atau skill...', 'Search role, major, or skill...')}
              className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs input-theme-focus dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {(['ALL', 'Open', 'Closed'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-md px-3 py-1 text-xs font-semibold ${
                  statusFilter === s
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-600 dark:text-slate-200'
                }`}
              >
                {s === 'ALL' ? t('Semua', 'All') : s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportVacanciesExcel(filtered.map((item) => localizeVacancy(item, lang)))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 whitespace-nowrap"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />
            Export Excel
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-lg btn-theme-primary px-3.5 py-2 text-xs font-semibold whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('Tambah Lowongan', 'Add Vacancy')}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {errorMsg}
        </div>
      )}

      {/* Vacancy List with Role Icons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-2 py-8 text-center text-xs text-slate-500 dark:text-slate-200">
            {t('Memuat lowongan...', 'Loading vacancies...')}
          </div>
        ) : (
          filtered.map((item) => {
            const loc = localizeVacancy(item, lang);
            const RoleIcon = getRoleIcon(item.namaPosisi);
            return (
              <div
                key={item.id}
                className="kpi-tile flex flex-col justify-between p-5 space-y-4"
              >
                <div className="flex items-start gap-3.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl icon-theme-plinth shrink-0">
                    <RoleIcon className="h-5 w-5" />
                  </div>
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-500 dark:text-slate-200 font-mono">
                        {item.id} · {loc.pendidikan}
                      </span>
                      <span
                        className={`font-semibold ${
                          item.status === 'Open' ? 'text-emerald-600 dark:text-emerald-300' : 'text-slate-400 dark:text-slate-300'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{loc.namaPosisi}</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-200">
                      {t('Prodi:', 'Majors:')} {loc.prodi}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-200 line-clamp-2">
                      {t('Skill:', 'Skills:')} {loc.skill}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleToggle(item.id)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-theme-accent dark:text-slate-300"
                  >
                    {item.status === 'Open' ? (
                      <ToggleRight className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                    ) : (
                      <ToggleLeft className="h-4 w-4 text-slate-400 dark:text-slate-300" />
                    )}
                    {t('Ubah ke', 'Switch to')} {item.status === 'Open' ? 'Closed' : 'Open'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Edit2 className="h-3 w-3" />
                    Edit
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Vacancy Modal */}
      {vacancyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center modal-backdrop p-3 sm:p-4 overflow-y-auto">
          <form
            onSubmit={handleSave}
            className="surface-card w-full max-w-lg my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:p-6 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">
                {editingVacancyId ? t('Edit Lowongan Magang', 'Edit Internship Vacancy') : t('Tambah Lowongan Baru', 'Add New Vacancy')}
              </h3>
              <button type="button" onClick={() => setVacancyModalOpen(false)} className="p-1 text-slate-500 dark:text-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">{t('Nama Posisi', 'Position Title')}</label>
                <input
                  type="text"
                  required
                  value={namaPosisi}
                  onChange={(e) => setNamaPosisi(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 input-theme-focus dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">{t('Pendidikan', 'Education')}</label>
                  <input
                    type="text"
                    required
                    value={pendidikan}
                    onChange={(e) => setPendidikan(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 input-theme-focus dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as LowonganStatus)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 input-theme-focus dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="Open">Open</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">{t('Program Studi / Jurusan', 'Study Program / Majors')}</label>
                <input
                  type="text"
                  required
                  value={prodi}
                  onChange={(e) => setProdi(e.target.value)}
                  placeholder={t('Contoh: Teknik Industri, Teknik Mesin', 'e.g., Industrial Engineering, Mechanical Engineering')}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 input-theme-focus dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">
                  {t('Skill Dibutuhkan (pisahkan dengan ;)', 'Required Skills (separate with ;)')}
                </label>
                <textarea
                  rows={2}
                  value={skill}
                  onChange={(e) => setSkill(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 input-theme-focus dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">
                  {t('Tugas Utama (pisahkan dengan ;)', 'Key Responsibilities (separate with ;)')}
                </label>
                <textarea
                  rows={2}
                  value={tugas}
                  onChange={(e) => setTugas(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 input-theme-focus dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">
                  {t('Benefit (pisahkan dengan ;)', 'Benefits (separate with ;)')}
                </label>
                <textarea
                  rows={2}
                  value={benefit}
                  onChange={(e) => setBenefit(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 input-theme-focus dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setVacancyModalOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium dark:border-slate-700"
              >
                {t('Batal', 'Cancel')}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg btn-theme-primary px-4 py-2 text-xs font-semibold disabled:opacity-50"
              >
                {saving ? t('Menyimpan...', 'Saving...') : t('Simpan Lowongan', 'Save Vacancy')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
