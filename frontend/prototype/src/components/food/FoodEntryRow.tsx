import React from 'react';
import { AlertCircleIcon, PencilIcon, Trash2Icon, UtensilsIcon } from 'lucide-react';
import { usePreferences } from '../../contexts/PreferencesContext';
import { MACRO_KEYS, NUTRIENT_COLOR, NUTRIENT_SHORT_KEY, missingNutrients } from '../../utils/nutrition';
import type { FoodEntry, NutrientKey } from '../../types/nutrition';

interface FoodEntryRowProps {
  entry: FoodEntry;
  onEdit?: (entry: FoodEntry) => void;
  onDelete?: (entry: FoodEntry) => void;
}

export const FOOD_ROW_GRID =
'grid-cols-[40px_minmax(0,1fr)_auto] md:grid-cols-[40px_minmax(0,1fr)_5rem_repeat(3,4rem)_5rem]';

export function FoodEntryRow({ entry, onEdit, onDelete }: FoodEntryRowProps) {
  const { t, num, language } = usePreferences();
  const missing = missingNutrients(entry.nutrients);
  const draft = entry.status === 'draft';
  const meta = [entry.weightGrams !== null ? `${num(entry.weightGrams)} ${t('unit.g')}` : null, entry.brand || null].
  filter(Boolean).
  join(' · ');

  const value = (k: NutrientKey, withUnit = false) => {
    const v = entry.nutrients[k];
    if (v === null) {
      return (
        <span className="font-semibold text-attention">
          —<span className="sr-only">{t('entry.missingValue')}</span>
        </span>);

    }
    return (
      <span className="font-semibold text-ink">
        {num(v)}
        {withUnit && <span className="font-normal text-muted">{t('unit.g')}</span>}
      </span>);

  };

  const actionBtn =
  'grid h-9 w-9 place-items-center rounded-[10px] text-muted transition-colors duration-150 hover:bg-elevated hover:text-ink';

  return (
    <li className={`group grid items-center gap-x-3 gap-y-1.5 py-3.5 md:gap-x-4 ${FOOD_ROW_GRID}`}>
      <span
        aria-hidden
        className={`row-span-2 grid h-10 w-10 place-items-center rounded-[12px] md:row-span-1 ${
        draft ? 'bg-attention-soft text-attention' : 'bg-elevated text-muted'}`
        }>
        
        {draft ? <AlertCircleIcon className="h-[18px] w-[18px]" /> : <UtensilsIcon className="h-[18px] w-[18px]" />}
      </span>

      <div className="min-w-0">
        <button
          type="button"
          onClick={() => onEdit?.(entry)}
          disabled={!onEdit}
          className="block max-w-full truncate text-start text-[15px] font-semibold text-ink underline-offset-4 hover:underline disabled:no-underline">
          
          {entry.name}
        </button>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
          {draft && <span className="font-semibold text-attention">{t('entry.draft')}</span>}
          {meta && <span className="truncate">{meta}</span>}
          {missing.length > 0 &&
          <span className="text-attention">
              {t('entry.missing', { list: missing.map((k) => t(NUTRIENT_SHORT_KEY[k])).join(language === 'ar' ? '، ' : ', ') })}
            </span>
          }
        </p>
      </div>

      <p className="tnum text-end text-[15px]">
        {value('calories')} <span className="text-xs text-muted">{t('unit.kcal')}</span>
      </p>

      {/* Mobile macro line */}
      <div className="tnum col-start-2 flex flex-wrap gap-x-3 text-[13px] md:hidden">
        {MACRO_KEYS.map((k) =>
        <span key={k} className="inline-flex items-center gap-1">
            <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${NUTRIENT_COLOR[k].bg}`} />
            <span className="sr-only">{t(NUTRIENT_SHORT_KEY[k])}</span>
            {value(k, true)}
          </span>
        )}
      </div>

      {MACRO_KEYS.map((k) =>
      <p key={k} className="tnum hidden text-end text-sm md:block">
          <span className="sr-only">{t(NUTRIENT_SHORT_KEY[k])}: </span>
          {value(k, true)}
        </p>
      )}

      {(onEdit || onDelete) &&
      <div className="col-start-3 row-start-2 flex justify-end gap-0.5 md:col-start-auto md:row-start-auto">
          {onEdit &&
        <button type="button" onClick={() => onEdit(entry)} aria-label={t('entry.edit', { name: entry.name })} className={actionBtn}>
              <PencilIcon className="h-4 w-4" aria-hidden />
            </button>
        }
          {onDelete &&
        <button
          type="button"
          onClick={() => onDelete(entry)}
          aria-label={t('entry.delete', { name: entry.name })}
          className={`${actionBtn} hover:!bg-danger-soft hover:!text-danger`}>
          
              <Trash2Icon className="h-4 w-4" aria-hidden />
            </button>
        }
        </div>
      }
    </li>);

}