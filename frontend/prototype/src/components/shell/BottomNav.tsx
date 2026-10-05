import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { usePreferences } from '../../contexts/PreferencesContext';
import { bottomItems, morePaths } from '../../data/navigation';

export function BottomNav() {
  const { t } = usePreferences();
  const { pathname } = useLocation();

  const isActive = (path: string) => {
    if (path === '/more') return morePaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  return (
    <nav
      aria-label={t('nav.main')}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas pb-[env(safe-area-inset-bottom)] md:hidden">
      
      <ul className="grid h-16 grid-cols-4">
        {bottomItems.map(({ path, labelKey, icon: Icon }) => {
          const active = isActive(path);
          return (
            <li key={path}>
              <Link
                to={path}
                aria-current={active ? 'page' : undefined}
                className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors duration-150 ${
                active ? 'text-ink' : 'text-muted hover:text-ink'}`
                }>
                
                <span
                  className={`grid h-7 w-14 place-items-center rounded-full transition-colors duration-150 ${
                  active ? 'bg-primary text-primary-fg' : ''}`
                  }>
                  
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden />
                </span>
                {t(labelKey)}
              </Link>
            </li>);

        })}
      </ul>
    </nav>);

}