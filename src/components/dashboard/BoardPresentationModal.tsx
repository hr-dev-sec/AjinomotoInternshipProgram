import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Building2,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  FileDown,
  FileText,
  GraduationCap,
  Lightbulb,
  Maximize2,
  Minimize2,
  Moon,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Sun,
  TrendingUp,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { exportExecutivePdf } from '../../lib/exports';
import { localizeTalent } from '../../lib/localizeData';
import type {
  DashboardStatsResponse,
  Lowongan,
  Mahasiswa,
  Pendaftaran,
  UniversitasPKS,
} from '../../types/internship';

export interface BoardBriefingData {
  stats: DashboardStatsResponse;
  interns: Mahasiswa[];
  pksList: UniversitasPKS[];
  applicants: Pendaftaran[];
  vacancies: Lowongan[];
  scopeLabel: string;
}

interface BoardPresentationModalProps {
  open: boolean;
  onClose: () => void;
  data: BoardBriefingData;
}

function formatTimer(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const BoardPresentationModal: React.FC<BoardPresentationModalProps> = ({
  open,
  onClose,
  data,
}) => {
  const { lang, setLang, theme, setColorMode, t } = useAppPreferences();
  const [slideIndex, setSlideIndex] = useState(0);
  const [showNotes, setShowNotes] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(true);
  const [copiedNotes, setCopiedNotes] = useState(false);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const deckRef = useRef<HTMLDivElement | null>(null);

  const { stats, interns, pksList, applicants, vacancies, scopeLabel } = data;

  // Derived real metrics for the filtered scope
  const metrics = useMemo(() => {
    const activeInterns = interns.filter((m) => m.status === 'Aktif');
    const mbkmCount = activeInterns.filter((m) => m.program === 'MBKM').length;
    const pklCount = activeInterns.filter((m) => m.program === 'PKL').length;
    const totalActive = activeInterns.length;
    const evaluated = activeInterns.filter((m) => m.skor > 0);
    const avgScore =
      evaluated.length > 0
        ? Math.round((evaluated.reduce((s, m) => s + m.skor, 0) / evaluated.length) * 10) / 10
        : 0;
    const talentRecommended = activeInterns.filter(
      (m) => m.talent === 'Sangat Direkomendasikan' || m.skor >= 30
    ).length;
    const talentConsidered = activeInterns.filter(
      (m) => m.talent === 'Dipertimbangkan' || (m.skor >= 21 && m.skor < 30)
    ).length;
    const evalCoveragePct =
      totalActive > 0 ? Math.round((evaluated.length / totalActive) * 100) : 0;

    // Department grouping
    const deptMap = new Map<
      string,
      { department: string; total: number; mbkm: number; pkl: number; scoreSum: number; scored: number }
    >();
    for (const m of activeInterns) {
      const key = m.department || 'General';
      const entry = deptMap.get(key) || {
        department: key,
        total: 0,
        mbkm: 0,
        pkl: 0,
        scoreSum: 0,
        scored: 0,
      };
      entry.total += 1;
      if (m.program === 'MBKM') entry.mbkm += 1;
      else entry.pkl += 1;
      if (m.skor > 0) {
        entry.scoreSum += m.skor;
        entry.scored += 1;
      }
      deptMap.set(key, entry);
    }
    const departments = Array.from(deptMap.values())
      .map((d) => ({
        ...d,
        avgSkor: d.scored > 0 ? Math.round((d.scoreSum / d.scored) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.total - a.total || b.avgSkor - a.avgSkor);

    // University grouping
    const uniMap = new Map<string, { universitas: string; mbkm: number; pkl: number; total: number }>();
    for (const m of activeInterns) {
      const key = m.universitas || '-';
      const entry = uniMap.get(key) || { universitas: key, mbkm: 0, pkl: 0, total: 0 };
      entry.total += 1;
      if (m.program === 'MBKM') entry.mbkm += 1;
      else entry.pkl += 1;
      uniMap.set(key, entry);
    }
    const universities = Array.from(uniMap.values()).sort((a, b) => b.total - a.total);

    // Top talent list
    const topTalent = [...activeInterns]
      .sort((a, b) => b.skor - a.skor || a.nama.localeCompare(b.nama))
      .slice(0, 5);

    // PKS health
    const totalPks = pksList.length;
    const activePks = pksList.filter((p) => p.status === 'Active').length;
    const expiredPks = pksList.filter((p) => p.status === 'Expired').length;
    const expiringSoonPks = stats.kpi.pksMendekatiH30;
    const pksHealthPct = totalPks > 0 ? Math.round((activePks / totalPks) * 100) : 100;

    // Recruitment funnel
    const totalApplicants = applicants.length;
    const pendingApplicants = applicants.filter((a) => a.status === 'Pending').length;
    const acceptedApplicants = applicants.filter((a) => a.status === 'Diterima').length;
    const openVacancies = vacancies.filter((v) => v.status === 'Open').length;

    // 4-Pillar averages
    const radar = stats.radarAverage || { bk: 0, ps: 0, tw: 0, is: 0 };
    const pillars = [
      { key: 'bk', labelId: 'Business Knowledge', labelEn: 'Business Knowledge', score: radar.bk },
      { key: 'ps', labelId: 'Problem Solving', labelEn: 'Problem Solving', score: radar.ps },
      { key: 'tw', labelId: 'Teamwork & Kolaborasi', labelEn: 'Teamwork & Collaboration', score: radar.tw },
      { key: 'is', labelId: 'Inisiatif & Safety (HSE)', labelEn: 'Initiative & Safety (HSE)', score: radar.is },
    ];
    const strongestPillar = [...pillars].sort((a, b) => b.score - a.score)[0];

    // Overall operational readiness score (composite of attendance, evaluation coverage, and PKS health)
    const attendanceRate = stats.kpi.kehadiranHariIniRate;
    const compositeHealth = Math.round(
      attendanceRate * 0.45 + pksHealthPct * 0.3 + Math.max(evalCoveragePct, 50) * 0.25
    );

    return {
      totalActive,
      mbkmCount,
      pklCount,
      evaluatedCount: evaluated.length,
      evalCoveragePct,
      avgScore,
      talentRecommended,
      talentConsidered,
      departments,
      universities,
      topTalent,
      totalPks,
      activePks,
      expiredPks,
      expiringSoonPks,
      pksHealthPct,
      totalApplicants,
      pendingApplicants,
      acceptedApplicants,
      openVacancies,
      pillars,
      strongestPillar,
      attendanceRate,
      attendanceCount: stats.kpi.kehadiranHariIniCount,
      compositeHealth,
      attendanceTrend: stats.attendanceTrend || [],
    };
  }, [interns, pksList, applicants, vacancies, stats]);

  const slides = useMemo(
    () => [
      {
        num: 1,
        shortTitle: t('Ikhtisar Makro & Kesehatan', 'Macro Health & Intake'),
        shortSub: t('MBKM vs PKL & Kepatuhan', 'MBKM vs PKL & Compliance'),
        kicker: t(
          'SLIDE 1 · IKHTISAR MAKRO PROGRAM MAGANG MOJOKERTO FACTORY',
          'SLIDE 1 · MOJOKERTO FACTORY MACRO INTERNSHIP OVERVIEW'
        ),
        title: t(
          'Status Ketersediaan Talenta Magang & Kepatuhan Operasional',
          'Internship Talent Readiness & Operational Compliance'
        ),
        subtitle: t(
          `Program magang beroperasi aktif dengan ${metrics.totalActive} peserta lintas ${metrics.departments.length} departemen dan tingkat kepatuhan PKS kampus ${metrics.pksHealthPct}%.`,
          `The internship program runs actively with ${metrics.totalActive} interns across ${metrics.departments.length} departments and ${metrics.pksHealthPct}% university MoA compliance.`
        ),
        notesHeading: t(
          'Slide 1: Pembukaan & Status Makro Program Magang Mojokerto Factory',
          'Slide 1: Opening & Mojokerto Factory Macro Internship Overview'
        ),
        talkingPoints:
          lang === 'en'
            ? [
                `Honorable Board of Directors, to open today's briefing, PT Ajinomoto Indonesia - PT Ajinex International Mojokerto Factory currently hosts ${metrics.totalActive} active interns (${metrics.mbkmCount} MBKM and ${metrics.pklCount} PKL) across ${metrics.departments.length} factory departments.`,
                `Today's GPS-verified attendance stands at ${metrics.attendanceRate}% (${metrics.attendanceCount} recorded), maintaining disciplined site presence aligned with Safety First standards.`,
                `Talent pool readiness has identified ${metrics.talentRecommended} highly recommended candidates (score ≥ 30/40) with an overall competency average of ${metrics.avgScore}/40.`,
              ]
            : [
                `Yth. Jajaran Direksi dan Manajemen, mengawali paparan hari ini, PT Ajinomoto Indonesia - PT Ajinex International Mojokerto Factory membina ${metrics.totalActive} peserta magang aktif (${metrics.mbkmCount} MBKM dan ${metrics.pklCount} PKL) di ${metrics.departments.length} departemen pabrik.`,
                `Tingkat kehadiran terverifikasi GPS hari ini berada di angka ${metrics.attendanceRate}% (${metrics.attendanceCount} tercatat), menjaga kedisiplinan kerja pabrik sesuai standar Safety First.`,
                `Kesiapan talent pool telah memetakan ${metrics.talentRecommended} kandidat Sangat Direkomendasikan (skor ≥ 30/40) dengan rata-rata skor evaluasi ${metrics.avgScore}/40.`,
              ],
        presenterTip: t(
          'Tekankan keseimbangan komposisi MBKM (jangka panjang) dan PKL (operasional) sebagai sumber talent pipeline pabrik tanpa mengganggu ritme produksi.',
          'Emphasize the healthy balance between long-term MBKM cohorts and operational PKL placements as a sustainable factory talent pipeline.'
        ),
      },
      {
        num: 2,
        shortTitle: t('Alokasi Departemen', 'Department Allocation'),
        shortSub: t(`${metrics.departments.length} Departemen Aktif`, `${metrics.departments.length} Active Depts`),
        kicker: t(
          'SLIDE 2 · EVALUASI PENEMPATAN & SKOR PER DEPARTEMEN',
          'SLIDE 2 · DEPARTMENT DEPLOYMENT & PERFORMANCE EVALUATION'
        ),
        title: t(
          'Distribusi Peserta & Performa Evaluasi Lintas Departemen',
          'Cross-Department Placement Distribution & Evaluation Scores'
        ),
        subtitle: t(
          `Penempatan tersebar pada ${metrics.departments.length} unit operasional dengan ${metrics.openVacancies} posisi lowongan terbuka untuk siklus penerimaan berikutnya.`,
          `Placements span ${metrics.departments.length} operational units with ${metrics.openVacancies} open internship vacancies for the upcoming intake cycle.`
        ),
        notesHeading: t(
          'Slide 2: Evaluasi Beban Bimbingan & Skor Antar Departemen',
          'Slide 2: Mentoring Load & Cross-Department Score Evaluation'
        ),
        talkingPoints:
          lang === 'en'
            ? [
                `Active intern deployment currently covers ${metrics.departments.length} factory departments, led by ${metrics.departments[0]?.department || 'core production'} with ${metrics.departments[0]?.total || 0} interns.`,
                `Evaluation completion has reached ${metrics.evalCoveragePct}% (${metrics.evaluatedCount} of ${metrics.totalActive} active interns formally scored across 4 AJIU competency pillars).`,
                `There are currently ${metrics.openVacancies} open positions and ${metrics.pendingApplicants} pending applicant dossiers ready for department user screening.`,
              ]
            : [
                `Penempatan peserta aktif saat ini menjangkau ${metrics.departments.length} departemen pabrik, terbanyak di ${metrics.departments[0]?.department || 'unit utama'} sebanyak ${metrics.departments[0]?.total || 0} peserta.`,
                `Cakupan penilaian kompetensi mencapai ${metrics.evalCoveragePct}% (${metrics.evaluatedCount} dari ${metrics.totalActive} peserta aktif telah dievaluasi pada 4 pilar AJIU).`,
                `Saat ini tersedia ${metrics.openVacancies} lowongan aktif dengan ${metrics.pendingApplicants} berkas pelamar menunggu seleksi user departemen.`,
              ],
        presenterTip: t(
          'Soroti departemen dengan rata-rata skor tertinggi sebagai benchmark mentoring, dan dorong penuntasan evaluasi bagi peserta yang belum dinilai.',
          'Highlight top-scoring departments as mentoring benchmarks and encourage timely completion of pending intern evaluations.'
        ),
      },
      {
        num: 3,
        shortTitle: t('4 Pilar & Talent Pool', '4-Pillar & Talent Pool'),
        shortSub: t('Kompetensi AJIU & Top 5', 'AJIU Competency & Top 5'),
        kicker: t(
          'SLIDE 3 · PROFIL KOMPETENSI 4 PILAR & KANDIDAT TALENT POOL',
          'SLIDE 3 · 4-PILLAR COMPETENCY PROFILE & TALENT POOL'
        ),
        title: t(
          'Kualitas Kompetensi 4 Pilar AJIU & Peringkat Top 5 Talenta',
          'AJIU 4-Pillar Competency Profile & Top 5 Talent Leaderboard'
        ),
        subtitle: t(
          `Pilar terkuat tercatat pada ${lang === 'en' ? metrics.strongestPillar?.labelEn : metrics.strongestPillar?.labelId} (${metrics.strongestPillar?.score.toFixed(1)}/10), menghasilkan ${metrics.talentRecommended} kandidat siap jalur rekrutmen.`,
          `Strongest competency sits in ${metrics.strongestPillar?.labelEn} (${metrics.strongestPillar?.score.toFixed(1)}/10), yielding ${metrics.talentRecommended} recruitment-ready talent candidates.`
        ),
        notesHeading: t(
          'Slide 3: Analisis 4 Pilar Kompetensi & Pipeline Rekrutmen',
          'Slide 3: 4-Pillar Competency Analysis & Recruitment Pipeline'
        ),
        talkingPoints:
          lang === 'en'
            ? [
                `Across all evaluated interns, the strongest AJIU competency pillar is ${metrics.strongestPillar?.labelEn} averaging ${metrics.strongestPillar?.score.toFixed(1)} out of 10.`,
                `A total of ${metrics.talentRecommended} interns achieved "Highly Recommended" (≥ 30/40) and ${metrics.talentConsidered} are classified under "Considered" (21–29/40).`,
                metrics.topTalent[0]
                  ? `Top-ranked candidate is ${metrics.topTalent[0].nama} (${metrics.topTalent[0].universitas} · ${metrics.topTalent[0].department}) with ${metrics.topTalent[0].skor}/40.`
                  : `Consistent quarterly evaluations keep our early-career talent pipeline transparent and auditable.`,
              ]
            : [
                `Dari seluruh evaluasi peserta, pilar kompetensi AJIU terkuat adalah ${metrics.strongestPillar?.labelId} dengan rata-rata ${metrics.strongestPillar?.score.toFixed(1)} dari skala 10.`,
                `Sebanyak ${metrics.talentRecommended} peserta meraih predikat Sangat Direkomendasikan (≥ 30/40) dan ${metrics.talentConsidered} peserta masuk kategori Dipertimbangkan (21–29/40).`,
                metrics.topTalent[0]
                  ? `Kandidat peringkat teratas adalah ${metrics.topTalent[0].nama} (${metrics.topTalent[0].universitas} · ${metrics.topTalent[0].department}) dengan skor ${metrics.topTalent[0].skor}/40.`
                  : `Evaluasi berkala menjaga pipeline talenta muda pabrik tetap terukur dan akuntabel.`,
              ],
        presenterTip: t(
          'Usulkan mekanisme fast-track interview bagi Top 5 kandidat saat terdapat kebutuhan posisi tetap/MT di Mojokerto Factory.',
          'Propose a fast-track interview pathway for Top 5 candidates whenever permanent or Management Trainee roles open at Mojokerto Factory.'
        ),
      },
      {
        num: 4,
        shortTitle: t('Absensi & Mitra Kampus', 'Attendance & Campus'),
        shortSub: t('Tren Harian & PKS', 'Daily Trend & MoAs'),
        kicker: t(
          'SLIDE 4 · KEDISIPLINAN ABSENSI GPS & KEMITRAAN UNIVERSITAS',
          'SLIDE 4 · GPS ATTENDANCE DISCIPLINE & UNIVERSITY PARTNERSHIPS'
        ),
        title: t(
          'Tren Kehadiran Harian & Tata Kelola PKS Universitas Mitra',
          'Daily Attendance Momentum & Partner University MoA Governance'
        ),
        subtitle: t(
          `${metrics.universities.length} universitas aktif menyuplai talenta dengan ${metrics.activePks} dari ${metrics.totalPks} dokumen PKS berstatus aktif.`,
          `${metrics.universities.length} partner universities actively supply interns with ${metrics.activePks} of ${metrics.totalPks} MoA contracts in active status.`
        ),
        notesHeading: t(
          'Slide 4: Integritas Kehadiran Pabrik & Kontrak PKS Kampus',
          'Slide 4: Site Attendance Integrity & Campus MoA Governance'
        ),
        talkingPoints:
          lang === 'en'
            ? [
                `All intern check-ins and check-outs are geo-fenced within the Mojokerto Factory perimeter with live selfie verification to eliminate proxy attendance.`,
                `Currently ${metrics.activePks} university MoAs are active across ${metrics.universities.length} contributing campuses, while ${metrics.expiringSoonPks} agreements are within the H-30 renewal window.`,
                `Automated H-30 renewal reminders ensure zero legal interruption for ongoing MBKM/PKL cohorts.`,
              ]
            : [
                `Seluruh absensi masuk dan pulang peserta divalidasi dengan radius geofence Mojokerto Factory serta foto selfie real-time untuk menjamin akurasi data.`,
                `Saat ini terdapat ${metrics.activePks} PKS universitas berstatus aktif dari total ${metrics.totalPks} mitra, dengan ${metrics.expiringSoonPks} kontrak memasuki jendela pengingat H-30.`,
                `Pengingat otomatis H-30 memastikan tidak ada kekosongan payung hukum bagi mahasiswa MBKM/PKL yang sedang berjalan.`,
              ],
        presenterTip: t(
          'Tunjukkan bahwa integrasi absensi geofence & monitoring PKS H-30 memangkas risiko kepatuhan audit HR dan keselamatan kerja.',
          'Highlight how geofenced attendance and H-30 MoA tracking significantly reduce HR audit and safety compliance risks.'
        ),
      },
      {
        num: 5,
        shortTitle: t('Ratifikasi Direksi', 'Board Ratification'),
        shortSub: t('Keputusan Strategis', 'Strategic Decisions'),
        kicker: t(
          'SLIDE 5 · RATIFIKASI & KEPUTUSAN STRATEGIS DIREKSI',
          'SLIDE 5 · BOARD RATIFICATION & STRATEGIC DECISIONS'
        ),
        title: t(
          'Agenda Keputusan Direksi & Prioritas Tindak Lanjut HRD',
          'Board Decision Agenda & HR Development Priority Actions'
        ),
        subtitle: t(
          'Sintesis 4 keputusan strategis berbasis data aktual PostgreSQL untuk persetujuan dan arahan Pimpinan Mojokerto Factory.',
          'Synthesis of 4 live-data strategic decisions submitted for Mojokerto Factory Top Management ratification and direction.'
        ),
        notesHeading: t(
          'Slide 5: Penutup & Permohonan Arahan/Persetujuan Direksi',
          'Slide 5: Closing & Request for Board Direction/Ratification'
        ),
        talkingPoints:
          lang === 'en'
            ? [
                `To conclude our briefing, HR Development proposes four concrete governance actions for Board endorsement.`,
                `First, fast-track talent retention for our ${metrics.talentRecommended} highly recommended interns; second, proactive renewal of ${metrics.expiringSoonPks} H-30 university MoAs.`,
                `Third, accelerating review of ${metrics.pendingApplicants} pending applications; and fourth, sustaining 100% geofenced attendance & 4-pillar evaluation compliance across all departments.`,
              ]
            : [
                `Sebagai penutup paparan, HR Development mengajukan empat keputusan tata kelola berbasis data aktual untuk mendapatkan arahan dan persetujuan Direksi.`,
                `Pertama, jalur retensi fast-track bagi ${metrics.talentRecommended} kandidat Talent Pool; kedua, perpanjangan proaktif ${metrics.expiringSoonPks} PKS kampus pada jendela H-30.`,
                `Ketiga, percepatan seleksi ${metrics.pendingApplicants} pelamar pending; serta keempat, menjaga kepatuhan absensi geofence dan evaluasi 4 pilar di seluruh departemen.`,
              ],
        presenterTip: t(
          'Tutup dengan membuka sesi diskusi/arahan kuota departemen untuk periode penerimaan MBKM/PKL berikutnya, lalu unduh PDF Dossier sebagai notulen resmi.',
          'Close by inviting Board feedback on next-cycle department intake quotas, then export the PDF Dossier as official meeting documentation.'
        ),
      },
    ],
    [metrics, lang, t]
  );

  const currentSlide = slides[slideIndex] || slides[0];

  const toggleNativeFullscreen = useCallback(async () => {
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    const el = (deckRef.current || document.documentElement) as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    const active = Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement);
    try {
      if (active) {
        if (doc.exitFullscreen) await doc.exitFullscreen();
        else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
      } else {
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      }
    } catch {
      // ignore if browser blocks fullscreen inside sandboxed iframe
    }
  }, []);

  const handleCloseDeck = useCallback(() => {
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      try {
        if (doc.exitFullscreen) void doc.exitFullscreen();
        else if (doc.webkitExitFullscreen) void doc.webkitExitFullscreen();
      } catch {
        // ignore
      }
    }
    onClose();
  }, [onClose]);

  // Reset state when opening
  useEffect(() => {
    if (!open) return;
    setSlideIndex(0);
    setElapsedSeconds(0);
    setTimerRunning(true);
    setShowNotes(true);
  }, [open]);

  // Timer tick
  useEffect(() => {
    if (!open || !timerRunning) return;
    const id = window.setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [open, timerRunning]);

  // Fullscreen listener
  useEffect(() => {
    if (!open) return;
    const onFsChange = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element | null };
      setIsNativeFullscreen(Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, [open]);

  // Keyboard controls inside presentation mode
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
      ) {
        return;
      }
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        setSlideIndex((i) => Math.min(slides.length - 1, i + 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSlideIndex((i) => Math.max(0, i - 1));
      } else if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setShowNotes((v) => !v);
      } else if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        setColorMode(theme.isDark ? 'light' : 'dark');
      } else if (e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setLang(lang === 'id' ? 'en' : 'id');
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        void toggleNativeFullscreen();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCloseDeck();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, slides.length, theme.isDark, setColorMode, lang, setLang, toggleNativeFullscreen, handleCloseDeck]);

  if (!open) return null;

  const handleCopyNotes = async () => {
    const text = [
      currentSlide.notesHeading,
      ...currentSlide.talkingPoints.map((p) => `• ${p}`),
      `${t('Tips Presenter', 'Presenter Tip')}: ${currentSlide.presenterTip}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedNotes(true);
      window.setTimeout(() => setCopiedNotes(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  // Board decisions for Slide 5
  const boardDecisions = [
    {
      num: '01',
      title: t('Jalur Fast-Track Rekrutmen Talent Pool', 'Fast-Track Talent Pool Recruitment Pathway'),
      status: metrics.talentRecommended > 0 ? t('DIREKOMENDASIKAN', 'RECOMMENDED') : t('PEMANTAUAN', 'MONITORING'),
      tone: 'emerald' as const,
      body: t(
        `Menetapkan ${metrics.talentRecommended} peserta berpredikat Sangat Direkomendasikan (skor ≥ 30/40) ke dalam prioritas wawancara Management Trainee & staf pabrik saat posisi tersedia.`,
        `Prioritize ${metrics.talentRecommended} Highly Recommended interns (score ≥ 30/40) for fast-track Management Trainee and permanent plant staff interviews as openings arise.`
      ),
    },
    {
      num: '02',
      title: t('Perpanjangan Proaktif PKS Universitas Mitra', 'Proactive Partner University MoA Renewal'),
      status: metrics.expiringSoonPks > 0 ? t('PRIORITAS H-30', 'H-30 PRIORITY') : t('TERKENDALI', 'COMPLIANT'),
      tone: metrics.expiringSoonPks > 0 ? ('amber' as const) : ('emerald' as const),
      body: t(
        `Saat ini ${metrics.activePks} PKS kampus aktif (${metrics.pksHealthPct}%) dengan ${metrics.expiringSoonPks} dokumen mendekati batas H-30 untuk segera diproses perpanjangan legal.`,
        `Currently ${metrics.activePks} campus MoAs are active (${metrics.pksHealthPct}%) with ${metrics.expiringSoonPks} agreements within the H-30 window requiring legal renewal follow-up.`
      ),
    },
    {
      num: '03',
      title: t('Percepatan Seleksi Pelamar & Kuota Departemen', 'Applicant Screening & Department Intake Alignment'),
      status: metrics.pendingApplicants > 0 ? t('TINDAK LANJUT', 'ACTION NEEDED') : t('OPTIMAL', 'OPTIMAL'),
      tone: metrics.pendingApplicants > 0 ? ('blue' as const) : ('emerald' as const),
      body: t(
        `Menyelesaikan tinjauan ${metrics.pendingApplicants} berkas pelamar pending terhadap ${metrics.openVacancies} lowongan terbuka di ${metrics.departments.length} departemen operasional.`,
        `Complete review of ${metrics.pendingApplicants} pending applicant dossiers against ${metrics.openVacancies} open vacancies across ${metrics.departments.length} operational departments.`
      ),
    },
    {
      num: '04',
      title: t('Standarisasi Disiplin Geofence & Evaluasi 4 Pilar', 'Geofence Discipline & 4-Pillar Evaluation Governance'),
      status: t('DISETUJUI', 'APPROVED'),
      tone: 'emerald' as const,
      body: t(
        `Mempertahankan kepatuhan absensi selfie-geofence pabrik (${metrics.attendanceRate}% hari ini) serta menargetkan 100% cakupan evaluasi 4 pilar AJIU sebelum akhir masa magang.`,
        `Sustain factory selfie-geofence attendance compliance (${metrics.attendanceRate}% today) and drive 100% 4-pillar AJIU evaluation coverage prior to internship completion.`
      ),
    },
  ];

  // Max bar reference for charts
  const maxDeptTotal = Math.max(1, ...metrics.departments.map((d) => d.total));
  const maxUniTotal = Math.max(1, ...metrics.universities.map((u) => u.total));
  const maxTrendTotal = Math.max(
    1,
    ...metrics.attendanceTrend.map((pt) => pt.masuk + pt.pulang + pt.izin)
  );

  // SVG 4-pillar radar polygon math
  const radarCenter = 95;
  const radarRadius = 68;
  const radarValues = [
    Math.min(10, Math.max(0, metrics.pillars[0]?.score || 0)) / 10,
    Math.min(10, Math.max(0, metrics.pillars[1]?.score || 0)) / 10,
    Math.min(10, Math.max(0, metrics.pillars[2]?.score || 0)) / 10,
    Math.min(10, Math.max(0, metrics.pillars[3]?.score || 0)) / 10,
  ];
  const radarAngles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
  const radarPoints = radarValues
    .map((v, idx) => {
      const r = v * radarRadius;
      const x = radarCenter + Math.cos(radarAngles[idx]) * r;
      const y = radarCenter + Math.sin(radarAngles[idx]) * r;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div
      ref={deckRef}
      role="dialog"
      aria-modal="true"
      aria-label={t('Mode Presentasi Direksi', 'Board Presentation Mode')}
      className="fixed inset-0 z-[80] flex flex-col bg-executive-canvas text-slate-900 dark:text-slate-100 overflow-hidden"
    >
      {/* Top Executive Deck Header */}
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/85 bg-white/95 px-4 py-2.5 backdrop-blur-md dark:border-slate-800 dark:bg-[#0A101B]/95 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1.5 rounded-xl bg-white px-2 py-1 ring-1 ring-slate-200/90 shadow-2xs shrink-0">
            <img
              src="/assets/aistudio/Logo_Ajinomoto_641a64fc.png"
              alt="Ajinomoto"
              className="h-5 w-auto object-contain"
            />
            <span className="h-4 w-px bg-slate-200" aria-hidden="true" />
            <img
              src="/assets/aistudio/logo_ajiu_crisp.png"
              alt="AJIU"
              className="h-5 w-5 object-contain"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-wider text-theme-accent">
              <span>{t('DEWAN DIREKSI & TOP MANAGEMENT', 'BOARD OF DIRECTORS')}</span>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
              <span className="font-mono tabular-nums text-slate-500 dark:text-slate-300">
                SLIDE {slideIndex + 1} / {slides.length}
              </span>
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-display text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                {t('Deck Presentasi Rapat Direksi Program Magang', 'Executive Board Meeting Presentation Deck')}
              </span>
              <span className="hidden lg:inline text-[11px] text-slate-500 dark:text-slate-400 truncate">
                · PT Ajinomoto Indonesia · Mojokerto Factory · {scopeLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Presentation Timer */}
          <div className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200/90 bg-slate-50 px-2 text-xs font-mono font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <button
              type="button"
              onClick={() => setTimerRunning((r) => !r)}
              title={timerRunning ? t('Jeda Timer', 'Pause Timer') : t('Lanjutkan Timer', 'Resume Timer')}
              className="inline-flex items-center gap-1.5 hover:text-theme-accent transition-colors"
            >
              {timerRunning ? <Pause className="h-3 w-3 text-theme-accent" /> : <Play className="h-3 w-3 text-emerald-600" />}
              <span className="tabular-nums">{formatTimer(elapsedSeconds)}</span>
            </button>
            <button
              type="button"
              onClick={() => setElapsedSeconds(0)}
              title={t('Reset Timer', 'Reset Timer')}
              className="ml-0.5 rounded p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-white"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          </div>

          {/* Language Switcher inside Deck */}
          <div
            role="group"
            aria-label={t('Bahasa Presentasi', 'Presentation Language')}
            className="inline-flex h-8 items-center rounded-lg border border-slate-200/90 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900"
          >
            <button
              type="button"
              onClick={() => setLang('id')}
              className={`rounded-md px-2 py-1 text-[11px] font-bold transition-colors ${
                lang === 'id'
                  ? 'bg-theme-accent text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              ID
            </button>
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`rounded-md px-2 py-1 text-[11px] font-bold transition-colors ${
                lang === 'en'
                  ? 'bg-theme-accent text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              EN
            </button>
          </div>

          {/* Light / Dark Toggle */}
          <button
            type="button"
            onClick={() => setColorMode(theme.isDark ? 'light' : 'dark')}
            title={t('Ubah Mode Terang/Gelap (T)', 'Toggle Light/Dark Mode (T)')}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200/90 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {theme.isDark ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5 text-slate-600" />}
            <span className="hidden md:inline">
              {theme.isDark ? t('Mode Terang', 'Light Mode') : t('Mode Gelap', 'Dark Mode')}
            </span>
          </button>

          {/* Speaker Notes Toggle */}
          <button
            type="button"
            onClick={() => setShowNotes((v) => !v)}
            aria-pressed={showNotes}
            title={t('Tampilkan/Sembunyikan Catatan Presenter (N)', 'Toggle Speaker Notes (N)')}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors ${
              showNotes
                ? 'border-theme-accent bg-theme-soft text-theme-accent'
                : 'border-slate-200/90 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <StickyNote className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t('Catatan', 'Notes')}</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => void toggleNativeFullscreen()}
            title={t('Layar Penuh Presentasi (F)', 'Presentation Full Screen (F)')}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/90 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {isNativeFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>

          {/* Prev / Next Arrows */}
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSlideIndex((i) => Math.max(0, i - 1))}
              disabled={slideIndex === 0}
              aria-label={t('Slide Sebelumnya', 'Previous Slide')}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/90 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-35 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setSlideIndex((i) => Math.min(slides.length - 1, i + 1))}
              disabled={slideIndex === slides.length - 1}
              aria-label={t('Slide Berikutnya', 'Next Slide')}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/90 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-35 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Close Button */}
          <button
            type="button"
            onClick={handleCloseDeck}
            aria-label={t('Tutup Mode Presentasi', 'Close Presentation Mode')}
            title={t('Tutup Presentasi (ESC)', 'Close Presentation (ESC)')}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg btn-theme-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* 5-Slide Interactive Stepper Bar */}
      <nav
        aria-label={t('Navigasi Slide Presentasi', 'Presentation Slide Navigation')}
        className="border-b border-slate-200/75 bg-white/75 px-4 py-2 dark:border-slate-800/80 dark:bg-slate-950/60 shrink-0 overflow-x-auto"
      >
        <div className="mx-auto flex max-w-6xl items-center gap-2 min-w-max">
          {slides.map((s, idx) => {
            const active = idx === slideIndex;
            return (
              <button
                key={s.num}
                type="button"
                onClick={() => setSlideIndex(idx)}
                className={`flex items-center gap-2.5 rounded-xl border px-3 py-1.5 text-left transition-all ${
                  active
                    ? 'btn-theme-primary border-transparent shadow-sm'
                    : 'border-slate-200/85 bg-white/90 text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full font-mono text-[11px] font-bold shrink-0 ${
                    active
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {s.num}
                </span>
                <div className="leading-tight">
                  <div className={`text-xs font-bold ${active ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                    {s.shortTitle}
                  </div>
                  <div
                    className={`text-[10px] ${
                      active ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {s.shortSub}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Slide Canvas */}
      <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div key={slideIndex} className="tab-panel-enter mx-auto max-w-5xl space-y-6">
          {/* Slide Hero Heading */}
          <div className="text-center space-y-2 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-theme-accent">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span>{currentSlide.kicker}</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {currentSlide.title}
            </h1>
            <p className="text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {currentSlide.subtitle}
            </p>
          </div>

          {/* SLIDE 1: MACRO PROGRAM HEALTH & COMPLIANCE */}
          {slideIndex === 0 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="surface-card p-5 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <span>{t('PESERTA MAGANG AKTIF', 'ACTIVE INTERNS')}</span>
                    <GraduationCap className="h-4 w-4 text-theme-accent" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-3xl font-extrabold tabular-nums text-slate-900 dark:text-white">
                      {metrics.totalActive}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {t('orang', 'interns')}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    {metrics.mbkmCount} MBKM · {metrics.pklCount} PKL
                  </div>
                </div>

                <div className="surface-card p-5 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <span>{t('KEHADIRAN HARI INI', 'ATTENDANCE TODAY')}</span>
                    <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-3xl font-extrabold tabular-nums text-blue-600 dark:text-blue-400">
                      {metrics.attendanceRate}%
                    </span>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      ({metrics.attendanceCount}/{metrics.totalActive})
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    {t('Terverifikasi Selfie & GPS Pabrik', 'Factory Selfie & GPS Verified')}
                  </div>
                </div>

                <div className="surface-card p-5 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <span>{t('TALENT POOL SIAP REKRUT', 'TALENT POOL READY')}</span>
                    <Award className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-3xl font-extrabold tabular-nums text-slate-900 dark:text-white">
                      {metrics.talentRecommended}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      ≥ 30/40
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    {t(`Rerata evaluasi ${metrics.avgScore}/40`, `Evaluation avg ${metrics.avgScore}/40`)}
                  </div>
                </div>

                <div className="surface-card p-5 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <span>{t('KEPATUHAN PKS & HSE', 'MOA & HSE COMPLIANCE')}</span>
                    <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-3xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {metrics.pksHealthPct}%
                    </span>
                  </div>
                  <div className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                    {metrics.activePks}/{metrics.totalPks} {t('PKS Kampus Aktif', 'Active Campus MoAs')}
                  </div>
                </div>
              </div>

              {/* Executive Corridor Progress Card (inspired by Screenshot 2) */}
              <div className="surface-card p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900 dark:text-white">
                      <ShieldCheck className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>
                        {t(
                          'Evaluasi Indeks Kesiapan Program & Koridor Kepatuhan Operasional',
                          'Program Readiness Index & Operational Compliance Corridor'
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
                      {t(
                        'Mengukur gabungan kedisiplinan absensi GPS, cakupan evaluasi 4 pilar AJIU, dan legalitas PKS universitas mitra.',
                        'Composite index combining GPS attendance discipline, 4-pillar AJIU evaluation coverage, and partner university MoA validity.'
                      )}
                    </p>
                  </div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    {metrics.compositeHealth >= 75
                      ? t('STATUS: STABIL & TERKENDALI', 'STATUS: STABLE & CONTROLLED')
                      : t('STATUS: PERLU PERHATIAN', 'STATUS: ATTENTION ADVISED')}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-700 dark:text-slate-200">
                      {t('Indeks Kesiapan Saat Ini:', 'Current Readiness Index:')}{' '}
                      <span className="font-mono font-extrabold text-theme-accent">{metrics.compositeHealth}%</span>
                    </span>
                    <span className="text-emerald-700 dark:text-emerald-300">
                      {t('Target Koridor: 80% – 100%', 'Target Corridor: 80% – 100%')}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {t(`Tanggal: ${stats.todayDate}`, `Date: ${stats.todayDate}`)}
                    </span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-600 via-teal-500 to-emerald-500 transition-all duration-500"
                      style={{ width: `${Math.max(8, Math.min(100, metrics.compositeHealth))}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-slate-500 dark:text-slate-400">{t('Cakupan Evaluasi:', 'Evaluation Coverage:')}</span>
                    <strong className="font-mono tabular-nums">{metrics.evalCoveragePct}%</strong>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                    <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                    <span className="text-slate-500 dark:text-slate-400">{t('Pelamar Pending:', 'Pending Applicants:')}</span>
                    <strong className="font-mono tabular-nums">{metrics.pendingApplicants}</strong>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                    <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                    <span className="text-slate-500 dark:text-slate-400">{t('PKS H-30:', 'H-30 MoAs:')}</span>
                    <strong className="font-mono tabular-nums">{metrics.expiringSoonPks}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SLIDE 2: DEPARTMENT ALLOCATION & SCORES */}
          {slideIndex === 1 && (
            <div className="surface-card p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900 dark:text-white">
                  <Building2 className="h-4.5 w-4.5 text-theme-accent" />
                  <span>{t('Rincian Peserta & Rerata Skor per Departemen', 'Intern Headcount & Average Score by Department')}</span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-300 font-mono tabular-nums">
                  {metrics.departments.length} {t('Departemen', 'Departments')} · {metrics.totalActive} {t('Peserta', 'Interns')}
                </div>
              </div>

              {metrics.departments.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500">
                  {t('Belum ada data penempatan departemen pada cakupan filter ini.', 'No department allocation data in this filter scope.')}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {metrics.departments.map((dept) => {
                    const widthPct = Math.round((dept.total / maxDeptTotal) * 100);
                    return (
                      <div
                        key={dept.department}
                        className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/60 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {dept.department}
                          </span>
                          <span className="font-mono text-xs font-extrabold text-theme-accent tabular-nums shrink-0">
                            {dept.total} {t('orang', 'interns')}
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-theme-accent transition-all duration-500"
                            style={{ width: `${Math.max(10, widthPct)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
                          <span>MBKM: {dept.mbkm} · PKL: {dept.pkl}</span>
                          <span className="font-mono font-semibold tabular-nums">
                            {t('Rerata Skor:', 'Avg Score:')}{' '}
                            <strong className="text-slate-900 dark:text-white">
                              {dept.avgSkor > 0 ? `${dept.avgSkor}/40` : '-'}
                            </strong>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SLIDE 3: 4-PILLAR COMPETENCY & TOP 5 TALENT */}
          {slideIndex === 2 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* 4-Pillar Radar & Bars */}
              <div className="surface-card lg:col-span-5 p-5 space-y-4">
                <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t('Profil Rerata 4 Pilar Kompetensi AJIU', 'AJIU 4-Pillar Competency Average')}
                </div>

                <div className="flex justify-center">
                  <svg viewBox="0 0 190 190" className="h-44 w-44">
                    {[0.25, 0.5, 0.75, 1].map((scale) => {
                      const r = radarRadius * scale;
                      const pts = radarAngles
                        .map((a) => `${(radarCenter + Math.cos(a) * r).toFixed(1)},${(radarCenter + Math.sin(a) * r).toFixed(1)}`)
                        .join(' ');
                      return (
                        <polygon
                          key={scale}
                          points={pts}
                          fill="none"
                          stroke="currentColor"
                          className="text-slate-200 dark:text-slate-700"
                          strokeWidth="1"
                        />
                      );
                    })}
                    {radarAngles.map((a, idx) => (
                      <line
                        key={idx}
                        x1={radarCenter}
                        y1={radarCenter}
                        x2={radarCenter + Math.cos(a) * radarRadius}
                        y2={radarCenter + Math.sin(a) * radarRadius}
                        stroke="currentColor"
                        className="text-slate-200 dark:text-slate-700"
                        strokeWidth="1"
                      />
                    ))}
                    <polygon
                      points={radarPoints}
                      fill={theme.accentHex}
                      fillOpacity={0.22}
                      stroke={theme.accentHex}
                      strokeWidth="2.2"
                    />
                    <text x="95" y="16" textAnchor="middle" className="fill-slate-600 dark:fill-slate-300 text-[9px] font-bold">BK</text>
                    <text x="176" y="98" textAnchor="middle" className="fill-slate-600 dark:fill-slate-300 text-[9px] font-bold">PS</text>
                    <text x="95" y="182" textAnchor="middle" className="fill-slate-600 dark:fill-slate-300 text-[9px] font-bold">TW</text>
                    <text x="14" y="98" textAnchor="middle" className="fill-slate-600 dark:fill-slate-300 text-[9px] font-bold">IS</text>
                  </svg>
                </div>

                <div className="space-y-2.5">
                  {metrics.pillars.map((p) => (
                    <div key={p.key} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          {lang === 'en' ? p.labelEn : p.labelId}
                        </span>
                        <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                          {p.score.toFixed(1)} / 10
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-theme-accent"
                          style={{ width: `${Math.min(100, Math.max(4, p.score * 10))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top 5 Talent Leaderboard */}
              <div className="surface-card lg:col-span-7 p-5 space-y-4">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900 dark:text-white">
                    <Trophy className="h-4.5 w-4.5 text-amber-500" />
                    <span>{t('Peringkat Top 5 Kandidat Talent Pool', 'Top 5 Talent Pool Candidates')}</span>
                  </div>
                  <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400">
                    {metrics.talentRecommended} {t('Sangat Direkomendasikan', 'Highly Recommended')}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {metrics.topTalent.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500">
                      {t('Belum ada peserta yang dievaluasi pada cakupan ini.', 'No evaluated interns in this scope yet.')}
                    </div>
                  ) : (
                    metrics.topTalent.map((m, idx) => (
                      <div
                        key={m.nim}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/70 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-900/60"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`flex h-7 w-7 items-center justify-center rounded-lg font-mono text-xs font-extrabold shrink-0 ${
                              idx === 0
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
                                : 'bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                            }`}
                          >
                            #{idx + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {m.nama}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-300 truncate">
                              {m.program} · {m.department} · {m.universitas}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono text-sm font-extrabold tabular-nums text-theme-accent">
                            {m.skor}/40
                          </div>
                          <div className="text-[10.5px] font-semibold text-emerald-700 dark:text-emerald-300">
                            {localizeTalent(m.talent, lang)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SLIDE 4: ATTENDANCE MOMENTUM & UNIVERSITY MOAS */}
          {slideIndex === 3 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Daily Attendance Trend */}
              <div className="surface-card lg:col-span-6 p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900 dark:text-white">
                    <CalendarCheck className="h-4.5 w-4.5 text-theme-accent" />
                    <span>{t('Tren Absensi Harian Terakhir', 'Recent Daily Attendance Trend')}</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {metrics.attendanceRate}% {t('Hari Ini', 'Today')}
                  </span>
                </div>

                {metrics.attendanceTrend.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-500">
                    {t('Belum ada riwayat tren absensi.', 'No attendance trend history available.')}
                  </div>
                ) : (
                  <div className="flex items-end justify-between gap-2 h-44 pt-4 px-1">
                    {metrics.attendanceTrend.slice(-7).map((pt) => {
                      const total = pt.masuk + pt.pulang + pt.izin;
                      const heightPct = Math.max(8, Math.round((total / maxTrendTotal) * 100));
                      return (
                        <div key={pt.tanggal} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                          <span className="font-mono text-[10.5px] font-bold tabular-nums text-slate-700 dark:text-slate-200">
                            {total}
                          </span>
                          <div className="w-full max-w-[36px] rounded-t-lg bg-theme-accent/85 transition-all" style={{ height: `${heightPct}%` }} />
                          <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                            {pt.tanggal.slice(5)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
                  <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-900/70">
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">{t('PKS Aktif', 'Active MoAs')}</div>
                    <div className="font-mono text-sm font-extrabold text-emerald-600 dark:text-emerald-400">{metrics.activePks}</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-900/70">
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">{t('Jendela H-30', 'H-30 Window')}</div>
                    <div className="font-mono text-sm font-extrabold text-amber-600 dark:text-amber-400">{metrics.expiringSoonPks}</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-900/70">
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">{t('Kedaluwarsa', 'Expired')}</div>
                    <div className="font-mono text-sm font-extrabold text-red-600 dark:text-red-400">{metrics.expiredPks}</div>
                  </div>
                </div>
              </div>

              {/* Partner Universities Breakdown */}
              <div className="surface-card lg:col-span-6 p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900 dark:text-white">
                    <Users className="h-4.5 w-4.5 text-theme-accent" />
                    <span>{t('Sebaran Universitas Mitra Utama', 'Top Partner Universities')}</span>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {metrics.universities.length} {t('Kampus', 'Campuses')}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {metrics.universities.slice(0, 6).map((u) => {
                    const pct = Math.round((u.total / maxUniTotal) * 100);
                    return (
                      <div key={u.universitas} className="space-y-1">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                            {u.universitas}
                          </span>
                          <span className="font-mono font-bold tabular-nums text-slate-700 dark:text-slate-200 shrink-0">
                            {u.total} <span className="text-[10px] font-normal text-slate-500">({u.mbkm}M · {u.pkl}P)</span>
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-slate-700 to-slate-500 dark:from-slate-300 dark:to-slate-500"
                            style={{ width: `${Math.max(10, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* SLIDE 5: BOARD RATIFICATION & STRATEGIC DECISIONS */}
          {slideIndex === 4 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {boardDecisions.map((item) => (
                  <div key={item.num} className="surface-card p-5 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-xs font-extrabold text-theme-accent shrink-0">
                          {item.num}.
                        </span>
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white leading-snug">
                          {item.title}
                        </h3>
                      </div>
                      <span
                        className={`text-[10px] font-extrabold uppercase tracking-wider shrink-0 ${
                          item.tone === 'emerald'
                            ? 'text-emerald-700 dark:text-emerald-300'
                            : item.tone === 'amber'
                              ? 'text-amber-700 dark:text-amber-300'
                              : 'text-blue-700 dark:text-blue-300'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                      {item.body}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white/85 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
                <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>
                    {t(
                      'Unduh dokumen PDF Eksekutif sebagai lampiran resmi risalah rapat Direksi.',
                      'Export the Executive PDF Dossier as official Board meeting minutes.'
                    )}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => exportExecutivePdf(stats)}
                  className="inline-flex items-center gap-1.5 rounded-lg btn-theme-primary px-3.5 py-2 text-xs font-semibold"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  {t('Unduh PDF Dossier Direksi', 'Download Executive PDF Dossier')}
                </button>
              </div>
            </div>
          )}

          {/* Presenter Speaker Talking Points Guide (Collapsible, inspired by Screenshot 2) */}
          {showNotes && (
            <section
              aria-label={t('Panduan Poin Bicara Presenter', 'Presenter Speaker Talking Points Guide')}
              className="rounded-2xl border border-amber-300/90 bg-amber-50/85 p-5 shadow-xs dark:border-amber-700/60 dark:bg-amber-950/30 space-y-3.5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-white shadow-xs shrink-0">
                    <FileText className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                      {t('PANDUAN POIN BICARA PRESENTER', 'PRESENTER SPEAKER TALKING POINTS GUIDE')}
                    </div>
                    <div className="text-xs font-medium text-amber-800/90 dark:text-amber-300/90">
                      {currentSlide.notesHeading}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyNotes}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-100/90 px-2.5 py-1 text-[11px] font-bold text-amber-900 hover:bg-amber-200/80 dark:border-amber-700 dark:bg-amber-900/60 dark:text-amber-100 dark:hover:bg-amber-800/80 transition-colors"
                  >
                    {copiedNotes ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copiedNotes ? t('Tersalin!', 'Copied!') : t('Salin Catatan', 'Copy Notes')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNotes(false)}
                    aria-label={t('Sembunyikan catatan', 'Hide notes')}
                    className="rounded-lg p-1 text-amber-800 hover:bg-amber-200/70 dark:text-amber-200 dark:hover:bg-amber-900/60"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-amber-900/80 dark:text-amber-300">
                  {t('POIN PAPARAN DIREKSI:', 'BOARD BRIEFING TALKING POINTS:')}
                </div>
                <ul className="space-y-1.5 text-xs italic leading-relaxed text-amber-950 dark:text-amber-100/95 list-disc pl-5">
                  {currentSlide.talkingPoints.map((pt, i) => (
                    <li key={i}>“{pt}”</li>
                  ))}
                </ul>
              </div>

              <div className="flex items-start gap-2 rounded-xl border border-amber-300/70 bg-amber-100/75 px-3.5 py-2.5 text-xs text-amber-950 dark:border-amber-800/70 dark:bg-amber-900/35 dark:text-amber-100">
                <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
                <span>
                  <strong>{t('Tips Presenter:', 'Presenter Tip:')}</strong> {currentSlide.presenterTip}
                </span>
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Bottom Executive Presentation Footer */}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/85 bg-white/95 px-4 py-2.5 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-[#0A101B]/95 dark:text-slate-400 shrink-0">
        <div className="truncate font-medium">
          PT Ajinomoto Indonesia · PT Ajinex International · Mojokerto Factory · {t('Deck Direksi', 'Board Executive Deck')}
        </div>

        <div className="flex items-center gap-1.5">
          {slides.map((s, idx) => (
            <button
              key={s.num}
              type="button"
              onClick={() => setSlideIndex(idx)}
              aria-label={`Slide ${s.num}`}
              className={`h-2 rounded-full transition-all ${
                idx === slideIndex
                  ? 'w-6 bg-theme-accent'
                  : 'w-2 bg-slate-300 hover:bg-slate-400 dark:bg-slate-700 dark:hover:bg-slate-500'
              }`}
            />
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2.5 font-mono text-[10.5px]">
          <span><kbd className="rounded border border-slate-300 px-1 py-0.5 dark:border-slate-700">←/→</kbd> {t('Slide', 'Nav')}</span>
          <span><kbd className="rounded border border-slate-300 px-1 py-0.5 dark:border-slate-700">T</kbd> {t('Tema', 'Theme')}</span>
          <span><kbd className="rounded border border-slate-300 px-1 py-0.5 dark:border-slate-700">L</kbd> ID/EN</span>
          <span><kbd className="rounded border border-slate-300 px-1 py-0.5 dark:border-slate-700">N</kbd> {t('Catatan', 'Notes')}</span>
          <span><kbd className="rounded border border-slate-300 px-1 py-0.5 dark:border-slate-700">F</kbd> Full</span>
          <span><kbd className="rounded border border-slate-300 px-1 py-0.5 dark:border-slate-700">ESC</kbd> {t('Tutup', 'Close')}</span>
        </div>
      </footer>
    </div>
  );
};
