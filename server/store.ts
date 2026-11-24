import type {
  AIAuditLog,
  AbsensiRecord,
  DailyAttendanceSummary,
  DashboardStatsResponse,
  EmailNotificationLog,
  EvaluasiRecord,
  Lowongan,
  Mahasiswa,
  Pendaftaran,
  RekomendasiTalent,
  UniversitasPKS,
} from '../src/types/internship';
import { loadOrSeedPostgresData, syncDatabaseToPostgres } from '../src/db/storeSync.ts';

export interface AdminProfile {
  username: string;
  namaTampilan: string;
  role: string;
  departemen: string;
  email: string;
  noTelepon: string;
  avatarUrl: string;
  passwordHash?: string;
}

export const DEFAULT_ADMIN_PROFILE: AdminProfile = {
  username: 'hr.mojokerto',
  namaTampilan: 'Rina Kusuma',
  role: 'HR Development Admin',
  departemen: 'HR Development Section',
  email: 'hr.development@ajinomoto.co.id',
  noTelepon: '+62 321-361-000',
  avatarUrl: '/assets/images/avatar_hr_admin_1794535891951.jpg',
};

export interface DatabaseSchema {
  lowongan: Lowongan[];
  pendaftaran: Pendaftaran[];
  mahasiswa: Mahasiswa[];
  absensi: AbsensiRecord[];
  evaluasi: EvaluasiRecord[];
  universitas: UniversitasPKS[];
  aiAuditLogs: AIAuditLog[];
  emailLogs: EmailNotificationLog[];
  gasApiUrl: string;
  factoryCoords?: {
    lat: number;
    lng: number;
    maxRadiusMeters: number;
  };
  adminProfile?: AdminProfile;
}

// Koordinat resmi PT Ajinomoto Indonesia - Pabrik Mojokerto (Jl. Raya Mlirip, Jetis, Mojokerto)
export const FACTORY_COORDS = {
  lat: -7.4589,
  lng: 112.4631,
  maxRadiusMeters: 650,
};

export function getJakartaDateStr(dateInput: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(dateInput);
}

export function getJakartaTimestamp(dateInput: Date = new Date()): string {
  const datePart = getJakartaDateStr(dateInput);
  const timePart = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(dateInput);
  return `${datePart} ${timePart} WIB`;
}

export function addDaysJakarta(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function diffDays(startStr: string, endStr: string): number {
  const start = new Date(`${startStr}T00:00:00Z`).getTime();
  const end = new Date(`${endStr}T00:00:00Z`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
}

export function calcDurationMonths(days: number): number {
  if (days <= 0) return 0;
  return Math.max(1, Math.round(days / 30));
}

export function computeTalentRekomendasi(totalSkor: number): RekomendasiTalent {
  if (totalSkor >= 30) return 'Sangat Direkomendasikan';
  if (totalSkor >= 21) return 'Dipertimbangkan';
  return 'Tidak Direkomendasikan';
}

export function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function buildInitialSeed(): DatabaseSchema {
  const today = getJakartaDateStr();
  const dMinus1 = addDaysJakarta(today, -1);
  const dMinus2 = addDaysJakarta(today, -2);
  const dMinus3 = addDaysJakarta(today, -3);
  const dMinus4 = addDaysJakarta(today, -4);

  const lowongan: Lowongan[] = [
    {
      id: 'LOW-001',
      namaPosisi: 'Quality Assurance & Food Safety Intern',
      pendidikan: 'S1 / D4',
      prodi: 'Teknologi Pangan, Kimia, Bioteknologi, Teknik Kimia',
      skill: 'HACCP & ISO 22000; Analisis Mikrobiologi & Kimia Dasar; Microsoft Excel & Pengolahan Data',
      tugas: 'Mendampingi inspeksi bahan baku dan produk jadi di lini produksi; Menyusun log verifikasi CCP harian; Membantu uji laboratorium sanitasi area pabrik',
      benefit: 'Uang saku bulanan kompetitif; Makan siang & fasilitas antar-jemput area Mojokerto; Sertifikat industri resmi & pendampingan mentor QA',
      status: 'Open',
    },
    {
      id: 'LOW-002',
      namaPosisi: 'Production Engineering & Automation Intern',
      pendidikan: 'S1 / D4',
      prodi: 'Teknik Industri, Teknik Mesin, Teknik Elektro, Mekatronika',
      skill: 'AutoCAD / SolidWorks; Dasar PLC & SCADA; Lean Manufacturing & Time Motion Study',
      tugas: 'Menganalisis OEE (Overall Equipment Effectiveness) lini pengemasan; Mendukung proyek perbaikan efisiensi energi utilitas; Dokumentasi SOP kerja standar',
      benefit: 'Uang saku bulanan; Seragam kerja & APD lengkap; Pengalaman langsung proyek Kaizen pabrik skala nasional',
      status: 'Open',
    },
    {
      id: 'LOW-003',
      namaPosisi: 'Environmental & Waste Water Management Intern',
      pendidikan: 'S1 / D4',
      prodi: 'Teknik Lingkungan, Teknik Kimia, Biologi',
      skill: 'Pengukuran COD/BOD/TSS; Regulasi PROPER KLHK; Analisis Data Lingkungan',
      tugas: 'Pemantauan harian instalasi pengolahan air limbah (IPAL) Mojokerto; Kalibrasi catatan pemakaian bahan kimia koagulan; Pelaporan kepatuhan eco-factory',
      benefit: 'Uang saku bulanan; Pelatihan K3 Lingkungan; Kesempatan riset tugas akhir terintegrasi',
      status: 'Open',
    },
    {
      id: 'LOW-004',
      namaPosisi: 'HR Development & People Analytics Intern',
      pendidikan: 'S1',
      prodi: 'Psikologi, Manajemen SDM, Sistem Informasi, Teknik Industri',
      skill: 'Administrasi Rekrutmen & Training; Pengolahan Data Dashboard (Excel/BI); Komunikasi Interpersonal & Presentasi',
      tugas: 'Mengelola operasional administrasi program MBKM & PKL; Menyusun rekap evaluasi peserta magang & kalender pelatihan karyawan; Mendukung employer branding kampus',
      benefit: 'Uang saku bulanan; Eksposur sistem HR manufacturing modern; Mentoring langsung oleh HR Development Section Head',
      status: 'Open',
    },
    {
      id: 'LOW-005',
      namaPosisi: 'Supply Chain & Warehouse Optimization Intern',
      pendidikan: 'S1 / D4',
      prodi: 'Teknik Industri, Manajemen Logistik, Sistem Informasi',
      skill: 'Inventory Control (FIFO/FEFO); Excel Pivot & Forecasting; Dasar ERP/SAP Warehouse',
      tugas: 'Audit akurasi stok bahan kemas gudang Mojokerto; Evaluasi lead time penerimaan vendor; Optimalisasi layout rak penyimpanan',
      benefit: 'Uang saku bulanan; Makan siang pabrik; Sertifikat kompetensi logistik',
      status: 'Closed',
    },
  ];

  const mahasiswa: Mahasiswa[] = [
    {
      nim: '215100201111014',
      program: 'MBKM',
      department: 'Quality Assurance',
      nama: 'Nadia Kusuma Wardani',
      universitas: 'Universitas Brawijaya',
      jurusan: 'Teknologi Pangan',
      tglMasuk: addDaysJakarta(today, -65),
      tanggalBerakhir: addDaysJakarta(today, 55),
      gender: 'P',
      status: 'Aktif',
      talent: 'Sangat Direkomendasikan',
      skor: 35,
    },
    {
      nim: '5009211042',
      program: 'MBKM',
      department: 'Production Engineering',
      nama: 'Rizky Pratama Putra',
      universitas: 'Institut Teknologi Sepuluh Nopember',
      jurusan: 'Teknik Fisika',
      tglMasuk: addDaysJakarta(today, -65),
      tanggalBerakhir: addDaysJakarta(today, 55),
      gender: 'L',
      status: 'Aktif',
      talent: 'Sangat Direkomendasikan',
      skor: 34,
    },
    {
      nim: '21081010188',
      program: 'MBKM',
      department: 'HR Development',
      nama: 'Siti Aisyah Rahmawati',
      universitas: 'Universitas Airlangga',
      jurusan: 'Psikologi',
      tglMasuk: addDaysJakarta(today, -50),
      tanggalBerakhir: addDaysJakarta(today, 70),
      gender: 'P',
      status: 'Aktif',
      talent: 'Sangat Direkomendasikan',
      skor: 32,
    },
    {
      nim: '21032010077',
      program: 'PKL',
      department: 'Environment & Safety',
      nama: 'Bagas Adi Nugroho',
      universitas: 'UPN Veteran Jawa Timur',
      jurusan: 'Teknik Lingkungan',
      tglMasuk: addDaysJakarta(today, -32),
      tanggalBerakhir: addDaysJakarta(today, 28),
      gender: 'L',
      status: 'Aktif',
      talent: 'Dipertimbangkan',
      skor: 26,
    },
    {
      nim: '22051204031',
      program: 'MBKM',
      department: 'Production Engineering',
      nama: 'Dimas Wahyu Setiawan',
      universitas: 'Universitas Negeri Surabaya',
      jurusan: 'Teknik Mesin',
      tglMasuk: addDaysJakarta(today, -50),
      tanggalBerakhir: addDaysJakarta(today, 70),
      gender: 'L',
      status: 'Aktif',
      talent: 'Sangat Direkomendasikan',
      skor: 31,
    },
    {
      nim: '211710101095',
      program: 'PKL',
      department: 'Quality Assurance',
      nama: 'Fitriani Dwi Lestari',
      universitas: 'Universitas Jember',
      jurusan: 'Teknologi Hasil Pertanian',
      tglMasuk: addDaysJakarta(today, -28),
      tanggalBerakhir: addDaysJakarta(today, 32),
      gender: 'P',
      status: 'Aktif',
      talent: 'Dipertimbangkan',
      skor: 24,
    },
    {
      nim: '2141170045',
      program: 'PKL',
      department: 'Utility & Automation',
      nama: 'Fajar Maulana Hakim',
      universitas: 'Politeknik Negeri Malang',
      jurusan: 'Teknik Elektronika',
      tglMasuk: addDaysJakarta(today, -20),
      tanggalBerakhir: addDaysJakarta(today, 40),
      gender: 'L',
      status: 'Aktif',
      talent: 'Sangat Direkomendasikan',
      skor: 30,
    },
    {
      nim: '215060700111029',
      program: 'MBKM',
      department: 'Supply Chain',
      nama: 'Clara Angelina Wijaya',
      universitas: 'Universitas Brawijaya',
      jurusan: 'Teknik Industri',
      tglMasuk: addDaysJakarta(today, -65),
      tanggalBerakhir: addDaysJakarta(today, 55),
      gender: 'P',
      status: 'Aktif',
      talent: 'Belum Dievaluasi',
      skor: 0,
    },
    {
      nim: '20050874011',
      program: 'PKL',
      department: 'Quality Assurance',
      nama: 'Hendra Wijaksono',
      universitas: 'Universitas Negeri Malang',
      jurusan: 'Kimia',
      tglMasuk: addDaysJakarta(today, -120),
      tanggalBerakhir: addDaysJakarta(today, -30),
      gender: 'L',
      status: 'Tidak Aktif',
      talent: 'Tidak Direkomendasikan',
      skor: 19,
    },
  ];

  const evaluasi: EvaluasiRecord[] = [
    {
      id: 'EV-001',
      timestamp: `${dMinus4} 14:20:00 WIB`,
      nim: '215100201111014',
      nama: 'Nadia Kusuma Wardani',
      skorBk: 9,
      skorPs: 9,
      skorTw: 9,
      skorIs: 8,
      skor: 35,
      rekomendasi: 'Sangat Direkomendasikan',
    },
    {
      id: 'EV-002',
      timestamp: `${dMinus4} 15:05:00 WIB`,
      nim: '5009211042',
      nama: 'Rizky Pratama Putra',
      skorBk: 8,
      skorPs: 9,
      skorTw: 9,
      skorIs: 8,
      skor: 34,
      rekomendasi: 'Sangat Direkomendasikan',
    },
    {
      id: 'EV-003',
      timestamp: `${dMinus3} 10:15:00 WIB`,
      nim: '21081010188',
      nama: 'Siti Aisyah Rahmawati',
      skorBk: 8,
      skorPs: 8,
      skorTw: 8,
      skorIs: 8,
      skor: 32,
      rekomendasi: 'Sangat Direkomendasikan',
    },
    {
      id: 'EV-004',
      timestamp: `${dMinus3} 13:45:00 WIB`,
      nim: '22051204031',
      nama: 'Dimas Wahyu Setiawan',
      skorBk: 8,
      skorPs: 8,
      skorTw: 8,
      skorIs: 7,
      skor: 31,
      rekomendasi: 'Sangat Direkomendasikan',
    },
    {
      id: 'EV-005',
      timestamp: `${dMinus2} 11:30:00 WIB`,
      nim: '2141170045',
      nama: 'Fajar Maulana Hakim',
      skorBk: 8,
      skorPs: 8,
      skorTw: 7,
      skorIs: 7,
      skor: 30,
      rekomendasi: 'Sangat Direkomendasikan',
    },
    {
      id: 'EV-006',
      timestamp: `${dMinus2} 16:00:00 WIB`,
      nim: '21032010077',
      nama: 'Bagas Adi Nugroho',
      skorBk: 6,
      skorPs: 7,
      skorTw: 7,
      skorIs: 6,
      skor: 26,
      rekomendasi: 'Dipertimbangkan',
    },
    {
      id: 'EV-007',
      timestamp: `${dMinus1} 09:40:00 WIB`,
      nim: '211710101095',
      nama: 'Fitriani Dwi Lestari',
      skorBk: 6,
      skorPs: 6,
      skorTw: 6,
      skorIs: 6,
      skor: 24,
      rekomendasi: 'Dipertimbangkan',
    },
    {
      id: 'EV-008',
      timestamp: `${addDaysJakarta(today, -31)} 16:20:00 WIB`,
      nim: '20050874011',
      nama: 'Hendra Wijaksono',
      skorBk: 5,
      skorPs: 4,
      skorTw: 5,
      skorIs: 5,
      skor: 19,
      rekomendasi: 'Tidak Direkomendasikan',
    },
  ];

  const sampleAvatarSvg = (initials: string, color: string) =>
    `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" fill="${color}"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="72" font-weight="700" fill="#ffffff">${initials}</text></svg>`
    )}`;

  const absensi: AbsensiRecord[] = [
    // Historical days
    ...[dMinus4, dMinus3, dMinus2, dMinus1].flatMap((tgl, idx) => [
      {
        id: `ABS-H-${idx}-1`,
        timestamp: `${tgl} 07:42:11 WIB`,
        tanggal: tgl,
        nim: '215100201111014',
        nama: 'Nadia Kusuma Wardani',
        status: 'Masuk' as const,
        lokasi: '-7.4591,112.4633',
        jarakMeter: 31,
        linkFoto: sampleAvatarSvg('NK', '#B91C1C'),
      },
      {
        id: `ABS-H-${idx}-2`,
        timestamp: `${tgl} 16:35:04 WIB`,
        tanggal: tgl,
        nim: '215100201111014',
        nama: 'Nadia Kusuma Wardani',
        status: 'Pulang' as const,
        lokasi: '-7.4590,112.4630',
        jarakMeter: 16,
        linkFoto: sampleAvatarSvg('NK', '#B91C1C'),
      },
      {
        id: `ABS-H-${idx}-3`,
        timestamp: `${tgl} 07:48:19 WIB`,
        tanggal: tgl,
        nim: '5009211042',
        nama: 'Rizky Pratama Putra',
        status: 'Masuk' as const,
        lokasi: '-7.4586,112.4628',
        jarakMeter: 47,
        linkFoto: sampleAvatarSvg('RP', '#1E293B'),
      },
      {
        id: `ABS-H-${idx}-4`,
        timestamp: `${tgl} 07:53:40 WIB`,
        tanggal: tgl,
        nim: '21081010188',
        nama: 'Siti Aisyah Rahmawati',
        status: 'Masuk' as const,
        lokasi: '-7.4592,112.4635',
        jarakMeter: 55,
        linkFoto: sampleAvatarSvg('SA', '#334155'),
      },
      {
        id: `ABS-H-${idx}-5`,
        timestamp: `${tgl} 08:05:12 WIB`,
        tanggal: tgl,
        nim: '22051204031',
        nama: 'Dimas Wahyu Setiawan',
        status: idx === 2 ? ('Izin' as const) : ('Masuk' as const),
        lokasi: '-7.4588,112.4632',
        jarakMeter: 15,
        linkFoto: sampleAvatarSvg('DW', '#0F172A'),
        keterangan: idx === 2 ? 'Bimbingan Skripsi Kampus' : undefined,
      },
    ]),
    // Today's entries
    {
      id: 'ABS-T-001',
      timestamp: `${today} 07:38:14 WIB`,
      tanggal: today,
      nim: '215100201111014',
      nama: 'Nadia Kusuma Wardani',
      status: 'Masuk',
      lokasi: '-7.4590,112.4632',
      jarakMeter: 16,
      linkFoto: sampleAvatarSvg('NK', '#B91C1C'),
    },
    {
      id: 'ABS-T-002',
      timestamp: `${today} 07:44:50 WIB`,
      tanggal: today,
      nim: '5009211042',
      nama: 'Rizky Pratama Putra',
      status: 'Masuk',
      lokasi: '-7.4587,112.4629',
      jarakMeter: 31,
      linkFoto: sampleAvatarSvg('RP', '#1E293B'),
    },
    {
      id: 'ABS-T-003',
      timestamp: `${today} 07:51:03 WIB`,
      tanggal: today,
      nim: '21081010188',
      nama: 'Siti Aisyah Rahmawati',
      status: 'Masuk',
      lokasi: '-7.4591,112.4634',
      jarakMeter: 40,
      linkFoto: sampleAvatarSvg('SA', '#334155'),
    },
    {
      id: 'ABS-T-004',
      timestamp: `${today} 07:56:29 WIB`,
      tanggal: today,
      nim: '2141170045',
      nama: 'Fajar Maulana Hakim',
      status: 'Masuk',
      lokasi: '-7.4584,112.4627',
      jarakMeter: 71,
      linkFoto: sampleAvatarSvg('FM', '#0F172A'),
    },
    {
      id: 'ABS-T-005',
      timestamp: `${today} 08:12:41 WIB`,
      tanggal: today,
      nim: '21032010077',
      nama: 'Bagas Adi Nugroho',
      status: 'Izin',
      lokasi: '-7.3102,112.7318',
      jarakMeter: 33920,
      linkFoto: sampleAvatarSvg('BA', '#B45309'),
      keterangan: 'Izin sakit demam (Surat Dokter terlampir)',
    },
    {
      id: 'ABS-T-006',
      timestamp: `${today} 08:21:05 WIB`,
      tanggal: today,
      nim: '22051204031',
      nama: 'Dimas Wahyu Setiawan',
      status: 'Masuk',
      lokasi: '-7.4792,112.4410',
      jarakMeter: 3328,
      linkFoto: sampleAvatarSvg('DW', '#0F172A'),
      anomaliFlag: 'Lokasi di luar radius pabrik (> 650 m)',
    },
  ];

  const pendaftaran: Pendaftaran[] = [
    {
      id: 'REG-2026-001',
      timestamp: `${dMinus2} 09:14:22 WIB`,
      jenis: 'MBKM',
      nama: 'Aulia Putri Maharani',
      nim: '215100100111033',
      universitas: 'Universitas Brawijaya',
      jurusan: 'Teknologi Pangan',
      lowongan: 'Quality Assurance & Food Safety Intern',
      linkCv: 'drive://cv-aulia-putri-maharani.pdf',
      cvFileName: 'CV_Aulia_Putri_Maharani_UB.pdf',
      cvSummaryText:
        'Mahasiswa S1 Teknologi Pangan IPK 3.78. Sertifikasi dasar HACCP & GMP. Pengalaman asisten laboratorium mikrobiologi pangan 2 semester, menguasai uji TPC, analisis kadar air, dan pengolahan data Excel.',
      status: 'Pending',
      email: 'aulia.maharani@student.ub.ac.id',
      persetujuanPrivacy: true,
    },
    {
      id: 'REG-2026-002',
      timestamp: `${dMinus2} 11:42:08 WIB`,
      jenis: 'MBKM',
      nama: 'Muhammad Ilham Syahputra',
      nim: '5007211098',
      universitas: 'Institut Teknologi Sepuluh Nopember',
      jurusan: 'Teknik Mesin',
      lowongan: 'Production Engineering & Automation Intern',
      linkCv: 'drive://cv-ilham-syahputra.pdf',
      cvFileName: 'CV_Ilham_Syahputra_ITS.pdf',
      cvSummaryText:
        'Mahasiswa Teknik Mesin ITS semester 7, IPK 3.64. Menguasai SolidWorks, AutoCAD, dan pemrograman dasar PLC Siemens. Pernah mengerjakan proyek optimasi OEE lini konveyor dan studi waktu kerja.',
      status: 'Pending',
      email: 'ilham.syahputra@its.ac.id',
      persetujuanPrivacy: true,
    },
    {
      id: 'REG-2026-003',
      timestamp: `${dMinus1} 14:05:49 WIB`,
      jenis: 'PKL',
      nama: 'Rania Azzahra',
      nim: '22031010051',
      universitas: 'UPN Veteran Jawa Timur',
      jurusan: 'Teknik Kimia',
      lowongan: 'Environmental & Waste Water Management Intern',
      linkCv: '-',
      status: 'Pending',
      email: 'rania.azzahra@upnjatim.ac.id',
      persetujuanPrivacy: true,
    },
    {
      id: 'REG-2026-004',
      timestamp: `${dMinus3} 10:20:00 WIB`,
      jenis: 'MBKM',
      nama: 'Nadia Kusuma Wardani',
      nim: '215100201111014',
      universitas: 'Universitas Brawijaya',
      jurusan: 'Teknologi Pangan',
      lowongan: 'Quality Assurance & Food Safety Intern',
      linkCv: 'drive://cv-nadia-kusuma.pdf',
      cvFileName: 'CV_Nadia_Kusuma_UB.pdf',
      cvSummaryText: 'S1 Teknologi Pangan IPK 3.85, pengalaman riset fermentasi asam amino dan QC pangan.',
      status: 'Diterima',
      email: 'nadia.wardani@student.ub.ac.id',
      persetujuanPrivacy: true,
    },
    {
      id: 'REG-2026-005',
      timestamp: `${dMinus4} 16:10:00 WIB`,
      jenis: 'PKL',
      nama: 'Kevin Adi Pratama',
      nim: '21041010122',
      universitas: 'Universitas Muhammadiyah Malang',
      jurusan: 'Ilmu Komunikasi',
      lowongan: 'Production Engineering & Automation Intern',
      linkCv: '-',
      status: 'Ditolak',
      email: 'kevin.pratama@webmail.umm.ac.id',
      persetujuanPrivacy: true,
    },
  ];

  const makePks = (
    id: string,
    universitas: string,
    tanggalMulai: string,
    tanggalBerakhir: string,
    keterangan: string,
    dokumenNama: string
  ): UniversitasPKS => {
    const durasiHari = Math.max(0, diffDays(tanggalMulai, tanggalBerakhir));
    const durasiBulan = calcDurationMonths(durasiHari);
    const status = tanggalBerakhir < today ? 'Expired' : 'Active';
    return {
      id,
      universitas,
      tanggalMulai,
      tanggalBerakhir,
      durasiHari,
      durasiBulan,
      keterangan,
      linkDataPks: `drive://pks/${dokumenNama}`,
      dokumenNama,
      status,
    };
  };

  const universitas: UniversitasPKS[] = [
    makePks(
      'PKS-001',
      'Universitas Brawijaya',
      addDaysJakarta(today, -335),
      addDaysJakarta(today, 30),
      'PKS Program MBKM Fakultas Teknologi Pertanian & Teknik Industri (Tepat H-30 Reminder)',
      'PKS_Ajinomoto_UB_2025_2026.pdf'
    ),
    makePks(
      'PKS-002',
      'Institut Teknologi Sepuluh Nopember',
      addDaysJakarta(today, -180),
      addDaysJakarta(today, 185),
      'PKS Riset & Magang Industri Fakultas Teknologi Industri dan Rekayasa Sistem',
      'PKS_Ajinomoto_ITS_2026.pdf'
    ),
    makePks(
      'PKS-003',
      'Universitas Airlangga',
      addDaysJakarta(today, -120),
      addDaysJakarta(today, 245),
      'PKS MBKM Fakultas Psikologi dan Kesehatan Masyarakat',
      'PKS_Ajinomoto_UNAIR_2026.pdf'
    ),
    makePks(
      'PKS-004',
      'UPN Veteran Jawa Timur',
      addDaysJakarta(today, -345),
      addDaysJakarta(today, 20),
      'PKS Teknik Kimia & Teknik Lingkungan — perlu perpanjangan segera',
      'PKS_Ajinomoto_UPNVJT_2025.pdf'
    ),
    makePks(
      'PKS-005',
      'Politeknik Negeri Malang',
      addDaysJakarta(today, -90),
      addDaysJakarta(today, 275),
      'PKS Vokasi Otomasi & Teknik Mesin Industri',
      'PKS_Ajinomoto_POLINEMA_2026.pdf'
    ),
    makePks(
      'PKS-006',
      'Universitas Negeri Surabaya',
      addDaysJakarta(today, -400),
      addDaysJakarta(today, -35),
      'PKS Lama Periode 2025 — menunggu penandatanganan adendum baru',
      'PKS_Ajinomoto_UNESA_2025.pdf'
    ),
  ];

  return {
    lowongan,
    pendaftaran,
    mahasiswa,
    absensi,
    evaluasi,
    universitas,
    aiAuditLogs: [
      {
        id: 'AI-LOG-001',
        timestamp: `${today} 08:30:00 WIB`,
        fitur: 'AI Executive Insight',
        adminUser: 'hr.mojokerto',
        ringkasanPrompt: 'Analisis tren kehadiran dan kesiapan talent agregat (8 peserta aktif, 6 PKS).',
        status: 'Sukses',
      },
    ],
    emailLogs: [
      {
        id: 'MAIL-001',
        timestamp: `${dMinus3} 10:25:00 WIB`,
        kepada: 'nadia.wardani@student.ub.ac.id',
        subjek: '[PT Ajinomoto Indonesia] Pengumuman Penerimaan Magang MBKM – Quality Assurance',
        jenis: 'Seleksi Diterima',
        isiRingkas: 'Selamat! Pendaftaran Anda untuk posisi Quality Assurance & Food Safety Intern dinyatakan Diterima.',
      },
    ],
    gasApiUrl: process.env.GAS_API_URL || '',
    factoryCoords: { ...FACTORY_COORDS },
    adminProfile: { ...DEFAULT_ADMIN_PROFILE },
  };
}

class DataStore {
  private data: DatabaseSchema;
  private pgHydrated = false;
  private lastHydratedAt = 0;
  private hydratePromise: Promise<void> | null = null;

  constructor() {
    // 100% PostgreSQL-backed: zero local db.json file reads or writes
    this.data = buildInitialSeed();
  }

  async ensurePostgresHydrated(): Promise<void> {
    const isServerless = Boolean(process.env.VERCEL);
    const cacheStale = isServerless && Date.now() - this.lastHydratedAt > 3000;
    if (this.pgHydrated && !cacheStale) return;
    if (!this.hydratePromise) {
      this.hydratePromise = loadOrSeedPostgresData(this.data)
        .then((loaded) => {
          this.data = loaded;
          this.pgHydrated = true;
          this.lastHydratedAt = Date.now();
          this.autoUpdatePksStatuses();
        })
        .catch((err) => {
          throw err;
        })
        .finally(() => {
          this.hydratePromise = null;
        });
    }
    await this.hydratePromise;
  }

  async refreshFromPostgres(): Promise<DatabaseSchema> {
    const loaded = await loadOrSeedPostgresData(this.data);
    this.data = loaded;
    this.pgHydrated = true;
    this.lastHydratedAt = Date.now();
    this.autoUpdatePksStatuses();
    return this.data;
  }

  async flushToPostgres(options: { replaceAll?: boolean } = {}): Promise<void> {
    await syncDatabaseToPostgres(this.data, options);
    this.lastHydratedAt = Date.now();
  }

  save(): void {
    if (this.pgHydrated) {
      void syncDatabaseToPostgres(this.data).catch((err) => {
        console.error('Background PostgreSQL sync error:', err);
      });
    }
  }

  getAll(): DatabaseSchema {
    return this.data;
  }

  resetSeed(): DatabaseSchema {
    this.data = buildInitialSeed();
    return this.data;
  }

  autoUpdatePksStatuses(): { updatedExpired: number; h30Reminders: UniversitasPKS[] } {
    const today = getJakartaDateStr();
    let updatedExpired = 0;
    const h30Reminders: UniversitasPKS[] = [];

    for (const pks of this.data.universitas) {
      pks.durasiHari = Math.max(0, diffDays(pks.tanggalMulai, pks.tanggalBerakhir));
      pks.durasiBulan = calcDurationMonths(pks.durasiHari);

      if (pks.tanggalBerakhir < today && pks.status !== 'Expired') {
        pks.status = 'Expired';
        updatedExpired += 1;
      } else if (pks.tanggalBerakhir >= today && pks.status === 'Active') {
        const remaining = diffDays(today, pks.tanggalBerakhir);
        if (remaining === 30) {
          h30Reminders.push(pks);
        }
      }
    }

    if (updatedExpired > 0) {
      this.save();
    }
    return { updatedExpired, h30Reminders };
  }

  syncMahasiswaTalent(): number {
    let syncedCount = 0;
    for (const mhs of this.data.mahasiswa) {
      const evals = this.data.evaluasi.filter((e) => e.nim === mhs.nim);
      if (evals.length > 0) {
        const latest = evals[evals.length - 1];
        mhs.skor = latest.skor;
        mhs.talent = computeTalentRekomendasi(latest.skor);
        syncedCount += 1;
      }
    }
    this.save();
    return syncedCount;
  }

  getFactoryCoords(): { lat: number; lng: number; maxRadiusMeters: number } {
    if (!this.data.factoryCoords) {
      this.data.factoryCoords = { ...FACTORY_COORDS };
    }
    return this.data.factoryCoords;
  }

  updateGeofenceRadius(maxRadiusMeters: number): { lat: number; lng: number; maxRadiusMeters: number } {
    const clamped = Math.min(5000, Math.max(100, Math.round(maxRadiusMeters)));
    const coords = this.getFactoryCoords();
    coords.maxRadiusMeters = clamped;
    this.save();
    return coords;
  }

  getAdminProfile(): AdminProfile {
    if (!this.data.adminProfile) {
      this.data.adminProfile = { ...DEFAULT_ADMIN_PROFILE };
      this.save();
    }
    return this.data.adminProfile;
  }

  getPublicAdminProfile(): Omit<AdminProfile, 'passwordHash'> {
    const { passwordHash: _ignored, ...publicProfile } = this.getAdminProfile();
    return publicProfile;
  }

  updateAdminProfile(patch: Partial<AdminProfile>): Omit<AdminProfile, 'passwordHash'> {
    const current = this.getAdminProfile();
    this.data.adminProfile = {
      ...current,
      ...patch,
      username: current.username,
    };
    this.save();
    return this.getPublicAdminProfile();
  }

  trackApplicationStatus(nim: string, email: string) {
    const cleanNim = nim.trim();
    const cleanEmail = email.trim().toLowerCase();
    const match = this.data.pendaftaran.find(
      (p) => p.nim === cleanNim && p.email.trim().toLowerCase() === cleanEmail
    );
    if (!match) return null;
    const mhs = this.data.mahasiswa.find((m) => m.nim === match.nim);
    return {
      id: match.id,
      timestamp: match.timestamp,
      jenis: match.jenis,
      nama: match.nama,
      nim: match.nim,
      universitas: match.universitas,
      jurusan: match.jurusan,
      lowongan: match.lowongan,
      status: match.status,
      mahasiswaAktif: mhs
        ? {
            department: mhs.department,
            tglMasuk: mhs.tglMasuk,
            tanggalBerakhir: mhs.tanggalBerakhir,
            status: mhs.status,
          }
        : undefined,
    };
  }

  getInternDetail(nim: string) {
    const mhs = this.data.mahasiswa.find((m) => m.nim === nim);
    if (!mhs) return null;
    const evaluasiHistory = this.data.evaluasi.filter((e) => e.nim === nim);
    const logs = this.data.absensi.filter((a) => a.nim === nim);
    return {
      mahasiswa: mhs,
      evaluasiHistory,
      attendanceSummary: {
        totalMasuk: logs.filter((l) => l.status === 'Masuk').length,
        totalPulang: logs.filter((l) => l.status === 'Pulang').length,
        totalIzin: logs.filter((l) => l.status === 'Izin').length,
        totalAnomali: logs.filter((l) => Boolean(l.anomaliFlag)).length,
        recentLogs: logs.slice(0, 10),
      },
    };
  }

  getDashboardStats(): DashboardStatsResponse {
    const today = getJakartaDateStr();
    const activeStudents = this.data.mahasiswa.filter((m) => m.status === 'Aktif');
    const mbkmAktif = activeStudents.filter((m) => m.program === 'MBKM').length;
    const pklAktif = activeStudents.filter((m) => m.program === 'PKL').length;

    const daily = this.getDailyAttendance(today);
    const talentPoolCount = this.data.mahasiswa.filter(
      (m) => m.skor >= 30 || m.talent === 'Sangat Direkomendasikan'
    ).length;

    const pksMendekatiH30 = this.data.universitas.filter((u) => {
      if (u.status !== 'Active') return false;
      const rem = diffDays(today, u.tanggalBerakhir);
      return rem >= 0 && rem <= 30;
    }).length;

    const pendingApplicants = this.data.pendaftaran.filter((p) => p.status === 'Pending').length;
    const expiringOrExpiredPks = this.data.universitas.filter((u) => {
      if (u.status === 'Expired') return true;
      const rem = diffDays(today, u.tanggalBerakhir);
      return rem >= 0 && rem <= 30;
    }).length;
    const unEvaluatedActiveInterns = activeStudents.filter(
      (m) => m.talent === 'Belum Dievaluasi' || m.skor === 0
    ).length;
    const endingSoonInterns = activeStudents.filter((m) => {
      const rem = diffDays(today, m.tanggalBerakhir);
      return rem >= 0 && rem <= 30;
    }).length;

    // 7-day trend
    const attendanceTrend: DashboardStatsResponse['attendanceTrend'] = [];
    for (let i = 6; i >= 0; i--) {
      const d = addDaysJakarta(today, -i);
      const dayLogs = this.data.absensi.filter((a) => a.tanggal === d);
      const uniqueByNim = new Map<string, string>();
      for (const log of dayLogs) {
        const prev = uniqueByNim.get(log.nim);
        if (!prev || log.status === 'Izin' || (log.status === 'Pulang' && prev === 'Masuk')) {
          uniqueByNim.set(log.nim, log.status);
        }
      }
      let masuk = 0;
      let pulang = 0;
      let izin = 0;
      for (const st of uniqueByNim.values()) {
        if (st === 'Masuk') masuk += 1;
        else if (st === 'Pulang') pulang += 1;
        else if (st === 'Izin') izin += 1;
      }
      attendanceTrend.push({ tanggal: d, masuk, pulang, izin });
    }

    // University distribution
    const uniMap = new Map<string, { mbkm: number; pkl: number }>();
    for (const m of activeStudents) {
      const entry = uniMap.get(m.universitas) || { mbkm: 0, pkl: 0 };
      if (m.program === 'MBKM') entry.mbkm += 1;
      else entry.pkl += 1;
      uniMap.set(m.universitas, entry);
    }
    const universityDistribution = Array.from(uniMap.entries())
      .map(([universitas, counts]) => ({
        universitas,
        mbkm: counts.mbkm,
        pkl: counts.pkl,
        total: counts.mbkm + counts.pkl,
      }))
      .sort((a, b) => b.total - a.total);

    // Department breakdown
    const deptMap = new Map<string, { aktifCount: number; mbkmCount: number; pklCount: number; skorSum: number; skorCount: number }>();
    for (const m of activeStudents) {
      const d = deptMap.get(m.department) || { aktifCount: 0, mbkmCount: 0, pklCount: 0, skorSum: 0, skorCount: 0 };
      d.aktifCount += 1;
      if (m.program === 'MBKM') d.mbkmCount += 1;
      else d.pklCount += 1;
      if (m.skor > 0) {
        d.skorSum += m.skor;
        d.skorCount += 1;
      }
      deptMap.set(m.department, d);
    }
    const departmentBreakdown = Array.from(deptMap.entries())
      .map(([department, d]) => ({
        department,
        aktifCount: d.aktifCount,
        mbkmCount: d.mbkmCount,
        pklCount: d.pklCount,
        avgSkor: d.skorCount > 0 ? Number((d.skorSum / d.skorCount).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.aktifCount - a.aktifCount);

    // Radar average
    const evals = this.data.evaluasi;
    const radarAverage =
      evals.length > 0
        ? {
            bk: Number((evals.reduce((s, e) => s + e.skorBk, 0) / evals.length).toFixed(1)),
            ps: Number((evals.reduce((s, e) => s + e.skorPs, 0) / evals.length).toFixed(1)),
            tw: Number((evals.reduce((s, e) => s + e.skorTw, 0) / evals.length).toFixed(1)),
            is: Number((evals.reduce((s, e) => s + e.skorIs, 0) / evals.length).toFixed(1)),
          }
        : { bk: 0, ps: 0, tw: 0, is: 0 };

    const top5Talent = [...this.data.mahasiswa]
      .filter((m) => m.skor > 0)
      .sort((a, b) => b.skor - a.skor)
      .slice(0, 5);

    return {
      kpi: {
        mbkmAktif,
        pklAktif,
        totalAktif: activeStudents.length,
        kehadiranHariIniCount: daily.kpi.masuk + daily.kpi.pulang,
        kehadiranHariIniRate: daily.kpi.attendanceRate,
        talentPoolCount,
        pksMendekatiH30,
      },
      attendanceTrend,
      universityDistribution,
      departmentBreakdown,
      actionQueue: {
        pendingApplicants,
        expiringOrExpiredPks,
        unEvaluatedActiveInterns,
        endingSoonInterns,
      },
      radarAverage,
      top5Talent,
      todayDate: today,
    };
  }

  getDailyAttendance(tanggal: string): DailyAttendanceSummary {
    const activeStudents = this.data.mahasiswa.filter((m) => m.status === 'Aktif');
    const dayLogs = this.data.absensi.filter((a) => a.tanggal === tanggal);
    const coords = this.getFactoryCoords();

    // Priority rule per PRD 8.4: Izin > Pulang > Masuk > Belum Absen
    const records = activeStudents.map((mhs) => {
      const logs = dayLogs.filter((l) => l.nim === mhs.nim);
      const izinLog = logs.find((l) => l.status === 'Izin');
      const pulangLog = logs.find((l) => l.status === 'Pulang');
      const masukLog = logs.find((l) => l.status === 'Masuk');

      let statusFinal: 'Masuk' | 'Pulang' | 'Izin' | 'Belum Absen' = 'Belum Absen';
      let primaryLog: AbsensiRecord | undefined;

      if (izinLog) {
        statusFinal = 'Izin';
        primaryLog = izinLog;
      } else if (pulangLog) {
        statusFinal = 'Pulang';
        primaryLog = pulangLog;
      } else if (masukLog) {
        statusFinal = 'Masuk';
        primaryLog = masukLog;
      }

      return {
        nim: mhs.nim,
        nama: mhs.nama,
        program: mhs.program,
        department: mhs.department,
        universitas: mhs.universitas,
        statusFinal,
        waktuMasuk: masukLog?.timestamp.split(' ')[1],
        waktuPulang: pulangLog?.timestamp.split(' ')[1],
        waktuIzin: izinLog?.timestamp.split(' ')[1],
        lokasi: primaryLog?.lokasi,
        jarakMeter: primaryLog?.jarakMeter,
        linkFoto: primaryLog?.linkFoto,
        keterangan: primaryLog?.keterangan,
        anomaliFlag: logs.find((l) => l.anomaliFlag)?.anomaliFlag,
      };
    });

    const masuk = records.filter((r) => r.statusFinal === 'Masuk').length;
    const pulang = records.filter((r) => r.statusFinal === 'Pulang').length;
    const izin = records.filter((r) => r.statusFinal === 'Izin').length;
    const belumAbsen = records.filter((r) => r.statusFinal === 'Belum Absen').length;
    const totalAktif = activeStudents.length;
    const attendanceRate = totalAktif > 0 ? Math.round(((masuk + pulang) / totalAktif) * 100) : 0;

    return {
      tanggal,
      maxRadiusMeters: coords.maxRadiusMeters,
      kpi: {
        totalAktif,
        masuk,
        pulang,
        izin,
        belumAbsen,
        attendanceRate,
      },
      records,
      rawLogs: dayLogs,
    };
  }
}

export const dbStore = new DataStore();
