import React from 'react';
import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { SidebarNav } from './SidebarNav';
import { TopBar } from './TopBar';
import { usePreferences } from '../../contexts/PreferencesContext';

export function AppShell() {
  const { t } = usePreferences();
  return (
    <div className="flex min-h-screen w-full bg-canvas text-ink">
      <a
        href="#main"
        className="sr-only z-50 rounded-control bg-primary px-4 py-2 font-semibold text-primary-fg focus:not-sr-only focus:fixed focus:start-4 focus:top-4">
        
        {t('common.skip')}
      </a>
      <SidebarNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main id="main" tabIndex={-1} className="w-full min-w-0 flex-1 focus:outline-none">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>);

}