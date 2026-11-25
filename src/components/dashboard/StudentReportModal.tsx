import React, { useEffect, useMemo, useState } from 'react';
import { Award, Download, Loader2, SlidersHorizontal, X } from 'lucide-react';
import QRCode from 'qrcode';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import {
  type BrandLogoUrls,
  DEFAULT_BRAND_LOGOS,
  buildInternDocNumber,
  computeInternDurationLabel,
  computeInternGradeMeta,
  exportInternCertificatePdf,
  formatReportDate,
  getPillarQualitative,
  resolveBrandLogoUrls,
} from '../../lib/exports';
import { localizeGender, localizeMajor, localizeStatus, localizeTalent } from '../../lib/localizeData';
import type { InternDetailResponse, Mahasiswa } from '../../types/internship';

interface StudentReportModalProps {
  open: boolean;
  mahasiswa: Mahasiswa | null;
  detail: InternDetailResponse | null;
  loadingDetail?: boolean;
  onClose: () => void;
}

export const StudentReportModal: React.FC<StudentReportModalProps> = ({
  open,
  mahasiswa,
  detail,
  loadingDetail = false,
  onClose,
}) => {
  const { lang, t } = useAppPreferences();
  const isEn = lang === 'en';
  const [logos, setLogos] = useState<BrandLogoUrls>({ ...DEFAULT_BRAND_LOGOS });
  const [qrUrl, setQrUrl] = useState<string>('');
  const [downloading, setDownloading] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [signerTitle, setSignerTitle] = useState('HR Development Manager');
  const [mentorNote, setMentorNote] = useState('');

  useEffect(() => {
    if (!open) return;
    resolveBrandLogoUrls()
      .then((resolved) => setLogos(resolved))
      .catch(() => setLogos({ ...DEFAULT_BRAND_LOGOS }));
  }, [open]);

  const activeMhs = detail?.mahasiswa ?? mahasiswa;
  const latestEval = detail?.evaluasiHistory?.[0] ?? null;

  const scores = useMemo(() => {
    if (!activeMhs) return { bk: 0, ps: 0, tw: 0, is: 0, total: 0, talent: 'Belum Dievaluasi' };
    const fallback = activeMhs.skor > 0 ? Math.min(10, Math.round((activeMhs.skor / 4) * 10) / 10) : 0;
    return {
      bk: latestEval?.skorBk ?? fallback,
      ps: latestEval?.skorPs ?? fallback,
      tw: latestEval?.skorTw ?? fallback,
      is: latestEval?.skorIs ?? fallback,
      total: latestEval?.skor ?? activeMhs.skor ?? 0,
      talent: latestEval?.rekomendasi ?? activeMhs.talent,
    };
  }, [activeMhs, latestEval]);

  const attendance = detail?.attendanceSummary ?? {
    totalMasuk: 0,
    totalPulang: 0,
    totalIzin: 0,
    totalAnomali: 0,
    recentLogs: [],
  };

  const docNumber = activeMhs ? buildInternDocNumber(activeMhs) : '';
  const issuedDate = formatReportDate(undefined, lang);
  const durationLabel = activeMhs
    ? computeInternDurationLabel(activeMhs.tglMasuk, activeMhs.tanggalBerakhir, lang)
    : '-';
  const grade = computeInternGradeMeta(scores.total, lang);

  useEffect(() => {
    if (!open || !activeMhs) return;
    const payload = JSON.stringify({
      docNo: docNumber,
      issuer: 'PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory (HRD)',
      nim: activeMhs.nim,
      nama: activeMhs.nama,
      program: activeMhs.program,
      dept: activeMhs.department,
      skor: `${scores.total}/40`,
      pilar: { bk: scores.bk, ps: scores.ps, tw: scores.tw, is: scores.is },
      rekomendasi: scores.talent,
      terbit: issuedDate,
    });
    QRCode.toDataURL(payload, {
      width: 220,
      margin: 1,
      color: { dark: '#0F172A', light: '#FFFFFF' },
    })
      .then(setQrUrl)
      .catch(() => setQrUrl(''));
  }, [open, activeMhs, docNumber, issuedDate, scores]);

  if (!open || !activeMhs) return null;

  const pillars = [
    {
      code: 'BK',
      name: 'Business Knowledge',
      desc: isEn ? 'Industrial process & food safety awareness' : 'Pemahaman proses industri & standar mutu',
      score: scores.bk,
    },
    {
      code: 'PS',
      name: 'Problem Solving',
      desc: isEn ? 'Analytical rigor & root-cause Kaizen thinking' : 'Analisis akar masalah & solusi perbaikan',
      score: scores.ps,
    },
    {
      code: 'TW',
      name: 'Teamwork',
      desc: isEn ? 'Cross-functional factory collaboration' : 'Kolaborasi lintas tim & koordinasi kerja',
      score: scores.tw,
    },
    {
      code: 'IS',
      name: 'Interpersonal Skill',
      desc: isEn ? 'Professional communication & work ethic' : 'Komunikasi profesional & etika kerja',
      score: scores.is,
    },
  ];

  // SVG Radar geometry (center 90,90, max radius 62)
  const cx = 90;
  const cy = 90;
  const maxR = 60;
  const polyPoints = [
    `${cx},${cy - maxR * (Math.max(0.5, scores.bk) / 10)}`,
    `${cx + maxR * (Math.max(0.5, scores.ps) / 10)},${cy}`,
    `${cx},${cy + maxR * (Math.max(0.5, scores.tw) / 10)}`,
    `${cx - maxR * (Math.max(0.5, scores.is) / 10)},${cy}`,
  ].join(' ');

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      await exportInternCertificatePdf(activeMhs, {
        detail,
        signerName,
        signerTitle,
        mentorNote,
        lang,
        logos,
      });
    } finally {
      setDownloading(false);
    }
  };

  const defaultAttestation = isEn
    ? `This document officially certifies that ${activeMhs.nama} (NIM ${activeMhs.nim}) from ${activeMhs.universitas} has undergone the ${activeMhs.program} Industrial Internship Program in the ${activeMhs.department} Department at PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory (${activeMhs.tglMasuk} to ${activeMhs.tanggalBerakhir}) in compliance with Safety First (HSE) and Ajinomoto Indonesia University operational standards.`
    : `Dengan ini diterangkan bahwa ${activeMhs.nama} (NIM ${activeMhs.nim}) dari ${activeMhs.universitas} telah melaksanakan Program Magang Industri (${activeMhs.program}) pada Departemen ${activeMhs.department} di PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory (${activeMhs.tglMasuk} s/d ${activeMhs.tanggalBerakhir}) sesuai standar operasional Ajinomoto Indonesia University dan budaya kerja Safety First (HSE).`;

  const gradeToneClass =
    scores.total >= 30
      ? 'text-emerald-800 bg-emerald-50/80 border-emerald-200/80'
      : scores.total >= 21
        ? 'text-amber-800 bg-amber-50/80 border-amber-200/80'
        : scores.total > 0
          ? 'text-red-800 bg-red-50/80 border-red-200/80'
          : 'text-slate-700 bg-slate-50 border-slate-200';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center modal-backdrop p-3 sm:p-5 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={t('Pratinjau Laporan Resmi Mahasiswa', 'Official Student Report Preview')}
    >
      <div className="w-full max-w-4xl my-auto space-y-3">
        {/* Top Action Bar */}
        <div className="surface-card px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg icon-theme-plinth shrink-0">
              <Award className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {t('Pratinjau Laporan & Sertifikat Magang (A4)', 'Internship Report & Certificate Preview (A4)')}
              </div>
              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-300 truncate">
                {docNumber} · {activeMhs.nama}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowCustomize((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap transition-colors"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {t('Atur Penandatangan', 'Customize Signer')}
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloading || loadingDetail}
              className="inline-flex items-center gap-1.5 rounded-lg btn-theme-primary px-4 py-1.5 text-xs font-semibold disabled:opacity-60 whitespace-nowrap"
            >
              {downloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {downloading
                ? t('Menyusun PDF...', 'Generating PDF...')
                : t('Unduh PDF Resmi (A4)', 'Download Official PDF (A4)')}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('Tutup pratinjau', 'Close preview')}
              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Optional Signer & Mentor Note Customization Panel */}
        {showCustomize && (
          <div className="surface-card p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                {t('Nama Penandatangan (Opsional)', 'Signer Name (Optional)')}
              </label>
              <input
                type="text"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder={t('Contoh: Rina Kusuma, S.Psi', 'e.g., Rina Kusuma, S.Psi')}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 input-theme-focus dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                {t('Jabatan Penandatangan', 'Signer Title')}
              </label>
              <input
                type="text"
                value={signerTitle}
                onChange={(e) => setSignerTitle(e.target.value)}
                placeholder="HR Development Manager"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 input-theme-focus dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                {t('Catatan Pengesahan / Mentor (Opsional)', 'Custom Attestation / Mentor Note')}
              </label>
              <input
                type="text"
                value={mentorNote}
                onChange={(e) => setMentorNote(e.target.value)}
                placeholder={t('Kosongkan untuk teks pengesahan resmi standar', 'Leave blank for official standard statement')}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 input-theme-focus dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>
        )}

        {/* Executive A4 Archival Document Preview Sheet */}
        <div className="rounded-2xl bg-[#FAF8F4] p-2.5 sm:p-4 shadow-2xl border border-stone-300/80">
          <div className="relative bg-white text-slate-900 border border-stone-300/90 shadow-sm overflow-hidden">
            {/* Top Corporate Crimson Ribbon + Antique Gold Rule */}
            <div className="h-2.5 bg-[#B91C1C]" />
            <div className="h-[2.5px] bg-[#B4862E]" />

            {/* Inner Archival Hairline Frame */}
            <div className="m-2.5 sm:m-4 border border-stone-200/90 p-5 sm:p-8 space-y-6 relative">
              {/* Subtle Gold Corner Brackets */}
              <span className="pointer-events-none absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-[#B4862E]" />
              <span className="pointer-events-none absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-[#B4862E]" />

              {/* OFFICIAL 3-LOGO CORPORATE LETTERHEAD */}
              <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b-2 border-[#B91C1C] relative">
                <div className="flex items-center gap-3.5 min-w-0">
                  <img
                    src={logos.ajinomoto}
                    alt="Logo PT Ajinomoto Indonesia"
                    referrerPolicy="no-referrer"
                    className="h-11 sm:h-12 w-auto object-contain shrink-0"
                  />
                  <div className="h-10 w-px bg-stone-300 shrink-0 hidden sm:block" />
                  <div className="min-w-0">
                    <div className="text-[11px] sm:text-xs font-extrabold tracking-wide text-slate-900">
                      PT AJINOMOTO INDONESIA — PT AJINEX INTERNATIONAL
                    </div>
                    <div className="text-[10px] font-bold tracking-[0.12em] text-[#B91C1C] uppercase mt-0.5">
                      MOJOKERTO FACTORY · HR DEVELOPMENT SECTION
                    </div>
                    <div className="text-[10px] text-stone-500 mt-0.5">
                      Jl. Raya Mlirip, Jetis, Mojokerto, Jawa Timur · Ajinomoto Indonesia University (AJIU)
                    </div>
                  </div>
                </div>

                {/* Right Pair: Logo AJIU + Logo Safety First (HSE) */}
                <div className="flex items-center gap-3 shrink-0 self-start md:self-center">
                  <img
                    src={logos.ajiu}
                    alt="Logo Ajinomoto Indonesia University (AJIU)"
                    referrerPolicy="no-referrer"
                    className="h-12 w-12 object-contain shrink-0"
                  />
                  <div className="h-9 w-px bg-stone-300 shrink-0" />
                  <img
                    src={logos.safety}
                    alt="Logo Safety First HSE"
                    referrerPolicy="no-referrer"
                    className="h-9 sm:h-10 w-auto object-contain shrink-0"
                  />
                </div>
                <span className="pointer-events-none absolute inset-x-0 -bottom-[4px] h-[1px] bg-[#B4862E]" />
              </header>

              {/* EDITORIAL DOCUMENT TITLE & REFERENCE BAR */}
              <div className="text-center space-y-2 pt-1">
                <p className="text-[10px] font-bold tracking-[0.18em] text-stone-500 uppercase">
                  {isEn
                    ? 'Official Student Internship Evaluation & Completion Record'
                    : 'Dokumen Resmi Evaluasi Kompetensi & Rekam Magang Mahasiswa'}
                </p>
                <h2
                  className="text-2xl sm:text-[28px] font-bold tracking-tight text-slate-900 text-balance"
                  style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
                >
                  {isEn
                    ? 'Internship Evaluation Report & Certificate'
                    : 'Laporan Evaluasi & Sertifikat Magang'}
                </h2>
                <div className="mt-3 rounded-md border border-stone-200 bg-[#FAF8F4] px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-700">
                  <span className="font-mono font-bold text-slate-900">
                    {isEn ? 'Doc. No:' : 'No. Dokumen:'} {docNumber}
                  </span>
                  <span className="text-stone-600">
                    {isEn ? 'Program:' : 'Program:'}{' '}
                    <strong className="text-slate-900">
                      {activeMhs.program === 'MBKM' ? 'Kampus Merdeka (MBKM)' : 'PKL Mandiri'}
                    </strong>
                  </span>
                  <span className="text-stone-600">
                    {isEn ? 'Issued:' : 'Terbit:'} <strong className="text-slate-900">{issuedDate}</strong>
                  </span>
                </div>
              </div>

              {loadingDetail && (
                <div className="flex items-center justify-center gap-2 py-2 text-xs text-stone-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#B91C1C]" />
                  <span>{t('Menyelaraskan data 4 pilar & presensi...', 'Syncing 4-pillar scores & attendance...')}</span>
                </div>
              )}

              {/* SECTION 01: PROFIL PESERTA & PENUGASAN INDUSTRI */}
              <section className="space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="text-[11px] font-bold tracking-wider text-[#B91C1C]">01.</span>
                  <h3 className="text-[11px] font-bold tracking-[0.08em] text-slate-900 uppercase whitespace-nowrap">
                    {isEn ? 'Intern Profile & Industrial Placement' : 'Profil Peserta & Penugasan Industri'}
                  </h3>
                  <div className="h-px flex-1 bg-stone-200" />
                </div>

                <div className="rounded-lg border border-stone-200 bg-[#FDFCFA] p-4 sm:p-5 space-y-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-3 pb-3 border-b border-stone-200/80">
                    <div>
                      <div className="text-[10px] font-medium tracking-wider text-stone-500 uppercase">
                        {isEn ? 'Awarded & Reported For' : 'Nama Lengkap Peserta Magang'}
                      </div>
                      <div
                        className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5"
                        style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
                      >
                        {activeMhs.nama}
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <div
                        className={`text-[11px] font-bold tracking-wider uppercase ${
                          activeMhs.status === 'Aktif' ? 'text-emerald-700' : 'text-slate-600'
                        }`}
                      >
                        Status: {localizeStatus(activeMhs.status, lang)}
                      </div>
                      <div className="font-mono text-xs font-bold text-slate-700 mt-0.5">
                        NIM {activeMhs.nim}
                      </div>
                    </div>
                  </div>

                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-xs">
                    <div>
                      <dt className="text-[10px] text-stone-500">
                        {isEn ? 'University / Institution' : 'Universitas / Perguruan Tinggi'}
                      </dt>
                      <dd className="font-semibold text-slate-900 mt-0.5">{activeMhs.universitas}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] text-stone-500">
                        {isEn ? 'Assigned Department' : 'Departemen Penempatan'}
                      </dt>
                      <dd className="font-semibold text-slate-900 mt-0.5">
                        {activeMhs.department} · Mojokerto Factory
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] text-stone-500">
                        {isEn ? 'Study Program / Major' : 'Program Studi / Jurusan'}
                      </dt>
                      <dd className="font-semibold text-slate-900 mt-0.5">
                        {localizeMajor(activeMhs.jurusan, lang)} · {localizeGender(activeMhs.gender, lang)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] text-stone-500">
                        {isEn ? 'Internship Period & Duration' : 'Periode Penugasan & Durasi'}
                      </dt>
                      <dd className="font-semibold text-slate-900 font-mono text-[11px] mt-0.5">
                        {activeMhs.tglMasuk} {isEn ? 'to' : 's/d'} {activeMhs.tanggalBerakhir}{' '}
                        <span className="font-sans font-normal text-stone-500">({durationLabel})</span>
                      </dd>
                    </div>
                  </dl>
                </div>
              </section>

              {/* SECTION 02: EVALUASI 4 PILAR KOMPETENSI & RADAR */}
              <section className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-[11px] font-bold tracking-wider text-[#B91C1C]">02.</span>
                  <h3 className="text-[11px] font-bold tracking-[0.08em] text-slate-900 uppercase whitespace-nowrap">
                    {isEn
                      ? '4-Pillar Competency Evaluation & Talent Rating'
                      : 'Evaluasi 4 Pilar Kompetensi & Pemeringkatan Talent'}
                  </h3>
                  <div className="h-px flex-1 bg-stone-200" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
                  {/* Left: 4-Pillar Score Bars */}
                  <div className="md:col-span-7 rounded-lg border border-stone-200 bg-white divide-y divide-stone-100 px-4 py-1 flex flex-col justify-center">
                    {pillars.map((p) => {
                      const barPct = Math.max(0, Math.min(100, (p.score / 10) * 100));
                      const barColor =
                        p.score >= 8 ? 'bg-emerald-700' : p.score >= 6 ? 'bg-[#B4862E]' : 'bg-[#B91C1C]';
                      return (
                        <div key={p.code} className="py-2.5 flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-slate-900">
                              {p.name} <span className="font-mono text-[10px] text-stone-500">({p.code})</span>
                            </div>
                            <div className="text-[10px] text-stone-500 truncate">{p.desc}</div>
                          </div>
                          <div className="w-24 sm:w-28 shrink-0">
                            <div className="h-2 w-full rounded-full bg-stone-100 overflow-hidden">
                              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${barPct}%` }} />
                            </div>
                          </div>
                          <div className="w-20 text-right shrink-0">
                            <div className="font-mono text-xs font-bold tabular-nums text-slate-900">
                              {p.score > 0 ? `${p.score}/10` : '—/10'}
                            </div>
                            <div className="text-[10px] text-stone-500">
                              {getPillarQualitative(p.score, lang)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Right: Vector SVG 4-Pillar Radar Chart */}
                  <div className="md:col-span-5 rounded-lg border border-stone-200 bg-[#FDFCFA] p-3.5 flex flex-col items-center justify-center">
                    <div className="text-[10px] font-bold tracking-wider text-stone-500 uppercase mb-1">
                      {isEn ? 'Competency Radar Profile' : 'Profil Radar Kompetensi'}
                    </div>
                    <svg viewBox="0 0 180 180" className="w-40 h-40" aria-label="4-Pillar Competency Radar">
                      {[0.25, 0.5, 0.75, 1].map((scale) => {
                        const r = maxR * scale;
                        return (
                          <polygon
                            key={scale}
                            points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`}
                            fill="none"
                            stroke={scale === 1 ? '#CBD5E1' : '#E2E8F0'}
                            strokeWidth={scale === 1 ? 1.1 : 0.75}
                          />
                        );
                      })}
                      <line x1={cx} y1={cy - maxR} x2={cx} y2={cy + maxR} stroke="#CBD5E1" strokeWidth="0.75" />
                      <line x1={cx - maxR} y1={cy} x2={cx + maxR} y2={cy} stroke="#CBD5E1" strokeWidth="0.75" />

                      {scores.total > 0 && (
                        <>
                          <polygon
                            points={polyPoints}
                            fill="rgba(185, 28, 28, 0.16)"
                            stroke="#B91C1C"
                            strokeWidth="2"
                          />
                          <circle cx={cx} cy={cy - maxR * (Math.max(0.5, scores.bk) / 10)} r="3.2" fill="#991B1B" />
                          <circle cx={cx + maxR * (Math.max(0.5, scores.ps) / 10)} cy={cy} r="3.2" fill="#991B1B" />
                          <circle cx={cx} cy={cy + maxR * (Math.max(0.5, scores.tw) / 10)} r="3.2" fill="#991B1B" />
                          <circle cx={cx - maxR * (Math.max(0.5, scores.is) / 10)} cy={cy} r="3.2" fill="#991B1B" />
                        </>
                      )}

                      <text x={cx} y={cy - maxR - 8} textAnchor="middle" fontSize="10" fontWeight="700" fill="#0F172A">
                        BK
                      </text>
                      <text x={cx + maxR + 10} y={cy + 3.5} textAnchor="start" fontSize="10" fontWeight="700" fill="#0F172A">
                        PS
                      </text>
                      <text x={cx} y={cy + maxR + 15} textAnchor="middle" fontSize="10" fontWeight="700" fill="#0F172A">
                        TW
                      </text>
                      <text x={cx - maxR - 10} y={cy + 3.5} textAnchor="end" fontSize="10" fontWeight="700" fill="#0F172A">
                        IS
                      </text>
                    </svg>
                  </div>
                </div>

                {/* Unified Total Score / Predicate / Talent Recommendation Strip */}
                <div
                  className={`rounded-lg border px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:divide-x sm:divide-stone-300/70 ${gradeToneClass}`}
                >
                  <div>
                    <div className="text-[10px] font-semibold tracking-wider text-slate-600 uppercase">
                      {isEn ? 'Total Evaluation Score' : 'Skor Evaluasi Total'}
                    </div>
                    <div className="mt-0.5 flex items-baseline gap-2">
                      <span className="font-mono text-xl font-extrabold tabular-nums text-slate-900">
                        {scores.total} / 40
                      </span>
                      <span className="font-mono text-xs font-bold">({grade.pct}%)</span>
                    </div>
                  </div>
                  <div className="sm:pl-4">
                    <div className="text-[10px] font-semibold tracking-wider text-slate-600 uppercase">
                      {isEn ? 'Achievement Grade' : 'Predikat Mutu'}
                    </div>
                    <div
                      className="mt-0.5 text-lg font-bold"
                      style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
                    >
                      {grade.letter} · {grade.label}
                    </div>
                  </div>
                  <div className="sm:pl-4">
                    <div className="text-[10px] font-semibold tracking-wider text-slate-600 uppercase">
                      {isEn ? 'Talent Pool Recommendation' : 'Rekomendasi Talent Pool'}
                    </div>
                    <div className="mt-1 text-sm font-bold">
                      {localizeTalent(scores.talent, lang)}
                    </div>
                  </div>
                </div>
              </section>

              {/* SECTION 03: REKAM KEDISIPLINAN & PERNYATAAN RESMI */}
              <section className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-[11px] font-bold tracking-wider text-[#B91C1C]">03.</span>
                  <h3 className="text-[11px] font-bold tracking-[0.08em] text-slate-900 uppercase whitespace-nowrap">
                    {isEn
                      ? 'Attendance Discipline & Official Attestation'
                      : 'Rekam Kedisiplinan & Pernyataan Resmi'}
                  </h3>
                  <div className="h-px flex-1 bg-stone-200" />
                </div>

                <div className="rounded-lg border border-stone-200 bg-white grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-stone-200 text-center">
                  <div className="p-3">
                    <div className="text-[10px] text-stone-500">{isEn ? 'Check-In Recorded' : 'Presensi Masuk'}</div>
                    <div className="font-mono text-sm font-bold tabular-nums text-[#B91C1C] mt-0.5">
                      {attendance.totalMasuk} {isEn ? 'days' : 'hari'}
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="text-[10px] text-stone-500">{isEn ? 'Check-Out Recorded' : 'Presensi Pulang'}</div>
                    <div className="font-mono text-sm font-bold tabular-nums text-emerald-700 mt-0.5">
                      {attendance.totalPulang} {isEn ? 'days' : 'hari'}
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="text-[10px] text-stone-500">{isEn ? 'Approved Leave' : 'Izin / Keterangan'}</div>
                    <div className="font-mono text-sm font-bold tabular-nums text-[#B4862E] mt-0.5">
                      {attendance.totalIzin} {isEn ? 'days' : 'hari'}
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="text-[10px] text-stone-500">{isEn ? 'GPS Anomalies' : 'Anomali Geofence GPS'}</div>
                    <div
                      className={`font-mono text-sm font-bold tabular-nums mt-0.5 ${
                        attendance.totalAnomali > 0 ? 'text-[#B91C1C]' : 'text-slate-700'
                      }`}
                    >
                      {attendance.totalAnomali} {isEn ? 'flags' : 'catatan'}
                    </div>
                  </div>
                </div>

                <p
                  className="text-xs leading-relaxed text-slate-600 italic px-1"
                  style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
                >
                  {mentorNote.trim() || defaultAttestation}
                </p>
              </section>

              {/* SECTION 04: PENGESAHAN DIGITAL & TANDA TANGAN RESMI */}
              <section className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-[11px] font-bold tracking-wider text-[#B91C1C]">04.</span>
                  <h3 className="text-[11px] font-bold tracking-[0.08em] text-slate-900 uppercase whitespace-nowrap">
                    {isEn
                      ? 'Digital Authentication & Official Endorsement'
                      : 'Pengesahan Digital & Tanda Tangan Resmi'}
                  </h3>
                  <div className="h-px flex-1 bg-stone-200" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center pt-1">
                  {/* Left: QR Verification Seal */}
                  <div className="md:col-span-7 rounded-lg border border-stone-200 bg-[#FDFCFA] p-3.5 flex items-center gap-4">
                    <div className="h-24 w-24 rounded-md border border-stone-200 bg-white p-1.5 shrink-0 flex items-center justify-center">
                      {qrUrl ? (
                        <img
                          src={qrUrl}
                          alt="QR Code Verifikasi Digital HRD"
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <span className="text-[10px] text-stone-400">QR</span>
                      )}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="text-[11px] font-bold tracking-wider text-[#B91C1C] uppercase">
                        {isEn ? 'Digital Verification Seal' : 'Verifikasi Keaslian Digital'}
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-600">
                        {isEn
                          ? 'Scan this QR code to validate recipient identity, 4-pillar competency scores, and official HRD Mojokerto Factory issuance.'
                          : 'Pindai QR code ini untuk memvalidasi identitas peserta, nilai 4 pilar kompetensi, dan keaslian dokumen resmi HRD Mojokerto Factory.'}
                      </p>
                      <div className="font-mono text-[11px] font-bold text-slate-900 pt-0.5">
                        ID: AJI-MJK-{activeMhs.nim.slice(-10)}
                      </div>
                    </div>
                  </div>

                  {/* Right: Signature & Official Stamp */}
                  <div className="md:col-span-5 text-center space-y-1">
                    <div className="text-xs text-slate-600">Mojokerto, {issuedDate}</div>
                    <div className="text-xs font-bold text-slate-900">
                      {isEn ? 'Approved & Certified by,' : 'Mengetahui & Mengesahkan,'}
                    </div>
                    <div className="text-[10px] text-stone-500">
                      HR Development Section · Mojokerto Factory
                    </div>

                    <div className="relative h-14 flex items-center justify-center">
                      <div className="absolute left-6 sm:left-8 flex h-12 w-12 items-center justify-center rounded-full border border-red-200/90 text-[7px] font-bold tracking-wider text-red-400/90 uppercase select-none">
                        <div className="flex h-10 w-10 flex-col items-center justify-center rounded-full border border-red-200/70 leading-tight">
                          <span>HRD</span>
                          <span>VERIFIED</span>
                        </div>
                      </div>
                    </div>

                    <div className="mx-auto w-48 border-t border-slate-900 pt-1.5">
                      {signerName.trim() ? (
                        <>
                          <div className="text-xs font-bold text-slate-900">{signerName.trim()}</div>
                          <div className="text-[11px] text-slate-600">{signerTitle.trim() || 'HR Development Manager'}</div>
                        </>
                      ) : (
                        <>
                          <div className="text-xs font-bold text-slate-900">
                            {signerTitle.trim() || 'HR Development Manager'}
                          </div>
                          <div className="text-[10px] text-stone-500">
                            PT Ajinomoto Indonesia - PT Ajinex International
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* ARCHIVAL FOOTER */}
              <footer className="pt-3 border-t border-stone-200 flex flex-wrap items-center justify-between gap-2 text-[10px] text-stone-500">
                <span>
                  PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory · Dokumen Resmi HR Development
                </span>
                <span className="font-medium text-stone-600">
                  {isEn
                    ? 'Eat Well, Live Well. · Safety First · Page 1 / 1'
                    : 'Eat Well, Live Well. · Safety First · Halaman 1 / 1'}
                </span>
              </footer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
