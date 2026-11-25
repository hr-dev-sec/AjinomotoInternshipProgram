import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import * as XLSX from 'xlsx';
import { apiRequest, getCachedApiResponse } from './api';
import type {
  DailyAttendanceSummary,
  DashboardStatsResponse,
  InternDetailResponse,
  Lowongan,
  Mahasiswa,
  Pendaftaran,
  UniversitasPKS,
} from '../types/internship';

export function exportToExcel(filename: string, sheetName: string, rows: Record<string, unknown>[]) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

export function exportToCsv(filename: string, rows: Record<string, unknown>[]) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(worksheet);
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportExecutivePdf(
  stats: DashboardStatsResponse,
  insight?: {
    ringkasanEksekutif: string;
    sorotanKehadiran: string;
    risikoPks: string;
    rekomendasiTalent: string;
    langkahPrioritas: string[];
  } | null
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Header corporate red band
  doc.setFillColor(200, 16, 46);
  doc.rect(0, 0, 210, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12.5);
  doc.text('PT AJINOMOTO INDONESIA - PT AJINEX INTERNATIONAL, MOJOKERTO FACTORY', 14, 11);
  doc.setFontSize(9.5);
  doc.text(`Laporan Eksekutif Program Magang (MBKM & PKL) · ${stats.todayDate}`, 14, 18);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.text('1. Ringkasan KPI Utama', 14, 36);

  autoTable(doc, {
    startY: 40,
    head: [['Indikator Kinerja', 'Nilai', 'Keterangan']],
    body: [
      ['Peserta MBKM Aktif', String(stats.kpi.mbkmAktif), 'Program Kampus Merdeka'],
      ['Peserta PKL Aktif', String(stats.kpi.pklAktif), 'Praktik Kerja Lapangan Mandiri'],
      ['Total Peserta Aktif', String(stats.kpi.totalAktif), 'Seluruh departemen pabrik'],
      [
        'Kehadiran Hari Ini',
        `${stats.kpi.kehadiranHariIniCount} (${stats.kpi.kehadiranHariIniRate}%)`,
        'Masuk + Pulang / Total Aktif',
      ],
      ['Talent Pool (Skor >= 30)', String(stats.kpi.talentPoolCount), 'Sangat Direkomendasikan'],
      ['PKS Mendekati H-30', String(stats.kpi.pksMendekatiH30), 'Perlu tindak lanjut perpanjangan'],
    ],
    headStyles: { fillColor: [200, 16, 46] },
    styles: { fontSize: 9 },
  });

  let nextY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 95;
  nextY += 10;

  doc.setFontSize(12);
  doc.text('2. Top 5 Talent Magang (Evaluasi Kompetensi)', 14, nextY);

  // Fixes PRD 11.2 #4: safely reads t.universitas instead of undefined t.university
  autoTable(doc, {
    startY: nextY + 4,
    head: [['Peringkat', 'Nama Peserta', 'Program', 'Universitas', 'Departemen', 'Skor', 'Rekomendasi']],
    body: stats.top5Talent.map((t, idx) => [
      `#${idx + 1}`,
      t.nama,
      t.program,
      t.universitas || '-',
      t.department,
      `${t.skor}/40`,
      t.talent,
    ]),
    headStyles: { fillColor: [30, 41, 59] },
    styles: { fontSize: 8.5 },
  });

  nextY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || nextY + 45) + 10;

  if (insight) {
    if (nextY > 235) {
      doc.addPage();
      nextY = 20;
    }
    doc.setFontSize(12);
    doc.text('3. Ringkasan Analitik HR (AI Executive Insight)', 14, nextY);
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);

    const blocks = [
      `Ringkasan: ${insight.ringkasanEksekutif}`,
      `Kehadiran: ${insight.sorotanKehadiran}`,
      `Risiko PKS: ${insight.risikoPks}`,
      `Talent: ${insight.rekomendasiTalent}`,
      `Prioritas: ${insight.langkahPrioritas.join(' | ')}`,
    ];
    let yCursor = nextY + 6;
    for (const block of blocks) {
      const lines = doc.splitTextToSize(block, 182) as string[];
      doc.text(lines, 14, yCursor);
      yCursor += lines.length * 4.5 + 2.5;
    }
  }

  doc.save(`Laporan_Eksekutif_Magang_Ajinomoto_${stats.todayDate}.pdf`);
}

export function exportAttendancePdf(summary: DailyAttendanceSummary) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFillColor(200, 16, 46);
  doc.rect(0, 0, 297, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.text('REKAPITULASI ABSENSI HARIAN · PT AJINOMOTO INDONESIA - PT AJINEX INTERNATIONAL, MOJOKERTO FACTORY', 14, 10);
  doc.setFontSize(9.5);
  doc.text(
    `Tanggal: ${summary.tanggal} · Total Aktif: ${summary.kpi.totalAktif} · Masuk: ${summary.kpi.masuk} · Pulang: ${summary.kpi.pulang} · Izin: ${summary.kpi.izin} · Belum Absen: ${summary.kpi.belumAbsen} · Rate: ${summary.kpi.attendanceRate}%`,
    14,
    17
  );

  autoTable(doc, {
    startY: 28,
    head: [['NIM', 'Nama', 'Program', 'Departemen', 'Universitas', 'Status', 'Masuk', 'Pulang', 'Jarak GPS', 'Catatan']],
    body: summary.records.map((r) => [
      r.nim,
      r.nama,
      r.program,
      r.department,
      r.universitas,
      r.statusFinal,
      r.waktuMasuk || '-',
      r.waktuPulang || '-',
      r.jarakMeter !== undefined ? `${r.jarakMeter} m` : '-',
      r.anomaliFlag || r.keterangan || '-',
    ]),
    headStyles: { fillColor: [200, 16, 46] },
    styles: { fontSize: 8 },
  });

  doc.save(`Absensi_Magang_${summary.tanggal}.pdf`);
}

export const DEFAULT_BRAND_LOGOS = {
  ajinomoto: '/assets/aistudio/Logo_Ajinomoto_641a64fc.png',
  ajiu: '/assets/aistudio/logo_ajiu_crisp.png',
  safety: '/assets/aistudio/HSE_8e0164a8.png',
} as const;

export interface BrandLogoUrls {
  ajinomoto: string;
  ajiu: string;
  safety: string;
}

export interface InternReportOptions {
  detail?: InternDetailResponse | null;
  signerName?: string;
  signerTitle?: string;
  mentorNote?: string;
  lang?: 'id' | 'en';
  logos?: Partial<BrandLogoUrls>;
}

interface LoadedLogoAsset {
  dataUrl: string;
  width: number;
  height: number;
  ratio: number;
}

export async function resolveBrandLogoUrls(): Promise<BrandLogoUrls> {
  try {
    const cached = getCachedApiResponse<{
      media?: Record<string, { currentUrl?: string }>;
    }>('/api/public/media');
    const media =
      cached?.media ??
      (
        await apiRequest<{ media?: Record<string, { currentUrl?: string }> }>(
          '/api/public/media'
        ).catch(() => ({ media: undefined }))
      )?.media;

    return {
      ajinomoto: media?.brand_logo_ajinomoto?.currentUrl || DEFAULT_BRAND_LOGOS.ajinomoto,
      ajiu: media?.brand_logo_ajiu?.currentUrl || DEFAULT_BRAND_LOGOS.ajiu,
      safety: media?.brand_logo_safety?.currentUrl || DEFAULT_BRAND_LOGOS.safety,
    };
  } catch {
    return { ...DEFAULT_BRAND_LOGOS };
  }
}

async function loadLogoAsPngDataUrl(url: string): Promise<LoadedLogoAsset | null> {
  if (!url || typeof window === 'undefined') return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const naturalW = img.naturalWidth || img.width || 1;
        const naturalH = img.naturalHeight || img.height || 1;
        const maxDim = 640;
        const scale = Math.min(1, maxDim / Math.max(naturalW, naturalH));
        const targetW = Math.max(1, Math.round(naturalW * scale));
        const targetH = Math.max(1, Math.round(naturalH * scale));
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.clearRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);
        resolve({
          dataUrl: canvas.toDataURL('image/png'),
          width: targetW,
          height: targetH,
          ratio: naturalW / naturalH,
        });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export function buildInternDocNumber(mhs: Mahasiswa): string {
  const year = (mhs.tglMasuk || '').slice(0, 4) || String(new Date().getFullYear());
  const cleanNim = (mhs.nim || '0000').replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase();
  return `HRD-MJK/${year}/${mhs.program}/${cleanNim}`;
}

export function formatReportDate(dateStr?: string, lang: 'id' | 'en' = 'id'): string {
  const target = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
  if (Number.isNaN(target.getTime())) return dateStr || '-';
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(target);
}

export function computeInternDurationLabel(
  startStr: string,
  endStr: string,
  lang: 'id' | 'en' = 'id'
): string {
  const start = new Date(`${startStr}T00:00:00Z`).getTime();
  const end = new Date(`${endStr}T00:00:00Z`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return '-';
  const days = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
  const months = Math.max(1, Math.round(days / 30));
  return lang === 'en'
    ? `${days} days (~${months} mos)`
    : `${days} hari (±${months} bulan)`;
}

export function computeInternGradeMeta(
  skor: number,
  lang: 'id' | 'en' = 'id'
): {
  letter: string;
  label: string;
  pct: number;
  rgb: [number, number, number];
  bgRgb: [number, number, number];
} {
  const pct = Math.min(100, Math.max(0, Math.round((skor / 40) * 100)));
  if (skor <= 0) {
    return {
      letter: '—',
      label: lang === 'en' ? 'Pending Evaluation' : 'Belum Dievaluasi',
      pct: 0,
      rgb: [100, 116, 139],
      bgRgb: [241, 245, 249],
    };
  }
  if (skor >= 35) {
    return {
      letter: 'A+',
      label: lang === 'en' ? 'Distinction' : 'Istimewa',
      pct,
      rgb: [4, 120, 87],
      bgRgb: [236, 253, 245],
    };
  }
  if (skor >= 30) {
    return {
      letter: 'A',
      label: lang === 'en' ? 'Excellent' : 'Sangat Baik',
      pct,
      rgb: [4, 120, 87],
      bgRgb: [236, 253, 245],
    };
  }
  if (skor >= 21) {
    return {
      letter: 'B',
      label: lang === 'en' ? 'Good' : 'Baik',
      pct,
      rgb: [180, 83, 9],
      bgRgb: [255, 251, 235],
    };
  }
  return {
    letter: 'C',
    label: lang === 'en' ? 'Needs Development' : 'Perlu Pengembangan',
    pct,
    rgb: [185, 28, 28],
    bgRgb: [254, 242, 242],
  };
}

export function getPillarQualitative(score: number, lang: 'id' | 'en' = 'id'): string {
  if (score <= 0) return lang === 'en' ? 'Unrated' : 'Belum Dinilai';
  if (score >= 9) return lang === 'en' ? 'Exemplary' : 'Istimewa';
  if (score >= 7.5) return lang === 'en' ? 'Proficient' : 'Sangat Baik';
  if (score >= 6) return lang === 'en' ? 'Competent' : 'Baik';
  return lang === 'en' ? 'Developing' : 'Cukup';
}

export async function exportInternCertificatePdf(
  mhs: Mahasiswa,
  options: InternReportOptions = {}
) {
  const lang = options.lang || 'id';
  const isEn = lang === 'en';

  // Ensure we have full 4-pillar & attendance detail when possible
  let detail = options.detail ?? null;
  if (!detail) {
    try {
      detail = await apiRequest<InternDetailResponse>(
        `/api/mahasiswa/${encodeURIComponent(mhs.nim)}/detail`
      );
    } catch {
      detail = null;
    }
  }

  const resolvedUrls = await resolveBrandLogoUrls();
  const logoUrls: BrandLogoUrls = {
    ajinomoto: options.logos?.ajinomoto || resolvedUrls.ajinomoto,
    ajiu: options.logos?.ajiu || resolvedUrls.ajiu,
    safety: options.logos?.safety || resolvedUrls.safety,
  };

  const [logoAjinomoto, logoAjiu, logoSafety] = await Promise.all([
    loadLogoAsPngDataUrl(logoUrls.ajinomoto),
    loadLogoAsPngDataUrl(logoUrls.ajiu),
    loadLogoAsPngDataUrl(logoUrls.safety),
  ]);

  const latestEval = detail?.evaluasiHistory?.[0] ?? null;
  const fallbackPillar = mhs.skor > 0 ? Math.min(10, Math.round((mhs.skor / 4) * 10) / 10) : 0;
  const bk = latestEval?.skorBk ?? fallbackPillar;
  const ps = latestEval?.skorPs ?? fallbackPillar;
  const tw = latestEval?.skorTw ?? fallbackPillar;
  const isScore = latestEval?.skorIs ?? fallbackPillar;
  const totalSkor = latestEval?.skor ?? mhs.skor ?? 0;
  const talentLabel = latestEval?.rekomendasi ?? mhs.talent;

  const attendance = detail?.attendanceSummary ?? {
    totalMasuk: 0,
    totalPulang: 0,
    totalIzin: 0,
    totalAnomali: 0,
    recentLogs: [],
  };

  const docNumber = buildInternDocNumber(mhs);
  const issuedDateLabel = formatReportDate(undefined, lang);
  const durationLabel = computeInternDurationLabel(mhs.tglMasuk, mhs.tanggalBerakhir, lang);
  const grade = computeInternGradeMeta(totalSkor, lang);
  const signerName = (options.signerName || '').trim();
  const signerTitle = (options.signerTitle || 'HR Development Manager').trim();
  const mentorNote = (options.mentorNote || '').trim();

  // Palette (Archival Executive Paper + Ajinomoto Corporate Crimson & Antique Gold)
  const CRIMSON: [number, number, number] = [185, 28, 28];
  const CRIMSON_DEEP: [number, number, number] = [145, 18, 28];
  const GOLD: [number, number, number] = [180, 134, 46];
  const INK: [number, number, number] = [15, 23, 42];
  const SLATE: [number, number, number] = [71, 85, 105];
  const MUTED: [number, number, number] = [120, 113, 108];
  const PAPER_TINT: [number, number, number] = [250, 248, 244];
  const BORDER: [number, number, number] = [226, 223, 217];
  const RULE_SOFT: [number, number, number] = [238, 235, 230];

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const pageH = 297;

  // 1. Subtle Archival Cream Perimeter & Crisp Pure White Inner Page
  doc.setFillColor(...PAPER_TINT);
  doc.rect(0, 0, pageW, pageH, 'F');
  doc.setFillColor(255, 255, 255);
  doc.rect(7.5, 7.5, pageW - 15, pageH - 15, 'F');

  // Top Corporate Crimson Ribbon & Gold Hairline
  doc.setFillColor(...CRIMSON);
  doc.rect(7.5, 7.5, pageW - 15, 4.2, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(7.5, 11.7, pageW - 15, 0.7, 'F');

  // Outer & Inner Archival Borders
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.35);
  doc.rect(7.5, 7.5, pageW - 15, pageH - 15);
  doc.setDrawColor(...RULE_SOFT);
  doc.setLineWidth(0.2);
  doc.rect(10, 14, pageW - 20, pageH - 24);

  // Subtle Architectural Corner Brackets (Gold)
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.55);
  const cLen = 5;
  // Bottom-left
  doc.line(10, pageH - 10 - cLen, 10, pageH - 10);
  doc.line(10, pageH - 10, 10 + cLen, pageH - 10);
  // Bottom-right
  doc.line(pageW - 10, pageH - 10 - cLen, pageW - 10, pageH - 10);
  doc.line(pageW - 10 - cLen, pageH - 10, pageW - 10, pageH - 10);

  // 2. OFFICIAL 3-LOGO CORPORATE LETTERHEAD (y: 16 -> 39)
  const marginX = 15;
  const contentW = pageW - marginX * 2; // 180mm

  // Left Logo: Ajinomoto Indonesia
  let textStartX = marginX;
  if (logoAjinomoto) {
    const h = 12.5;
    const w = Math.min(24, h * logoAjinomoto.ratio);
    doc.addImage(logoAjinomoto.dataUrl, 'PNG', marginX, 17.5, w, h, undefined, 'FAST');
    // Hairline separator after Ajinomoto logo
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.25);
    doc.line(marginX + w + 3.2, 18.2, marginX + w + 3.2, 30.2);
    textStartX = marginX + w + 6.4;
  }

  // Right Logos: Safety First (far right) + AJIU Crest (beside Safety First)
  let rightCursorX = pageW - marginX;
  if (logoSafety) {
    const h = 10.5;
    const w = Math.min(22, h * logoSafety.ratio);
    const x = rightCursorX - w;
    doc.addImage(logoSafety.dataUrl, 'PNG', x, 18.5, w, h, undefined, 'FAST');
    rightCursorX = x - 3;
  }
  if (logoAjiu) {
    if (logoSafety) {
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.25);
      doc.line(rightCursorX, 18.5, rightCursorX, 29.5);
      rightCursorX -= 3;
    }
    const h = 13.5;
    const w = Math.min(15, h * logoAjiu.ratio);
    const x = rightCursorX - w;
    doc.addImage(logoAjiu.dataUrl, 'PNG', x, 17, w, h, undefined, 'FAST');
    rightCursorX = x - 3;
  }

  // Corporate Identity Text Lockup (between left Ajinomoto logo and right AJIU/HSE logos)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(...INK);
  doc.text('PT AJINOMOTO INDONESIA — PT AJINEX INTERNATIONAL', textStartX, 21.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(...CRIMSON);
  doc.text('MOJOKERTO FACTORY  ·  HR DEVELOPMENT SECTION', textStartX, 25.3);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.7);
  doc.setTextColor(...MUTED);
  doc.text(
    'Jl. Raya Mlirip, Jetis, Mojokerto, Jawa Timur  ·  Ajinomoto Indonesia University (AJIU)',
    textStartX,
    29.2
  );

  // Double Header Divider Rule (Crimson + Gold)
  doc.setDrawColor(...CRIMSON);
  doc.setLineWidth(0.6);
  doc.line(marginX, 34, pageW - marginX, 34);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.22);
  doc.line(marginX, 35.1, pageW - marginX, 35.1);

  // 3. EDITORIAL DOCUMENT TITLE & REFERENCE BAR (y: 41 -> 62)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(...MUTED);
  doc.text(
    isEn
      ? 'OFFICIAL STUDENT INTERNSHIP EVALUATION & COMPLETION RECORD'
      : 'DOKUMEN RESMI EVALUASI KOMPETENSI & REKAM MAGANG MAHASISWA',
    pageW / 2,
    41.5,
    { align: 'center' }
  );

  doc.setFont('times', 'bold');
  doc.setFontSize(17.5);
  doc.setTextColor(...INK);
  doc.text(
    isEn
      ? 'Internship Evaluation Report & Certificate'
      : 'Laporan Evaluasi & Sertifikat Magang',
    pageW / 2,
    49.2,
    { align: 'center' }
  );

  // Subtle Reference Metadata Strip
  doc.setFillColor(...PAPER_TINT);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.25);
  doc.roundedRect(marginX, 53.5, contentW, 8.8, 1.5, 1.5, 'FD');

  doc.setFont('courier', 'bold');
  doc.setFontSize(7.4);
  doc.setTextColor(...INK);
  doc.text(
    `${isEn ? 'Doc. No:' : 'No. Dokumen:'} ${docNumber}`,
    marginX + 4,
    58.9
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  doc.setTextColor(...SLATE);
  doc.text(
    `${isEn ? 'Program:' : 'Program:'} ${mhs.program === 'MBKM' ? 'Kampus Merdeka (MBKM)' : 'PKL Mandiri'}`,
    pageW / 2,
    58.9,
    { align: 'center' }
  );
  doc.text(
    `${isEn ? 'Issued:' : 'Terbit:'} ${issuedDateLabel}`,
    pageW - marginX - 4,
    58.9,
    { align: 'right' }
  );

  // Helper to draw Editorial Section Heading
  const drawSectionHeading = (num: string, title: string, yPos: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(...CRIMSON);
    doc.text(num, marginX, yPos);
    doc.setTextColor(...INK);
    doc.text(title, marginX + 6.5, yPos);
    const titleW = doc.getTextWidth(title);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.25);
    doc.line(marginX + 6.5 + titleW + 3, yPos - 1, pageW - marginX, yPos - 1);
  };

  // 4. SECTION 01: PROFIL PESERTA & PENUGASAN INDUSTRI (y: 69 -> 108)
  drawSectionHeading(
    '01.',
    isEn ? 'INTERN PROFILE & INDUSTRIAL PLACEMENT' : 'PROFIL PESERTA & PENUGASAN INDUSTRI',
    69.5
  );

  // Recipient Highlight Card (Clean Archival Paper with Hairline Border)
  doc.setFillColor(253, 252, 250);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.28);
  doc.roundedRect(marginX, 72.5, contentW, 35.5, 1.8, 1.8, 'FD');

  // Recipient Name Banner Row
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...MUTED);
  doc.text(isEn ? 'AWARDED & REPORTED FOR' : 'NAMA LENGKAP PESERTA MAGANG', marginX + 5, 77.8);

  doc.setFont('times', 'bold');
  doc.setFontSize(14.5);
  doc.setTextColor(...INK);
  doc.text(mhs.nama, marginX + 5, 84);

  // Right status text (unboxed editorial metadata)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  const isActive = mhs.status === 'Aktif';
  doc.setTextColor(isActive ? 4 : 71, isActive ? 120 : 85, isActive ? 87 : 105);
  doc.text(
    `${isEn ? 'STATUS:' : 'STATUS:'} ${mhs.status.toUpperCase()}`,
    pageW - marginX - 5,
    78.2,
    { align: 'right' }
  );
  doc.setFont('courier', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(...SLATE);
  doc.text(`NIM ${mhs.nim}`, pageW - marginX - 5, 83.6, { align: 'right' });

  // Horizontal hairline inside profile card
  doc.setDrawColor(...RULE_SOFT);
  doc.setLineWidth(0.25);
  doc.line(marginX + 5, 87.2, pageW - marginX - 5, 87.2);

  // 2x2 Accession Metadata Grid
  const col1X = marginX + 5;
  const col2X = marginX + 94;
  const drawMetaField = (x: number, y: number, label: string, value: string, maxW = 82) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...MUTED);
    doc.text(label, x, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.4);
    doc.setTextColor(...INK);
    const clipped = doc.splitTextToSize(value || '-', maxW)[0] as string;
    doc.text(clipped, x, y + 4);
  };

  drawMetaField(
    col1X,
    92.2,
    isEn ? 'University / Institution' : 'Universitas / Perguruan Tinggi',
    mhs.universitas
  );
  drawMetaField(
    col2X,
    92.2,
    isEn ? 'Assigned Department' : 'Departemen Penempatan',
    `${mhs.department} · Mojokerto Factory`
  );
  drawMetaField(
    col1X,
    101.2,
    isEn ? 'Study Program / Major' : 'Program Studi / Jurusan',
    `${mhs.jurusan} (${mhs.gender === 'P' ? (isEn ? 'Female' : 'Perempuan') : isEn ? 'Male' : 'Laki-laki'})`
  );
  drawMetaField(
    col2X,
    101.2,
    isEn ? 'Internship Period & Duration' : 'Periode Penugasan & Durasi',
    `${mhs.tglMasuk} s/d ${mhs.tanggalBerakhir} (${durationLabel})`
  );

  // 5. SECTION 02: EVALUASI 4 PILAR KOMPETENSI & RADAR VECTOR (y: 116 -> 188)
  drawSectionHeading(
    '02.',
    isEn ? '4-PILLAR COMPETENCY EVALUATION & TALENT RATING' : 'EVALUASI 4 PILAR KOMPETENSI & PEMERINGKATAN TALENT',
    116.5
  );

  // Left column (108mm): 4-Pillar Meter Rows
  const pillars = [
    {
      code: 'BK',
      name: 'Business Knowledge',
      desc: isEn ? 'Industrial process & food safety awareness' : 'Pemahaman proses industri & standar mutu',
      score: bk,
    },
    {
      code: 'PS',
      name: 'Problem Solving',
      desc: isEn ? 'Analytical rigor & root-cause Kaizen thinking' : 'Analisis akar masalah & solusi perbaikan',
      score: ps,
    },
    {
      code: 'TW',
      name: 'Teamwork',
      desc: isEn ? 'Cross-functional factory collaboration' : 'Kolaborasi lintas tim & koordinasi kerja',
      score: tw,
    },
    {
      code: 'IS',
      name: 'Interpersonal Skill',
      desc: isEn ? 'Professional communication & work ethic' : 'Komunikasi profesional & etika kerja',
      score: isScore,
    },
  ];

  const leftBoxW = 111;
  const rightBoxX = marginX + leftBoxW + 5;
  const rightBoxW = contentW - leftBoxW - 5; // 64mm

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.25);
  doc.roundedRect(marginX, 120, leftBoxW, 49, 1.8, 1.8, 'FD');

  pillars.forEach((p, idx) => {
    const rowY = 126.5 + idx * 11.4;
    if (idx > 0) {
      doc.setDrawColor(...RULE_SOFT);
      doc.setLineWidth(0.18);
      doc.line(marginX + 4, rowY - 5.2, marginX + leftBoxW - 4, rowY - 5.2);
    }

    // Pillar Title & Descriptor
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(...INK);
    doc.text(`${p.name} (${p.code})`, marginX + 4.5, rowY - 0.8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED);
    doc.text(p.desc, marginX + 4.5, rowY + 2.7);

    // Score Bar
    const barX = marginX + 61;
    const barW = 28;
    const barY = rowY - 2.3;
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(barX, barY, barW, 2.6, 1, 1, 'F');
    const fillW = Math.max(0, Math.min(barW, (p.score / 10) * barW));
    if (fillW > 0) {
      doc.setFillColor(...(p.score >= 8 ? [4, 120, 87] as [number, number, number] : p.score >= 6 ? GOLD : CRIMSON));
      doc.roundedRect(barX, barY, fillW, 2.6, 1, 1, 'F');
    }

    // Numeric Score & Qualitative Grade
    doc.setFont('courier', 'bold');
    doc.setFontSize(8.3);
    doc.setTextColor(...INK);
    doc.text(p.score > 0 ? `${p.score}/10` : '—/10', marginX + leftBoxW - 4.5, rowY - 0.5, {
      align: 'right',
    });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.3);
    doc.setTextColor(...SLATE);
    doc.text(getPillarQualitative(p.score, lang), marginX + leftBoxW - 4.5, rowY + 2.7, {
      align: 'right',
    });
  });

  // Right column (64mm): Native Vector 4-Pillar Competency Radar Chart
  doc.setFillColor(253, 252, 250);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.25);
  doc.roundedRect(rightBoxX, 120, rightBoxW, 49, 1.8, 1.8, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.1);
  doc.setTextColor(...SLATE);
  doc.text(
    isEn ? 'COMPETENCY RADAR PROFILE' : 'PROFIL RADAR KOMPETENSI',
    rightBoxX + rightBoxW / 2,
    125.2,
    { align: 'center' }
  );

  const cx = rightBoxX + rightBoxW / 2;
  const cy = 147.2;
  const maxR = 15.5;

  // Concentric diamonds (25%, 50%, 75%, 100%)
  [0.25, 0.5, 0.75, 1].forEach((scale) => {
    const r = maxR * scale;
    doc.setDrawColor(scale === 1 ? 203 : 226, scale === 1 ? 213 : 232, scale === 1 ? 225 : 240);
    doc.setLineWidth(scale === 1 ? 0.3 : 0.18);
    doc.line(cx, cy - r, cx + r, cy);
    doc.line(cx + r, cy, cx, cy + r);
    doc.line(cx, cy + r, cx - r, cy);
    doc.line(cx - r, cy, cx, cy - r);
  });

  // Axes crosshairs
  doc.setDrawColor(215, 222, 232);
  doc.setLineWidth(0.2);
  doc.line(cx, cy - maxR, cx, cy + maxR);
  doc.line(cx - maxR, cy, cx + maxR, cy);

  // Axis Labels
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(...INK);
  doc.text('BK', cx, cy - maxR - 2, { align: 'center' });
  doc.text('PS', cx + maxR + 2.5, cy + 1);
  doc.text('TW', cx, cy + maxR + 3.8, { align: 'center' });
  doc.text('IS', cx - maxR - 2.5, cy + 1, { align: 'right' });

  // Data Polygon (Top: BK, Right: PS, Bottom: TW, Left: IS)
  const rBk = maxR * (Math.max(0.5, bk) / 10);
  const rPs = maxR * (Math.max(0.5, ps) / 10);
  const rTw = maxR * (Math.max(0.5, tw) / 10);
  const rIs = maxR * (Math.max(0.5, isScore) / 10);

  if (totalSkor > 0) {
    const pts: Array<[number, number]> = [
      [cx, cy - rBk],
      [cx + rPs, cy],
      [cx, cy + rTw],
      [cx - rIs, cy],
    ];
    // Soft blush polygon fill + crisp crimson stroke
    doc.setFillColor(254, 226, 226);
    doc.setDrawColor(...CRIMSON);
    doc.setLineWidth(0.55);
    doc.lines(
      [
        [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]],
        [pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]],
        [pts[3][0] - pts[2][0], pts[3][1] - pts[2][1]],
        [pts[0][0] - pts[3][0], pts[0][1] - pts[3][1]],
      ],
      pts[0][0],
      pts[0][1],
      [1, 1],
      'FD',
      true
    );

    // Plotted vertices
    doc.setFillColor(...CRIMSON_DEEP);
    pts.forEach(([px, py]) => {
      doc.circle(px, py, 0.95, 'F');
    });
  }

  // Unified Total Score & Talent Recommendation Summary Strip (y: 172 -> 186)
  doc.setFillColor(...grade.bgRgb);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.28);
  doc.roundedRect(marginX, 172, contentW, 14.5, 1.8, 1.8, 'FD');

  // Column 1: Total Score
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.7);
  doc.setTextColor(...SLATE);
  doc.text(isEn ? 'TOTAL EVALUATION SCORE' : 'SKOR EVALUASI TOTAL', marginX + 5, 177.2);
  doc.setFont('courier', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text(`${totalSkor} / 40`, marginX + 5, 183.3);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...grade.rgb);
  doc.text(`(${grade.pct}%)`, marginX + 27, 183.1);

  // Vertical Hairline 1
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.25);
  doc.line(marginX + 53, 174.5, marginX + 53, 184);

  // Column 2: Grade Predicate
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.7);
  doc.setTextColor(...SLATE);
  doc.text(isEn ? 'ACHIEVEMENT GRADE' : 'PREDIKAT MUTU', marginX + 58, 177.2);
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...grade.rgb);
  doc.text(`${grade.letter}  ·  ${grade.label}`, marginX + 58, 183.2);

  // Vertical Hairline 2
  doc.line(marginX + 112, 174.5, marginX + 112, 184);

  // Column 3: Talent Recommendation
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.7);
  doc.setTextColor(...SLATE);
  doc.text(isEn ? 'TALENT POOL RECOMMENDATION' : 'REKOMENDASI TALENT POOL', marginX + 117, 177.2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.2);
  doc.setTextColor(...grade.rgb);
  doc.text(talentLabel, marginX + 117, 183.2);

  // 6. SECTION 03: REKAM KEDISIPLINAN & PERNYATAAN RESMI (y: 194 -> 229)
  drawSectionHeading(
    '03.',
    isEn ? 'ATTENDANCE DISCIPLINE & OFFICIAL ATTESTATION' : 'REKAM KEDISIPLINAN & PERNYATAAN RESMI',
    194.5
  );

  // 4-Column Tabular Attendance Ribbon (Clean hairline-separated strip)
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.25);
  doc.roundedRect(marginX, 197.8, contentW, 14.2, 1.5, 1.5, 'FD');

  const attItems = [
    {
      label: isEn ? 'Check-In Recorded' : 'Presensi Masuk',
      value: `${attendance.totalMasuk} ${isEn ? 'days' : 'hari'}`,
      color: CRIMSON,
    },
    {
      label: isEn ? 'Check-Out Recorded' : 'Presensi Pulang',
      value: `${attendance.totalPulang} ${isEn ? 'days' : 'hari'}`,
      color: [4, 120, 87] as [number, number, number],
    },
    {
      label: isEn ? 'Approved Leave' : 'Izin / Keterangan',
      value: `${attendance.totalIzin} ${isEn ? 'days' : 'hari'}`,
      color: GOLD,
    },
    {
      label: isEn ? 'GPS Geofence Anomalies' : 'Anomali Geofence GPS',
      value: `${attendance.totalAnomali} ${isEn ? 'flags' : 'catatan'}`,
      color: attendance.totalAnomali > 0 ? CRIMSON : SLATE,
    },
  ];

  const cellW = contentW / 4;
  attItems.forEach((item, idx) => {
    const xCenter = marginX + cellW * idx + cellW / 2;
    if (idx > 0) {
      doc.setDrawColor(...RULE_SOFT);
      doc.setLineWidth(0.22);
      doc.line(marginX + cellW * idx, 200.2, marginX + cellW * idx, 209.6);
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.6);
    doc.setTextColor(...MUTED);
    doc.text(item.label, xCenter, 202.8, { align: 'center' });
    doc.setFont('courier', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...item.color);
    doc.text(item.value, xCenter, 209.1, { align: 'center' });
  });

  // Formal Attestation Statement
  const attestationText = mentorNote
    ? mentorNote
    : isEn
      ? `This document officially certifies that ${mhs.nama} (NIM ${mhs.nim}) from ${mhs.universitas} has undergone the ${mhs.program} Industrial Internship Program in the ${mhs.department} Department at PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory (${mhs.tglMasuk} to ${mhs.tanggalBerakhir}) in compliance with Safety First (HSE) and Ajinomoto Indonesia University operational standards.`
      : `Dengan ini diterangkan bahwa ${mhs.nama} (NIM ${mhs.nim}) dari ${mhs.universitas} telah melaksanakan Program Magang Industri (${mhs.program}) pada Departemen ${mhs.department} di PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory (${mhs.tglMasuk} s/d ${mhs.tanggalBerakhir}) sesuai standar operasional Ajinomoto Indonesia University dan budaya kerja Safety First (HSE).`;

  doc.setFont('times', 'italic');
  doc.setFontSize(8.6);
  doc.setTextColor(...SLATE);
  const attLines = doc.splitTextToSize(attestationText, contentW - 4) as string[];
  doc.text(attLines.slice(0, 3), marginX + 2, 218.2);

  // 7. SECTION 04: PENGESAHAN DIGITAL QR & TANDA TANGAN RESMI (y: 235 -> 276)
  drawSectionHeading(
    '04.',
    isEn ? 'DIGITAL AUTHENTICATION & OFFICIAL ENDORSEMENT' : 'PENGESAHAN DIGITAL & TANDA TANGAN RESMI',
    235.5
  );

  // Left Block: QR Verification Card
  const verifyPayload = JSON.stringify({
    docNo: docNumber,
    issuer: 'PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory (HRD)',
    nim: mhs.nim,
    nama: mhs.nama,
    program: mhs.program,
    dept: mhs.department,
    skor: `${totalSkor}/40`,
    pilar: { bk, ps, tw, is: isScore },
    rekomendasi: talentLabel,
    terbit: issuedDateLabel,
  });
  const qrDataUrl = await QRCode.toDataURL(verifyPayload, {
    width: 240,
    margin: 1,
    color: { dark: '#0F172A', light: '#FFFFFF' },
  });

  doc.setFillColor(253, 252, 250);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.25);
  doc.roundedRect(marginX, 239.5, 92, 34, 1.8, 1.8, 'FD');

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...RULE_SOFT);
  doc.rect(marginX + 3.5, 243, 27, 27, 'FD');
  doc.addImage(qrDataUrl, 'PNG', marginX + 4.5, 244, 25, 25);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.4);
  doc.setTextColor(...CRIMSON);
  doc.text(
    isEn ? 'DIGITAL VERIFICATION SEAL' : 'VERIFIKASI KEASLIAN DIGITAL',
    marginX + 34,
    247
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.7);
  doc.setTextColor(...SLATE);
  const qrDesc = doc.splitTextToSize(
    isEn
      ? 'Scan this QR code to validate recipient identity, 4-pillar scores, and official HRD Mojokerto issuance.'
      : 'Pindai QR code ini untuk memvalidasi identitas peserta, nilai 4 pilar kompetensi, dan keaslian dokumen resmi HRD.',
    54
  ) as string[];
  doc.text(qrDesc, marginX + 34, 251.5);

  doc.setFont('courier', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(...INK);
  doc.text(`ID: AJI-MJK-${mhs.nim.slice(-10)}`, marginX + 34, 267.8);

  // Right Block: Official Signature Block with Subtle Corporate Verification Ring
  const sigCenterX = pageW - marginX - 38;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(...SLATE);
  doc.text(`Mojokerto, ${issuedDateLabel}`, sigCenterX, 243.8, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.6);
  doc.setTextColor(...INK);
  doc.text(
    isEn ? 'Approved & Certified by,' : 'Mengetahui & Mengesahkan,',
    sigCenterX,
    248.2,
    { align: 'center' }
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.9);
  doc.setTextColor(...MUTED);
  doc.text('HR Development Section · Mojokerto Factory', sigCenterX, 252, { align: 'center' });

  // Subtle Official Circular Verification Seal (Light Crimson Tint Ring)
  doc.setDrawColor(235, 195, 195);
  doc.setLineWidth(0.35);
  doc.circle(sigCenterX - 24, 261.5, 6.5, 'S');
  doc.setLineWidth(0.18);
  doc.circle(sigCenterX - 24, 261.5, 5.2, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.5);
  doc.setTextColor(210, 120, 120);
  doc.text('HRD', sigCenterX - 24, 260.7, { align: 'center' });
  doc.text('VERIFIED', sigCenterX - 24, 263, { align: 'center' });

  // Signature Line & Signer Name / Title
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.35);
  doc.line(sigCenterX - 30, 266.8, sigCenterX + 30, 266.8);

  if (signerName) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.6);
    doc.setTextColor(...INK);
    doc.text(signerName, sigCenterX, 271.2, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(...SLATE);
    doc.text(signerTitle, sigCenterX, 275, { align: 'center' });
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.4);
    doc.setTextColor(...INK);
    doc.text(signerTitle, sigCenterX, 271.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text('PT Ajinomoto Indonesia - PT Ajinex International', sigCenterX, 275.2, {
      align: 'center',
    });
  }

  // 8. ARCHIVAL FOOTER (y: 280 -> 287)
  doc.setDrawColor(...RULE_SOFT);
  doc.setLineWidth(0.25);
  doc.line(marginX, 280.5, pageW - marginX, 280.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...MUTED);
  doc.text(
    'PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory  ·  Dokumen Resmi HR Development',
    marginX,
    284.5
  );
  doc.text(
    isEn ? 'Eat Well, Live Well. · Safety First · Page 1 / 1' : 'Eat Well, Live Well. · Safety First · Halaman 1 / 1',
    pageW - marginX,
    284.5,
    { align: 'right' }
  );

  doc.save(`Laporan_Magang_${mhs.nim}_${mhs.nama.replace(/\s+/g, '_')}.pdf`);
}

export function exportVacanciesExcel(rows: Lowongan[]) {
  exportToExcel(
    `Lowongan_Magang_Ajinomoto.xlsx`,
    'Lowongan',
    rows.map((r) => ({
      ID: r.id,
      Nama_Posisi: r.namaPosisi,
      Pendidikan: r.pendidikan,
      Prodi: r.prodi,
      Skill: r.skill,
      Tugas: r.tugas,
      Benefit: r.benefit,
      Status: r.status,
    }))
  );
}

export function exportApplicantsCsv(rows: Pendaftaran[]) {
  exportToCsv(
    `Pelamar_Magang_Ajinomoto.csv`,
    rows.map((r) => ({
      ID: r.id,
      Timestamp: r.timestamp,
      Jenis: r.jenis,
      Nama: r.nama,
      NIM: r.nim,
      Universitas: r.universitas,
      Jurusan: r.jurusan,
      Lowongan: r.lowongan,
      Email: r.email,
      Link_CV: r.linkCv,
      Persetujuan_Privacy: r.persetujuanPrivacy ? 'Setuju' : 'Belum',
      Status: r.status,
    }))
  );
}

export function exportPksCsv(rows: UniversitasPKS[]) {
  exportToCsv(
    `PKS_Universitas_Ajinomoto.csv`,
    rows.map((r) => ({
      Universitas: r.universitas,
      Tanggal_Mulai: r.tanggalMulai,
      Tanggal_Berakhir: r.tanggalBerakhir,
      Durasi_Hari: r.durasiHari,
      Durasi_Bulan: r.durasiBulan,
      Keterangan: r.keterangan,
      Link_Data_PKS: r.linkDataPks,
      Status: r.status,
    }))
  );
}
