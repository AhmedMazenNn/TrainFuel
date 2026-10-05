import React, { useEffect, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { usePreferences } from '../contexts/PreferencesContext';
import { dayOfMonth, shiftDateKey, todayKey, weekKeys } from '../utils/dates';
import { computeTotals } from '../utils/nutrition';
import type { DayLog } from '../types/nutrition';

interface WeekStripProps {
  selected: string;
  onSelect: (key: string) => void;
  logs: Record<string, DayLog>;
}

export function WeekStrip({ selected, onSelect, logs }: WeekStripProps) {
  const { t, date, num } = usePreferences();
  const [anchor, setAnchor] = useState(selected);
  const today = todayKey();
  useEffect(() => setAnchor(selected), [selected]);

  const navBtn =
  'grid h-10 w-8 shrink-0 place-items-center rounded-control text-muted transition-colors duration-150 hover:bg-surface hover:text-ink sm:w-10';

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <button type="button" onClick={() => setAnchor(shiftDateKey(anchor, -7))} aria-label={t('week.prev')} className={navBtn}>
        <ChevronLeftIcon className="h-5 w-5 rtl:rotate-180" aria-hidden />
      </button>
      <div className="grid min-w-0 flex-1 grid-cols-7 gap-1 sm:gap-2">
        {weekKeys(anchor).map((key) => {
          const log = logs[key];
          const isSelected = key === selected;
          const isToday = key === today;
          const ratio = log && log.targets.calories > 0 ? computeTotals(log.entries).totals.calories / log.targets.calories : 0;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              aria-pressed={isSelected}
              aria-label={`${date(key, { weekday: 'long', month: 'long', day: 'numeric' })}${log ? `, ${t('week.hasLog')}` : ''}`}
              className={`group flex h-[68px] min-w-0 flex-col items-center justify-center rounded-card border px-1 transition-colors duration-150 sm:h-[76px] ${
              isSelected ?
              'border-primary bg-primary text-primary-fg' :
              'border-line bg-surface text-ink hover:border-muted/40'}`
              }>
              
              <span className={`text-[11px] font-semibold ${isSelected ? 'text-primary-fg/75' : 'text-muted'}`}>
                {isToday ? t('today.isToday') : date(key, { weekday: 'short' })}
              </span>
              <span className="tnum font-display text-lg font-extrabold leading-tight sm:text-xl">{num(dayOfMonth(key), 0)}</span>
              <span
                aria-hidden
                className={`mt-1 h-1 w-6 overflow-hidden rounded-full sm:w-8 ${
                log ? isSelected ? 'bg-primary-fg/25' : 'bg-elevated' : `border border-dashed ${isSelected ? 'border-primary-fg/40' : 'border-line'}`}`
                }>
                
                {log &&
                <span
                  className={`block h-full rounded-full ${isSelected ? 'bg-primary-fg' : ratio > 1 ? 'bg-attention' : 'bg-primary'}`}
                  style={{ width: `${Math.min(100, ratio * 100)}%` }} />

                }
              </span>
            </button>);

        })}
      </div>
      <button type="button" onClick={() => setAnchor(shiftDateKey(anchor, 7))} aria-label={t('week.next')} className={navBtn}>
        <ChevronRightIcon className="h-5 w-5 rtl:rotate-180" aria-hidden />
      </button>
    </div>);

}