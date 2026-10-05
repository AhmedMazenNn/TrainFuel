import React from 'react';
import { NavLink } from 'react-router-dom';
import { MoonIcon, SunIcon } from 'lucide-react';
import { BrandMark } from './BrandMark';
import { usePreferences } from '../../contexts/PreferencesContext';
import { sidebarItems } from '../../data/navigation';

export function SidebarNav() {
  const { t, language, setLanguage, resolvedTheme, setTheme, displayName } = usePreferences();
  const control =
  'grid h-9 place-items-center rounded-control text-[13px] font-semibold text-muted transition-colors duration-150 hover:bg-elevated hover:text-ink';

  return (
    <aside className="sticky top-0 hidden h-screen w-[84px] shrink-0 flex-col border-e border-line bg-canvas px-3 py-5 md:flex lg:w-[232px] lg:px-4">
      <div className="flex justify-center px-1 lg:justify-start">
        <BrandMark collapsible />
      </div>
      <nav aria-label={t('nav.main')} className="mt-8 flex-1">
        <ul className="space-y-1">
          {sidebarItems.map(({ path, labelKey, icon: Icon }) =>
          <li key={path}>
              <NavLink
              to={path}
              end={path === '/'}
              title={t(labelKey)}
              className={({ isActive }) =>
              `group relative flex h-11 items-center justify-center gap-3 rounded-control px-3 text-sm font-semibold transition-colors duration-150 lg:justify-start ${
              isActive ? 'bg-surface text-ink' : 'text-muted hover:bg-surface/60 hover:text-ink'}`

              }>
              
                {({ isActive }) =>
              <>
                    <span
                  aria-hidden
                  className={`absolute inset-y-2.5 start-0 w-[3px] rounded-full transition-colors duration-150 ${
                  isActive ? 'bg-primary' : 'bg-transparent'}`
                  } />
                
                    <Icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-primary' : ''}`} strokeWidth={2} aria-hidden />
                    <span className="hidden truncate lg:inline">{t(labelKey)}</span>
                  </>
              }
              </NavLink>
            </li>
          )}
        </ul>
      </nav>

      <div className="space-y-3 border-t border-line pt-4">
        <div className="grid grid-cols-1 gap-1 lg:grid-cols-2">
          <button
            type="button"
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            aria-label={t('header.switchLanguage')}
            className={control}>
            
            <span lang={language === 'en' ? 'ar' : 'en'}>{language === 'en' ? 'ع' : 'EN'}</span>
          </button>
          <button
            type="button"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            aria-label={resolvedTheme === 'dark' ? t('header.themeToLight') : t('header.themeToDark')}
            className={control}>
            
            {resolvedTheme === 'dark' ? <SunIcon className="h-4 w-4" aria-hidden /> : <MoonIcon className="h-4 w-4" aria-hidden />}
          </button>
        </div>
        <NavLink
          to="/settings"
          className="flex items-center justify-center gap-3 rounded-control p-1.5 transition-colors duration-150 hover:bg-surface lg:justify-start">
          
          <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-elevated font-display text-sm font-bold text-primary">
            {displayName.trim().charAt(0).toUpperCase() || 'F'}
          </span>
          <span className="hidden min-w-0 leading-tight lg:block">
            <span className="block truncate text-sm font-semibold text-ink">{displayName || t('header.demoUser')}</span>
            <span className="block text-xs text-attention">{t('header.demoSession')}</span>
          </span>
          <span className="sr-only lg:hidden">
            {displayName}, {t('header.demoSession')}
          </span>
        </NavLink>
      </div>
    </aside>);

}