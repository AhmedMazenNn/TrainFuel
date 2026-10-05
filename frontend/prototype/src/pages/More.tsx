import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRightIcon } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { usePreferences } from '../contexts/PreferencesContext';
import { moreItems } from '../data/navigation';

export function More() {
  const { t } = usePreferences();
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 pt-5 md:px-8 md:pt-8">
      <PageHeader title={t('more.title')} />
      <ul className="mt-6 divide-y divide-line overflow-hidden rounded-panel border border-line bg-surface">
        {moreItems.map(({ path, labelKey, icon: Icon }) =>
        <li key={path}>
            <Link to={path} className="flex h-16 items-center gap-4 px-5 text-ink transition-colors duration-150 hover:bg-elevated">
              <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-elevated text-primary">
                <Icon className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <span className="flex-1 font-semibold">{t(labelKey)}</span>
              <ChevronRightIcon className="h-4 w-4 text-muted rtl:rotate-180" aria-hidden />
            </Link>
          </li>
        )}
      </ul>
    </div>);

}