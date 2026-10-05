import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRightIcon, ChevronRightIcon } from 'lucide-react';
import { Panel } from '../Panel';
import { usePreferences } from '../../contexts/PreferencesContext';
import { useTraining } from '../../contexts/TrainingContext';
import { daysBetween, todayKey } from '../../utils/dates';

export function TrainingShortcut() {
  const { t, num } = usePreferences();
  const { folders, records, getExercise, status } = useTraining();
  const latest = [...records].filter((r) => !r.referenceOnly).sort((a, b) => a.date < b.date ? 1 : -1)[0];
  const latestExercise = latest ? getExercise(latest.exerciseId) : undefined;
  const ago = latest ? daysBetween(latest.date, todayKey()) : 0;

  return (
    <Panel aria-labelledby="training-shortcut">
      <div className="flex items-center justify-between">
        <h2 id="training-shortcut" className="font-display text-lg font-bold text-ink">
          {t('shortcut.training')}
        </h2>
        <Link to="/folders" className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline">
          {t('nav.folders')}
          <ArrowUpRightIcon className="h-3.5 w-3.5 rtl:-scale-x-100" aria-hidden />
        </Link>
      </div>

      {status === 'loading' ?
      <div className="mt-4 h-32 rounded-card bg-elevated motion-safe:animate-pulse" /> :

      <ul className="mt-3 divide-y divide-line">
          {folders.slice(0, 3).map((f) =>
        <li key={f.id}>
              <Link to={`/folders/${f.id}`} className="group flex items-center gap-3 py-3">
                <span
              aria-hidden
              className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-elevated font-display text-sm font-extrabold text-primary">
              
                  {f.name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink group-hover:underline">{f.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {f.items.
                map((i) => getExercise(i.exerciseId)?.name).
                filter(Boolean).
                join(' · ') || t('folders.empty.short')}
                  </span>
                </span>
                <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted rtl:rotate-180" aria-hidden />
              </Link>
            </li>
        )}
        </ul>
      }

      {latest && latestExercise &&
      <Link
        to={`/exercises/${latestExercise.id}`}
        className="mt-3 block rounded-card bg-elevated p-4 transition-colors duration-150 hover:bg-elevated/70">
        
          <span className="text-xs font-semibold text-muted">{t('shortcut.latestRecord')}</span>
          <span className="mt-1 flex items-baseline justify-between gap-3">
            <span className="truncate text-sm font-semibold text-ink">{latestExercise.name}</span>
            <span className="tnum shrink-0 font-display text-lg font-extrabold text-ink">
              {num(latest.weight)}
              <span className="text-xs font-semibold text-muted"> {t('unit.kg')}</span> × {num(latest.reps, 0)}
            </span>
          </span>
          <span className="mt-0.5 block text-xs text-muted">
            {ago === 0 ? t('time.today') : t('time.daysAgo', { count: num(ago, 0) })}
          </span>
        </Link>
      }
    </Panel>);

}