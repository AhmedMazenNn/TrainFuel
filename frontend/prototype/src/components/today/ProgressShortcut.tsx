import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRightIcon, LockIcon } from 'lucide-react';
import { Panel } from '../Panel';
import { usePreferences } from '../../contexts/PreferencesContext';
import { useProgress } from '../../contexts/ProgressContext';
import { todayKey, weekStartKey } from '../../utils/dates';
import { PHOTOS_PER_WEEK } from '../../types/progress';

function Sparkline({ values }: {values: number[];}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${i / (values.length - 1) * 100},${30 - (v - min) / span * 26}`).join(' ');
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-10 w-full rtl:-scale-x-100" aria-hidden>
      <polyline points={pts} fill="none" className="stroke-primary" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>);

}

export function ProgressShortcut() {
  const { t, num, date } = usePreferences();
  const { weights, usedSlots, status } = useProgress();
  const latest = weights[weights.length - 1];
  const reference = weights.length > 4 ? weights[weights.length - 5] : weights[0];
  const delta = latest && reference ? Math.round((latest.weight - reference.weight) * 10) / 10 : 0;
  const used = usedSlots(weekStartKey(todayKey()));

  return (
    <Panel aria-labelledby="progress-shortcut">
      <div className="flex items-center justify-between">
        <h2 id="progress-shortcut" className="font-display text-lg font-bold text-ink">
          {t('nav.progress')}
        </h2>
        <Link to="/progress" className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline">
          {t('shortcut.open')}
          <ArrowUpRightIcon className="h-3.5 w-3.5 rtl:-scale-x-100" aria-hidden />
        </Link>
      </div>

      {status === 'loading' ?
      <div className="mt-4 h-32 rounded-card bg-elevated motion-safe:animate-pulse" /> :
      latest ?
      <>
          <div className="mt-3 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-muted">{t('progress.latestWeight')}</p>
              <p className="tnum mt-1 font-display text-4xl font-extrabold leading-none text-ink">
                {num(latest.weight)}
                <span className="ms-1 text-base font-semibold text-muted">{t('unit.kg')}</span>
              </p>
              {reference && reference !== latest &&
            <p className="tnum mt-1.5 text-xs text-muted">
                  {t('progress.changeSince', {
                value: `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${num(Math.abs(delta))}`,
                date: date(reference.date, { month: 'short', day: 'numeric' })
              })}
                </p>
            }
            </div>
            <div className="w-28">
              <Sparkline values={weights.slice(-8).map((w) => w.weight)} />
            </div>
          </div>
        </> :

      <p className="mt-3 text-sm text-muted">{t('progress.noWeights')}</p>
      }

      <div className="mt-4 flex items-center justify-between gap-3 rounded-card bg-elevated p-4">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
            <LockIcon className="h-3 w-3" aria-hidden />
            {t('progress.thisWeekPhotos')}
          </p>
          <p className="tnum mt-1 font-display text-lg font-extrabold text-ink">
            {num(used, 0)}/{num(PHOTOS_PER_WEEK, 0)}
          </p>
        </div>
        <div className="flex gap-1.5" aria-hidden>
          {Array.from({ length: PHOTOS_PER_WEEK }, (_, i) =>
          <span key={i} className={`h-8 w-6 rounded-[6px] ${i < used ? 'bg-primary' : 'border border-dashed border-muted/50'}`} />
          )}
        </div>
      </div>
    </Panel>);

}