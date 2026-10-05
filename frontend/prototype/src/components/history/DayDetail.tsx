import React from 'react';
import { AlertCircleIcon, ArrowUpIcon, CalendarPlusIcon, CalendarXIcon, PlusIcon } from 'lucide-react';
import { Button } from '../Button';
import { EmptyState } from '../EmptyState';
import { Panel } from '../Panel';
import { ProgressBar } from '../ProgressBar';
import { FoodEntryRow } from '../food/FoodEntryRow';
import { usePreferences } from '../../contexts/PreferencesContext';
import { NUTRIENT_COLOR, NUTRIENT_KEYS, NUTRIENT_SHORT_KEY, UNIT_KEY, computeTotals } from '../../utils/nutrition';
import type { DayLog, FoodEntry } from '../../types/nutrition';

interface DayDetailProps {
  dateKey: string;
  log?: DayLog;
  onStartLog: () => void;
  onAdd: () => void;
  onEdit: (entry: FoodEntry) => void;
  onDelete: (entry: FoodEntry) => void;
}

export function DayDetail({ dateKey, log, onStartLog, onAdd, onEdit, onDelete }: DayDetailProps) {
  const { t, date, num } = usePreferences();
  const summary = log ? computeTotals(log.entries) : null;
  const statusText = !log ?
  t('history.noLog') :
  log.entries.length === 0 ?
  t('history.loggedEmpty') :
  t('today.entryCount', { count: num(log.entries.length, 0) });

  return (
    <Panel aria-labelledby="day-detail-heading" padded={false}>
      <header className="flex flex-wrap items-start justify-between gap-3 p-5 md:p-6">
        <div>
          <h2 id="day-detail-heading" className="font-display text-2xl font-extrabold tracking-tight text-ink">
            {date(dateKey, { weekday: 'long', month: 'long', day: 'numeric' })}
          </h2>
          <p className="mt-0.5 text-sm text-muted">{statusText}</p>
        </div>
        {log &&
        <Button variant="secondary" size="sm" icon={PlusIcon} onClick={onAdd}>
            {t('today.addFood')}
          </Button>
        }
      </header>

      {!log || !summary ?
      <EmptyState
        icon={CalendarXIcon}
        title={t('history.noLog')}
        body={t('history.noLogBody')}
        action={
        <Button variant="secondary" icon={CalendarPlusIcon} onClick={onStartLog}>
              {t('history.startLog')}
            </Button>
        } /> :


      <>
          <dl className="grid grid-cols-2 gap-px border-y border-line bg-line sm:grid-cols-4">
            {NUTRIENT_KEYS.map((k) => {
            const consumed = summary.totals[k];
            const target = log.targets[k];
            return (
              <div key={k} className="bg-surface p-4">
                  <dt className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                    <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${NUTRIENT_COLOR[k].bg}`} />
                    {t(NUTRIENT_SHORT_KEY[k])}
                  </dt>
                  <dd className="tnum mt-1">
                    <span className="font-display text-xl font-extrabold text-ink">{num(consumed)}</span>
                    <span className="text-xs font-semibold text-muted">
                      {' '}
                      / {num(target)} {t(UNIT_KEY[k])}
                    </span>
                  </dd>
                  <dd className="mt-2">
                    <ProgressBar value={consumed} max={target} color={NUTRIENT_COLOR[k].bg} />
                  </dd>
                  {consumed > target &&
                <dd className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-attention">
                      <ArrowUpIcon className="h-3 w-3" aria-hidden />
                      {t('history.overTarget')}
                    </dd>
                }
                  {summary.missing[k] > 0 &&
                <dd className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-attention">
                      <AlertCircleIcon className="h-3 w-3" aria-hidden />
                      {t('history.partial')}
                    </dd>
                }
                </div>);

          })}
          </dl>
          {log.entries.length === 0 ?
        <p className="p-6 text-sm text-muted">{t('history.loggedEmptyBody')}</p> :

        <ul className="divide-y divide-line px-5 md:px-6">
              {log.entries.map((e) =>
          <FoodEntryRow key={e.id} entry={e} onEdit={onEdit} onDelete={onDelete} />
          )}
            </ul>
        }
        </>
      }
    </Panel>);

}