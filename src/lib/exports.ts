import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import * as XLSX from 'xlsx';
import type {
  DailyAttendanceSummary,
  DashboardStatsResponse,
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

export async function exportInternCertificatePdf(mhs: Mahasiswa) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Border frame
  doc.setDrawColor(200, 16, 46);
  doc.setLineWidth(1.2);
  doc.rect(10, 10, 277, 190);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.rect(13, 13, 271, 184);

  doc.setTextColor(200, 16, 46);
  doc.setFontSize(11);
  doc.text('PT AJINOMOTO INDONESIA - PT AJINEX INTERNATIONAL, MOJOKERTO FACTORY', 148.5, 28, { align: 'center' });

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(24);
  doc.text('SURAT KETERANGAN & LAPORAN EVALUASI MAGANG', 148.5, 43, { align: 'center' });

  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text(`Program ${mhs.program} · HR Development Section`, 148.5, 51, { align: 'center' });

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.text('Diberikan kepada:', 148.5, 68, { align: 'center' });
  doc.setFontSize(22);
  doc.text(mhs.nama, 148.5, 80, { align: 'center' });
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text(`NIM ${mhs.nim} · ${mhs.jurusan} · ${mhs.universitas}`, 148.5, 89, { align: 'center' });

  const bodyCopy = `Telah mengikuti dan menyelesaikan penugasan Program Magang ${mhs.program} pada Departemen ${mhs.department} di PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory terhitung mulai tanggal ${mhs.tglMasuk} hingga ${mhs.tanggalBerakhir}.`;
  const wrapped = doc.splitTextToSize(bodyCopy, 210) as string[];
  doc.setTextColor(30, 41, 59);
  doc.text(wrapped, 148.5, 104, { align: 'center' });

  autoTable(doc, {
    startY: 122,
    margin: { left: 45, right: 45 },
    head: [['Program', 'Departemen', 'Status', 'Skor Evaluasi Total', 'Kategori Rekomendasi Talent']],
    body: [[mhs.program, mhs.department, mhs.status, `${mhs.skor} / 40`, mhs.talent]],
    headStyles: { fillColor: [200, 16, 46] },
    styles: { halign: 'center', fontSize: 9.5 },
  });

  // Verification QR Code
  const verifyPayload = JSON.stringify({
    issuer: 'PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory (HRD)',
    nim: mhs.nim,
    nama: mhs.nama,
    program: mhs.program,
    skor: mhs.skor,
    rekomendasi: mhs.talent,
  });
  const qrDataUrl = await QRCode.toDataURL(verifyPayload, { width: 160, margin: 1 });
  doc.addImage(qrDataUrl, 'PNG', 22, 152, 30, 30);
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Verifikasi Digital HRD', 37, 186, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Mojokerto, HR Development Section', 238, 160, { align: 'center' });
  doc.line(210, 180, 266, 180);
  doc.setFontSize(9);
  doc.text('HR Development Manager', 238, 186, { align: 'center' });

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
