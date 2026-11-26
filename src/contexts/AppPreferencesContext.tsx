import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest } from '../lib/api';
import { useRealtimeSync } from '../lib/realtime';

export type ThemeId =
  | 'ajinomoto-crimson'
  | 'mojokerto-eco'
  | 'ajiu-navy'
  | 'obsidian-dark'
  | 'aminoscience-dark';

export type Language = 'id' | 'en';

export const SESSION_TIMEOUT_OPTIONS = [5, 10, 15, 30, 60] as const;
export type SessionTimeoutMinutes = (typeof SESSION_TIMEOUT_OPTIONS)[number];

export interface ThemeDefinition {
  id: ThemeId;
  nameId: string;
  nameEn: string;
  taglineId: string;
  taglineEn: string;
  isDark: boolean;
  accentHex: string;
  accentLightHex: string;
  secondaryHex: string;
  canvasPreview: string;
  surfacePreview: string;
  swatchColors: [string, string, string];
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'ajinomoto-crimson',
    nameId: 'Ajinomoto Executive',
    nameEn: 'Ajinomoto Executive',
    taglineId: 'Terang · Merah korporat Ajinomoto & batu hangat',
    taglineEn: 'Light · Signature Ajinomoto crimson & warm stone',
    isDark: false,
    accentHex: '#DC2626',
    accentLightHex: '#F87171',
    secondaryHex: '#1E293B',
    canvasPreview: '#F5F5F2',
    surfacePreview: '#FFFFFF',
    swatchColors: ['#F5F5F2', '#DC2626', '#0F172A'],
  },
  {
    id: 'mojokerto-eco',
    nameId: 'Mojokerto Eco-Factory',
    nameEn: 'Mojokerto Eco-Factory',
    taglineId: 'Terang · Hijau Eco-Factory & standar Safety First',
    taglineEn: 'Light · Eco-Factory emerald & Safety First palette',
    isDark: false,
    accentHex: '#059669',
    accentLightHex: '#34D399',
    secondaryHex: '#134E4A',
    canvasPreview: '#F2F7F4',
    surfacePreview: '#FFFFFF',
    swatchColors: ['#F2F7F4', '#059669', '#0F2E24'],
  },
  {
    id: 'ajiu-navy',
    nameId: 'AJIU Corporate Navy',
    nameEn: 'AJIU Corporate Navy',
    taglineId: 'Terang · Biru akademis Ajinomoto Indonesia University',
    taglineEn: 'Light · Academic navy inspired by AJIU University',
    isDark: false,
    accentHex: '#1D4ED8',
    accentLightHex: '#60A5FA',
    secondaryHex: '#1E293B',
    canvasPreview: '#F3F6FB',
    surfacePreview: '#FFFFFF',
    swatchColors: ['#F3F6FB', '#1D4ED8', '#0F2557'],
  },
  {
    id: 'obsidian-dark',
    nameId: 'Industrial Obsidian',
    nameEn: 'Industrial Obsidian',
    taglineId: 'Gelap · Command center malam dengan aksen crimson',
    taglineEn: 'Dark · Midnight command center with crimson accent',
    isDark: true,
    accentHex: '#EF4444',
    accentLightHex: '#F87171',
    secondaryHex: '#94A3B8',
    canvasPreview: '#06090F',
    surfacePreview: '#0D131F',
    swatchColors: ['#06090F', '#EF4444', '#1E293B'],
  },
  {
    id: 'aminoscience-dark',
    nameId: 'AminoScience Bio-Teal',
    nameEn: 'AminoScience Bio-Teal',
    taglineId: 'Gelap · Laboratorium bioteknologi teal & obsidian',
    taglineEn: 'Dark · Biotechnology lab deep teal & slate',
    isDark: true,
    accentHex: '#14B8A6',
    accentLightHex: '#2DD4BF',
    secondaryHex: '#94A3B8',
    canvasPreview: '#041014',
    surfacePreview: '#0A1A20',
    swatchColors: ['#041014', '#14B8A6', '#134E4A'],
  },
];

interface AppPreferencesContextValue {
  themeId: ThemeId;
  theme: ThemeDefinition;
  setThemeId: (id: ThemeId) => void;
  setColorMode: (mode: 'light' | 'dark') => void;
  lang: Language;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  sessionTimeoutMinutes: SessionTimeoutMinutes;
  setSessionTimeoutMinutes: (minutes: SessionTimeoutMinutes) => void;
  t: (idText: string, enText: string) => string;
}

const AppPreferencesContext = createContext<AppPreferencesContextValue | null>(null);

function isValidThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && THEMES.some((item) => item.id === value);
}

function isValidSessionTimeout(value: unknown): value is SessionTimeoutMinutes {
  return (
    typeof value === 'number' &&
    (SESSION_TIMEOUT_OPTIONS as readonly number[]).includes(value)
  );
}

export const AppPreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Zero browser localStorage: hydrated & persisted 100% via PostgreSQL /api/preferences
  const [themeId, setThemeIdState] = useState<ThemeId>('ajinomoto-crimson');
  const [lang, setLangState] = useState<Language>('id');
  const [sessionTimeoutMinutes, setSessionTimeoutMinutesState] = useState<SessionTimeoutMinutes>(15);
  const lastLightThemeRef = useRef<ThemeId>('ajinomoto-crimson');
  const lastDarkThemeRef = useRef<ThemeId>('obsidian-dark');
  const latestLocalSaveRef = useRef<number>(0);

  const rememberThemeByMode = useCallback((id: ThemeId) => {
    const def = THEMES.find((item) => item.id === id);
    if (!def) return;
    if (def.isDark) {
      lastDarkThemeRef.current = id;
    } else {
      lastLightThemeRef.current = id;
    }
  }, []);

  const loadFromServer = useCallback(async () => {
    try {
      const res = await apiRequest<{
        themeId?: string;
        lang?: string;
        sessionTimeoutMinutes?: number;
      }>('/api/preferences');
      if (isValidThemeId(res?.themeId)) {
        setThemeIdState(res.themeId);
        rememberThemeByMode(res.themeId);
      }
      if (res?.lang === 'id' || res?.lang === 'en') {
        setLangState(res.lang);
      }
      if (isValidSessionTimeout(res?.sessionTimeoutMinutes)) {
        setSessionTimeoutMinutesState(res.sessionTimeoutMinutes);
      }
    } catch {
      // keep active in-memory defaults if offline
    }
  }, [rememberThemeByMode]);

  useEffect(() => {
    void loadFromServer();
    const onAuthChanged = () => {
      void loadFromServer();
    };
    window.addEventListener('ajinomoto:auth-changed', onAuthChanged);
    return () => {
      window.removeEventListener('ajinomoto:auth-changed', onAuthChanged);
    };
  }, [loadFromServer]);

  useRealtimeSync(['preferences', 'all'], (ev) => {
    // Avoid snapping back while an optimistic local save is in flight
    if (Date.now() - latestLocalSaveRef.current < 400) return;
    const meta = ev.meta;
    if (meta && isValidThemeId(meta.themeId) && (meta.lang === 'id' || meta.lang === 'en')) {
      setThemeIdState(meta.themeId);
      rememberThemeByMode(meta.themeId);
      setLangState(meta.lang);
      if (isValidSessionTimeout(meta.sessionTimeoutMinutes)) {
        setSessionTimeoutMinutesState(meta.sessionTimeoutMinutes);
      }
      return;
    }
    void loadFromServer();
  });

  const theme = useMemo(
    () => THEMES.find((item) => item.id === themeId) || THEMES[0],
    [themeId]
  );

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme.id;
    if (theme.isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const persistPreferences = useCallback(
    (next: {
      themeId?: ThemeId;
      lang?: Language;
      sessionTimeoutMinutes?: SessionTimeoutMinutes;
    }) => {
      latestLocalSaveRef.current = Date.now();
      void apiRequest('/api/preferences', {
        method: 'PUT',
        body: JSON.stringify(next),
      }).catch(() => {
        // ignore transient network failures
      });
    },
    []
  );

  const setThemeId = useCallback(
    (id: ThemeId) => {
      setThemeIdState(id);
      rememberThemeByMode(id);
      persistPreferences({ themeId: id });
    },
    [persistPreferences, rememberThemeByMode]
  );

  const setColorMode = useCallback(
    (mode: 'light' | 'dark') => {
      const currentlyDark = (THEMES.find((item) => item.id === themeId) || THEMES[0]).isDark;
      if (mode === 'light' && !currentlyDark) return;
      if (mode === 'dark' && currentlyDark) return;
      const targetId = mode === 'dark' ? lastDarkThemeRef.current : lastLightThemeRef.current;
      setThemeId(targetId);
    },
    [themeId, setThemeId]
  );

  const setLang = useCallback(
    (next: Language) => {
      setLangState(next);
      persistPreferences({ lang: next });
    },
    [persistPreferences]
  );

  const toggleLang = useCallback(() => {
    setLangState((prev) => {
      const next: Language = prev === 'id' ? 'en' : 'id';
      persistPreferences({ lang: next });
      return next;
    });
  }, [persistPreferences]);

  const setSessionTimeoutMinutes = useCallback(
    (minutes: SessionTimeoutMinutes) => {
      setSessionTimeoutMinutesState(minutes);
      persistPreferences({ sessionTimeoutMinutes: minutes });
    },
    [persistPreferences]
  );

  const t = useCallback(
    (idText: string, enText: string) => (lang === 'en' ? enText : idText),
    [lang]
  );

  const value = useMemo<AppPreferencesContextValue>(
    () => ({
      themeId,
      theme,
      setThemeId,
      setColorMode,
      lang,
      setLang,
      toggleLang,
      sessionTimeoutMinutes,
      setSessionTimeoutMinutes,
      t,
    }),
    [
      themeId,
      theme,
      setThemeId,
      setColorMode,
      lang,
      setLang,
      toggleLang,
      sessionTimeoutMinutes,
      setSessionTimeoutMinutes,
      t,
    ]
  );

  return (
    <AppPreferencesContext.Provider value={value}>
      {children}
    </AppPreferencesContext.Provider>
  );
};

export function useAppPreferences(): AppPreferencesContextValue {
  const ctx = useContext(AppPreferencesContext);
  if (!ctx) {
    throw new Error('useAppPreferences must be used within AppPreferencesProvider');
  }
  return ctx;
}
