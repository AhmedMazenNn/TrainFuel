import React from 'react';
import { AlertCircleIcon, ArrowUpIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { usePreferences } from '../../contexts/PreferencesContext';
import { weekKeys } from '../../utils/dates';
import { NUTRIENT_KEYS, NUTRIENT_SHORT_KEY, UNIT_KEY, computeTotals } from '../../utils/nutrition';
import type { DayLog, NutrientKey } from '../../types/nutrition';

interface WeeklySummaryProps {
  selected: string;
  logs: Record<string, DayLog>;
  onSelectDay: (key: string) => void;
  onShiftWeek: (weeks: number) => void;
}

export function WeeklySummary({ selected, logs, onSelectDay, onShiftWeek }: WeeklySummaryProps) {
  const { t, date, num } = usePreferences();
  const keys = weekKeys(selected);
  const rows = keys.map((key) => {
    const log = logs[key];
    return { key, log, summary: log ? computeTotals(log.entries) : null };
  });
  const withEntries = rows.filter((r) => r.log && r.log.entries.length > 0);
  const average = (k: NutrientKey) =>
  withEntries.length === 0 ? null : withEntries.reduce((sum, r) => sum + (r.summary?.totals[k] ?? 0), 0) / withEntries.length;

  const scaleMax =
  Math.max(1, ...rows.map((r) => Math.max(r.summary?.totals.calories ?? 0, r.log?.targets.calories ?? 0))) * 1.12;

  const navBtn =
  'grid h-9 w-9 place-items-center rounded-control text-muted transition-colors duration-150 hover:bg-elevated hover:text-ink';

  return (
    <section aria-labelledby="weekly-heading" className="mt-6 rounded-panel border border-line bg-surface p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="weekly-heading" className="font-display text-xl font-bold text-ink">
            {t('history.weekly')}
          </h2>
          <p className="text-sm text-muted">
            {t('history.weekRange', {
              start: date(keys[0], { month: 'short', day: 'numeric' }),
              end: date(keys[6], { month: 'short', day: 'numeric', year: 'numeric' })
            })}
            {' · '}
            {t('history.daysLogged', { count: num(withEntries.length, 0) })}
          </p>
        </div>
        <div className="flex gap-1">
          <button type="button" onClick={() => onShiftWeek(-1)} aria-label={t('history.prevWeek')} className={navBtn}>
            <ChevronLeftIcon className="h-4 w-4 rtl:rotate-180" aria-hidden />
          </button>
          <button type="button" onClick={() => onShiftWeek(1)} aria-label={t('history.nextWeek')} className={navBtn}>
            <ChevronRightIcon className="h-4 w-4 rtl:rotate-180" aria-hidden />
          </button>
        </div>
      </div>

      <div aria-hidden className="mt-6 grid h-44 grid-cols-7 gap-2 sm:gap-4">
        {rows.map((r) => {
          const kcal = r.summary?.totals.calories ?? 0;
          const target = r.log?.targets.calories ?? 0;
          const over = r.log ? kcal > target : false;
          return (
            <div key={r.key} className="flex h-full flex-col">
              <div className="relative flex flex-1 items-end justify-center">
                {r.log ?
                <>
                    <span
                    className="absolute text-[11px] tabular-nums text-muted"
                    style={{ bottom: `calc(${kcal / scaleMax * 100}% + 4px)` }}>
                    
                      {num(kcal, 0)}
                    </span>
                    <div
                    className={`min-h-[2px] w-full max-w-10 rounded-t ${over ? 'bar-stripes bg-attention' : 'bg-primary'}`}
                    style={{ height: `${kcal / scaleMax * 100}%` }} />
                  
                    <div
                    className="absolute inset-x-0 border-t-2 border-dashed border-ink/40"
                    style={{ bottom: `${target / scaleMax * 100}%` }} />
                  
                  </> :

                <div className="flex h-full w-full max-w-10 items-center justify-center rounded border border-dashed border-line text-xs text-muted">
                    —
                  </div>
                }
              </div>
              <div className={`mt-2 text-center text-xs ${r.key === selected ? 'font-semibold text-ink' : 'text-muted'}`}>
                {date(r.key, { weekday: 'short' })}
              </div>
            </div>);

        })}
      </div>
      <p className="mt-3 text-xs text-muted">{t('history.chartNote')}</p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[22rem] text-sm tabular-nums">
          <caption className="sr-only">{t('history.tableCaption')}</caption>
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th scope="col" className="py-2 pe-2 text-start font-medium">
                {t('history.day')}
              </th>
              {NUTRIENT_KEYS.map((k) =>
              <th key={k} scope="col" className="px-2 py-2 text-end font-medium">
                  {t(NUTRIENT_SHORT_KEY[k])} <span className="font-normal">({t(UNIT_KEY[k])})</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) =>
            <tr key={r.key} className={`border-b border-line ${r.key === selected ? 'bg-primary-soft/50' : ''}`}>
                <th scope="row" className="py-2.5 pe-2 text-start font-medium">
                  <button type="button" onClick={() => onSelectDay(r.key)} className="text-ink underline-offset-4 hover:underline">
                    {date(r.key, { weekday: 'short', day: 'numeric' })}
                  </button>
                </th>
                {NUTRIENT_KEYS.map((k) =>
              <td key={k} className="px-2 py-2.5 text-end">
                    {!r.log || !r.summary ?
                <span className="text-muted">
                        —<span className="sr-only">{t('history.noLog')}</span>
                      </span> :

                <span className="inline-flex items-center justify-end gap-1 text-ink">
                        {r.summary.missing[k] > 0 &&
                  <>
                            <AlertCircleIcon className="h-3 w-3 text-attention" aria-hidden />
                            <span className="sr-only">{t('history.partial')}</span>
                          </>
                  }
                        {r.summary.totals[k] > r.log.targets[k] &&
                  <>
                            <ArrowUpIcon className="h-3 w-3 text-attention" aria-hidden />
                            <span className="sr-only">{t('history.overTarget')}</span>
                          </>
                  }
                        {num(r.summary.totals[k], 0)}
                      </span>
                }
                  </td>
              )}
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="pe-2 pt-3 text-start text-xs font-medium text-muted" title={t('history.averageHint')}>
                {t('history.average')}
              </th>
              {NUTRIENT_KEYS.map((k) => {
                const v = average(k);
                return (
                  <td key={k} className="px-2 pt-3 text-end font-semibold text-ink">
                    {v === null ? '—' : num(v, 0)}
                  </td>);

              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>);

}