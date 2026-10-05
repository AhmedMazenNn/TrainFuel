import React, { useEffect, useState } from 'react';
import { ArrowUpIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Panel } from '../Panel';
import { usePreferences } from '../../contexts/PreferencesContext';
import { dayOfMonth, isSameMonthKey, monthGridKeys, monthStartKey, shiftMonthKey, todayKey } from '../../utils/dates';
import { dayStatus } from '../../utils/nutrition';
import type { TranslationKey } from '../../data/translations';
import type { DayLog, DayStatus } from '../../types/nutrition';

interface MonthCalendarProps {
  selected: string;
  onSelect: (key: string) => void;
  logs: Record<string, DayLog>;
}

const STATUS_LABEL: Record<DayStatus, TranslationKey> = {
  none: 'history.noLog',
  empty: 'history.legend.empty',
  logged: 'history.legend.logged',
  over: 'history.legend.over',
  partial: 'history.legend.partial'
};

function Marker({ status, inverted }: {status: DayStatus;inverted?: boolean;}) {
  if (status === 'none') return <span className="h-3" aria-hidden />;
  if (status === 'over') return <ArrowUpIcon className={`h-3 w-3 ${inverted ? 'text-primary-fg' : 'text-attention'}`} strokeWidth={3} aria-hidden />;
  const shape =
  status === 'logged' ?
  `h-1.5 w-1.5 rounded-full ${inverted ? 'bg-primary-fg' : 'bg-primary'}` :
  status === 'partial' ?
  `h-1.5 w-1.5 rotate-45 ${inverted ? 'bg-primary-fg' : 'bg-attention'}` :
  `h-2 w-2 rounded-full border ${inverted ? 'border-primary-fg' : 'border-muted'}`;
  return (
    <span className="grid h-3 place-items-center" aria-hidden>
      <span className={shape} />
    </span>);

}

export function MonthCalendar({ selected, onSelect, logs }: MonthCalendarProps) {
  const { t, date, num } = usePreferences();
  const [month, setMonth] = useState(monthStartKey(selected));
  const today = todayKey();
  useEffect(() => setMonth(monthStartKey(selected)), [selected]);
  const days = monthGridKeys(month);
  const navBtn = 'grid h-9 w-9 place-items-center rounded-control text-muted transition-colors duration-150 hover:bg-elevated hover:text-ink';

  return (
    <Panel aria-label={date(month, { month: 'long', year: 'numeric' })}>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-ink">{date(month, { month: 'long', year: 'numeric' })}</h2>
        <div className="flex gap-1">
          <button type="button" onClick={() => setMonth(shiftMonthKey(month, -1))} aria-label={t('history.prevMonth')} className={navBtn}>
            <ChevronLeftIcon className="h-4 w-4 rtl:rotate-180" aria-hidden />
          </button>
          <button type="button" onClick={() => setMonth(shiftMonthKey(month, 1))} aria-label={t('history.nextMonth')} className={navBtn}>
            <ChevronRightIcon className="h-4 w-4 rtl:rotate-180" aria-hidden />
          </button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-7 text-center text-xs font-semibold text-muted" aria-hidden>
        {days.slice(0, 7).map((k) =>
        <div key={k} className="py-1">
            {date(k, { weekday: 'narrow' })}
          </div>
        )}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((k) => {
          const status = dayStatus(logs[k]);
          const isSelected = k === selected;
          const inMonth = isSameMonthKey(k, month);
          return (
            <button
              key={k}
              type="button"
              onClick={() => onSelect(k)}
              aria-pressed={isSelected}
              aria-label={`${date(k, { dateStyle: 'full' })}, ${t(STATUS_LABEL[status])}`}
              className={`tnum flex h-12 flex-col items-center justify-center gap-0.5 rounded-[12px] text-sm font-semibold transition-colors duration-150 ${
              isSelected ? 'bg-primary text-primary-fg' : `${inMonth ? 'text-ink' : 'text-muted/50'} hover:bg-elevated`} ${
              k === today && !isSelected ? 'ring-1 ring-inset ring-primary' : ''}`}>
              
              {num(dayOfMonth(k), 0)}
              <Marker status={status} inverted={isSelected} />
            </button>);

        })}
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-4 text-xs text-muted">
        {(['logged', 'over', 'partial', 'empty'] as DayStatus[]).map((s) =>
        <li key={s} className="flex items-center gap-1.5">
            <Marker status={s} />
            {t(STATUS_LABEL[s])}
          </li>
        )}
      </ul>
    </Panel>);

}