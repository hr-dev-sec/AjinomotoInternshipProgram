import type { Language } from '../contexts/AppPreferencesContext';
import type { Lowongan } from '../types/internship';

const MAJOR_MAP: Record<string, string> = {
  'Teknologi Pangan': 'Food Technology',
  Kimia: 'Chemistry',
  Bioteknologi: 'Biotechnology',
  'Teknik Kimia': 'Chemical Engineering',
  'Teknik Industri': 'Industrial Engineering',
  'Teknik Mesin': 'Mechanical Engineering',
  'Teknik Elektro': 'Electrical Engineering',
  'Teknik Elektronika': 'Electronics Engineering',
  Mekatronika: 'Mechatronics',
  'Teknik Lingkungan': 'Environmental Engineering',
  Biologi: 'Biology',
  Psikologi: 'Psychology',
  'Manajemen SDM': 'Human Resource Management',
  'Sistem Informasi': 'Information Systems',
  'Manajemen Logistik': 'Logistics Management',
  'Teknik Fisika': 'Engineering Physics',
  'Teknologi Hasil Pertanian': 'Agricultural Product Technology',
  'Ilmu Komunikasi': 'Communication Studies',
  'Teknik Informatika': 'Informatics Engineering',
  Manajemen: 'Management',
  Akuntansi: 'Accounting',
  'Kesehatan Masyarakat': 'Public Health',
};

const VACANCY_EN_TRANSLATIONS: Record<
  string,
  {
    prodi?: string;
    skill?: string;
    tugas?: string;
    benefit?: string;
  }
> = {
  'Quality Assurance & Food Safety Intern': {
    prodi: 'Food Technology, Chemistry, Biotechnology, Chemical Engineering',
    skill: 'HACCP & ISO 22000; Basic Microbiology & Chemical Analysis; Microsoft Excel & Data Processing',
    tugas:
      'Assist raw material and finished product inspections on production lines; Prepare daily CCP verification logs; Support factory sanitation laboratory testing',
    benefit:
      'Competitive monthly allowance; Lunch & shuttle service around Mojokerto area; Official industrial certificate & QA mentor guidance',
  },
  'Production Engineering & Automation Intern': {
    prodi: 'Industrial Engineering, Mechanical Engineering, Electrical Engineering, Mechatronics',
    skill: 'AutoCAD / SolidWorks; Basic PLC & SCADA; Lean Manufacturing & Time Motion Study',
    tugas:
      'Analyze packaging line OEE (Overall Equipment Effectiveness); Support utility energy efficiency improvement projects; Document standard operating procedures (SOP)',
    benefit:
      'Monthly allowance; Full work uniform & PPE; Hands-on experience in national-scale factory Kaizen projects',
  },
  'Environmental & Waste Water Management Intern': {
    prodi: 'Environmental Engineering, Chemical Engineering, Biology',
    skill: 'COD/BOD/TSS Measurement; KLHK PROPER Regulations; Environmental Data Analysis',
    tugas:
      'Daily monitoring of Mojokerto Wastewater Treatment Plant (WWTP); Calibrate coagulant chemical consumption records; Prepare eco-factory compliance reports',
    benefit:
      'Monthly allowance; Environmental OHS training; Integrated final thesis research opportunity',
  },
  'HR Development & People Analytics Intern': {
    prodi: 'Psychology, Human Resource Management, Information Systems, Industrial Engineering',
    skill: 'Recruitment & Training Administration; Dashboard Data Processing (Excel/BI); Interpersonal Communication & Presentation',
    tugas:
      'Manage daily administration of MBKM & PKL internship programs; Compile intern evaluation recaps & employee training calendars; Support campus employer branding',
    benefit:
      'Monthly allowance; Exposure to modern manufacturing HR systems; Direct mentoring by the HR Development Section Head',
  },
  'Supply Chain & Warehouse Optimization Intern': {
    prodi: 'Industrial Engineering, Logistics Management, Information Systems',
    skill: 'Inventory Control (FIFO/FEFO); Excel Pivot & Forecasting; Basic ERP/SAP Warehouse',
    tugas:
      'Audit Mojokerto warehouse packaging stock accuracy; Evaluate vendor receiving lead times; Optimize storage rack layout',
    benefit: 'Monthly allowance; Factory lunch; Logistics competency certificate',
  },
};

const PKS_NOTE_EN_MAP: Record<string, string> = {
  'PKS Program MBKM Fakultas Teknologi Pertanian & Teknik Industri (Tepat H-30 Reminder)':
    'MBKM Program MoA — Faculty of Agricultural Technology & Industrial Engineering (Exact D-30 Reminder)',
  'PKS Riset & Magang Industri Fakultas Teknologi Industri dan Rekayasa Sistem':
    'Industrial Research & Internship MoA — Faculty of Industrial Technology and Systems Engineering',
  'PKS MBKM Fakultas Psikologi dan Kesehatan Masyarakat':
    'MBKM MoA — Faculty of Psychology and Public Health',
  'PKS Teknik Kimia & Teknik Lingkungan — perlu perpanjangan segera':
    'Chemical & Environmental Engineering MoA — requires immediate renewal',
  'PKS Vokasi Otomasi & Teknik Mesin Industri':
    'Vocational Industrial Automation & Mechanical Engineering MoA',
  'PKS Lama Periode 2025 — menunggu penandatanganan adendum baru':
    'Previous 2025 MoA — awaiting new addendum signature',
};

const CV_SUMMARY_EN_MAP: Record<string, string> = {
  'Mahasiswa S1 Teknologi Pangan IPK 3.78. Sertifikasi dasar HACCP & GMP. Pengalaman asisten laboratorium mikrobiologi pangan 2 semester, menguasai uji TPC, analisis kadar air, dan pengolahan data Excel.':
    'Undergraduate Food Technology student, GPA 3.78. Certified in basic HACCP & GMP. 2 semesters as Food Microbiology Laboratory Assistant; proficient in TPC testing, moisture analysis, and Excel data processing.',
  'Mahasiswa Teknik Mesin ITS semester 7, IPK 3.64. Menguasai SolidWorks, AutoCAD, dan pemrograman dasar PLC Siemens. Pernah mengerjakan proyek optimasi OEE lini konveyor dan studi waktu kerja.':
    '7th-semester Mechanical Engineering student at ITS, GPA 3.64. Proficient in SolidWorks, AutoCAD, and basic Siemens PLC programming. Completed conveyor line OEE optimization and time-motion study projects.',
  'S1 Teknologi Pangan IPK 3.85, pengalaman riset fermentasi asam amino dan QC pangan.':
    'B.Sc. Food Technology, GPA 3.85, experienced in amino acid fermentation research and food quality control.',
};

const ATTENDANCE_NOTE_EN_MAP: Record<string, string> = {
  'Bimbingan Skripsi Kampus': 'Campus Thesis Supervision',
  'Izin sakit demam (Surat Dokter terlampir)': 'Sick leave — fever (Doctor certificate attached)',
};

const AI_FEATURE_EN_MAP: Record<string, string> = {
  'AI Executive Insight': 'AI Executive Insight',
  'Screening CV': 'CV Screening',
  'Asisten HR Chat': 'HR Assistant Chat',
  'Drafting Email & Surat': 'Email & Letter Drafting',
  'Deteksi Anomali Absensi': 'Attendance Anomaly Detection',
};

const EMAIL_TYPE_EN_MAP: Record<string, string> = {
  Diterima: 'Accepted',
  Ditolak: 'Rejected',
  'Reminder PKS': 'MoA / PKS Reminder',
  'Notifikasi Umum': 'General Notification',
};

export function localizeStatus(status: string, lang: Language): string {
  if (lang === 'id') return status;
  const map: Record<string, string> = {
    Aktif: 'Active',
    'Tidak Aktif': 'Inactive',
    Pending: 'Pending',
    Diterima: 'Accepted',
    Ditolak: 'Rejected',
    Masuk: 'Check-In',
    Pulang: 'Check-Out',
    Izin: 'Excused / Leave',
    'Belum Absen': 'Not Checked In',
    Sukses: 'Success',
    Error: 'Error',
    Open: 'Open',
    Closed: 'Closed',
    Active: 'Active',
    Expired: 'Expired',
    Tinggi: 'High',
    Sedang: 'Medium',
    Rendah: 'Low',
  };
  return map[status] || status;
}

export function localizeTalent(talent: string, lang: Language): string {
  if (lang === 'id') return talent;
  const map: Record<string, string> = {
    'Sangat Direkomendasikan': 'Highly Recommended',
    Dipertimbangkan: 'Under Consideration',
    'Tidak Direkomendasikan': 'Not Recommended',
    'Belum Dievaluasi': 'Not Evaluated',
    'Sangat Cocok': 'Strong Match',
    'Cukup Cocok': 'Moderate Match',
    'Perlu Pertimbangan': 'Needs Review',
  };
  return map[talent] || talent;
}

export function localizeGender(gender: string, lang: Language, full = false): string {
  if (lang === 'id') {
    if (!full) return gender;
    return gender === 'L' ? 'Laki-laki (L)' : 'Perempuan (P)';
  }
  if (!full) return gender === 'L' ? 'M' : gender === 'P' ? 'F' : gender;
  return gender === 'L' ? 'Male (M)' : 'Female (F)';
}

export function localizeEducation(pendidikan: string, lang: Language): string {
  if (lang === 'id') return pendidikan;
  const map: Record<string, string> = {
    'S1 / D4': "Bachelor's / Applied (S1/D4)",
    S1: "Bachelor's (S1)",
    D3: 'Diploma (D3)',
    D4: "Applied Bachelor's (D4)",
  };
  return map[pendidikan] || pendidikan;
}

export function localizeMajor(text: string, lang: Language): string {
  if (lang === 'id' || !text) return text;
  if (MAJOR_MAP[text]) return MAJOR_MAP[text];
  // Handle comma-separated study programs
  return text
    .split(',')
    .map((part) => {
      const trimmed = part.trim();
      return MAJOR_MAP[trimmed] || trimmed;
    })
    .join(', ');
}

export function localizeVacancy(v: Lowongan, lang: Language): Lowongan {
  if (lang === 'id') return v;
  const preset = VACANCY_EN_TRANSLATIONS[v.namaPosisi];
  if (preset) {
    return {
      ...v,
      pendidikan: localizeEducation(v.pendidikan, lang),
      prodi: preset.prodi || localizeMajor(v.prodi, lang),
      skill: preset.skill || v.skill,
      tugas: preset.tugas || v.tugas,
      benefit: preset.benefit || v.benefit,
    };
  }
  return {
    ...v,
    pendidikan: localizeEducation(v.pendidikan, lang),
    prodi: localizeMajor(v.prodi, lang),
  };
}

export function localizePksNote(note: string, lang: Language): string {
  if (lang === 'id' || !note) return note;
  if (PKS_NOTE_EN_MAP[note]) return PKS_NOTE_EN_MAP[note];
  return note
    .replace(/\bPKS\b/g, 'MoA (PKS)')
    .replace(/Fakultas/gi, 'Faculty of')
    .replace(/perlu perpanjangan segera/gi, 'requires immediate renewal')
    .replace(/menunggu penandatanganan adendum baru/gi, 'awaiting new addendum signature');
}

export function localizeCvSummary(summary: string | undefined, lang: Language): string {
  if (!summary) return '';
  if (lang === 'id') return summary;
  return CV_SUMMARY_EN_MAP[summary] || summary;
}

export function localizeAttendanceNote(note: string | undefined, lang: Language): string {
  if (!note) return '';
  if (lang === 'id') return note;
  if (ATTENDANCE_NOTE_EN_MAP[note]) return ATTENDANCE_NOTE_EN_MAP[note];
  const radiusMatch = note.match(/Lokasi di luar radius pabrik\s*\(>\s*(\d+)\s*m\)/i);
  if (radiusMatch) {
    return `Location outside factory geofence radius (> ${radiusMatch[1]} m)`;
  }
  return note;
}

export function localizeAiFeature(fitur: string, lang: Language): string {
  if (lang === 'id') return fitur;
  return AI_FEATURE_EN_MAP[fitur] || fitur;
}

export function localizeAiPromptSummary(text: string, lang: Language): string {
  if (lang === 'id' || !text) return text;
  return text
    .replace(/^Agregat (\d+) peserta aktif/i, 'Aggregate snapshot of $1 active interns')
    .replace(/^Screening teranonimkan untuk /i, 'Anonymized CV screening for ')
    .replace(/^Jenis:\s*/i, 'Letter type: ')
    .replace(/^Tanggal\s*/i, 'Date ')
    .replace(/^Gagal memanggil layanan AI/i, 'Failed to call AI service');
}

export function localizeEmailType(jenis: string, lang: Language): string {
  if (lang === 'id') return jenis;
  return EMAIL_TYPE_EN_MAP[jenis] || jenis;
}

export function localizeEmailSubject(subjek: string, lang: Language): string {
  if (lang === 'id' || !subjek) return subjek;
  return subjek
    .replace(/Hasil Seleksi Magang/gi, 'Internship Selection Result')
    .replace(/Pengingat Perpanjangan PKS/gi, 'MoA / PKS Renewal Reminder')
    .replace(/Diterima/g, 'Accepted')
    .replace(/Ditolak/g, 'Not Selected');
}

export function localizeAccountRole(role: string, lang: Language): string {
  if (lang === 'id' || !role) return role;
  const map: Record<string, string> = {
    'HR Development Admin': 'HR Development Admin',
    'Admin Operasional': 'Operational Admin',
    'Pimpinan Perusahaan': 'Company Leadership',
    'Pimpinan Departemen / Seksi': 'Department / Section Head',
  };
  return map[role] || role;
}

export function localizeApiMessage(message: string, lang: Language): string {
  if (lang === 'id' || !message) return message;
  const exact: Record<string, string> = {
    'Absensi Masuk berhasil tercatat.': 'Check-In attendance recorded successfully.',
    'Absensi Pulang berhasil tercatat.': 'Check-Out attendance recorded successfully.',
    'Pengajuan Izin berhasil tercatat.': 'Leave / Excused submission recorded successfully.',
    'Profil administrator berhasil diperbarui.': 'Administrator profile updated successfully.',
    'Profil pengguna berhasil diperbarui.': 'User profile updated successfully.',
    'Username atau password tidak valid.': 'Invalid username or password.',
    'Username atau password tidak sesuai.': 'Incorrect username or password.',
    'Akun ini sedang dinonaktifkan. Silakan hubungi HR Development Admin.':
      'This account is currently deactivated. Please contact HR Development Admin.',
    'Akses ditolak. Hanya akun HR Development Admin yang dapat mengelola pengguna sistem.':
      'Access denied. Only HR Development Admin accounts can manage system users.',
    'Username tersebut sudah digunakan oleh akun lain.':
      'That username is already taken by another account.',
    'Username harus 3–40 karakter dan hanya boleh huruf kecil, angka, titik, garis bawah, atau tanda hubung.':
      'Username must be 3–40 characters using lowercase letters, numbers, dots, underscores, or hyphens only.',
    'Password awal minimal 8 karakter.': 'Initial password must be at least 8 characters.',
    'Password reset minimal 8 karakter.': 'Reset password must be at least 8 characters.',
    'Anda tidak dapat menonaktifkan akun Anda sendiri.': 'You cannot deactivate your own account.',
    'Anda tidak dapat menghapus akun yang sedang digunakan.': 'You cannot delete the account currently signed in.',
    'Akun HR Development Admin utama tidak dapat dihapus.': 'The primary HR Development Admin account cannot be deleted.',
    'Akun HR Admin utama tidak dapat dinonaktifkan.': 'The primary HR Admin account cannot be deactivated.',
    'Minimal harus tersisa satu akun HR Development Admin yang aktif.':
      'At least one active HR Development Admin account must remain.',
    'Akses ditolak. Hanya akun Admin yang dapat memperbarui gambar dan media portal.':
      'Access denied. Only Admin accounts can update portal images and media.',
    'Akses ditolak. Hanya akun Admin yang dapat mereset gambar dan media portal.':
      'Access denied. Only Admin accounts can reset portal images and media.',
    'Format file harus gambar (PNG, JPG, WEBP) atau dokumen PDF.':
      'File must be an image (PNG, JPG, WEBP) or a PDF document.',
    'Format gambar harus PNG, JPEG, atau WEBP.': 'Image must be in PNG, JPEG, or WEBP format.',
    'Ukuran dokumen/gambar maksimal 4,5 MB.': 'Maximum document/image size is 4.5 MB.',
    'URL gambar tidak valid. Gunakan file upload atau tautan HTTP/HTTPS.':
      'Invalid image URL. Use file upload or an HTTP/HTTPS link.',
    'NIM tidak ditemukan dalam daftar peserta magang aktif.':
      'Student ID (NIM) was not found among active interns.',
    'Data pendaftaran tidak ditemukan untuk kombinasi NIM dan Email tersebut.':
      'No application record found for that NIM and Email combination.',
  };
  return exact[message] || message;
}
