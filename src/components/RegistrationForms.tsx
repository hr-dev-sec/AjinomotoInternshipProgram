import React, { useState } from 'react';
import { Award, CheckCircle2, Clock, Download, Eye, FileCheck2, FileText, FileUp, ShieldCheck, X } from 'lucide-react';
import { useAppPreferences } from '../contexts/AppPreferencesContext';
import { apiRequest } from '../lib/api';
import { localizeApiMessage, localizeEducation, localizeVacancy } from '../lib/localizeData';
import type { Lowongan, ProgramType } from '../types/internship';

export const RegistrationForms: React.FC<{
  program: ProgramType;
  vacancies: Lowongan[];
  mediaMap?: Record<string, { currentUrl: string; altText?: string; objectPosition?: string; mimeType?: string }>;
  onBack: () => void;
  onSwitchProgram: (p: ProgramType) => void;
}> = ({ program, vacancies, mediaMap = {}, onBack, onSwitchProgram }) => {
  const { lang, t } = useAppPreferences();

  const [selectedLowongan, setSelectedLowongan] = useState(vacancies[0]?.namaPosisi || '');
  const [detailModal, setDetailModal] = useState<Lowongan | null>(null);
  const [bannerPreviewOpen, setBannerPreviewOpen] = useState(false);

  const logoAjinomoto = mediaMap.brand_logo_ajinomoto?.currentUrl || '/assets/aistudio/Logo_Ajinomoto_641a64fc.png';
  const logoAjiu = mediaMap.brand_logo_ajiu?.currentUrl || '/assets/aistudio/logo_ajiu_crisp.png';
  const logoSafety = mediaMap.brand_logo_safety?.currentUrl || '/assets/aistudio/HSE_8e0164a8.png';
  const programBannerKey = program === 'MBKM' ? 'form_mbkm_banner' : 'form_pkl_banner';
  const activeBanner =
    (mediaMap[programBannerKey]?.currentUrl ? mediaMap[programBannerKey] : null) ||
    (mediaMap.info_poster_pendaftaran?.currentUrl ? mediaMap.info_poster_pendaftaran : null);
  const activeBannerIsPdf = Boolean(
    activeBanner &&
      (activeBanner.currentUrl.startsWith('data:application/pdf') || activeBanner.mimeType === 'application/pdf')
  );

  const [nama, setNama] = useState('');
  const [nim, setNim] = useState('');
  const [universitas, setUniversitas] = useState('');
  const [jurusan, setJurusan] = useState('');
  const [email, setEmail] = useState('');
  const [cvSummaryText, setCvSummaryText] = useState('');
  const [cvFileName, setCvFileName] = useState('');
  const [cvBase64, setCvBase64] = useState('');
  const [privacyAgreed, setPrivacyAgreed] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successReceipt, setSuccessReceipt] = useState<{ id: string; timestamp: string } | null>(null);

  const rawActiveVacancy =
    vacancies.find((v) => v.namaPosisi === selectedLowongan) || vacancies[0] || null;
  const activeVacancyObj = rawActiveVacancy ? localizeVacancy(rawActiveVacancy, lang) : null;
  const localizedDetailModal = detailModal ? localizeVacancy(detailModal, lang) : null;

  const handleCvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    if (file.type !== 'application/pdf') {
      setError(t('File CV harus berformat PDF (.pdf).', 'CV file must be in PDF (.pdf) format.'));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError(t('Ukuran file CV maksimal 2 MB.', 'Maximum CV file size is 2 MB.'));
      return;
    }
    setCvFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setCvBase64(String(reader.result || ''));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!nama.trim() || !nim.trim() || !universitas.trim() || !jurusan.trim() || !email.trim()) {
      setError(t('Seluruh data diri mahasiswa wajib diisi.', 'All student personal details are required.'));
      return;
    }
    if (!selectedLowongan) {
      setError(t('Pilih posisi lowongan terlebih dahulu.', 'Please select an internship position first.'));
      return;
    }
    if (program === 'MBKM' && !cvBase64) {
      setError(
        t(
          'Pendaftar Program MBKM wajib mengunggah CV berformat PDF (maks 2 MB).',
          'MBKM Program applicants must upload a PDF CV (max 2 MB).'
        )
      );
      return;
    }
    if (!privacyAgreed) {
      setError(
        t(
          'Anda wajib menyetujui kebijakan privasi penggunaan data seleksi.',
          'You must agree to the privacy policy for selection data usage.'
        )
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest<{
        data: { id: string; timestamp: string; status: string };
      }>('/api/pendaftaran', {
        method: 'POST',
        body: JSON.stringify({
          jenis: program,
          nama: nama.trim(),
          nim: nim.trim(),
          universitas: universitas.trim(),
          jurusan: jurusan.trim(),
          lowongan: selectedLowongan,
          email: email.trim(),
          persetujuanPrivacy: privacyAgreed,
          cvFileName: program === 'MBKM' ? cvFileName : undefined,
          cvBase64: program === 'MBKM' ? cvBase64 : undefined,
          cvSummaryText: program === 'MBKM' ? cvSummaryText.trim() : undefined,
        }),
      });
      setSuccessReceipt({ id: res.data.id, timestamp: res.data.timestamp });
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('Gagal mengirim pendaftaran.', 'Failed to submit application.');
      setError(localizeApiMessage(msg, lang));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl 2xl:max-w-[1440px] px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-5">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-theme-accent">
            {t('Pendaftaran Magang', 'Internship Registration')} · PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory
          </p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            {program === 'MBKM'
              ? t('Formulir Pendaftaran Program MBKM', 'MBKM Program Registration Form')
              : t('Formulir Pendaftaran PKL Mandiri', 'Independent PKL Registration Form')}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-200">
            {program === 'MBKM'
              ? t(
                  'Program Kampus Merdeka terintegrasi (wajib lampirkan CV PDF maks 2 MB).',
                  'Integrated Kampus Merdeka internship track (PDF CV max 2 MB required).'
                )
              : t(
                  'Program Praktik Kerja Lapangan reguler tanpa kewajiban unggah CV.',
                  'Regular fieldwork practice track without mandatory CV upload.'
                )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onSwitchProgram(program === 'MBKM' ? 'PKL' : 'MBKM')}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            {program === 'MBKM' ? t('Pindah ke Form PKL', 'Switch to PKL Form') : t('Pindah ke Form MBKM', 'Switch to MBKM Form')}
          </button>
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            {t('Kembali', 'Back')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Form */}
        <div className="lg:col-span-7">
          {successReceipt ? (
            <div className="surface-card p-8 text-center space-y-4 border-emerald-200/90 dark:border-emerald-900/60">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600 dark:text-emerald-300" />
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
                {t('Pendaftaran Berhasil Diterima', 'Application Successfully Received')}
              </h2>
              <p className="mx-auto max-w-md text-sm text-slate-600 dark:text-slate-300">
                {lang === 'en' ? (
                  <>
                    Your <strong>{program}</strong> application under <strong>{nama}</strong> has entered the HR Development selection queue at PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory with status <strong>Pending</strong>.
                  </>
                ) : (
                  <>
                    Data pendaftaran program <strong>{program}</strong> atas nama <strong>{nama}</strong> telah masuk ke antrean seleksi HR Development PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory dengan status <strong>Pending</strong>.
                  </>
                )}
              </p>
              <div className="surface-inset mx-auto max-w-sm px-4 py-3 text-xs font-mono text-slate-700 dark:text-slate-300">
                {t('ID Registrasi', 'Registration ID')}: {successReceipt.id}
                <br />
                {t('Waktu', 'Submitted At')}: {successReceipt.timestamp}
              </div>
              <div className="pt-2 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSuccessReceipt(null);
                    setNama('');
                    setNim('');
                    setEmail('');
                    setCvBase64('');
                    setCvFileName('');
                    setCvSummaryText('');
                    setPrivacyAgreed(false);
                  }}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  {t('Daftar Lagi', 'Submit Another')}
                </button>
                <button
                  type="button"
                  onClick={onBack}
                  className="btn-theme-primary rounded-lg px-4 py-2 text-xs font-semibold"
                >
                  {t('Kembali ke Portal', 'Back to Portal')}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="surface-card space-y-5 p-6 sm:p-8">
              {/* Visual 3-Step Indicator */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 border-b border-slate-100 dark:border-slate-800 pb-4 text-xs">
                <div className="flex items-center gap-2 font-semibold text-theme-accent">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-theme-accent text-[10px] text-white font-mono">1</span>
                  <span>{t('Posisi', 'Position')}</span>
                </div>
                <div className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-200 dark:bg-slate-800 text-[10px] text-slate-800 dark:text-slate-200 font-mono">2</span>
                  <span>{t('Data Diri', 'Personal Info')}</span>
                </div>
                <div className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-200 dark:bg-slate-800 text-[10px] text-slate-800 dark:text-slate-200 font-mono">3</span>
                  <span>{program === 'MBKM' ? t('CV & Privasi', 'CV & Privacy') : t('Privasi', 'Privacy')}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="reg-lowongan" className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {t('Posisi / Divisi yang Dilamar', 'Target Position / Division')}
                </label>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <select
                    id="reg-lowongan"
                    value={selectedLowongan}
                    onChange={(e) => setSelectedLowongan(e.target.value)}
                    className="input-theme-focus flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 dark:text-slate-100 px-3.5 py-2.5 text-sm"
                  >
                    {vacancies.map((v) => (
                      <option key={v.id} value={v.namaPosisi}>
                        {v.namaPosisi} ({localizeEducation(v.pendidikan, lang)})
                      </option>
                    ))}
                  </select>
                  {rawActiveVacancy && (
                    <button
                      type="button"
                      onClick={() => setDetailModal(rawActiveVacancy)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                    >
                      <Eye className="h-3.5 w-3.5 text-theme-accent" />
                      {t('Detail Posisi', 'Role Details')}
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t('Nama Lengkap', 'Full Name')}
                  </label>
                  <input
                    type="text"
                    required
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                    placeholder={t('Nama sesuai KTM', 'Full name as on student ID')}
                    className="input-theme-focus w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 dark:text-slate-100 px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t('NIM / Nomor Induk', 'Student ID (NIM)')}
                  </label>
                  <input
                    type="text"
                    required
                    value={nim}
                    onChange={(e) => setNim(e.target.value)}
                    placeholder={t('Contoh: 215100100111044', 'e.g., 215100100111044')}
                    className="input-theme-focus w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 dark:text-slate-100 px-3.5 py-2.5 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t('Universitas / Politeknik', 'University / Polytechnic')}
                  </label>
                  <input
                    type="text"
                    required
                    value={universitas}
                    onChange={(e) => setUniversitas(e.target.value)}
                    placeholder={t('Contoh: Universitas Brawijaya', 'e.g., Universitas Brawijaya')}
                    className="input-theme-focus w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 dark:text-slate-100 px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t('Program Studi / Jurusan', 'Study Program / Major')}
                  </label>
                  <input
                    type="text"
                    required
                    value={jurusan}
                    onChange={(e) => setJurusan(e.target.value)}
                    placeholder={t('Contoh: Teknologi Pangan', 'e.g., Food Technology')}
                    className="input-theme-focus w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 dark:text-slate-100 px-3.5 py-2.5 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t('Email Aktif Mahasiswa', 'Active Student Email')}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@student.ac.id"
                  className="input-theme-focus w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 dark:text-slate-100 px-3.5 py-2.5 text-sm"
                />
              </div>

              {program === 'MBKM' && (
                <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      {t('Unggah CV (Wajib PDF, Maksimal 2 MB)', 'Upload CV (PDF Required, Max 2 MB)')}
                    </label>
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 px-4 py-5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:border-theme-accent hover:bg-theme-soft transition-colors">
                      <FileUp className="h-4 w-4 text-theme-accent" />
                      <span>
                        {cvFileName
                          ? `${t('PDF Terunggah', 'Uploaded PDF')}: ${cvFileName}`
                          : t('Pilih File CV (.pdf, maks 2 MB)', 'Choose CV File (.pdf, max 2 MB)')}
                      </span>
                      <input
                        type="file"
                        accept="application/pdf"
                        className="sr-only"
                        onChange={handleCvChange}
                      />
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      {t(
                        'Ringkasan Kompetensi / Pengalaman Singkat (Opsional)',
                        'Brief Competency / Experience Summary (Optional)'
                      )}
                    </label>
                    <textarea
                      rows={2}
                      value={cvSummaryText}
                      onChange={(e) => setCvSummaryText(e.target.value)}
                      placeholder={t(
                        'Contoh: Menguasai HACCP, analisis mikrobiologi dasar, dan MS Excel.',
                        'e.g., Proficient in HACCP, basic microbiology analysis, and MS Excel.'
                      )}
                      className="input-theme-focus w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 dark:text-slate-100 px-3.5 py-2 text-sm"
                    />
                  </div>
                </div>
              )}

              <label className="surface-inset flex items-start gap-2.5 p-3.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={privacyAgreed}
                  onChange={(e) => setPrivacyAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-theme"
                />
                <span>
                  {t(
                    'Saya menyetujui kebijakan privasi PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory bahwa seluruh data pribadi dan dokumen lamaran hanya digunakan untuk keperluan proses seleksi magang.',
                    'I agree to the privacy policy of PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory stating that all personal data and application documents are used strictly for internship selection.'
                  )}
                </span>
              </label>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 px-4 py-3 text-xs text-red-700 dark:text-red-300">
                  {error}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-theme-primary w-full sm:w-auto rounded-lg px-6 py-3 text-sm font-semibold disabled:opacity-50 whitespace-nowrap"
                >
                  {submitting
                    ? t('Mengirim Pendaftaran...', 'Submitting Application...')
                    : t('Kirim Pendaftaran', 'Submit Application')}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Right: Program Infographic & Live Selected Vacancy Preview */}
        <div className="lg:col-span-5 space-y-5">
          {activeVacancyObj && (
            <div className="surface-card p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl icon-theme-plinth shrink-0">
                  <FileCheck2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-theme-accent">
                    {t('Ringkasan Posisi Terpilih', 'Selected Role Summary')}
                  </div>
                  <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                    {activeVacancyObj.namaPosisi}
                  </h3>
                </div>
              </div>
              <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-3 text-xs text-slate-600 dark:text-slate-300">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {t('Pendidikan & Prodi', 'Education & Majors')}
                  </div>
                  <p className="mt-0.5">{activeVacancyObj.pendidikan} · {activeVacancyObj.prodi}</p>
                </div>
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {t('Keterampilan Utama', 'Core Skills')}
                  </div>
                  <p className="mt-0.5">{activeVacancyObj.skill.replace(/;/g, ' · ')}</p>
                </div>
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {t('Benefit Magang', 'Internship Benefits')}
                  </div>
                  <p className="mt-0.5">{activeVacancyObj.benefit.replace(/;/g, ' · ')}</p>
                </div>
              </div>
            </div>
          )}

          {activeBanner && (
            <div className="surface-card overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                  {program === 'MBKM'
                    ? t('Panduan & Poster Pendaftaran MBKM', 'MBKM Registration Guide & Poster')
                    : t('Panduan & Poster Pendaftaran PKL', 'PKL Registration Guide & Poster')}
                </h3>
                <a
                  href={activeBanner.currentUrl}
                  download={activeBannerIsPdf ? `Panduan_${program}_Ajinomoto.pdf` : `Poster_${program}_Ajinomoto.png`}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-theme-accent hover:underline"
                >
                  <Download className="h-3.5 w-3.5" />
                  {t('Unduh', 'Download')}
                </a>
              </div>
              {activeBannerIsPdf ? (
                <div className="p-5 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-900/50">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 text-white shrink-0">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {activeBanner.altText || t('Dokumen Informasi Resmi (PDF)', 'Official Information Guide (PDF)')}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-200">
                        {t('Klik Pratinjau untuk membaca panduan lengkap.', 'Click Preview to view the full guide.')}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBannerPreviewOpen(true)}
                    className="inline-flex items-center gap-1 rounded-lg btn-theme-primary px-3 py-1.5 text-xs font-semibold shrink-0"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {t('Pratinjau', 'Preview')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setBannerPreviewOpen(true)}
                  className="block w-full bg-slate-100 dark:bg-slate-900 cursor-zoom-in"
                >
                  <img
                    src={activeBanner.currentUrl}
                    alt={activeBanner.altText || `Banner Informasi ${program}`}
                    referrerPolicy="no-referrer"
                    style={{ objectPosition: activeBanner.objectPosition || 'center' }}
                    className="w-full max-h-64 object-cover"
                  />
                </button>
              )}
              {activeBanner.altText && !activeBannerIsPdf && (
                <div className="px-5 py-3 text-[11px] text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800">
                  {activeBanner.altText}
                </div>
              )}
            </div>
          )}

          <div className="surface-card p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                {t('Standar Proses Seleksi HRD', 'HRD Selection Process Standards')}
              </h3>
              <div className="flex items-center gap-2.5">
                <div className="rounded-md bg-white px-2 py-1 ring-1 ring-slate-200/80 shadow-2xs">
                  <img
                    src={logoAjinomoto}
                    alt="Logo Ajinomoto"
                    referrerPolicy="no-referrer"
                    className="h-5.5 w-auto object-contain"
                  />
                </div>
                <img
                  src={logoAjiu}
                  alt="Logo AJIU"
                  referrerPolicy="no-referrer"
                  className="h-10 w-10 object-contain shrink-0 drop-shadow-xs"
                />
                <div className="rounded-md bg-white p-1 ring-1 ring-emerald-200/80 shadow-2xs">
                  <img
                    src={logoSafety}
                    alt="Logo Safety First"
                    referrerPolicy="no-referrer"
                    className="h-5.5 w-auto object-contain"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-start gap-3">
                <Clock className="h-4 w-4 text-theme-accent mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {t('Konfirmasi Cepat via Email', 'Prompt Email Confirmation')}
                  </div>
                  <p className="mt-0.5">
                    {t(
                      'Keputusan seleksi dikirim otomatis ke email resmi mahasiswa setelah verifikasi HR.',
                      'Selection outcomes are sent automatically to your student email after HR verification.'
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-300 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {t('Perlindungan Data Pribadi', 'Personal Data Protection')}
                  </div>
                  <p className="mt-0.5">
                    {t(
                      'CV dan data akademik hanya diproses oleh HR Development Section PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory.',
                      'CVs and academic records are processed exclusively by HR Development Section at PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory.'
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Award className="h-4 w-4 text-slate-800 dark:text-slate-200 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {t('Sertifikat & Evaluasi AJIU', 'AJIU Certificate & Evaluation')}
                  </div>
                  <p className="mt-0.5">
                    {t(
                      'Peserta aktif memperoleh pembekalan budaya kerja, orientasi K3 (Safety First), evaluasi 4 pilar, dan sertifikat ber-QR.',
                      'Active interns receive corporate culture onboarding, Safety First induction, 4-pillar evaluations, and QR-verified certificates.'
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Banner / Guide Lightbox */}
      {bannerPreviewOpen && activeBanner && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop p-4"
          onClick={() => setBannerPreviewOpen(false)}
        >
          <div
            className="surface-card w-full max-w-4xl max-h-[90dvh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <div className="font-display text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                {activeBanner.altText || t(`Informasi Pendaftaran ${program}`, `${program} Registration Info`)}
              </div>
              <button
                type="button"
                onClick={() => setBannerPreviewOpen(false)}
                className="rounded-lg p-1 text-slate-500 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-slate-950/90 p-4 flex items-center justify-center min-h-[340px]">
              {activeBannerIsPdf ? (
                <iframe
                  src={activeBanner.currentUrl}
                  title={`Panduan ${program}`}
                  className="h-[72dvh] w-full rounded-lg bg-white"
                />
              ) : (
                <img
                  src={activeBanner.currentUrl}
                  alt={activeBanner.altText || `Poster ${program}`}
                  referrerPolicy="no-referrer"
                  className="max-h-[75dvh] max-w-full object-contain rounded-lg"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Detail Posisi */}
      {localizedDetailModal && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center modal-backdrop p-3 sm:p-4 overflow-y-auto">
          <div className="surface-card w-full max-w-lg my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-theme-accent">
                  {t('Detail Lowongan Magang', 'Internship Vacancy Details')}
                </p>
                <h3 className="mt-0.5 text-lg font-bold text-slate-900 dark:text-slate-100">
                  {localizedDetailModal.namaPosisi}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-200 mt-0.5">
                  {localizedDetailModal.pendidikan} · {localizedDetailModal.prodi}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailModal(null)}
                className="rounded-lg p-1.5 text-slate-500 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label={t('Tutup modal detail', 'Close details modal')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800 pt-3">
              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {t('Kompetensi & Skill', 'Competencies & Skills')}
                </div>
                <ul className="mt-1 list-disc pl-5 space-y-1 text-xs">
                  {localizedDetailModal.skill.split(/[;\n]/).filter(Boolean).map((s, i) => (
                    <li key={i}>{s.trim()}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {t('Tugas & Tanggung Jawab', 'Tasks & Responsibilities')}
                </div>
                <ul className="mt-1 list-disc pl-5 space-y-1 text-xs">
                  {localizedDetailModal.tugas.split(/[;\n]/).filter(Boolean).map((s, i) => (
                    <li key={i}>{s.trim()}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {t('Benefit Program', 'Program Benefits')}
                </div>
                <ul className="mt-1 list-disc pl-5 space-y-1 text-xs">
                  {localizedDetailModal.benefit.split(/[;\n]/).filter(Boolean).map((s, i) => (
                    <li key={i}>{s.trim()}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setDetailModal(null)}
                className="rounded-lg bg-slate-900 dark:bg-slate-100 px-4 py-2 text-xs font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white"
              >
                {t('Tutup', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
