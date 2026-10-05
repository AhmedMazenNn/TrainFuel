import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { translations } from '../data/translations';
import type { TranslationKey } from '../data/translations';
import { formatDateKey, formatNumber } from '../utils/format';
import type { Language, Theme } from '../types/preferences';

interface PreferencesValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
  dir: 'ltr' | 'rtl';
  displayName: string;
  setDisplayName: (name: string) => void;
  storePhotosLocally: boolean;
  setStorePhotosLocally: (v: boolean) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  num: (value: number, maxFractionDigits?: number) => string;
  date: (key: string, options: Intl.DateTimeFormatOptions) => string;
}

const PreferencesContext = createContext<PreferencesValue | null>(null);

function readStored<T extends string>(key: string, allowed: readonly T[] | null, fallback: T): T {
  try {
    const v = window.localStorage.getItem(key);
    if (v === null) return fallback;
    return !allowed || (allowed as readonly string[]).includes(v) ? v as T : fallback;
  } catch {
    return fallback;
  }
}

export function PreferencesProvider({ children }: {children: React.ReactNode;}) {
  const [language, setLanguage] = useState<Language>(() => readStored('formlog.language', ['en', 'ar'] as const, 'en'));
  const [theme, setTheme] = useState<Theme>(() => readStored('formlog.theme', ['light', 'dark', 'system'] as const, 'dark'));
  const [displayName, setDisplayName] = useState(() => readStored<string>('formlog.displayName', null, 'Sam'));
  const [storePhotosLocally, setStorePhotosLocally] = useState(
    () => readStored('formlog.storePhotos', ['true', 'false'] as const, 'false') === 'true'
  );
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolvedTheme = theme === 'system' ? systemDark ? 'dark' : 'light' : theme;
  const dir = language === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    window.localStorage.setItem('formlog.language', language);
    document.documentElement.lang = language;
    document.documentElement.dir = dir;
  }, [language, dir]);

  useEffect(() => {
    window.localStorage.setItem('formlog.theme', theme);
    const root = document.documentElement.classList;
    root.toggle('dark', resolvedTheme === 'dark');
    root.toggle('light', resolvedTheme === 'light');
  }, [theme, resolvedTheme]);

  useEffect(() => window.localStorage.setItem('formlog.displayName', displayName), [displayName]);
  useEffect(() => window.localStorage.setItem('formlog.storePhotos', String(storePhotosLocally)), [storePhotosLocally]);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      let s = translations[language][key] ?? translations.en[key] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
      return s;
    },
    [language]
  );
  const num = useCallback((value: number, max = 1) => formatNumber(value, language, max), [language]);
  const date = useCallback((key: string, options: Intl.DateTimeFormatOptions) => formatDateKey(key, language, options), [language]);

  const value = useMemo<PreferencesValue>(
    () => ({
      language,
      setLanguage,
      theme,
      setTheme,
      resolvedTheme,
      dir,
      displayName,
      setDisplayName,
      storePhotosLocally,
      setStorePhotosLocally,
      t,
      num,
      date
    }),
    [language, theme, resolvedTheme, dir, displayName, storePhotosLocally, t, num, date]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}