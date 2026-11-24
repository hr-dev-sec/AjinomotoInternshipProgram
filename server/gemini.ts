import { GoogleGenAI, ThinkingLevel, Type, type GenerateContentResponse } from '@google/genai';
import { appendAiAuditLogToDb } from '../src/db/storeSync.js';
import type { Lowongan, Pendaftaran } from '../src/types/internship.js';
import { dbStore, diffDays, getJakartaDateStr, getJakartaTimestamp } from './store.js';

const PRIMARY_MODEL = 'gemini-4-hydrogen';
const FALLBACK_MODEL = 'gemini-3.1-flash-lite';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('Kunci API layanan AI (GEMINI_API_KEY) belum dikonfigurasi pada environment server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isTransientAiError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err || '');
  const status = (err as { status?: number; code?: number })?.status ?? (err as { code?: number })?.code;
  const lower = raw.toLowerCase();
  return (
    status === 503 ||
    status === 504 ||
    status === 429 ||
    status === 500 ||
    lower.includes('503') ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('deadline')
  );
}

export function formatFriendlyAiError(err: unknown, lang: 'id' | 'en' = 'id'): string {
  const raw = err instanceof Error ? err.message : String(err || '');
  const lower = raw.toLowerCase();

  if (lower.includes('gemini_api_key') || lower.includes('api_key_invalid') || lower.includes('api key not valid') || lower.includes('403') || lower.includes('permission_denied')) {
    return lang === 'en'
      ? 'AI service API key is invalid or not configured. Please verify GEMINI_API_KEY in server environment variables.'
      : 'API Key Gemini belum valid atau belum dikonfigurasi. Periksa kembali nilai GEMINI_API_KEY pada Environment Variables Vercel lalu lakukan Redeploy.';
  }
  if (lower.includes('429') || lower.includes('resource_exhausted') || lower.includes('quota')) {
    return lang === 'en'
      ? 'Gemini API quota limit has been reached temporarily. Please try again shortly or check your API key quota.'
      : 'Kuota permintaan API Gemini sedang mencapai batas sementara. Silakan coba kembali beberapa saat lagi.';
  }
  if (isTransientAiError(err)) {
    return lang === 'en'
      ? 'The AI service is temporarily experiencing high traffic. Please try sending your question again in a few seconds.'
      : 'Server AI Gemini sedang mengalami lonjakan trafik sementara. Silakan kirim ulang pertanyaan Anda beberapa detik lagi.';
  }
  if (lower.includes('not_found') || lower.includes('404')) {
    return lang === 'en'
      ? 'Selected AI model is currently unavailable for this API key.'
      : 'Model AI yang diminta sedang tidak tersedia untuk API Key ini.';
  }
  return lang === 'en'
    ? 'Unable to complete the AI request at this moment. Please try again.'
    : 'Gagal memproses permintaan AI saat ini. Silakan coba beberapa saat lagi.';
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`AI request timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function generateWithResilience(
  ai: GoogleGenAI,
  params: {
    contents: Parameters<GoogleGenAI['models']['generateContent']>[0]['contents'];
    config?: Record<string, unknown>;
  },
  lang: 'id' | 'en' = 'id'
): Promise<GenerateContentResponse> {
  const baseConfig = params.config || {};

  // Attempt 1: Primary model (gemini-4-hydrogen) with LOW thinking for fast ~1-3s latency
  try {
    return await withTimeout(
      ai.models.generateContent({
        model: PRIMARY_MODEL,
        contents: params.contents,
        config: {
          ...baseConfig,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      }),
      13_000
    );
  } catch (primaryErr) {
    if (!isTransientAiError(primaryErr)) {
      throw new Error(formatFriendlyAiError(primaryErr, lang), { cause: primaryErr });
    }
    console.warn(`Primary Gemini model (${PRIMARY_MODEL}) transient failure; retrying with ${FALLBACK_MODEL}:`, primaryErr);
  }

  // Brief backoff before falling back to fast gemini-3.1-flash-lite
  await new Promise((r) => setTimeout(r, 450));

  try {
    return await withTimeout(
      ai.models.generateContent({
        model: FALLBACK_MODEL,
        contents: params.contents,
        config: {
          ...baseConfig,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        },
      }),
      12_000
    );
  } catch (fallbackErr) {
    throw new Error(formatFriendlyAiError(fallbackErr, lang), { cause: fallbackErr });
  }
}

async function logAiAudit(
  fitur: string,
  adminUser: string,
  ringkasanPrompt: string,
  status: 'Sukses' | 'Error'
): Promise<void> {
  const entry = {
    id: `AI-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: getJakartaTimestamp(),
    fitur,
    adminUser,
    ringkasanPrompt: ringkasanPrompt.slice(0, 180),
    status,
  };
  const data = dbStore.getAll();
  data.aiAuditLogs.unshift(entry);
  if (data.aiAuditLogs.length > 100) {
    data.aiAuditLogs = data.aiAuditLogs.slice(0, 100);
  }
  await appendAiAuditLogToDb(entry);
}

export interface ExecutiveInsightResult {
  ringkasanEksekutif: string;
  sorotanKehadiran: string;
  risikoPks: string;
  rekomendasiTalent: string;
  langkahPrioritas: string[];
}

export async function generateExecutiveInsight(
  adminUser: string,
  lang: 'id' | 'en' = 'id'
): Promise<ExecutiveInsightResult> {
  const stats = dbStore.getDashboardStats();
  const data = dbStore.getAll();
  const today = getJakartaDateStr();

  const pksExpiringSoon = data.universitas
    .filter((u) => u.status === 'Active' && diffDays(today, u.tanggalBerakhir) <= 45)
    .map((u) => ({ kampus: u.universitas, sisaHari: diffDays(today, u.tanggalBerakhir) }));

  // Anonymized aggregate payload (PRD 12.4: no raw NIM/email/personal names in insight prompt)
  const payload = {
    tanggal: today,
    pesertaAktif: {
      mbkm: stats.kpi.mbkmAktif,
      pkl: stats.kpi.pklAktif,
      total: stats.kpi.totalAktif,
    },
    kehadiranHariIni: {
      hadirCount: stats.kpi.kehadiranHariIniCount,
      ratePersen: stats.kpi.kehadiranHariIniRate,
    },
    trenKehadiran7Hari: stats.attendanceTrend,
    distribusiKampus: stats.universityDistribution,
    rataRataKompetensi: stats.radarAverage,
    jumlahTalentPoolSkorTinggi: stats.kpi.talentPoolCount,
    jumlahPendaftarPending: data.pendaftaran.filter((p) => p.status === 'Pending').length,
    pksMendekatiBerakhir: pksExpiringSoon,
    pksExpiredCount: data.universitas.filter((u) => u.status === 'Expired').length,
  };

  const ai = getAiClient();
  const promptText =
    lang === 'en'
      ? `You are a Strategic HR Development Analyst at PT Ajinomoto Indonesia – Mojokerto Factory.
Analyze the following anonymized aggregate data for the MBKM & PKL internship programs:
${JSON.stringify(payload, null, 2)}

Provide sharp, factual, professional executive insights in clear, concise formal English without clichés. Keep the exact JSON property keys required by the schema.`
      : `Anda adalah Analis Strategis HR Development PT Ajinomoto Indonesia – Pabrik Mojokerto.
Analisis data agregat program magang MBKM & PKL berikut (data telah dianonimkan):
${JSON.stringify(payload, null, 2)}

Berikan insight eksekutif yang tajam, faktual, profesional, dalam Bahasa Indonesia yang formal dan ringkas tanpa kata klise.`;

  try {
    const response = await generateWithResilience(
      ai,
      {
        contents: promptText,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              ringkasanEksekutif: { type: Type.STRING },
              sorotanKehadiran: { type: Type.STRING },
              risikoPks: { type: Type.STRING },
              rekomendasiTalent: { type: Type.STRING },
              langkahPrioritas: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: [
              'ringkasanEksekutif',
              'sorotanKehadiran',
              'risikoPks',
              'rekomendasiTalent',
              'langkahPrioritas',
            ],
          },
        },
      },
      lang
    );

    const parsed = JSON.parse((response.text ?? '{}').trim()) as ExecutiveInsightResult;
    await logAiAudit('AI Executive Insight', adminUser, `Agregat ${stats.kpi.totalAktif} peserta aktif`, 'Sukses');
    return parsed;
  } catch (err) {
    await logAiAudit('AI Executive Insight', adminUser, 'Gagal memanggil layanan AI', 'Error');
    throw err;
  }
}

export interface CvScreeningResult {
  skorKecocokan: number;
  kategori: 'Sangat Cocok' | 'Cukup Cocok' | 'Perlu Pertimbangan';
  kompetensiCocok: string[];
  celahKompetensi: string[];
  ringkasanAnalisis: string;
  catatanKeputusanManual: string;
}

export async function screenApplicantCv(
  pendaftar: Pendaftaran,
  lowongan: Lowongan | undefined,
  adminUser: string,
  lang: 'id' | 'en' = 'id'
): Promise<CvScreeningResult> {
  const ai = getAiClient();

  // Anonymize applicant identity before sending to AI (PRD 12.4)
  const anonymizedApplicant = {
    kodeKandidat: `Kandidat-${pendaftar.id}`,
    program: pendaftar.jenis,
    jurusan: pendaftar.jurusan,
    institusiAsal: 'Perguruan Tinggi Mitra',
    posisiDilamar: pendaftar.lowongan,
    ringkasanCv: pendaftar.cvSummaryText || 'Tidak ada ringkasan teks CV.',
  };

  const vacancySpec = lowongan
    ? {
        namaPosisi: lowongan.namaPosisi,
        pendidikan: lowongan.pendidikan,
        prodi: lowongan.prodi,
        skillDibutuhkan: lowongan.skill,
        tugasUtama: lowongan.tugas,
      }
    : { namaPosisi: pendaftar.lowongan, skillDibutuhkan: 'Sesuai bidang teknik/pangan/SDM industri' };

  const textPrompt =
    lang === 'en'
      ? `You are an HR Recruitment Specialist at PT Ajinomoto Indonesia.
Evaluate the competency match of this anonymized candidate against the following internship vacancy specification:

Vacancy Specification:
${JSON.stringify(vacancySpec, null, 2)}

Anonymized Candidate Profile:
${JSON.stringify(anonymizedApplicant, null, 2)}

If a PDF document is attached, review technical competencies, project/organizational experience, and educational background without retaining personal data (name/email/student ID).
Provide an objective assessment in clear, professional English for kompetensiCocok, celahKompetensi, ringkasanAnalisis, and catatanKeputusanManual.
IMPORTANT: For the "kategori" field, strictly use one of these exact enum values: "Sangat Cocok", "Cukup Cocok", or "Perlu Pertimbangan".`
      : `Anda adalah HR Recruitment Specialist PT Ajinomoto Indonesia.
Evaluasi kesesuaian kompetensi kandidat (dianonimkan) terhadap spesifikasi lowongan magang berikut:

Spesifikasi Lowongan:
${JSON.stringify(vacancySpec, null, 2)}

Profil Kandidat Teranonimkan:
${JSON.stringify(anonymizedApplicant, null, 2)}

Jika dokumen PDF terlampir, baca kompetensi teknis, pengalaman proyek/organisasi, dan latar belakang pendidikannya tanpa menyimpan data pribadi (nama/email/NIM). Berikan penilaian objektif dalam Bahasa Indonesia. Untuk field "kategori", gunakan tepat salah satu nilai: "Sangat Cocok", "Cukup Cocok", atau "Perlu Pertimbangan".`;

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
  if (pendaftar.cvBase64 && pendaftar.cvBase64.startsWith('data:application/pdf;base64,')) {
    const base64Data = pendaftar.cvBase64.split(',')[1];
    if (base64Data) {
      parts.push({
        inlineData: {
          mimeType: 'application/pdf',
          data: base64Data,
        },
      });
    }
  }
  parts.push({ text: textPrompt });

  try {
    const response = await generateWithResilience(
      ai,
      {
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              skorKecocokan: { type: Type.INTEGER },
              kategori: { type: Type.STRING },
              kompetensiCocok: { type: Type.ARRAY, items: { type: Type.STRING } },
              celahKompetensi: { type: Type.ARRAY, items: { type: Type.STRING } },
              ringkasanAnalisis: { type: Type.STRING },
              catatanKeputusanManual: { type: Type.STRING },
            },
            required: [
              'skorKecocokan',
              'kategori',
              'kompetensiCocok',
              'celahKompetensi',
              'ringkasanAnalisis',
              'catatanKeputusanManual',
            ],
          },
        },
      },
      lang
    );

    const parsed = JSON.parse((response.text ?? '{}').trim()) as CvScreeningResult;
    await logAiAudit('Screening CV', adminUser, `Screening teranonimkan untuk ${pendaftar.id} (${pendaftar.lowongan})`, 'Sukses');
    return parsed;
  } catch (err) {
    await logAiAudit('Screening CV', adminUser, `Error screening ${pendaftar.id}`, 'Error');
    throw err;
  }
}

export async function chatWithHrAssistant(
  question: string,
  history: Array<{ role: 'user' | 'model'; text: string }>,
  adminUser: string,
  lang: 'id' | 'en' = 'id'
): Promise<string> {
  const ai = getAiClient();
  const today = getJakartaDateStr();
  const data = dbStore.getAll();
  const daily = dbStore.getDailyAttendance(today);
  const stats = dbStore.getDashboardStats();

  // Provide operational HR snapshot so queries like "siapa yang belum absen hari ini?" or "PKS mana yang habis 45 hari lagi?" are answered accurately
  const contextSnapshot = {
    tanggalHariIni: today,
    ringkasanKpi: stats.kpi,
    absensiHariIni: daily.records.map((r, idx) => ({
      kode: `Peserta-${idx + 1}`,
      namaTampilan: r.nama,
      program: r.program,
      departemen: r.department,
      statusHariIni: r.statusFinal,
      jarakMeter: r.jarakMeter ?? null,
      anomali: r.anomaliFlag ?? null,
    })),
    pksUniversitas: data.universitas.map((u) => ({
      universitas: u.universitas,
      status: u.status,
      tanggalBerakhir: u.tanggalBerakhir,
      sisaHari: diffDays(today, u.tanggalBerakhir),
    })),
    pelamarPending: data.pendaftaran.filter((p) => p.status === 'Pending').length,
    lowonganOpen: data.lowongan.filter((l) => l.status === 'Open').map((l) => l.namaPosisi),
    topTalent: stats.top5Talent.map((t) => ({
      nama: t.nama,
      departemen: t.department,
      program: t.program,
      skor: t.skor,
      rekomendasi: t.talent,
    })),
  };

  const systemInstruction =
    lang === 'en'
      ? `You are the HR Development Assistant for PT Ajinomoto Indonesia – Mojokerto Factory.
Answer HR Admin questions accurately, concisely (under 180 words unless listing records), and strictly grounded in the following real-time operational data (respond in clear, professional English):
${JSON.stringify(contextSnapshot)}

Rules:
- Always base your answer on the JSON data above. Never fabricate numbers or names.
- Use clean bullet points when listing interns or universities.
- If asked about final selection decisions (Accept/Reject), remind the admin that the final decision always rests with HR Admin.`
      : `Anda adalah Asisten HR Development PT Ajinomoto Indonesia – Pabrik Mojokerto.
Jawab pertanyaan HR Admin secara akurat, ringkas (maksimal ~180 kata kecuali saat menampilkan daftar), dan berbasis data operasional real-time berikut (gunakan Bahasa Indonesia profesional):
${JSON.stringify(contextSnapshot)}

Aturan:
- Selalu dasarkan jawaban pada data JSON di atas. Jangan mengarang angka atau nama.
- Gunakan poin rapi saat menyebutkan daftar peserta atau universitas.
- Jika ditanya keputusan seleksi final (Terima/Tolak), ingatkan bahwa keputusan akhir tetap berada di tangan HR Admin.`;

  // Keep last 8 turns to prevent bloated prompts
  const recentHistory = history.slice(-8);
  const contents = [
    ...recentHistory.map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    })),
    { role: 'user', parts: [{ text: question }] },
  ];

  try {
    const response = await generateWithResilience(
      ai,
      {
        contents,
        config: {
          systemInstruction,
        },
      },
      lang
    );
    await logAiAudit('Asisten HR Chat', adminUser, question, 'Sukses');
    return (
      response.text ||
      (lang === 'en'
        ? 'Sorry, no response was generated.'
        : 'Maaf, tidak ada respons yang dihasilkan.')
    );
  } catch (err) {
    await logAiAudit('Asisten HR Chat', adminUser, `Error: ${question}`, 'Error');
    throw err;
  }
}

export async function draftHrEmail(
  jenisSurat: 'Diterima' | 'Ditolak' | 'Peringatan Absensi' | 'Ringkasan Evaluasi',
  konteks: {
    program?: string;
    posisi?: string;
    departemen?: string;
    alasan?: string;
    skor?: number;
    rekomendasi?: string;
  },
  adminUser: string,
  lang: 'id' | 'en' = 'id'
): Promise<{ subjek: string; isiSurat: string }> {
  const ai = getAiClient();
  const prompt =
    lang === 'en'
      ? `Draft an official HR Development email/letter for PT Ajinomoto Indonesia – Mojokerto Factory in polite, well-structured, ready-to-send formal English.
Use placeholders [Intern Name] / [University Name] so personal privacy is protected during drafting.

Letter Type: ${jenisSurat}
Context: ${JSON.stringify(konteks)}`
      : `Buatkan draf email/surat resmi HR Development PT Ajinomoto Indonesia – Pabrik Mojokerto dalam Bahasa Indonesia yang sopan, rapi, dan siap kirim.
Gunakan placeholder [Nama Peserta] / [Nama Kampus] agar privasi tetap terjaga pada tahap penyusunan draf.

Jenis Surat: ${jenisSurat}
Konteks: ${JSON.stringify(konteks)}`;

  try {
    const response = await generateWithResilience(
      ai,
      {
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              subjek: { type: Type.STRING },
              isiSurat: { type: Type.STRING },
            },
            required: ['subjek', 'isiSurat'],
          },
        },
      },
      lang
    );
    const parsed = JSON.parse((response.text ?? '{}').trim()) as { subjek: string; isiSurat: string };
    await logAiAudit('Drafting Email & Surat', adminUser, `Jenis: ${jenisSurat}`, 'Sukses');
    return parsed;
  } catch (err) {
    await logAiAudit('Drafting Email & Surat', adminUser, `Error jenis: ${jenisSurat}`, 'Error');
    throw err;
  }
}

export async function analyzeAttendanceAnomalies(
  tanggal: string,
  adminUser: string,
  lang: 'id' | 'en' = 'id'
): Promise<{
  ringkasan: string;
  temuan: Array<{ kodePeserta: string; nama: string; tingkatRisiko: 'Tinggi' | 'Sedang' | 'Rendah'; alasan: string }>;
}> {
  const daily = dbStore.getDailyAttendance(tanggal);
  const data = dbStore.getAll();

  const izinCountByNim = new Map<string, number>();
  for (const log of data.absensi) {
    if (log.status === 'Izin') {
      izinCountByNim.set(log.nim, (izinCountByNim.get(log.nim) || 0) + 1);
    }
  }

  const sanitizedSummary = daily.records.map((r, i) => ({
    kodePeserta: `MHS-${i + 1}`,
    nama: r.nama,
    statusHariIni: r.statusFinal,
    jarakDariPabrikMeter: r.jarakMeter ?? null,
    anomaliSistem: r.anomaliFlag ?? null,
    totalRiwayatIzin: izinCountByNim.get(r.nim) || 0,
    keteranganIzin: r.keterangan ?? null,
  }));

  const ai = getAiClient();
  const prompt =
    lang === 'en'
      ? `Analyze potential internship attendance anomalies at PT Ajinomoto Indonesia – Mojokerto Factory for date ${tanggal}.
The normal factory radius is <= 650 meters. Watch for GPS distances outside the factory perimeter, "Belum Absen" (Not Checked In) status, or repeated leave patterns.
Write "ringkasan" and each item's "alasan" in clear, professional English.
IMPORTANT: For "tingkatRisiko", strictly use one of these exact enum values: "Tinggi", "Sedang", or "Rendah".
Data: ${JSON.stringify(sanitizedSummary)}`
      : `Analisis potensi anomali absensi magang PT Ajinomoto Mojokerto untuk tanggal ${tanggal}.
Radius normal area pabrik adalah <= 650 meter. Perhatikan jarak GPS di luar radius pabrik, status Belum Absen, atau pola izin berulang.
Untuk "tingkatRisiko", gunakan tepat salah satu nilai: "Tinggi", "Sedang", atau "Rendah".
Data: ${JSON.stringify(sanitizedSummary)}`;

  try {
    const response = await generateWithResilience(
      ai,
      {
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              ringkasan: { type: Type.STRING },
              temuan: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    kodePeserta: { type: Type.STRING },
                    nama: { type: Type.STRING },
                    tingkatRisiko: { type: Type.STRING },
                    alasan: { type: Type.STRING },
                  },
                  required: ['kodePeserta', 'nama', 'tingkatRisiko', 'alasan'],
                },
              },
            },
            required: ['ringkasan', 'temuan'],
          },
        },
      },
      lang
    );
    const parsed = JSON.parse((response.text ?? '{}').trim());
    await logAiAudit('Deteksi Anomali Absensi', adminUser, `Tanggal ${tanggal}`, 'Sukses');
    return parsed;
  } catch (err) {
    await logAiAudit('Deteksi Anomali Absensi', adminUser, `Error tanggal ${tanggal}`, 'Error');
    throw err;
  }
}
