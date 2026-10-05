import React from 'react';
import { Link } from 'react-router-dom';
import { LinkIcon } from 'lucide-react';
import { usePreferences } from '../../contexts/PreferencesContext';
import { daysBetween, todayKey } from '../../utils/dates';
import { EQUIPMENT_KEY, MUSCLE_KEY } from '../../utils/training';
import type { Exercise, SetRecord } from '../../types/training';

interface ExerciseCardProps {
  exercise: Exercise;
  lastRecord?: SetRecord;
  hasPrivateLink: boolean;
}

export function ExerciseCard({ exercise, lastRecord, hasPrivateLink }: ExerciseCardProps) {
  const { t, num } = usePreferences();
  const ago = lastRecord ? daysBetween(lastRecord.date, todayKey()) : 0;

  return (
    <Link
      to={`/exercises/${exercise.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-panel border border-line bg-surface transition-[border-color,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-muted/40">
      
      <div className="relative aspect-[4/3] overflow-hidden bg-elevated">
        <img
          src={exercise.image}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-200 ease-out group-hover:scale-[1.03]" />
        
        <span className="absolute start-3 top-3 rounded-full bg-canvas/85 px-2.5 py-1 text-[11px] font-semibold text-ink">
          {t(EQUIPMENT_KEY[exercise.equipment])}
        </span>
        {hasPrivateLink &&
        <span
          className="absolute end-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-canvas/85 text-primary"
          title={t('exercise.privateLink')}>
          
            <LinkIcon className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only">{t('exercise.privateLink')}</span>
          </span>
        }
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-[17px] font-bold leading-tight text-ink">{exercise.name}</h3>
        <p className="mt-1.5 text-[13px] text-muted">{exercise.muscles.map((m) => t(MUSCLE_KEY[m])).join(' · ')}</p>
        <div className="min-h-[12px] flex-1" aria-hidden />
        <p className="tnum border-t border-line pt-3 text-xs text-muted">
          {lastRecord ?
          <>
              <span className="font-semibold text-ink">
                {num(lastRecord.weight)} {t('unit.kg')} × {num(lastRecord.reps, 0)}
              </span>{' '}
              · {ago === 0 ? t('time.today') : t('time.daysAgo', { count: num(ago, 0) })}
            </> :

          t('exercise.noRecords')
          }
        </p>
      </div>
    </Link>);

}