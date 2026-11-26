import React, { useEffect, useRef, useState } from 'react';
import { Check, Clock, Globe, Moon, Palette, Sun } from 'lucide-react';
import {
  SESSION_TIMEOUT_OPTIONS,
  THEMES,
  type Language,
  type SessionTimeoutMinutes,
  type ThemeId,
  useAppPreferences,
} from '../contexts/AppPreferencesContext';

export const ThemeLanguageControls: React.FC<{
  variant?: 'header' | 'login' | 'compact';
  align?: 'right' | 'left';
  showSessionTimeout?: boolean;
}> = ({ variant = 'header', align = 'right', showSessionTimeout = false }) => {
  const {
    themeId,
    theme,
    setThemeId,
    setColorMode,
    lang,
    setLang,
    sessionTimeoutMinutes,
    setSessionTimeoutMinutes,
    t,
  } = useAppPreferences();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handleLangChange = (next: Language) => {
    setLang(next);
  };

  return (
    <div ref={containerRef} className="relative inline-flex items-center gap-1.5 sm:gap-2 shrink-0">
      {/* Compact ID / EN Language Switcher */}
      <div
        role="group"
        aria-label={t('Pilih Bahasa', 'Select Language')}
        className={`inline-flex items-center rounded-lg border border-slate-200/90 bg-white/95 p-0.5 shadow-2xs dark:border-slate-700/90 dark:bg-slate-900/95 shrink-0 ${
          variant === 'compact' ? 'h-8' : ''
        }`}
      >
        <button
          type="button"
          onClick={() => handleLangChange('id')}
          aria-pressed={lang === 'id'}
          className={`rounded-md px-2 py-1 text-[11px] font-bold tracking-wide transition-colors whitespace-nowrap ${
            lang === 'id'
              ? 'bg-theme-accent text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-200 dark:hover:text-slate-100'
          }`}
          title="Bahasa Indonesia"
        >
          ID
        </button>
        <button
          type="button"
          onClick={() => handleLangChange('en')}
          aria-pressed={lang === 'en'}
          className={`rounded-md px-2 py-1 text-[11px] font-bold tracking-wide transition-colors whitespace-nowrap ${
            lang === 'en'
              ? 'bg-theme-accent text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-200 dark:hover:text-slate-100'
          }`}
          title="English"
        >
          EN
        </button>
      </div>

      {/* Theme Palette Picker Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t('Pilih Tema Tampilan', 'Select UI Theme')}
        title={t('Ubah Tema Tampilan & Sesi', 'Switch UI Theme & Session')}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-200/90 bg-white/95 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700/90 dark:bg-slate-900/95 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 ${
          variant === 'compact' ? 'h-8 px-2' : 'px-2.5 py-1.5'
        }`}
      >
        <span
          className="h-3 w-3 rounded-full ring-1 ring-black/10 dark:ring-white/20 shrink-0"
          style={{ backgroundColor: theme.accentHex }}
        />
        <Palette className="h-3.5 w-3.5 text-slate-500 dark:text-slate-200 shrink-0" />
        {variant === 'login' && (
          <span className="hidden sm:inline max-w-[116px] truncate">
            {lang === 'en' ? theme.nameEn : theme.nameId}
          </span>
        )}
      </button>

      {/* Theme Popover Menu */}
      {open && (
        <div
          className={`absolute top-full mt-2 z-50 w-76 sm:w-84 rounded-2xl border border-slate-200/90 bg-white/98 p-3 shadow-2xl backdrop-blur-md dark:border-slate-700/90 dark:bg-[#0D131F]/98 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5 mb-2.5 dark:border-slate-800">
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {t('Mode & Tema Tampilan', 'Display Mode & Theme')}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-300 truncate">
                {t('Berlaku di seluruh portal & dashboard', 'Applied across all portal & dashboard views')}
              </div>
            </div>
            <div
              role="group"
              aria-label={t('Mode Tampilan', 'Display Mode')}
              className="inline-flex items-center rounded-lg bg-slate-100 p-0.5 ring-1 ring-slate-200/70 dark:bg-slate-800/90 dark:ring-slate-700/80 shrink-0"
            >
              <button
                type="button"
                onClick={() => setColorMode('light')}
                aria-pressed={!theme.isDark}
                className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-all ${
                  !theme.isDark
                    ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {t('Terang', 'Light')}
              </button>
              <button
                type="button"
                onClick={() => setColorMode('dark')}
                aria-pressed={theme.isDark}
                className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-all ${
                  theme.isDark
                    ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {t('Gelap', 'Dark')}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            {THEMES.map((item) => {
              const active = item.id === themeId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setThemeId(item.id as ThemeId);
                    if (!showSessionTimeout) setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition-all ${
                    active
                      ? 'border-theme-accent bg-theme-soft'
                      : 'border-slate-200/70 bg-white/60 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Swatch tri-bar preview */}
                    <div className="flex h-7 w-7 overflow-hidden rounded-lg border border-slate-300/70 dark:border-slate-700 shrink-0 shadow-2xs">
                      <span className="w-1/2 h-full" style={{ backgroundColor: item.swatchColors[0] }} />
                      <span className="w-1/4 h-full" style={{ backgroundColor: item.swatchColors[1] }} />
                      <span className="w-1/4 h-full" style={{ backgroundColor: item.swatchColors[2] }} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {lang === 'en' ? item.nameEn : item.nameId}
                        </span>
                        {item.isDark ? (
                          <Moon className="h-3 w-3 text-slate-400 dark:text-slate-300 shrink-0" />
                        ) : (
                          <Sun className="h-3 w-3 text-amber-500 shrink-0" />
                        )}
                      </div>
                      <div className="text-[10.5px] text-slate-500 dark:text-slate-300 truncate">
                        {lang === 'en' ? item.taglineEn : item.taglineId}
                      </div>
                    </div>
                  </div>
                  {active && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-theme-accent text-white shrink-0">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {showSessionTimeout && (
            <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
                <Clock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{t('Batas Waktu Sesi (Auto-Logout)', 'Session Timeout (Auto-Logout)')}</span>
              </div>
              <div
                role="group"
                aria-label={t('Durasi Auto-Logout', 'Auto-Logout Duration')}
                className="grid grid-cols-5 gap-1 rounded-xl bg-slate-100/95 p-1 ring-1 ring-slate-200/70 dark:bg-slate-800/90 dark:ring-slate-700/80"
              >
                {SESSION_TIMEOUT_OPTIONS.map((minutes) => {
                  const active = sessionTimeoutMinutes === minutes;
                  return (
                    <button
                      key={minutes}
                      type="button"
                      onClick={() => setSessionTimeoutMinutes(minutes as SessionTimeoutMinutes)}
                      aria-pressed={active}
                      className={`rounded-lg py-1.5 font-mono text-xs tabular-nums transition-all ${
                        active
                          ? 'bg-white font-bold text-slate-900 shadow-xs ring-1 ring-slate-200/80 dark:bg-slate-700 dark:text-white dark:ring-slate-600'
                          : 'font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      {minutes}m
                    </button>
                  );
                })}
              </div>
              <p className="text-[10.5px] leading-snug text-slate-500 dark:text-slate-300">
                {t(
                  'Otomatis kembali ke Login saat tab browser ditutup atau tidak aktif sesuai durasi pilihan.',
                  'Automatically returns to Login when the browser tab is closed or inactive for the selected duration.'
                )}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const AppearanceSettingsPanel: React.FC = () => {
  const {
    themeId,
    theme,
    setThemeId,
    setColorMode,
    lang,
    setLang,
    sessionTimeoutMinutes,
    setSessionTimeoutMinutes,
    t,
  } = useAppPreferences();

  return (
    <div className="surface-card p-6 space-y-5">
      {/* Display Mode (Terang / Gelap) + Language (Indonesia / English) Row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 sm:gap-5">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {t('Mode Tampilan', 'Display Mode')}
          </span>
          <div
            role="group"
            aria-label={t('Mode Tampilan', 'Display Mode')}
            className="inline-flex items-center rounded-xl bg-slate-100/95 p-1 ring-1 ring-slate-200/75 dark:bg-slate-800/90 dark:ring-slate-700/80"
          >
            <button
              type="button"
              onClick={() => setColorMode('light')}
              aria-pressed={!theme.isDark}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
                !theme.isDark
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-700 dark:text-white dark:ring-slate-600'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {t('Terang', 'Light')}
            </button>
            <button
              type="button"
              onClick={() => setColorMode('dark')}
              aria-pressed={theme.isDark}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
                theme.isDark
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-700 dark:text-white dark:ring-slate-600'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {t('Gelap', 'Dark')}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:gap-5">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
            <Globe className="h-4 w-4 text-slate-400 dark:text-slate-400 shrink-0" />
            {t('Bahasa', 'Language')}
          </span>
          <div
            role="group"
            aria-label={t('Bahasa', 'Language')}
            className="inline-flex items-center rounded-xl bg-slate-100/95 p-1 ring-1 ring-slate-200/75 dark:bg-slate-800/90 dark:ring-slate-700/80"
          >
            <button
              type="button"
              onClick={() => setLang('id')}
              aria-pressed={lang === 'id'}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
                lang === 'id'
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-700 dark:text-white dark:ring-slate-600'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Indonesia
            </button>
            <button
              type="button"
              onClick={() => setLang('en')}
              aria-pressed={lang === 'en'}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
                lang === 'en'
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-700 dark:text-white dark:ring-slate-600'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              English
            </button>
          </div>
        </div>
      </div>

      {/* Session Timeout (Auto-Logout) Row */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-5 dark:border-slate-800">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <Clock className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {t('Batas Waktu Sesi (Auto-Logout)', 'Session Timeout (Auto-Logout)')}
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-300">
            {t(
              'Otomatis kembali ke Login saat tab browser ditutup atau tidak aktif sesuai durasi pilihan.',
              'Automatically returns to Login when the browser tab is closed or inactive for the selected duration.'
            )}
          </p>
        </div>

        <div
          role="group"
          aria-label={t('Batas Waktu Sesi (Auto-Logout)', 'Session Timeout (Auto-Logout)')}
          className="inline-flex items-center rounded-xl bg-slate-100/95 p-1 ring-1 ring-slate-200/75 dark:bg-slate-800/90 dark:ring-slate-700/80 shrink-0"
        >
          {SESSION_TIMEOUT_OPTIONS.map((minutes) => {
            const active = sessionTimeoutMinutes === minutes;
            return (
              <button
                key={minutes}
                type="button"
                onClick={() => setSessionTimeoutMinutes(minutes as SessionTimeoutMinutes)}
                aria-pressed={active}
                className={`rounded-lg px-3.5 py-1.5 font-mono text-xs tabular-nums transition-all whitespace-nowrap ${
                  active
                    ? 'bg-white font-bold text-slate-900 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-700 dark:text-white dark:ring-slate-600'
                    : 'font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {minutes}m
              </button>
            );
          })}
        </div>
      </div>

      {/* Corporate Theme Presets Gallery */}
      <div className="border-t border-slate-100 pt-5 dark:border-slate-800 space-y-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl icon-theme-plinth shrink-0">
            <Palette className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
              {t('Palet Tema Korporat', 'Corporate Theme Presets')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-300">
              {t(
                'Pilih variasi warna aksen terang atau gelap untuk seluruh halaman portal & dashboard.',
                'Choose a light or dark corporate accent palette across all portal & dashboard pages.'
              )}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {THEMES.map((item) => {
            const active = item.id === themeId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setThemeId(item.id)}
                className={`group flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all ${
                  active
                    ? 'border-theme-accent bg-theme-soft ring-1 ring-[var(--theme-accent-soft-border)]'
                    : 'border-slate-200/80 bg-white/80 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700'
                }`}
              >
                {/* Mini UI Preview Card */}
                <div
                  className="mb-3 h-16 w-full rounded-lg border border-slate-200/70 dark:border-slate-700/70 p-2 flex flex-col justify-between overflow-hidden"
                  style={{ backgroundColor: item.canvasPreview }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="h-2 w-10 rounded-xs"
                      style={{ backgroundColor: item.swatchColors[2], opacity: 0.7 }}
                    />
                    <span
                      className="h-2.5 w-6 rounded-xs"
                      style={{ backgroundColor: item.accentHex }}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div
                      className="h-6 rounded-sm border border-black/5"
                      style={{ backgroundColor: item.surfacePreview }}
                    />
                    <div
                      className="h-6 rounded-sm border border-black/5"
                      style={{ backgroundColor: item.surfacePreview }}
                    />
                    <div
                      className="h-6 rounded-sm"
                      style={{ backgroundColor: item.accentHex, opacity: 0.85 }}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {lang === 'en' ? item.nameEn : item.nameId}
                    </span>
                    {active ? (
                      <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-theme-accent text-white shrink-0">
                        <Check className="h-2.5 w-2.5" />
                      </span>
                    ) : item.isDark ? (
                      <Moon className="h-3.5 w-3.5 text-slate-400 dark:text-slate-300 shrink-0" />
                    ) : (
                      <Sun className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-300">
                    {lang === 'en' ? item.taglineEn : item.taglineId}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
