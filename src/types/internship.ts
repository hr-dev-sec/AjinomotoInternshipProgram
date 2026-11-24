export type ProgramType = 'MBKM' | 'PKL';
export type LowonganStatus = 'Open' | 'Closed';
export type PendaftaranStatus = 'Pending' | 'Diterima' | 'Ditolak';
export type MahasiswaStatus = 'Aktif' | 'Tidak Aktif';
export type GenderCode = 'L' | 'P';
export type AbsensiStatus = 'Masuk' | 'Pulang' | 'Izin';
export type RekomendasiTalent =
  | 'Sangat Direkomendasikan'
  | 'Dipertimbangkan'
  | 'Tidak Direkomendasikan'
  | 'Belum Dievaluasi';
export type PKSStatus = 'Active' | 'Expired';

export interface Lowongan {
  id: string;
  namaPosisi: string;
  pendidikan: string;
  prodi: string;
  skill: string;
  tugas: string;
  benefit: string;
  status: LowonganStatus;
}

export interface Pendaftaran {
  id: string;
  timestamp: string;
  jenis: ProgramType;
  nama: string;
  nim: string;
  universitas: string;
  jurusan: string;
  lowongan: string;
  linkCv: string;
  cvFileName?: string;
  cvBase64?: string;
  cvSummaryText?: string;
  status: PendaftaranStatus;
  email: string;
  persetujuanPrivacy: boolean;
}

export interface Mahasiswa {
  nim: string;
  program: ProgramType;
  department: string;
  nama: string;
  universitas: string;
  jurusan: string;
  tglMasuk: string;
  tanggalBerakhir: string;
  gender: GenderCode;
  status: MahasiswaStatus;
  talent: RekomendasiTalent;
  skor: number;
}

export interface AbsensiRecord {
  id: string;
  timestamp: string;
  tanggal: string;
  nim: string;
  nama: string;
  status: AbsensiStatus;
  lokasi: string;
  jarakMeter: number;
  linkFoto: string;
  keterangan?: string;
  anomaliFlag?: string;
}

export interface EvaluasiRecord {
  id: string;
  timestamp: string;
  nim: string;
  nama: string;
  skorBk: number;
  skorPs: number;
  skorTw: number;
  skorIs: number;
  skor: number;
  rekomendasi: RekomendasiTalent;
}

export interface UniversitasPKS {
  id: string;
  universitas: string;
  tanggalMulai: string;
  tanggalBerakhir: string;
  durasiHari: number;
  durasiBulan: number;
  keterangan: string;
  linkDataPks: string;
  dokumenNama?: string;
  status: PKSStatus;
  reminderSentAt?: string;
}

export interface AIAuditLog {
  id: string;
  timestamp: string;
  fitur: string;
  adminUser: string;
  ringkasanPrompt: string;
  status: 'Sukses' | 'Error';
}

export interface EmailNotificationLog {
  id: string;
  timestamp: string;
  kepada: string;
  subjek: string;
  jenis: 'Seleksi Diterima' | 'Seleksi Ditolak' | 'Reminder PKS H-30';
  isiRingkas: string;
}

export interface PublicSummary {
  totalMahasiswaAktif: number;
  totalUniversitasMitra: number;
  divisiOpen: number;
  pksAktif: number;
  maxRadiusMeters?: number;
}

export interface PublicTrackStatusResponse {
  id: string;
  timestamp: string;
  jenis: ProgramType;
  nama: string;
  nim: string;
  universitas: string;
  jurusan: string;
  lowongan: string;
  status: PendaftaranStatus;
  mahasiswaAktif?: {
    department: string;
    tglMasuk: string;
    tanggalBerakhir: string;
    status: MahasiswaStatus;
  };
}

export interface DepartmentBreakdownItem {
  department: string;
  aktifCount: number;
  mbkmCount: number;
  pklCount: number;
  avgSkor: number;
}

export interface DashboardActionQueue {
  pendingApplicants: number;
  expiringOrExpiredPks: number;
  unEvaluatedActiveInterns: number;
  endingSoonInterns: number;
}

export interface DashboardStatsResponse {
  kpi: {
    mbkmAktif: number;
    pklAktif: number;
    totalAktif: number;
    kehadiranHariIniCount: number;
    kehadiranHariIniRate: number;
    talentPoolCount: number;
    pksMendekatiH30: number;
  };
  attendanceTrend: Array<{
    tanggal: string;
    masuk: number;
    pulang: number;
    izin: number;
  }>;
  universityDistribution: Array<{
    universitas: string;
    mbkm: number;
    pkl: number;
    total: number;
  }>;
  departmentBreakdown: DepartmentBreakdownItem[];
  actionQueue: DashboardActionQueue;
  radarAverage: {
    bk: number;
    ps: number;
    tw: number;
    is: number;
  };
  top5Talent: Mahasiswa[];
  todayDate: string;
}

export interface InternDetailResponse {
  mahasiswa: Mahasiswa;
  evaluasiHistory: EvaluasiRecord[];
  attendanceSummary: {
    totalMasuk: number;
    totalPulang: number;
    totalIzin: number;
    totalAnomali: number;
    recentLogs: AbsensiRecord[];
  };
}

export interface DailyAttendanceSummary {
  tanggal: string;
  maxRadiusMeters: number;
  kpi: {
    totalAktif: number;
    masuk: number;
    pulang: number;
    izin: number;
    belumAbsen: number;
    attendanceRate: number;
  };
  records: Array<{
    nim: string;
    nama: string;
    program: ProgramType;
    department: string;
    universitas: string;
    statusFinal: AbsensiStatus | 'Belum Absen';
    waktuMasuk?: string;
    waktuPulang?: string;
    waktuIzin?: string;
    lokasi?: string;
    jarakMeter?: number;
    linkFoto?: string;
    keterangan?: string;
    anomaliFlag?: string;
  }>;
  rawLogs: AbsensiRecord[];
}
