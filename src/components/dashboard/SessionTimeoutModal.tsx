import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Clock, LogOut, RefreshCw, ShieldAlert } from 'lucide-react';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { apiRequest } from '../../lib/api';

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes total idle before auto-logout
const WARNING_LEAD_MS = 60 * 1000; // Show confirmation popup 60 seconds before expiry
const ACTIVITY_THROTTLE_MS = 1_000;

interface SessionTimeoutModalProps {
  onTimeoutLogout: () => void | Promise<void>;
  onManualLogout: () => void | Promise<void>;
}

export const SessionTimeoutModal: React.FC<SessionTimeoutModalProps> = ({
  onTimeoutLogout,
  onManualLogout,
}) => {
  const { t } = useAppPreferences();
  const [warningOpen, setWarningOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(WARNING_LEAD_MS / 1000));
  const [extending, setExtending] = useState(false);

  const deadlineRef = useRef<number>(Date.now() + IDLE_TIMEOUT_MS);
  const warningOpenRef = useRef<boolean>(false);
  const lastActivityRef = useRef<number>(Date.now());
  const timedOutRef = useRef<boolean>(false);

  const triggerTimeoutLogout = useCallback(() => {
    if (timedOutRef.current) return;
    timedOutRef.current = true;
    warningOpenRef.current = false;
    setWarningOpen(false);
    void onTimeoutLogout();
  }, [onTimeoutLogout]);

  const resetIdleDeadline = useCallback(() => {
    deadlineRef.current = Date.now() + IDLE_TIMEOUT_MS;
    lastActivityRef.current = Date.now();
    timedOutRef.current = false;
  }, []);

  const handleContinueSession = async () => {
    setExtending(true);
    try {
      // Quietly confirm server session is still active
      const res = await apiRequest<{ authenticated: boolean }>('/api/auth/session');
      if (!res?.authenticated) {
        triggerTimeoutLogout();
        return;
      }
      warningOpenRef.current = false;
      setWarningOpen(false);
      setSecondsLeft(Math.ceil(WARNING_LEAD_MS / 1000));
      resetIdleDeadline();
    } catch {
      // Keep user in dashboard if transient network hiccup; next API call will enforce auth
      warningOpenRef.current = false;
      setWarningOpen(false);
      setSecondsLeft(Math.ceil(WARNING_LEAD_MS / 1000));
      resetIdleDeadline();
    } finally {
      setExtending(false);
    }
  };

  useEffect(() => {
    const handleActivity = () => {
      // Once the warning modal is visible, require an explicit button click (do not auto-dismiss on mouse move)
      if (warningOpenRef.current || timedOutRef.current) return;
      const now = Date.now();
      if (now - lastActivityRef.current < ACTIVITY_THROTTLE_MS) return;
      lastActivityRef.current = now;
      deadlineRef.current = now + IDLE_TIMEOUT_MS;
    };

    const evaluateClock = () => {
      if (timedOutRef.current) return;
      const remainingMs = deadlineRef.current - Date.now();

      if (remainingMs <= 0) {
        setSecondsLeft(0);
        triggerTimeoutLogout();
        return;
      }

      if (remainingMs <= WARNING_LEAD_MS) {
        const secs = Math.max(1, Math.ceil(remainingMs / 1000));
        setSecondsLeft(secs);
        if (!warningOpenRef.current) {
          warningOpenRef.current = true;
          setWarningOpen(true);
        }
      }
    };

    const events: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click',
      'pointerdown',
    ];

    events.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));
    document.addEventListener('visibilitychange', evaluateClock);
    const intervalId = window.setInterval(evaluateClock, 1_000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleActivity));
      document.removeEventListener('visibilitychange', evaluateClock);
      window.clearInterval(intervalId);
    };
  }, [triggerTimeoutLogout]);

  if (!warningOpen) return null;

  const totalWarningSecs = Math.ceil(WARNING_LEAD_MS / 1000);
  const progressPct = Math.max(0, Math.min(100, (secondsLeft / totalWarningSecs) * 100));
  const isCritical = secondsLeft <= 15;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center modal-backdrop p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="session-timeout-title"
      aria-describedby="session-timeout-desc"
    >
      <div className="surface-card w-full max-w-md overflow-hidden shadow-2xl border border-amber-300/80 dark:border-amber-700/60">
        {/* Top urgency accent strip */}
        <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
          <div
            className={`h-full transition-all duration-1000 ease-linear ${
              isCritical ? 'bg-red-600' : 'bg-amber-500'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-start gap-3.5">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-xl shrink-0 ring-1 ring-inset ${
                isCritical
                  ? 'bg-red-50 text-red-600 ring-red-200 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-800/70'
                  : 'bg-amber-50 text-amber-600 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-800/70'
              }`}
            >
              {isCritical ? <ShieldAlert className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                {t('Peringatan Keamanan Sesi', 'Session Security Reminder')}
              </div>
              <h2
                id="session-timeout-title"
                className="font-display text-lg font-extrabold tracking-tight text-slate-900 dark:text-white"
              >
                {t('Sesi Anda Akan Segera Berakhir', 'Your Session Is About to Expire')}
              </h2>
            </div>
          </div>

          <p
            id="session-timeout-desc"
            className="text-xs leading-relaxed text-slate-600 dark:text-slate-300"
          >
            {t(
              'Tidak ada aktivitas yang terdeteksi dalam 14 menit terakhir. Demi menjaga keamanan data HRD PT Ajinomoto Indonesia, sistem akan otomatis mengeluarkan akun Anda dan kembali ke halaman login jika tidak ada konfirmasi.',
              'No activity has been detected for the past 14 minutes. To protect PT Ajinomoto Indonesia HRD data, you will be automatically signed out and returned to the login page unless you confirm.'
            )}
          </p>

          {/* Live countdown panel */}
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/90 px-4 py-3.5 dark:border-slate-800 dark:bg-slate-900/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs font-medium text-slate-700 dark:text-slate-200">
              <Clock className={`h-4 w-4 shrink-0 ${isCritical ? 'text-red-600 dark:text-red-400 animate-pulse' : 'text-amber-600 dark:text-amber-400'}`} />
              <span>{t('Logout otomatis dalam:', 'Automatic sign-out in:')}</span>
            </div>
            <div
              className={`font-mono text-xl font-extrabold tabular-nums ${
                isCritical ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-300'
              }`}
            >
              {secondsLeft} <span className="text-xs font-sans font-semibold">{t('detik', 'sec')}</span>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => void onManualLogout()}
              disabled={extending}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white transition-colors disabled:opacity-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              {t('Keluar Sekarang', 'Sign Out Now')}
            </button>
            <button
              type="button"
              autoFocus
              onClick={handleContinueSession}
              disabled={extending}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg btn-theme-primary px-4 py-2.5 text-xs font-semibold disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${extending ? 'animate-spin' : ''}`} />
              {extending
                ? t('Memperpanjang Sesi...', 'Extending Session...')
                : t('Ya, Lanjutkan Sesi', 'Yes, Continue Session')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
