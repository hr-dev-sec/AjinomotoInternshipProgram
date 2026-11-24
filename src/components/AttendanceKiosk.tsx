import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CheckCircle2, Clock, FileUp, MapPin, RefreshCw, ShieldAlert } from 'lucide-react';
import { useAppPreferences } from '../contexts/AppPreferencesContext';
import { apiRequest } from '../lib/api';
import { localizeApiMessage, localizeAttendanceNote } from '../lib/localizeData';
import type { AbsensiStatus } from '../types/internship';
import { GeofenceRadarInfographic } from './Infographics';

interface LookupStudent {
  nim: string;
  nama: string;
  program: 'MBKM' | 'PKL';
  department: string;
  universitas: string;
  maxRadiusMeters?: number;
  todayStatus?: {
    masuk: string | null;
    pulang: string | null;
    izin: string | null;
  };
}

function calcDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function formatWibClock(lang: 'id' | 'en'): string {
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date());
}

export const AttendanceKiosk: React.FC<{
  onBack: () => void;
  defaultRadiusMeters?: number;
}> = ({ onBack, defaultRadiusMeters = 650 }) => {
  const { lang, t } = useAppPreferences();

  const [nim, setNim] = useState('');
  const [student, setStudent] = useState<LookupStudent | null>(null);
  const [lookupError, setLookupError] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);

  const [mode, setMode] = useState<AbsensiStatus>('Masuk');
  const [coords, setCoords] = useState<string>('');
  const [gpsState, setGpsState] = useState<'idle' | 'detecting' | 'locked' | 'factory' | 'unsupported' | 'denied'>('idle');
  const [gpsLoading, setGpsLoading] = useState(false);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState<string>('');
  const [izinFileName, setIzinFileName] = useState<string>('');
  const [keterangan, setKeterangan] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState<{
    message: string;
    timestamp: string;
    jarakMeter: number;
    anomaliFlag?: string;
  } | null>(null);

  const [wibNow, setWibNow] = useState(() => formatWibClock(lang));

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    setWibNow(formatWibClock(lang));
    const timer = setInterval(() => {
      setWibNow(formatWibClock(lang));
    }, 1000);
    return () => {
      clearInterval(timer);
      stopCamera();
    };
  }, [lang]);

  const gpsStatusLabel = useMemo(() => {
    switch (gpsState) {
      case 'detecting':
        return t('Mendeteksi koordinat GPS...', 'Detecting GPS coordinates...');
      case 'locked':
        return `${t('Terkunci', 'Locked')} (${coords})`;
      case 'factory':
        return `${t('Titik Pabrik Mojokerto', 'Mojokerto Factory Point')} (${coords})`;
      case 'unsupported':
        return t('Browser tidak mendukung GPS.', 'Browser does not support GPS.');
      case 'denied':
        return t('Izin lokasi ditolak atau perangkat GPS tidak tersedia.', 'Location permission denied or GPS unavailable.');
      default:
        return t('Belum dideteksi', 'Not detected yet');
    }
  }, [gpsState, coords, t]);

  const liveDistanceMeters = useMemo(() => {
    if (!coords || !coords.includes(',')) return null;
    const [la, lo] = coords.split(',').map((s) => Number(s.trim()));
    if (Number.isNaN(la) || Number.isNaN(lo)) return null;
    return calcDistanceMeters(la, lo, -7.4589, 112.4631);
  }, [coords]);

  const handleLookupNim = async (targetNim: string) => {
    const clean = targetNim.trim();
    if (clean.length < 4) {
      setStudent(null);
      setLookupError('');
      return;
    }
    setLookupLoading(true);
    setLookupError('');
    try {
      const data = await apiRequest<LookupStudent>(`/api/absensi/nama?nim=${encodeURIComponent(clean)}`);
      setStudent(data);
    } catch (err) {
      setStudent(null);
      const msg = err instanceof Error ? err.message : t('NIM tidak ditemukan.', 'Student ID (NIM) not found.');
      setLookupError(localizeApiMessage(msg, lang));
    } finally {
      setLookupLoading(false);
    }
  };

  const detectGps = () => {
    if (!navigator.geolocation) {
      setGpsState('unsupported');
      return;
    }
    setGpsLoading(true);
    setGpsState('detecting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const val = `${pos.coords.latitude.toFixed(5)},${pos.coords.longitude.toFixed(5)}`;
        setCoords(val);
        setGpsState('locked');
        setGpsLoading(false);
      },
      () => {
        setGpsState('denied');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const useMojokertoFactoryCoords = () => {
    const val = '-7.45890,112.46310';
    setCoords(val);
    setGpsState('factory');
  };

  const startCamera = async () => {
    setCameraError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(t('Kamera tidak didukung browser ini.', 'Camera is not supported by this browser.'));
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 50);
    } catch {
      setCameraError(
        t(
          'Kamera depan tidak dapat diakses. Anda dapat mengunggah foto selfie dari perangkat.',
          'Front camera could not be accessed. You can upload a selfie photo from your device.'
        )
      );
    }
  };

  const takeSelfieSnapshot = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      setCapturedPhoto(canvas.toDataURL('image/jpeg', 0.8));
      stopCamera();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, acceptPdf: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setSubmitError(t('Ukuran file maksimal 2 MB.', 'Maximum file size is 2 MB.'));
      return;
    }
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    if (!isImage && !(acceptPdf && isPdf)) {
      setSubmitError(
        acceptPdf
          ? t('Gunakan file gambar (JPG/PNG) atau PDF.', 'Please upload an image (JPG/PNG) or PDF file.')
          : t('Gunakan file foto JPG/PNG.', 'Please upload a JPG/PNG photo.')
      );
      return;
    }
    setSubmitError('');
    setIzinFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setCapturedPhoto(String(reader.result || ''));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitSuccess(null);

    if (!student) {
      setSubmitError(
        t('Masukkan NIM peserta aktif yang valid terlebih dahulu.', 'Please enter a valid active intern Student ID (NIM) first.')
      );
      return;
    }
    if (!coords) {
      setSubmitError(t('Koordinat GPS wajib dikunci sebelum mengirim absensi.', 'GPS coordinates must be locked before submitting attendance.'));
      return;
    }
    if (!capturedPhoto) {
      setSubmitError(
        mode === 'Izin'
          ? t('Unggah foto surat izin / keterangan dokter.', 'Please upload a leave letter or doctor certificate.')
          : t('Ambil foto selfie terlebih dahulu.', 'Please capture or upload a selfie photo first.')
      );
      return;
    }
    if (mode === 'Izin' && keterangan.trim().length < 3) {
      setSubmitError(t('Tuliskan alasan izin atau sakit secara jelas.', 'Please provide a clear reason for your leave/sick request.'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest<{
        message: string;
        data: { timestamp: string; jarakMeter: number; anomaliFlag?: string };
      }>('/api/absensi', {
        method: 'POST',
        body: JSON.stringify({
          nim: student.nim,
          status: mode,
          lokasi: coords,
          fotoBase64: capturedPhoto,
          keterangan: mode === 'Izin' ? keterangan.trim() : undefined,
        }),
      });
      setSubmitSuccess({
        message: res.message,
        timestamp: res.data.timestamp,
        jarakMeter: res.data.jarakMeter,
        anomaliFlag: res.data.anomaliFlag,
      });
      setCapturedPhoto('');
      setIzinFileName('');
      setKeterangan('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('Gagal mengirim absensi.', 'Failed to submit attendance.');
      setSubmitError(localizeApiMessage(msg, lang));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl 2xl:max-w-[1440px] px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-theme-accent">
            {t('Kiosk Kehadiran Harian', 'Daily Attendance Kiosk')}
          </p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            {t('Absensi Harian Magang (MBKM & PKL)', 'Daily Internship Attendance (MBKM & PKL)')}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-200">
            PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory ·{' '}
            {t('Jam Kerja 07:30 – 16:30 WIB', 'Working Hours 07:30 – 16:30 WIB')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="surface-card inline-flex items-center gap-2 px-3.5 py-2 text-xs font-mono tabular-nums text-slate-700 dark:text-slate-200">
            <Clock className="h-3.5 w-3.5 text-theme-accent" />
            <span>{wibNow} WIB</span>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-slate-300/90 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            {t('Kembali ke Portal', 'Back to Portal')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form onSubmit={handleSubmit} className="surface-card lg:col-span-7 space-y-6 p-6 sm:p-8">
          {/* Step 1: NIM Lookup */}
          <div className="space-y-3">
            <label htmlFor="kiosk-nim" className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t('1. Verifikasi NIM Peserta Aktif', '1. Verify Active Intern Student ID (NIM)')}
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                id="kiosk-nim"
                type="text"
                value={nim}
                onChange={(e) => setNim(e.target.value)}
                onBlur={() => handleLookupNim(nim)}
                placeholder={t('Contoh: 215100201111014 atau 5009211042', 'e.g., 215100201111014 or 5009211042')}
                className="input-theme-focus flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 dark:text-slate-100 px-3.5 py-2.5 text-sm font-mono"
              />
              <button
                type="button"
                onClick={() => handleLookupNim(nim)}
                disabled={lookupLoading}
                className="rounded-lg bg-slate-900 dark:bg-slate-100 px-4 py-2.5 text-xs font-medium text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                {lookupLoading ? t('Memeriksa...', 'Checking...') : t('Cek NIM', 'Verify ID')}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-200">
              <span>{t('Contoh NIM aktif:', 'Sample active IDs:')}</span>
              {['215100201111014', '215060700111029', '211710101095'].map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => {
                    setNim(sample);
                    handleLookupNim(sample);
                  }}
                  className="font-mono text-theme-accent underline-offset-2 hover:underline"
                >
                  {sample}
                </button>
              ))}
            </div>

            {lookupError && (
              <p className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-300">
                {lookupError}
              </p>
            )}

            {student && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/30 px-4 py-3 text-sm space-y-2">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">{student.nama}</div>
                  <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                    <span>{student.program}</span>
                    <span aria-hidden="true"> · </span>
                    <span>{student.department}</span>
                    <span aria-hidden="true"> · </span>
                    <span>{student.universitas}</span>
                  </div>
                </div>
                {student.todayStatus && (
                  <div className="flex flex-wrap items-center gap-4 border-t border-emerald-200/70 dark:border-emerald-900/50 pt-2 text-[11px] font-mono text-slate-700 dark:text-slate-300">
                    <span>
                      {t('Masuk', 'Check-In')}: <strong>{student.todayStatus.masuk || t('Belum', 'None')}</strong>
                    </span>
                    <span>
                      {t('Pulang', 'Check-Out')}: <strong>{student.todayStatus.pulang || t('Belum', 'None')}</strong>
                    </span>
                    <span>
                      {t('Izin', 'Leave')}: <strong>{student.todayStatus.izin || '-'}</strong>
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Jenis Absensi */}
          <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-5">
            <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t('2. Pilih Status Kehadiran', '2. Select Attendance Mode')}
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:gap-2 rounded-lg bg-slate-100 dark:bg-slate-800/80 p-1">
              {(['Masuk', 'Pulang', 'Izin'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setMode(tab);
                    setCapturedPhoto('');
                    setIzinFileName('');
                    stopCamera();
                  }}
                  className={`rounded-md py-2 px-2 text-xs font-semibold transition-colors ${
                    mode === tab
                      ? 'bg-theme-accent text-white shadow-xs'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-900/60'
                  }`}
                >
                  {tab === 'Izin'
                    ? t('Ajukan Izin / Sakit', 'Request Leave / Sick')
                    : tab === 'Masuk'
                      ? t('Absen Masuk', 'Check-In')
                      : t('Absen Pulang', 'Check-Out')}
                </button>
              ))}
            </div>
          </div>

          {/* Step 3: GPS Lokasi */}
          <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t('3. Verifikasi Lokasi GPS', '3. GPS Location Verification')}
              </span>
              <span className="text-xs font-mono text-slate-600 dark:text-slate-200">{gpsStatusLabel}</span>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={detectGps}
                disabled={gpsLoading}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <MapPin className="h-3.5 w-3.5 text-theme-accent shrink-0" />
                {gpsLoading ? t('Mendeteksi...', 'Detecting...') : t('Ambil Koordinat GPS', 'Detect GPS Location')}
              </button>
              <button
                type="button"
                onClick={useMojokertoFactoryCoords}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-left"
              >
                {t('Gunakan Koordinat Area Pabrik Mojokerto', 'Use Mojokerto Factory Coordinates')}
              </button>
            </div>
          </div>

          {/* Step 4: Selfie atau Dokumen Izin */}
          <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-5">
            <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
              {mode === 'Izin'
                ? t(
                    '4. Alasan & Bukti Surat Izin / Sakit (Gambar atau PDF maks 2 MB)',
                    '4. Reason & Supporting Leave / Sick Letter (Image or PDF max 2 MB)'
                  )
                : t('4. Foto Selfie Kamera Depan', '4. Front Camera Selfie Photo')}
            </span>

            {mode === 'Izin' ? (
              <div className="space-y-3">
                <textarea
                  rows={3}
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  placeholder={t(
                    'Contoh: Izin sakit demam disertai surat keterangan dokter / Bimbingan tugas akhir di kampus',
                    'e.g., Sick leave with doctor note / Campus final thesis consultation'
                  )}
                  className="input-theme-focus w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 dark:text-slate-100 px-3.5 py-2.5 text-sm"
                />
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 px-4 py-5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:border-theme-accent hover:bg-theme-soft transition-colors">
                  <FileUp className="h-4 w-4 text-theme-accent" />
                  <span>
                    {izinFileName
                      ? `${t('File terpilih', 'Selected file')}: ${izinFileName}`
                      : t('Pilih Foto Surat Izin atau PDF (Maks 2 MB)', 'Choose Leave Letter Image or PDF (Max 2 MB)')}
                  </span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="sr-only"
                    onChange={(e) => handleFileUpload(e, true)}
                  />
                </label>
              </div>
            ) : (
              <div className="space-y-3">
                {!capturedPhoto && !cameraActive && (
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={startCamera}
                      className="inline-flex items-center gap-2 rounded-lg bg-slate-900 dark:bg-slate-100 px-4 py-2.5 text-xs font-medium text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white whitespace-nowrap shrink-0"
                    >
                      <Camera className="h-4 w-4" />
                      {t('Aktifkan Kamera Depan', 'Open Front Camera')}
                    </button>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0">
                      <FileUp className="h-4 w-4 text-slate-600 dark:text-slate-200" />
                      <span>{t('Unggah Foto Selfie', 'Upload Selfie Photo')}</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="user"
                        className="sr-only"
                        onChange={(e) => handleFileUpload(e, false)}
                      />
                    </label>
                  </div>
                )}

                {cameraError && (
                  <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg px-3 py-2">
                    {cameraError}
                  </p>
                )}

                {cameraActive && (
                  <div className="space-y-3">
                    <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-950 aspect-video max-w-md">
                      <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={takeSelfieSnapshot}
                        className="btn-theme-primary rounded-lg px-4 py-2 text-xs font-semibold"
                      >
                        {t('Ambil Foto Sekarang', 'Capture Photo')}
                      </button>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300"
                      >
                        {t('Batal', 'Cancel')}
                      </button>
                    </div>
                  </div>
                )}

                {capturedPhoto && (
                  <div className="flex items-start gap-4">
                    <img
                      src={capturedPhoto}
                      alt={t('Pratinjau selfie absensi', 'Attendance selfie preview')}
                      className="h-28 w-28 rounded-lg border border-slate-200 dark:border-slate-700 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setCapturedPhoto('');
                        startCamera();
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      {t('Ulangi Foto', 'Retake Photo')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {submitError && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 px-4 py-3 text-xs text-red-700 dark:text-red-300">
              {submitError}
            </div>
          )}

          {submitSuccess && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30 px-4 py-3.5 text-sm text-emerald-950 dark:text-emerald-200 space-y-1">
              <div className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{localizeApiMessage(submitSuccess.message, lang)}</span>
              </div>
              <div className="text-xs text-slate-700 dark:text-slate-300 font-mono">
                {t('Waktu', 'Time')}: {submitSuccess.timestamp} · {t('Jarak dari Pabrik', 'Distance from Factory')}:{' '}
                {submitSuccess.jarakMeter} m
              </div>
              {submitSuccess.anomaliFlag && (
                <div className="mt-1 flex items-center gap-1.5 text-xs text-amber-800 dark:text-amber-300">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {t('Catatan sistem', 'System note')}: {localizeAttendanceNote(submitSuccess.anomaliFlag, lang)}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end border-t border-slate-100 dark:border-slate-800 pt-5">
            <button
              type="submit"
              disabled={submitting}
              className="btn-theme-primary w-full sm:w-auto rounded-lg px-6 py-3 text-sm font-semibold disabled:opacity-50 whitespace-nowrap"
            >
              {submitting
                ? t('Mengirim Absensi...', 'Submitting Attendance...')
                : mode === 'Izin'
                  ? t('Kirim Pengajuan Izin / Sakit', 'Submit Leave / Sick Request')
                  : mode === 'Masuk'
                    ? t('Kirim Absensi Masuk', 'Submit Check-In')
                    : t('Kirim Absensi Pulang', 'Submit Check-Out')}
            </button>
          </div>
        </form>

        {/* Right: Safety First & Live Geofence Radar Infographic */}
        <div className="lg:col-span-5 space-y-5 min-w-0">
          <div className="surface-card p-5 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-white p-1.5 ring-1 ring-emerald-200/90 shadow-2xs shrink-0">
                  <img
                    src="/assets/aistudio/HSE_8e0164a8.png"
                    alt="Logo Safety First"
                    referrerPolicy="no-referrer"
                    className="h-9 w-auto object-contain"
                  />
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    {t('Komitmen K3 & Safety First', 'OHS & Safety First Commitment')}
                  </div>
                  <div className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                    {t('Standar Kehadiran Area Pabrik', 'Factory Area Attendance Standard')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="rounded-lg bg-white px-2 py-1 ring-1 ring-slate-200/80 shadow-2xs">
                  <img
                    src="/assets/aistudio/Logo_Ajinomoto_641a64fc.png"
                    alt="Logo Ajinomoto Indonesia"
                    referrerPolicy="no-referrer"
                    className="h-5.5 w-auto object-contain"
                  />
                </div>
                <img
                  src="/assets/aistudio/logo_ajiu_crisp.png"
                  alt="Logo AJIU"
                  referrerPolicy="no-referrer"
                  className="h-10 w-10 object-contain shrink-0 drop-shadow-xs"
                />
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-3">
              {t(
                'Seluruh peserta magang PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory wajib mematuhi prosedur Keselamatan & Kesehatan Kerja (APD, area geofence, dan pelaporan izin tepat waktu).',
                'All interns at PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory must comply with Occupational Health & Safety procedures (PPE, geofence perimeter, and timely leave reporting).'
              )}
            </p>
          </div>

          <GeofenceRadarInfographic
            coords={coords}
            jarakMeter={liveDistanceMeters}
            maxRadiusMeters={student?.maxRadiusMeters ?? defaultRadiusMeters}
          />
        </div>
      </div>
    </div>
  );
};
