import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Award, CheckCircle2, ClipboardList, Edit2, Eye, FileClock, FileSpreadsheet, LogIn, Plus, Search, X } from 'lucide-react';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { apiRequest, getCachedApiResponse } from '../../lib/api';
import { exportInternCertificatePdf, exportToExcel } from '../../lib/exports';
import {
  localizeApiMessage,
  localizeGender,
  localizeMajor,
  localizeStatus,
  localizeTalent,
} from '../../lib/localizeData';
import { useRealtimeSync } from '../../lib/realtime';
import type {
  GenderCode,
  InternDetailResponse,
  Mahasiswa,
  MahasiswaStatus,
  ProgramType,
} from '../../types/internship';
import { CompetencyRadarChart } from '../Charts';

const PAGE_SIZE = 6;

export const TabInterns: React.FC = () => {
  const { lang, t } = useAppPreferences();
  const initialRows = getCachedApiResponse<Mahasiswa[]>('/api/mahasiswa');
  const [rows, setRows] = useState<Mahasiswa[]>(Array.isArray(initialRows) ? initialRows : []);
  const [loading, setLoading] = useState(!Array.isArray(initialRows));
  const [loadError, setLoadError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | MahasiswaStatus>('ALL');
  const [evalFilter, setEvalFilter] = useState<string>('ALL');
  const [programFilter, setProgramFilter] = useState<'ALL' | ProgramType>('ALL');
  const [page, setPage] = useState(1);

  const [detailTarget, setDetailTarget] = useState<Mahasiswa | null>(null);
  const [detailData, setDetailData] = useState<InternDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  // Inline evaluation state
  const [evalBk, setEvalBk] = useState(8);
  const [evalPs, setEvalPs] = useState(8);
  const [evalTw, setEvalTw] = useState(8);
  const [evalIs, setEvalIs] = useState(8);
  const [evalSaving, setEvalSaving] = useState(false);
  const [evalNotice, setEvalNotice] = useState('');

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingNim, setEditingNim] = useState<string | null>(null);

  const [fNim, setFNim] = useState('');
  const [fNama, setFNama] = useState('');
  const [fProgram, setFProgram] = useState<ProgramType>('MBKM');
  const [fDept, setFDept] = useState('Quality Assurance');
  const [fUniv, setFUniv] = useState('');
  const [fJurusan, setFJurusan] = useState('');
  const [fTglMasuk, setFTglMasuk] = useState('');
  const [fTglBerakhir, setFTglBerakhir] = useState('');
  const [fGender, setFGender] = useState<GenderCode>('L');
  const [fStatus, setFStatus] = useState<MahasiswaStatus>('Aktif');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadRows = async (silentArg?: unknown) => {
    const silent = silentArg === true;
    if (!silent) setLoading(true);
    setLoadError('');
    try {
      const data = await apiRequest<Mahasiswa[]>('/api/mahasiswa');
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      if (!silent) {
        setLoadError(
          err instanceof Error
            ? localizeApiMessage(err.message, lang)
            : t('Gagal memuat data peserta magang.', 'Failed to load intern records.')
        );
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows(Array.isArray(initialRows));
  }, []);

  useRealtimeSync(['mahasiswa', 'evaluasi', 'pendaftaran', 'all'], () => {
    void loadRows(true);
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((m) => {
      if (statusFilter !== 'ALL' && m.status !== statusFilter) return false;
      if (programFilter !== 'ALL' && m.program !== programFilter) return false;
      if (evalFilter !== 'ALL' && m.talent !== evalFilter) return false;
      if (
        q &&
        !`${m.nim} ${m.nama} ${m.universitas} ${m.department} ${m.jurusan} ${localizeMajor(m.jurusan, lang)}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [rows, search, statusFilter, programFilter, evalFilter, lang]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, evalFilter, programFilter]);

  const openAddModal = () => {
    setEditingNim(null);
    setFNim('');
    setFNama('');
    setFProgram('MBKM');
    setFDept('Quality Assurance');
    setFUniv('');
    setFJurusan('');
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
    setFTglMasuk(today);
    setFTglBerakhir(today);
    setFGender('L');
    setFStatus('Aktif');
    setFormError('');
    setFormModalOpen(true);
  };

  const openEditModal = (m: Mahasiswa) => {
    setEditingNim(m.nim);
    setFNim(m.nim);
    setFNama(m.nama);
    setFProgram(m.program);
    setFDept(m.department);
    setFUniv(m.universitas);
    setFJurusan(m.jurusan);
    setFTglMasuk(m.tglMasuk);
    setFTglBerakhir(m.tanggalBerakhir);
    setFGender(m.gender);
    setFStatus(m.status);
    setFormError('');
    setFormModalOpen(true);
  };

  const handleSaveIntern = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        nim: fNim.trim(),
        nama: fNama.trim(),
        program: fProgram,
        department: fDept.trim(),
        universitas: fUniv.trim(),
        jurusan: fJurusan.trim(),
        tglMasuk: fTglMasuk,
        tanggalBerakhir: fTglBerakhir,
        gender: fGender,
        status: fStatus,
      };
      if (editingNim) {
        await apiRequest(`/api/mahasiswa/${encodeURIComponent(editingNim)}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/api/mahasiswa', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setFormModalOpen(false);
      await loadRows();
    } catch (err) {
      setFormError(
        err instanceof Error
          ? localizeApiMessage(err.message, lang)
          : t('Gagal menyimpan data peserta.', 'Failed to save intern record.')
      );
    } finally {
      setSaving(false);
    }
  };

  const openDetailModal = async (m: Mahasiswa) => {
    setDetailTarget(m);
    setDetailData(null);
    setDetailError('');
    setEvalNotice('');
    setDetailLoading(true);
    try {
      const res = await apiRequest<InternDetailResponse>(`/api/mahasiswa/${encodeURIComponent(m.nim)}/detail`);
      setDetailData(res);
      setDetailTarget(res.mahasiswa);
      const latest = res.evaluasiHistory[0];
      if (latest) {
        setEvalBk(latest.skorBk);
        setEvalPs(latest.skorPs);
        setEvalTw(latest.skorTw);
        setEvalIs(latest.skorIs);
      } else {
        setEvalBk(8);
        setEvalPs(8);
        setEvalTw(8);
        setEvalIs(8);
      }
    } catch (err) {
      setDetailError(
        err instanceof Error
          ? localizeApiMessage(err.message, lang)
          : t('Gagal memuat profil kompetensi dan riwayat peserta.', 'Failed to load competency profile and intern history.')
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSaveEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailTarget) return;
    setEvalSaving(true);
    setEvalNotice('');
    setDetailError('');
    try {
      const res = await apiRequest<{ mahasiswa: Mahasiswa }>('/api/evaluasi', {
        method: 'POST',
        body: JSON.stringify({
          nim: detailTarget.nim,
          skorBk: evalBk,
          skorPs: evalPs,
          skorTw: evalTw,
          skorIs: evalIs,
        }),
      });
      setDetailTarget(res.mahasiswa);
      setEvalNotice(
        t(
          `Evaluasi tersimpan: Total ${res.mahasiswa.skor}/40 (${localizeTalent(res.mahasiswa.talent, lang)}).`,
          `Evaluation saved: Total ${res.mahasiswa.skor}/40 (${localizeTalent(res.mahasiswa.talent, lang)}).`
        )
      );
      const updatedDetail = await apiRequest<InternDetailResponse>(
        `/api/mahasiswa/${encodeURIComponent(detailTarget.nim)}/detail`
      );
      setDetailData(updatedDetail);
      await loadRows();
    } catch (err) {
      setDetailError(
        err instanceof Error
          ? localizeApiMessage(err.message, lang)
          : t('Gagal menyimpan evaluasi kompetensi.', 'Failed to save competency evaluation.')
      );
    } finally {
      setEvalSaving(false);
    }
  };

  const handleExportInternsExcel = () => {
    exportToExcel(
      'Daftar_Peserta_Magang_Ajinomoto.xlsx',
      t('Peserta Magang', 'Intern Records'),
      filtered.map((m) => ({
        NIM: m.nim,
        Nama: m.nama,
        Gender: localizeGender(m.gender, lang),
        Program: m.program,
        Departemen: m.department,
        Universitas: m.universitas,
        Jurusan: localizeMajor(m.jurusan, lang),
        Tanggal_Masuk: m.tglMasuk,
        Tanggal_Berakhir: m.tanggalBerakhir,
        Status: localizeStatus(m.status, lang),
        Skor: m.skor,
        Rekomendasi_Talent: localizeTalent(m.talent, lang),
      }))
    );
  };

  return (
    <div className="space-y-5">
      {/* Filter & Add Bar */}
      <div className="surface-card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-0 w-full sm:min-w-[220px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-slate-300" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('Cari NIM, nama, kampus, departemen...', 'Search NIM, name, university, dept...')}
              className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs input-theme-focus dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <select
            value={programFilter}
            onChange={(e) => setProgramFilter(e.target.value as 'ALL' | ProgramType)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs input-theme-focus dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="ALL">{t('Semua Program', 'All Programs')}</option>
            <option value="MBKM">MBKM</option>
            <option value="PKL">PKL</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | MahasiswaStatus)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs input-theme-focus dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="ALL">{t('Semua Status', 'All Statuses')}</option>
            <option value="Aktif">{t('Aktif', 'Active')}</option>
            <option value="Tidak Aktif">{t('Tidak Aktif', 'Inactive')}</option>
          </select>
          <select
            value={evalFilter}
            onChange={(e) => setEvalFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs input-theme-focus dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="ALL">{t('Semua Evaluasi', 'All Evaluations')}</option>
            <option value="Sangat Direkomendasikan">{t('Sangat Direkomendasikan (≥30)', 'Highly Recommended (≥30)')}</option>
            <option value="Dipertimbangkan">{t('Dipertimbangkan (21–29)', 'Considered (21–29)')}</option>
            <option value="Tidak Direkomendasikan">{t('Tidak Direkomendasikan (<21)', 'Not Recommended (<21)')}</option>
            <option value="Belum Dievaluasi">{t('Belum Dievaluasi', 'Not Evaluated')}</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportInternsExcel}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 whitespace-nowrap"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />
            Export Excel
          </button>
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 rounded-lg btn-theme-primary px-3.5 py-2 text-xs font-semibold whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('Tambah Peserta', 'Add Intern')}
          </button>
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {loadError}
        </div>
      )}

      {/* Table with visual score bar */}
      <div className="table-shell">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200/80 bg-stone-50/90 text-slate-600 dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-200">
            <tr>
              <th className="px-4 py-3 font-semibold">{t('Peserta', 'Intern')}</th>
              <th className="px-4 py-3 font-semibold">{t('Program & Dept', 'Program & Dept')}</th>
              <th className="px-4 py-3 font-semibold">{t('Periode Magang', 'Internship Period')}</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">{t('Evaluasi & Skor', 'Evaluation & Score')}</th>
              <th className="px-4 py-3 font-semibold text-right">{t('Aksi', 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500 dark:text-slate-200">
                  {t('Memuat data peserta...', 'Loading intern records...')}
                </td>
              </tr>
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500 dark:text-slate-200">
                  {t('Tidak ada peserta yang cocok dengan filter saat ini.', 'No interns match the current filter.')}
                </td>
              </tr>
            ) : (
              paginated.map((m) => {
                const pct = Math.min(100, Math.round((m.skor / 40) * 100));
                return (
                  <tr key={m.nim} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {m.nama} ({lang === 'en' ? (m.gender === 'L' ? 'M' : 'F') : m.gender})
                      </div>
                      <div className="font-mono text-[11px] text-slate-500 dark:text-slate-200">
                        {m.nim} · {m.universitas}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {m.program} · {m.department}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-200">{localizeMajor(m.jurusan, lang)}</div>
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-[11px] text-slate-600 dark:text-slate-200">
                      {m.tglMasuk} {t('s/d', 'to')} {m.tanggalBerakhir}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-semibold ${
                          m.status === 'Aktif' ? 'text-emerald-600 dark:text-emerald-300' : 'text-slate-400 dark:text-slate-300'
                        }`}
                      >
                        {localizeStatus(m.status, lang)}
                      </span>
                    </td>
                    <td className="px-4 py-3 min-w-[160px]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100">
                          {m.skor > 0 ? `${m.skor}/40` : '-'}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-200">{localizeTalent(m.talent, lang)}</span>
                      </div>
                      {m.skor > 0 && (
                        <div className="mt-1.5 h-1.5 w-full rounded-xs bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full ${
                              m.skor >= 30 ? 'bg-emerald-600' : m.skor >= 21 ? 'bg-amber-500' : 'bg-red-600'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openDetailModal(m)}
                          className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <Eye className="inline h-3 w-3 mr-1" />
                          {t('Detail & Nilai', 'Detail & Score')}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(m)}
                          className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
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

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-200">
        <span>
          {t(
            `Menampilkan ${paginated.length} dari ${filtered.length} peserta`,
            `Showing ${paginated.length} of ${filtered.length} interns`
          )}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40 dark:border-slate-700"
          >
            {t('Sebelumnya', 'Previous')}
          </button>
          <span className="font-mono tabular-nums">
            {t('Hal', 'Page')} {safePage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40 dark:border-slate-700"
          >
            {t('Berikutnya', 'Next')}
          </button>
        </div>
      </div>

      {/* Detail + Competency Radar + Inline Evaluation + Certificate QR PDF Modal */}
      {detailTarget && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center modal-backdrop p-3 sm:p-4 overflow-y-auto">
          <div className="surface-card w-full max-w-2xl my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-theme-accent">
                  {t('Profil Kompetensi & Rekam Magang', 'Competency Profile & Internship Record')}
                </p>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{detailTarget.nama}</h3>
                <p className="text-xs font-mono text-slate-500 dark:text-slate-200">
                  NIM {detailTarget.nim} · {localizeGender(detailTarget.gender, lang)} · {detailTarget.program}
                </p>
              </div>
              <button type="button" onClick={() => setDetailTarget(null)} className="p-1 text-slate-500 dark:text-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border-y border-slate-100 py-4 text-xs dark:border-slate-800">
              <div>
                <span className="text-slate-500 dark:text-slate-200">{t('Departemen', 'Department')}</span>
                <div className="font-semibold text-slate-900 dark:text-slate-100">{detailTarget.department}</div>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-200">{t('Universitas', 'University')}</span>
                <div className="font-semibold text-slate-900 dark:text-slate-100">{detailTarget.universitas}</div>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-200">{t('Jurusan', 'Major')}</span>
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {localizeMajor(detailTarget.jurusan, lang)}
                </div>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-200">{t('Periode', 'Period')}</span>
                <div className="font-mono text-slate-900 dark:text-slate-100">
                  {detailTarget.tglMasuk} {t('s/d', 'to')} {detailTarget.tanggalBerakhir}
                </div>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-200">Status</span>
                <div className={`font-semibold ${detailTarget.status === 'Aktif' ? 'text-emerald-600 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-200'}`}>
                  {localizeStatus(detailTarget.status, lang)}
                </div>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-200">{t('Evaluasi Talent', 'Talent Evaluation')}</span>
                <div className="font-semibold text-theme-accent font-mono">
                  {detailTarget.skor}/40 · {localizeTalent(detailTarget.talent, lang)}
                </div>
              </div>
            </div>

            {detailError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                {detailError}
              </div>
            )}
            {evalNotice && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{evalNotice}</span>
              </div>
            )}

            {detailLoading ? (
              <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-200">
                {t('Memuat riwayat presensi & radar kompetensi...', 'Loading attendance history & competency radar...')}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                {/* Left: Personal Radar + Attendance Summary */}
                <div className="md:col-span-6 space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-neutral-50/70 p-4 dark:border-slate-800 dark:bg-slate-950">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100 mb-2">
                      <Award className="h-3.5 w-3.5 text-theme-accent shrink-0" />
                      <span>{t('Radar 4 Pilar Kompetensi', '4-Pillar Competency Radar')}</span>
                    </div>
                    {detailData?.evaluasiHistory[0] ? (
                      <CompetencyRadarChart
                        bk={detailData.evaluasiHistory[0].skorBk}
                        ps={detailData.evaluasiHistory[0].skorPs}
                        tw={detailData.evaluasiHistory[0].skorTw}
                        is={detailData.evaluasiHistory[0].skorIs}
                      />
                    ) : (
                      <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-200">
                        {t(
                          'Peserta belum memiliki skor evaluasi. Gunakan formulir di samping untuk menilai.',
                          'Intern has no evaluation score yet. Use the form on the right to submit scores.'
                        )}
                      </div>
                    )}
                  </div>

                  {detailData && (
                    <div className="rounded-xl border border-slate-200 bg-neutral-50/70 p-4 dark:border-slate-800 dark:bg-slate-950 space-y-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
                        <ClipboardList className="h-3.5 w-3.5 text-theme-accent" />
                        {t('Ringkasan Presensi Terakhir', 'Recent Attendance Summary')}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                        <div className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900 space-y-0.5">
                          <div className="inline-flex items-center justify-center gap-1 text-[10px] text-slate-500 dark:text-slate-200">
                            <LogIn className="h-2.5 w-2.5 text-theme-accent" />
                            <span>{t('Masuk', 'In')}</span>
                          </div>
                          <div className="font-mono font-bold tabular-nums text-theme-accent">
                            {detailData.attendanceSummary.totalMasuk}
                          </div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900 space-y-0.5">
                          <div className="inline-flex items-center justify-center gap-1 text-[10px] text-slate-500 dark:text-slate-200">
                            <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-300" />
                            <span>{t('Pulang', 'Out')}</span>
                          </div>
                          <div className="font-mono font-bold tabular-nums text-emerald-600 dark:text-emerald-300">
                            {detailData.attendanceSummary.totalPulang}
                          </div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900 space-y-0.5">
                          <div className="inline-flex items-center justify-center gap-1 text-[10px] text-slate-500 dark:text-slate-200">
                            <FileClock className="h-2.5 w-2.5 text-amber-600 dark:text-amber-300" />
                            <span>{t('Izin', 'Leave')}</span>
                          </div>
                          <div className="font-mono font-bold tabular-nums text-amber-600 dark:text-amber-300">
                            {detailData.attendanceSummary.totalIzin}
                          </div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900 space-y-0.5">
                          <div className="inline-flex items-center justify-center gap-1 text-[10px] text-slate-500 dark:text-slate-200">
                            <AlertTriangle className="h-2.5 w-2.5 text-slate-500 dark:text-slate-200" />
                            <span>{t('Anomali', 'Anomaly')}</span>
                          </div>
                          <div className="font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100">
                            {detailData.attendanceSummary.totalAnomali}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Inline Evaluation Form + History */}
                <div className="md:col-span-6 space-y-4">
                  <form
                    onSubmit={handleSaveEvaluation}
                    className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {t('Input / Perbarui Evaluasi Kompetensi', 'Submit / Update Competency Evaluation')}
                      </span>
                      <span className="font-mono text-xs font-bold text-theme-accent tabular-nums">
                        Total: {evalBk + evalPs + evalTw + evalIs}/40
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 text-xs">
                      <label className="space-y-1">
                        <span className="text-[11px] text-slate-600 dark:text-slate-200">Business Knowledge (1–10)</span>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={evalBk}
                          onChange={(e) => setEvalBk(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
                          className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono input-theme-focus dark:border-slate-700 dark:bg-slate-900"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px] text-slate-600 dark:text-slate-200">Problem Solving (1–10)</span>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={evalPs}
                          onChange={(e) => setEvalPs(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
                          className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono input-theme-focus dark:border-slate-700 dark:bg-slate-900"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px] text-slate-600 dark:text-slate-200">Teamwork (1–10)</span>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={evalTw}
                          onChange={(e) => setEvalTw(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
                          className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono input-theme-focus dark:border-slate-700 dark:bg-slate-900"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px] text-slate-600 dark:text-slate-200">Interpersonal Skill (1–10)</span>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={evalIs}
                          onChange={(e) => setEvalIs(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
                          className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono input-theme-focus dark:border-slate-700 dark:bg-slate-900"
                        />
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={evalSaving}
                      className="w-full rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                    >
                      {evalSaving
                        ? t('Menyimpan Evaluasi...', 'Saving Evaluation...')
                        : t('Simpan Nilai Kompetensi', 'Save Competency Score')}
                    </button>
                  </form>

                  {detailData && detailData.evaluasiHistory.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-neutral-50/70 p-4 dark:border-slate-800 dark:bg-slate-950 space-y-2">
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {t('Riwayat Penilaian', 'Evaluation History')} ({detailData.evaluasiHistory.length})
                      </div>
                      <div className="max-h-32 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800 text-[11px]">
                        {detailData.evaluasiHistory.map((ev) => (
                          <div key={ev.id} className="py-1.5 flex items-center justify-between gap-2">
                            <span className="font-mono text-slate-500 dark:text-slate-200">{ev.timestamp}</span>
                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                              {ev.skor}/40 · {localizeTalent(ev.rekomendasi, lang)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDetailTarget(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium dark:border-slate-700"
              >
                {t('Tutup', 'Close')}
              </button>
              <button
                type="button"
                onClick={() => exportInternCertificatePdf(detailTarget)}
                className="inline-flex items-center gap-1.5 rounded-lg btn-theme-primary px-4 py-2 text-xs font-semibold"
              >
                <Award className="h-3.5 w-3.5" />
                {t('Cetak Laporan & Sertifikat QR PDF', 'Print Report & QR Certificate PDF')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Intern Modal */}
      {formModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center modal-backdrop p-3 sm:p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveIntern}
            className="surface-card w-full max-w-lg my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {editingNim
                  ? t(`Edit Peserta (${editingNim})`, `Edit Intern (${editingNim})`)
                  : t('Tambah Peserta Magang Baru', 'Add New Intern')}
              </h3>
              <button type="button" onClick={() => setFormModalOpen(false)} className="p-1 text-slate-500 dark:text-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">NIM</label>
                <input
                  type="text"
                  required
                  disabled={Boolean(editingNim)}
                  value={fNim}
                  onChange={(e) => setFNim(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono disabled:bg-slate-100 input-theme-focus dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">{t('Nama Lengkap', 'Full Name')}</label>
                <input
                  type="text"
                  required
                  value={fNama}
                  onChange={(e) => setFNama(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 input-theme-focus dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Program</label>
                <select
                  value={fProgram}
                  onChange={(e) => setFProgram(e.target.value as ProgramType)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 input-theme-focus dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="MBKM">MBKM</option>
                  <option value="PKL">PKL</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">{t('Departemen', 'Department')}</label>
                <input
                  type="text"
                  required
                  value={fDept}
                  onChange={(e) => setFDept(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 input-theme-focus dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">{t('Universitas', 'University')}</label>
                <input
                  type="text"
                  required
                  value={fUniv}
                  onChange={(e) => setFUniv(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 input-theme-focus dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">{t('Jurusan', 'Major')}</label>
                <input
                  type="text"
                  required
                  value={fJurusan}
                  onChange={(e) => setFJurusan(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 input-theme-focus dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">{t('Tanggal Masuk', 'Start Date')}</label>
                <input
                  type="date"
                  required
                  value={fTglMasuk}
                  onChange={(e) => setFTglMasuk(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono input-theme-focus dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">{t('Tanggal Berakhir', 'End Date')}</label>
                <input
                  type="date"
                  required
                  value={fTglBerakhir}
                  onChange={(e) => setFTglBerakhir(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono input-theme-focus dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">{t('Gender (L/P)', 'Gender')}</label>
                <select
                  value={fGender}
                  onChange={(e) => setFGender(e.target.value as GenderCode)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 input-theme-focus dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="L">{t('Laki-laki (L)', 'Male (L)')}</option>
                  <option value="P">{t('Perempuan (P)', 'Female (P)')}</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Status</label>
                <select
                  value={fStatus}
                  onChange={(e) => setFStatus(e.target.value as MahasiswaStatus)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 input-theme-focus dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="Aktif">{t('Aktif', 'Active')}</option>
                  <option value="Tidak Aktif">{t('Tidak Aktif', 'Inactive')}</option>
                </select>
              </div>
            </div>

            {formError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                {formError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setFormModalOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium dark:border-slate-700"
              >
                {t('Batal', 'Cancel')}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg btn-theme-primary px-4 py-2 text-xs font-semibold disabled:opacity-50"
              >
                {saving ? t('Menyimpan...', 'Saving...') : t('Simpan Data', 'Save Data')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
