import React from 'react';
import { PlusIcon, UtensilsIcon } from 'lucide-react';
import { Button } from '../Button';
import { EmptyState } from '../EmptyState';
import { Panel } from '../Panel';
import { FOOD_ROW_GRID, FoodEntryRow } from './FoodEntryRow';
import { usePreferences } from '../../contexts/PreferencesContext';
import { MACRO_KEYS, NUTRIENT_COLOR, NUTRIENT_SHORT_KEY } from '../../utils/nutrition';
import type { FoodEntry } from '../../types/nutrition';

interface FoodLogProps {
  entries: FoodEntry[];
  onAdd: () => void;
  onEdit: (entry: FoodEntry) => void;
  onDelete: (entry: FoodEntry) => void;
  title?: string;
}

/** The food journal — dense, aligned, editable rows. */
export function FoodLog({ entries, onAdd, onEdit, onDelete, title }: FoodLogProps) {
  const { t, num } = usePreferences();
  return (
    <Panel aria-labelledby="food-log-heading">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="food-log-heading" className="font-display text-xl font-bold tracking-tight text-ink">
            {title ?? t('today.foodLog')}
          </h2>
          <p className="tnum text-[13px] text-muted">{t('today.entryCount', { count: num(entries.length, 0) })}</p>
        </div>
        {entries.length > 0 &&
        <Button variant="secondary" size="sm" icon={PlusIcon} onClick={onAdd}>
            {t('today.addFood')}
          </Button>
        }
      </div>

      {entries.length === 0 ?
      <EmptyState
        icon={UtensilsIcon}
        title={t('today.empty.title')}
        body={t('today.empty.body')}
        action={
        <Button icon={PlusIcon} onClick={onAdd}>
              {t('today.addFood')}
            </Button>
        } /> :


      <>
          <div aria-hidden className={`mt-5 hidden gap-x-4 border-b border-line pb-2 text-xs font-semibold text-muted md:grid ${FOOD_ROW_GRID}`}>
            <span />
            <span>{t('col.food')}</span>
            <span className="text-end">{t('unit.kcal')}</span>
            {MACRO_KEYS.map((k) =>
          <span key={k} className="flex items-center justify-end gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${NUTRIENT_COLOR[k].bg}`} />
                {t(NUTRIENT_SHORT_KEY[k])}
              </span>
          )}
            <span />
          </div>
          <ul className="mt-2 divide-y divide-line md:mt-0">
            {entries.map((entry) =>
          <FoodEntryRow key={entry.id} entry={entry} onEdit={onEdit} onDelete={onDelete} />
          )}
          </ul>
        </>
      }
    </Panel>);

}