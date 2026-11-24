import React, { useEffect, useMemo, useState } from 'react';
import { Check, Eye, FileDown, Mail, Search, Sparkles, X } from 'lucide-react';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { apiRequest } from '../../lib/api';
import { exportApplicantsCsv } from '../../lib/exports';
import {
  localizeApiMessage,
  localizeCvSummary,
  localizeMajor,
  localizeStatus,
} from '../../lib/localizeData';
import { useRealtimeSync } from '../../lib/realtime';
import type { Pendaftaran, PendaftaranStatus, ProgramType } from '../../types/internship';
import { RecruitmentFunnelBar } from '../Infographics';

interface CvScreenResult {
  skorKecocokan: number;
  kategori: string;
  kompetensiCocok: string[];
  celahKompetensi: string[];
  ringkasanAnalisis: string;
  catatanKeputusanManual: string;
}

export const TabApplicants: React.FC = () => {
  const { lang, t } = useAppPreferences();
  const [rows, setRows] = useState<Pendaftaran[]>([]);
  const [loading, setLoading] = useState(true);
  const [programFilter, setProgramFilter] = useState<'ALL' | ProgramType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | PendaftaranStatus>('ALL');
  const [search, setSearch] = useState('');

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  const [cvModal, setCvModal] = useState<Pendaftaran | null>(null);
  const [screeningLoadingId, setScreeningLoadingId] = useState<string | null>(null);
  const [screenModal, setScreenModal] = useState<{
    applicant: Pendaftaran;
    result: CvScreenResult;
  } | null>(null);
  const [actionNotice, setActionNotice] = useState('');

  // Email Drafter Modal
  const [draftModalOpen, setDraftModalOpen] = useState(false);
  const [draftApplicant, setDraftApplicant] = useState<Pendaftaran | null>(null);
  const [draftJenis, setDraftJenis] = useState<'Diterima' | 'Ditolak' | 'Peringatan Absensi' | 'Ringkasan Evaluasi'>('Diterima');
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftResult, setDraftResult] = useState<{ subjek: string; isiSurat: string } | null>(null);

  const loadRows = async (silentArg?: unknown) => {
    const silent = silentArg === true;
    if (!silent) setLoading(true);
    try {
      const data = await apiRequest<Pendaftaran[]>('/api/pendaftar');
      const list = Array.isArray(data) ? data : [];
      setRows(list);
      setSelectedIds((prev) => prev.filter((id) => list.some((item) => item.id === id)));
    } catch (err) {
      if (!silent) {
        setActionNotice(
          err instanceof Error
            ? localizeApiMessage(err.message, lang)
            : t('Gagal memuat data pelamar.', 'Failed to load applicant records.')
        );
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, []);

  useRealtimeSync(['pendaftaran', 'all'], () => {
    void loadRows(true);
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (programFilter !== 'ALL' && r.jenis !== programFilter) return false;
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (
        q &&
        !`${r.nama} ${r.nim} ${r.universitas} ${r.jurusan} ${localizeMajor(r.jurusan, lang)} ${r.lowongan}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [rows, programFilter, statusFilter, search, lang]);

  const handleUpdateStatus = async (p: Pendaftaran, newStatus: 'Diterima' | 'Ditolak') => {
    setActionNotice('');
    try {
      const res = await apiRequest<{
        createdMahasiswa: { nim: string; nama: string } | null;
        emailPreview: { subjek: string; isiRingkas: string } | null;
      }>(`/api/pendaftar/${p.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      const extra = res.createdMahasiswa
        ? t(
            ` Peserta otomatis ditambahkan ke master Mahasiswa (NIM ${res.createdMahasiswa.nim}, status Aktif).`,
            ` Intern automatically enrolled to master records (NIM ${res.createdMahasiswa.nim}, Active status).`
          )
        : '';
      const mailMsg = res.emailPreview
        ? t(
            ` Email notifikasi tercatat: "${res.emailPreview.subjek}".`,
            ` Notification email logged: "${res.emailPreview.subjek}".`
          )
        : '';
      setActionNotice(
        t(
          `Status ${p.nama} diperbarui menjadi ${newStatus}.${extra}${mailMsg}`,
          `${p.nama}'s status updated to ${localizeStatus(newStatus, lang)}.${extra}${mailMsg}`
        )
      );
      await loadRows();
    } catch (err) {
      setActionNotice(
        err instanceof Error
          ? localizeApiMessage(err.message, lang)
          : t('Gagal memperbarui status.', 'Failed to update status.')
      );
    }
  };

  const handleScreenCv = async (p: Pendaftaran) => {
    setScreeningLoadingId(p.id);
    setActionNotice('');
    try {
      const res = await apiRequest<CvScreenResult>('/api/ai/screen-cv', {
        method: 'POST',
        body: JSON.stringify({ pendaftaranId: p.id, lang }),
      });
      setScreenModal({ applicant: p, result: res });
    } catch (err) {
      setActionNotice(
        err instanceof Error
          ? localizeApiMessage(err.message, lang)
          : t('Gagal melakukan screening CV.', 'Failed to run CV screening.')
      );
    } finally {
      setScreeningLoadingId(null);
    }
  };

  const openEmailDrafter = async (p: Pendaftaran, jenis: 'Diterima' | 'Ditolak') => {
    setDraftApplicant(p);
    setDraftJenis(jenis);
    setDraftResult(null);
    setDraftModalOpen(true);
    setDraftLoading(true);
    try {
      const res = await apiRequest<{ subjek: string; isiSurat: string }>('/api/ai/draft-email', {
        method: 'POST',
        body: JSON.stringify({
          jenisSurat: jenis,
          konteks: { program: p.jenis, posisi: p.lowongan },
          lang,
        }),
      });
      setDraftResult(res);
    } catch (err) {
      setDraftResult({
        subjek: t('Gagal menyusun draf', 'Failed to generate draft'),
        isiSurat:
          err instanceof Error
            ? localizeApiMessage(err.message, lang)
            : t('Terjadi kesalahan saat memanggil layanan AI.', 'An error occurred while calling the AI service.'),
      });
    } finally {
      setDraftLoading(false);
    }
  };

  const regenerateDraft = async () => {
    if (!draftApplicant) return;
    setDraftLoading(true);
    try {
      const res = await apiRequest<{ subjek: string; isiSurat: string }>('/api/ai/draft-email', {
        method: 'POST',
        body: JSON.stringify({
          jenisSurat: draftJenis,
          konteks: { program: draftApplicant.jenis, posisi: draftApplicant.lowongan },
          lang,
        }),
      });
      setDraftResult(res);
    } catch (err) {
      setDraftResult({
        subjek: t('Gagal menyusun draf', 'Failed to generate draft'),
        isiSurat:
          err instanceof Error
            ? localizeApiMessage(err.message, lang)
            : t('Terjadi kesalahan saat memanggil layanan AI.', 'An error occurred while calling the AI service.'),
      });
    } finally {
      setDraftLoading(false);
    }
  };

  const pipelineStats = useMemo(() => {
    let pending = 0;
    let accepted = 0;
    let rejected = 0;
    for (const r of rows) {
      if (r.status === 'Pending') pending += 1;
      else if (r.status === 'Diterima') accepted += 1;
      else if (r.status === 'Ditolak') rejected += 1;
    }
    return { total: rows.length, pending, accepted, rejected };
  }, [rows]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((item) => selectedIds.includes(item.id));

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      const filteredSet = new Set(filtered.map((item) => item.id));
      setSelectedIds((prev) => prev.filter((id) => !filteredSet.has(id)));
    } else {
      const merged = new Set([...selectedIds, ...filtered.map((item) => item.id)]);
      setSelectedIds(Array.from(merged));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkStatus = async (status: 'Diterima' | 'Ditolak') => {
    if (selectedIds.length === 0) return;
    setBulkLoading(true);
    setActionNotice('');
    try {
      const res = await apiRequest<{ updatedCount: number; addedInternsCount: number }>(
        '/api/pendaftar/bulk-status',
        {
          method: 'POST',
          body: JSON.stringify({ ids: selectedIds, status }),
        }
      );
      const addedInfo =
        res.addedInternsCount > 0
          ? t(
              ` ${res.addedInternsCount} peserta baru ditambahkan otomatis ke master Mahasiswa.`,
              ` ${res.addedInternsCount} new intern(s) automatically added to master records.`
            )
          : '';
      setActionNotice(
        t(
          `${res.updatedCount} pelamar berhasil diperbarui menjadi ${status}.${addedInfo}`,
          `${res.updatedCount} applicant(s) updated to ${localizeStatus(status, lang)}.${addedInfo}`
        )
      );
      setSelectedIds([]);
      await loadRows();
    } catch (err) {
      setActionNotice(
        err instanceof Error
          ? localizeApiMessage(err.message, lang)
          : t('Gagal memproses seleksi massal.', 'Failed to process bulk selection.')
      );
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Funnel Overview */}
      <RecruitmentFunnelBar
        total={pipelineStats.total}
        pending={pipelineStats.pending}
        accepted={pipelineStats.accepted}
        rejected={pipelineStats.rejected}
      />

      {/* Controls */}
      <div className="surface-card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-0 w-full sm:min-w-[220px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-slate-300" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('Cari pelamar, NIM, kampus, posisi...', 'Search applicant, NIM, university, role...')}
              className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs input-theme-focus dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {(['ALL', 'MBKM', 'PKL'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setProgramFilter(p)}
                className={`rounded-md px-3 py-1 text-xs font-semibold ${
                  programFilter === p
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-600 dark:text-slate-200'
                }`}
              >
                {p === 'ALL' ? t('Semua', 'All') : p}
              </button>
            ))}
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | PendaftaranStatus)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs input-theme-focus dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="ALL">{t('Semua Status', 'All Statuses')}</option>
            <option value="Pending">Pending</option>
            <option value="Diterima">{t('Diterima', 'Accepted')}</option>
            <option value="Ditolak">{t('Ditolak', 'Rejected')}</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => exportApplicantsCsv(filtered)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 whitespace-nowrap"
        >
          <FileDown className="h-3.5 w-3.5" />
          Export CSV
        </button>
      </div>

      {/* Bulk Action Strip */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-theme-accent bg-theme-soft px-4 py-3 text-xs">
          <div className="font-semibold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
            {t(
              `${selectedIds.length} pelamar terpilih untuk keputusan massal`,
              `${selectedIds.length} applicant(s) selected for bulk decision`
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={bulkLoading}
              onClick={() => handleBulkStatus('Diterima')}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              {bulkLoading ? t('Memproses...', 'Processing...') : t('Terima Terpilih', 'Accept Selected')}
            </button>
            <button
              type="button"
              disabled={bulkLoading}
              onClick={() => handleBulkStatus('Ditolak')}
              className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-white px-3 py-1.5 font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-950/60"
            >
              <X className="h-3.5 w-3.5" />
              {t('Tolak Terpilih', 'Reject Selected')}
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="rounded-lg px-2.5 py-1.5 font-medium text-slate-600 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white"
            >
              {t('Batal Pilih', 'Clear Selection')}
            </button>
          </div>
        </div>
      )}

      {actionNotice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
          {actionNotice}
        </div>
      )}

      {/* Table */}
      <div className="table-shell">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200/80 bg-stone-50/90 text-slate-600 dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-200">
            <tr>
              <th className="px-4 py-3 w-9">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAllFiltered}
                  aria-label={t('Pilih semua pelamar', 'Select all applicants')}
                  className="accent-theme"
                />
              </th>
              <th className="px-4 py-3 font-semibold">{t('Pelamar', 'Applicant')}</th>
              <th className="px-4 py-3 font-semibold">{t('Program & Posisi', 'Program & Role')}</th>
              <th className="px-4 py-3 font-semibold">{t('Kontak & Privasi', 'Contact & Privacy')}</th>
              <th className="px-4 py-3 font-semibold">{t('CV / Screening AI', 'CV / AI Screening')}</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold text-right">{t('Keputusan HR', 'HR Decision')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500 dark:text-slate-200">
                  {t('Memuat data pelamar...', 'Loading applicant records...')}
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500 dark:text-slate-200">
                  {t('Tidak ada pelamar yang cocok dengan filter.', 'No applicants match the filter.')}
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(p.id)}
                      onChange={() => toggleSelectOne(p.id)}
                      aria-label={`${t('Pilih', 'Select')} ${p.nama}`}
                      className="accent-theme"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{p.nama}</div>
                    <div className="font-mono text-[11px] text-slate-500 dark:text-slate-200">
                      {p.nim} · {p.universitas}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-200">{localizeMajor(p.jurusan, lang)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-800 dark:text-slate-200">{p.jenis}</div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-200 max-w-[200px]">
                      {p.lowongan}
                    </div>
                    <div className="font-mono text-[10px] text-slate-400 dark:text-slate-300 mt-0.5">{p.timestamp}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-700 dark:text-slate-300">{p.email}</div>
                    <div
                      className={`mt-0.5 text-[11px] font-semibold ${
                        p.persetujuanPrivacy ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'
                      }`}
                    >
                      {t('Privasi:', 'Privacy:')}{' '}
                      {p.persetujuanPrivacy ? t('Disetujui', 'Consented') : t('Belum Setuju', 'Not Consented')}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {p.jenis === 'MBKM' || p.cvBase64 || p.cvSummaryText ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setCvModal(p)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                          >
                            <Eye className="h-3 w-3" />
                            CV
                          </button>
                          <button
                            type="button"
                            disabled={screeningLoadingId === p.id}
                            onClick={() => handleScreenCv(p)}
                            className="inline-flex items-center gap-1 rounded-md btn-theme-soft px-2 py-1 text-[11px] font-semibold disabled:opacity-50"
                          >
                            <Sparkles className="h-3 w-3" />
                            {screeningLoadingId === p.id
                              ? t('Analisis...', 'Analyzing...')
                              : t('Screening AI', 'AI Screen')}
                          </button>
                        </>
                      ) : (
                        <span className="text-[11px] text-slate-400 dark:text-slate-300">{t('PKL (Tanpa CV)', 'PKL (No CV)')}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`font-semibold ${
                        p.status === 'Diterima'
                          ? 'text-emerald-600 dark:text-emerald-300'
                          : p.status === 'Ditolak'
                            ? 'text-red-600 dark:text-red-300'
                            : 'text-amber-600 dark:text-amber-300'
                      }`}
                    >
                      {localizeStatus(p.status, lang)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      {p.status !== 'Diterima' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(p, 'Diterima')}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                        >
                          <Check className="h-3 w-3" />
                          {t('Terima', 'Accept')}
                        </button>
                      )}
                      {p.status !== 'Ditolak' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(p, 'Ditolak')}
                          className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-950/60"
                        >
                          <X className="h-3 w-3" />
                          {t('Tolak', 'Reject')}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          openEmailDrafter(p, p.status === 'Ditolak' ? 'Ditolak' : 'Diterima')
                        }
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        title={t('Susun draf email otomatis dengan AI', 'Compose official email draft with AI')}
                      >
                        <Mail className="h-3 w-3" />
                        {t('Draf', 'Draft')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* View CV Modal */}
      {cvModal && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center modal-backdrop p-3 sm:p-4 overflow-y-auto">
          <div className="surface-card w-full max-w-2xl my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold">
                  {cvModal.nama} · {t('CV Pelamar', 'Applicant CV')}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-200">
                  {cvModal.cvFileName || cvModal.linkCv} · {cvModal.lowongan}
                </p>
              </div>
              <button type="button" onClick={() => setCvModal(null)} className="p-1 text-slate-500 dark:text-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            {cvModal.cvBase64 && (
              <iframe src={cvModal.cvBase64} title="CV PDF" className="h-80 w-full rounded-lg border" />
            )}
            {cvModal.cvSummaryText && (
              <div className="rounded-lg border border-slate-200 bg-neutral-50 p-4 text-xs leading-relaxed dark:border-slate-800 dark:bg-slate-950">
                <div className="font-semibold mb-1">{t('Ringkasan Dokumen CV:', 'CV Document Summary:')}</div>
                {localizeCvSummary(cvModal.cvSummaryText, lang)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Screening Result Modal */}
      {screenModal && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center modal-backdrop p-3 sm:p-4 overflow-y-auto">
          <div className="surface-card w-full max-w-xl my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-theme-accent">
                  {t('AI Screening CV (Teranonimkan)', 'AI CV Screening (Anonymized)')}
                </p>
                <h4 className="text-base font-bold mt-0.5">{screenModal.applicant.nama}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-200">{screenModal.applicant.lowongan}</p>
              </div>
              <button type="button" onClick={() => setScreenModal(null)} className="p-1 text-slate-500 dark:text-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-neutral-50 p-4 dark:border-slate-800 dark:bg-slate-950">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-200">{t('Skor Kecocokan Kompetensi', 'Competency Match Score')}</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-theme-accent">
                  {screenModal.result.skorKecocokan} / 100
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500 dark:text-slate-200">{t('Kategori Rekomendasi', 'Recommendation Category')}</div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {localizeStatus(screenModal.result.kategori, lang)}
                </div>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {t('Ringkasan Analisis', 'Analysis Summary')}
                </div>
                <p className="mt-1 text-slate-600 dark:text-slate-300 leading-relaxed">
                  {screenModal.result.ringkasanAnalisis}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <div className="font-semibold text-emerald-900 dark:text-emerald-300">
                    {t('Kompetensi Cocok', 'Matched Competencies')}
                  </div>
                  <ul className="mt-1 list-disc pl-4 space-y-1 text-slate-700 dark:text-slate-300">
                    {screenModal.result.kompetensiCocok.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                  <div className="font-semibold text-amber-900 dark:text-amber-300">
                    {t('Celah / Perlu Konfirmasi', 'Gaps / To Confirm')}
                  </div>
                  <ul className="mt-1 list-disc pl-4 space-y-1 text-slate-700 dark:text-slate-300">
                    {screenModal.result.celahKompetensi.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-200 italic">
                {t('Catatan tata kelola AI:', 'AI governance note:')} {screenModal.result.catatanKeputusanManual}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setScreenModal(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium dark:border-slate-700"
              >
                {t('Tutup', 'Close')}
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = screenModal.applicant;
                  setScreenModal(null);
                  handleUpdateStatus(target, 'Diterima');
                }}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                {t('Terima Pelamar Ini', 'Accept This Applicant')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Drafter Modal */}
      {draftModalOpen && draftApplicant && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center modal-backdrop p-3 sm:p-4 overflow-y-auto">
          <div className="surface-card w-full max-w-xl my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold">
                  {t('Penyusun Draf Email Resmi HR (AI Assistant)', 'Official HR Email Drafter (AI Assistant)')}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-200">
                  {t('Pelamar:', 'Applicant:')} {draftApplicant.nama}
                </p>
              </div>
              <button type="button" onClick={() => setDraftModalOpen(false)} className="p-1 text-slate-500 dark:text-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={draftJenis}
                onChange={(e) =>
                  setDraftJenis(
                    e.target.value as 'Diterima' | 'Ditolak' | 'Peringatan Absensi' | 'Ringkasan Evaluasi'
                  )
                }
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs input-theme-focus dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="Diterima">{t('Surat Penerimaan Magang', 'Internship Acceptance Letter')}</option>
                <option value="Ditolak">{t('Surat Penolakan Sopan', 'Polite Rejection Letter')}</option>
                <option value="Peringatan Absensi">{t('Surat Peringatan Kedisiplinan', 'Attendance Discipline Notice')}</option>
                <option value="Ringkasan Evaluasi">{t('Ringkasan Hasil Evaluasi', 'Evaluation Summary Letter')}</option>
              </select>
              <button
                type="button"
                disabled={draftLoading}
                onClick={regenerateDraft}
                className="rounded-lg btn-theme-primary px-4 py-2 text-xs font-semibold disabled:opacity-50"
              >
                {draftLoading ? t('Menyusun...', 'Drafting...') : t('Buat Draf', 'Generate Draft')}
              </button>
            </div>

            {draftLoading ? (
              <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-200">
                {t('Menyusun draf bahasa Indonesia formal...', 'Composing formal HR email draft...')}
              </div>
            ) : draftResult ? (
              <div className="space-y-3 text-xs">
                <div>
                  <div className="font-semibold mb-1">{t('Subjek Email', 'Email Subject')}</div>
                  <input
                    type="text"
                    readOnly
                    value={draftResult.subjek}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <div className="font-semibold mb-1">{t('Isi Surat', 'Email Body')}</div>
                  <textarea
                    rows={8}
                    readOnly
                    value={draftResult.isiSurat}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 leading-relaxed dark:border-slate-800 dark:bg-slate-950"
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
