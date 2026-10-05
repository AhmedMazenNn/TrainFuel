import React from 'react';
import { MoonIcon, SunIcon } from 'lucide-react';
import { BrandMark } from './BrandMark';
import { SyncStatusButton } from './SyncStatusButton';
import { usePreferences } from '../../contexts/PreferencesContext';

/** Mobile-only bar; on tablet and desktop these controls live in the sidebar and page headers. */
export function TopBar() {
  const { t, language, setLanguage, resolvedTheme, setTheme } = usePreferences();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-canvas px-4 md:hidden">
      <BrandMark />
      <div className="ms-auto flex items-center gap-0.5">
        <SyncStatusButton compact />
        <button
          type="button"
          onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
          aria-label={t('header.switchLanguage')}
          className="h-9 rounded-control px-2.5 text-[13px] font-semibold text-ink hover:bg-elevated">
          
          <span lang={language === 'en' ? 'ar' : 'en'}>{language === 'en' ? 'ع' : 'EN'}</span>
        </button>
        <button
          type="button"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          aria-label={resolvedTheme === 'dark' ? t('header.themeToLight') : t('header.themeToDark')}
          className="grid h-9 w-9 place-items-center rounded-control text-ink hover:bg-elevated">
          
          {resolvedTheme === 'dark' ? <SunIcon className="h-4 w-4" aria-hidden /> : <MoonIcon className="h-4 w-4" aria-hidden />}
        </button>
      </div>
    </header>);

}