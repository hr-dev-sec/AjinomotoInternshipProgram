import React, { useEffect, useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { ArrowLeft, Bot, Clock, Lock, ShieldCheck, Users, X } from 'lucide-react';
import { useAppPreferences } from '../contexts/AppPreferencesContext';
import { apiRequest, setAdminToken, setFirebaseIdToken } from '../lib/api';
import { auth, googleAuthProvider } from '../lib/firebase';
import { localizeApiMessage } from '../lib/localizeData';
import { ThemeLanguageControls } from './ThemeLanguageControls';

export interface AdminUser {
  username: string;
  namaTampilan: string;
  role: string;
  departemen?: string;
  email?: string;
  noTelepon?: string;
  avatarUrl?: string;
}

export const AdminLogin: React.FC<{
  notice?: string;
  onDismissNotice?: () => void;
  onSuccess: (user: AdminUser) => void;
  onBackToPortal: () => void;
}> = ({ notice, onDismissNotice, onSuccess, onBackToPortal }) => {
  const { theme, lang, t } = useAppPreferences();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [mediaMap, setMediaMap] = useState<Record<string, { currentUrl: string; objectPosition?: string }>>({});

  useEffect(() => {
    apiRequest<{ media: Record<string, { currentUrl: string; objectPosition?: string }> }>('/api/public/media')
      .then((res) => {
        if (res?.media) setMediaMap(res.media);
      })
      .catch(() => {});
  }, []);

  const showcaseBgUrl =
    mediaMap.login_showcase_bg?.currentUrl || '/assets/images/hero_ajinomoto_factory_1794535892664.jpg';
  const logoAjinomoto = mediaMap.brand_logo_ajinomoto?.currentUrl || '/assets/aistudio/Logo_Ajinomoto_641a64fc.png';
  const logoAjiu = mediaMap.brand_logo_ajiu?.currentUrl || '/assets/aistudio/logo_ajiu_crisp.png';
  const logoSafety = mediaMap.brand_logo_safety?.currentUrl || '/assets/aistudio/HSE_8e0164a8.png';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiRequest<{ token: string; user: AdminUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: username.trim(), password }),
      });
      setFirebaseIdToken(null);
      setAdminToken(res.token);
      onSuccess(res.user);
    } catch (err) {
      setError(
        err instanceof Error
          ? localizeApiMessage(err.message, lang)
          : t('Login gagal.', 'Login failed.')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await result.user.getIdToken();
      setAdminToken(null);
      setFirebaseIdToken(idToken);
      const res = await apiRequest<{ token?: string; user: AdminUser }>('/api/auth/firebase', {
        method: 'POST',
        body: JSON.stringify({ idToken }),
      });
      if (res.token) {
        setAdminToken(res.token);
      }
      onSuccess(res.user);
    } catch (err) {
      setFirebaseIdToken(null);
      setError(
        err instanceof Error
          ? localizeApiMessage(err.message, lang)
          : t('Login akun Google gagal.', 'Google sign-in failed.')
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-executive-canvas grid grid-cols-1 lg:grid-cols-12 items-stretch">
      {/* Left Architectural Showcase */}
      <div className="hidden lg:flex lg:col-span-6 relative overflow-hidden bg-theme-showcase text-white flex-col justify-between gap-8 p-8 xl:p-10 min-h-[100dvh]">
        <img
          src={showcaseBgUrl}
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
          className="absolute inset-0 h-full w-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/75 to-slate-950/45" />

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBackToPortal}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-200 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('Kembali ke Portal Publik', 'Back to Public Portal')}
          </button>

          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white px-2.5 py-1.5 shadow-sm">
              <img
                src={logoAjinomoto}
                alt="Logo Ajinomoto Indonesia"
                referrerPolicy="no-referrer"
                className="h-7 w-auto object-contain"
              />
            </div>
            <img
              src={logoAjiu}
              alt="Logo AJIU Ajinomoto Indonesia University"
              referrerPolicy="no-referrer"
              className="h-12 w-12 object-contain shrink-0 drop-shadow-[0_4px_12px_rgba(0,0,0,0.45)]"
            />
            <div className="rounded-lg bg-white p-1.5 shadow-sm">
              <img
                src={logoSafety}
                alt="Logo Safety First"
                referrerPolicy="no-referrer"
                className="h-7 w-auto object-contain"
              />
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-6 max-w-lg">
          <div className="space-y-2">
            <p
              className="text-[11px] font-bold uppercase tracking-[0.14em]"
              style={{ color: theme.accentLightHex }}
            >
              HR Development Section · PT Ajinomoto Indonesia - PT Ajinex International
            </p>
            <h2 className="text-3xl font-extrabold tracking-tight text-balance">
              {t(
                'Pusat Kendali Talenta Magang Mojokerto Factory',
                'Mojokerto Factory Internship Talent Control Center'
              )}
            </h2>
            <p className="text-sm text-slate-100/95 leading-relaxed">
              {t(
                'Pantau kehadiran real-time, seleksi pelamar MBKM & PKL, evaluasi kompetensi 4 pilar, hingga kontrol masa berlaku PKS universitas dalam satu dashboard terpadu.',
                'Monitor real-time attendance, screen MBKM & PKL applicants, evaluate 4-pillar competencies, and govern university MoA validity from one unified executive dashboard.'
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 pt-4 border-t border-white/10 text-xs">
            <div className="flex items-center gap-3">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
                style={{ backgroundColor: `${theme.accentHex}2E`, color: theme.accentLightHex }}
              >
                <ShieldCheck className="h-4 w-4" />
              </div>
              <span className="text-slate-200">
                {t(
                  'Autentikasi token sesi per pengguna terisolasi di server',
                  'Server-isolated per-user session token authentication'
                )}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
                style={{ backgroundColor: `${theme.accentHex}2E`, color: theme.accentLightHex }}
              >
                <Bot className="h-4 w-4" />
              </div>
              <span className="text-slate-200">
                {t(
                  'Asisten HR & Screening CV Berbasis AI dengan anonimisasi',
                  'AI-Powered HR Assistant & Anonymized CV Screening'
                )}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
                style={{ backgroundColor: `${theme.accentHex}2E`, color: theme.accentLightHex }}
              >
                <Users className="h-4 w-4" />
              </div>
              <span className="text-slate-200">
                {t(
                  'Laporan eksekutif PDF & sertifikat verifikasi QR 1-klik',
                  '1-click executive PDF reports & QR-verified certificates'
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between gap-4 border-t border-white/15 pt-4 text-xs text-slate-200">
          <span>PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory</span>
          <span className="font-mono text-[11px] text-slate-200 shrink-0">Ajinomoto Indonesia University</span>
        </div>
      </div>

      {/* Right Login Form */}
      <div className="lg:col-span-6 flex flex-col justify-center px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto w-full max-w-md space-y-4">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onBackToPortal}
              className="lg:hidden inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-theme-accent dark:text-slate-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t('Kembali ke Portal', 'Back to Portal')}
            </button>
            <div className="ml-auto">
              <ThemeLanguageControls variant="login" align="right" />
            </div>
          </div>

          <div className="surface-card p-6 sm:p-7 space-y-5">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl icon-theme-plinth">
                  <Lock className="h-5 w-5" />
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="rounded-lg bg-white px-2 py-1 ring-1 ring-slate-200/90 shadow-2xs">
                    <img
                      src={logoAjinomoto}
                      alt="Logo Ajinomoto Indonesia"
                      referrerPolicy="no-referrer"
                      className="h-6 w-auto object-contain"
                    />
                  </div>
                  <img
                    src={logoAjiu}
                    alt="Logo AJIU"
                    referrerPolicy="no-referrer"
                    className="h-10 w-10 object-contain shrink-0 drop-shadow-xs"
                  />
                  <div className="rounded-lg bg-white p-1 ring-1 ring-emerald-200/90 shadow-2xs">
                    <img
                      src={logoSafety}
                      alt="Logo Safety First"
                      referrerPolicy="no-referrer"
                      className="h-6 w-auto object-contain"
                    />
                  </div>
                </div>
              </div>
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {t('Login Admin & Pimpinan', 'Admin & Leadership Login')}
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-200 leading-relaxed">
                {t(
                  'PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory · Akses terpadu untuk HR Development Admin, Pimpinan Perusahaan, serta Kepala Departemen / Seksi.',
                  'PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory · Unified portal access for HR Development Admins, Company Leadership, and Department / Section Heads.'
                )}
              </p>
            </div>

            {notice && (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-300/90 bg-amber-50 px-3.5 py-3 text-xs text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/50 dark:text-amber-200">
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <span className="flex-1 leading-relaxed">{notice}</span>
                {onDismissNotice && (
                  <button
                    type="button"
                    onClick={onDismissNotice}
                    aria-label={t('Tutup notifikasi', 'Dismiss notice')}
                    className="rounded-md p-0.5 text-amber-700 hover:bg-amber-200/70 dark:text-amber-300 dark:hover:bg-amber-900/60 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label htmlFor="admin-user" className="block text-xs font-semibold text-slate-700 dark:text-slate-100 mb-1.5">
                  {t('Username Akun', 'Account Username')}
                </label>
                <input
                  id="admin-user"
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t('Masukkan username Admin atau Pimpinan', 'Enter Admin or Leadership username')}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 input-theme-focus dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div>
                <label htmlFor="admin-pass" className="block text-xs font-semibold text-slate-700 dark:text-slate-100 mb-1.5">
                  {t('Password', 'Password')}
                </label>
                <input
                  id="admin-pass"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('Masukkan password', 'Enter password')}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 input-theme-focus dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || googleLoading}
                className="w-full rounded-lg btn-theme-primary px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                {loading
                  ? t('Memverifikasi Sesi...', 'Verifying Session...')
                  : t('Masuk ke Dashboard', 'Sign In to Dashboard')}
              </button>
            </form>

            <div className="relative flex items-center py-0.5">
              <div className="flex-grow border-t border-slate-200 dark:border-slate-700" />
              <span className="mx-3 shrink-0 text-[11px] font-medium text-slate-500 dark:text-slate-300">
                {t('atau', 'or')}
              </span>
              <div className="flex-grow border-t border-slate-200 dark:border-slate-700" />
            </div>

            <button
              type="button"
              disabled={loading || googleLoading}
              onClick={handleGoogleLogin}
              className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#EA4335"
                  d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.9 1.5l2.6-2.5C16.8 3.4 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5c5.5 0 9.1-3.8 9.1-9.2 0-.6-.1-1.1-.2-1.6H12z"
                />
              </svg>
              <span>
                {googleLoading
                  ? t('Menghubungkan Akun Google...', 'Connecting Google Account...')
                  : t('Masuk dengan Google', 'Sign in with Google')}
              </span>
            </button>

            <div className="surface-inset p-3.5 text-xs text-slate-600 dark:text-slate-200 space-y-1.5">
              <div className="font-semibold text-slate-800 dark:text-white">
                {t('Akses Uji Coba HR Development:', 'HR Development Demo Access:')}
              </div>
              <div className="font-mono">
                Username: <span className="text-slate-900 dark:text-white font-semibold">hr.mojokerto</span> · Password:{' '}
                <span className="text-slate-900 dark:text-white font-semibold">Ajinomoto2026!</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setUsername('hr.mojokerto');
                  setPassword('Ajinomoto2026!');
                }}
                className="text-theme-accent font-semibold hover:underline"
              >
                {t('Isi Otomatis Kredensial Demo', 'Auto-Fill Demo Credentials')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
