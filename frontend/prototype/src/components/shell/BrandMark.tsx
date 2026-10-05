import React from 'react';
import { usePreferences } from '../../contexts/PreferencesContext';

export function BrandMark({ collapsible = false }: {collapsible?: boolean;}) {
  const { t } = usePreferences();
  return (
    <div className="flex items-center gap-2.5" dir="ltr">
      <span aria-hidden className="relative grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-primary">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-primary-fg" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
          <path d="M6 18V6h9" />
          <path d="M6 12h6" />
          <path d="M15 15l3 3" />
        </svg>
      </span>
      <span className={`font-display text-lg font-extrabold tracking-tight text-ink ${collapsible ? 'md:hidden lg:inline' : ''}`}>
        {t('app.name')}
      </span>
    </div>);

}