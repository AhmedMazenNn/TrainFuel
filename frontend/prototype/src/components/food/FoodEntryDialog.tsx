import React, { useCallback, useMemo } from 'react';
import { AlertCircleIcon } from 'lucide-react';
import { Button } from '../Button';
import { Dialog } from '../Dialog';
import { TextField } from '../TextField';
import { useFoodEntryForm } from './useFoodEntryForm';
import { useNutrition } from '../../contexts/NutritionContext';
import { usePreferences } from '../../contexts/PreferencesContext';
import { parseNumberInput } from '../../utils/format';
import { MACRO_KEYS, NUTRIENT_COLOR, NUTRIENT_LABEL_KEY, UNIT_KEY } from '../../utils/nutrition';
import type { FoodEntry, FoodEntryInput, NutrientKey } from '../../types/nutrition';

interface FoodEntryDialogProps {
  open: boolean;
  onClose: () => void;
  entry: FoodEntry | null;
  defaultDate: string;
  onSubmit: (input: FoodEntryInput, entry: FoodEntry | null) => void;
}

export function FoodEntryDialog({ open, onClose, entry, defaultDate, onSubmit }: FoodEntryDialogProps) {
  const { t, num, date } = usePreferences();
  const { logs, defaultTargets } = useNutrition();
  const handleSubmit = useCallback((input: FoodEntryInput) => onSubmit(input, entry), [onSubmit, entry]);
  const { values, errors, setField, submit, clearForm, restored, missing } = useFoodEntryForm({
    open,
    entry,
    defaultDate,
    onSubmit: handleSubmit
  });

  // Live preview: day total = other entries on that date + this portion. Weight never scales anything.
  const preview = useMemo(() => {
    const log = logs[values.date];
    const base = (log?.entries ?? []).filter((e) => e.id !== entry?.id).reduce((s, e) => s + (e.nutrients.calories ?? 0), 0);
    const parsed = parseNumberInput(values.calories);
    const add = parsed.kind === 'value' ? parsed.value : 0;
    return { total: Math.round((base + add) * 10) / 10, target: log?.targets.calories ?? defaultTargets.calories };
  }, [logs, values.date, values.calories, entry, defaultTargets]);

  const missingBadge =
  <span className="inline-flex items-center gap-1 text-xs font-semibold text-attention">
      <AlertCircleIcon className="h-3 w-3" aria-hidden />
      {t('form.missing')}
    </span>;


  const nutrientField = (k: NutrientKey, big = false) =>
  <TextField
    key={k}
    id={`food-${k}`}
    label={t(NUTRIENT_LABEL_KEY[k])}
    accent={NUTRIENT_COLOR[k].bg}
    inputMode="decimal"
    suffix={t(UNIT_KEY[k])}
    value={values[k]}
    onChange={(v) => setField(k, v)}
    error={errors[k]}
    badge={missing.includes(k) ? missingBadge : undefined}
    className={big ? '[&_input]:h-12 [&_input]:font-display [&_input]:text-xl [&_input]:font-bold' : ''} />;



  return (
    <Dialog
      open={open}
      onClose={onClose}
      variant="drawer"
      title={entry ? t('form.editTitle') : t('form.addTitle')}
      description={t('form.desc')}
      footer={
      <div className="flex items-center gap-2">
          {!entry &&
        <Button variant="ghost" onClick={clearForm} className="hidden sm:inline-flex">
              {t('form.clear')}
            </Button>
        }
          <div className="ms-auto flex gap-2">
            <Button variant="secondary" onClick={() => submit('draft')}>
              {t('form.saveDraft')}
            </Button>
            <Button type="submit" form="food-entry-form">
              {t('form.save')}
            </Button>
          </div>
        </div>
      }>
      
      <form
        id="food-entry-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit('complete');
        }}
        className="space-y-6">
        
        {restored &&
        <div role="status" className="flex items-center justify-between gap-3 rounded-control bg-elevated px-3.5 py-2.5 text-sm text-ink">
            <span>{t('form.draftRestored')}</span>
            <button type="button" onClick={clearForm} className="shrink-0 font-semibold text-primary hover:underline">
              {t('form.clear')}
            </button>
          </div>
        }

        <div className="space-y-4">
          <TextField
            id="food-name"
            label={t('form.name')}
            placeholder={t('form.namePlaceholder')}
            value={values.name}
            onChange={(v) => setField('name', v)}
            error={errors.name}
            autoComplete="off"
            data-autofocus />
          
          <div className="grid grid-cols-2 gap-3">
            <TextField
              id="food-weight"
              label={t('form.weight')}
              optionalLabel={t('common.optional')}
              inputMode="decimal"
              suffix={t('unit.g')}
              value={values.weight}
              onChange={(v) => setField('weight', v)}
              hint={t('form.weightHint')}
              error={errors.weight} />
            
            <TextField
              id="food-date"
              label={t('form.date')}
              type="date"
              value={values.date}
              onChange={(v) => setField('date', v)}
              error={errors.date} />
            
          </div>
        </div>

        <fieldset className="rounded-card border border-line bg-canvas/50 p-4">
          <legend className="sr-only">{t('form.nutritionSection')}</legend>
          <div aria-hidden className="mb-1 font-display text-[15px] font-bold text-ink">
            {t('form.nutritionSection')}
          </div>
          <p className="mb-4 text-xs text-muted">{t('form.nutritionHint')}</p>
          {nutrientField('calories', true)}
          <div className="mt-3 grid grid-cols-3 gap-2.5">{MACRO_KEYS.map((k) => nutrientField(k))}</div>
          <p className="tnum mt-4 flex items-center justify-between gap-3 border-t border-line pt-3 text-[13px]" aria-live="polite">
            <span className="text-muted">{t('form.dayTotal', { date: date(values.date || defaultDate, { month: 'short', day: 'numeric' }) })}</span>
            <span className={`font-semibold ${preview.total > preview.target ? 'text-attention' : 'text-ink'}`}>
              {num(preview.total)} / {num(preview.target)} {t('unit.kcal')}
            </span>
          </p>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            id="food-brand"
            label={t('form.brand')}
            optionalLabel={t('common.optional')}
            placeholder={t('form.brandPlaceholder')}
            value={values.brand}
            onChange={(v) => setField('brand', v)} />
          
          <TextField
            id="food-notes"
            label={t('form.notes')}
            optionalLabel={t('common.optional')}
            value={values.notes}
            onChange={(v) => setField('notes', v)} />
          
        </div>
      </form>
    </Dialog>);

}