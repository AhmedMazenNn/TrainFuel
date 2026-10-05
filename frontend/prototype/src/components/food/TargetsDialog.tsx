import React, { useEffect, useState } from 'react';
import { Button } from '../Button';
import { Dialog } from '../Dialog';
import { TextField } from '../TextField';
import { usePreferences } from '../../contexts/PreferencesContext';
import { parseNumberInput } from '../../utils/format';
import { NUTRIENT_COLOR, NUTRIENT_KEYS, NUTRIENT_LABEL_KEY, UNIT_KEY } from '../../utils/nutrition';
import type { NutrientKey, Targets, TargetScope } from '../../types/nutrition';

interface TargetsDialogProps {
  open: boolean;
  onClose: () => void;
  dateKey: string;
  targets: Targets;
  onSave: (targets: Targets, scope: TargetScope) => void;
}

type Values = Record<NutrientKey, string>;

export function TargetsDialog({ open, onClose, dateKey, targets, onSave }: TargetsDialogProps) {
  const { t, date } = usePreferences();
  const [values, setValues] = useState<Values>({ calories: '', protein: '', carbs: '', fat: '' });
  const [scope, setScope] = useState<TargetScope>('future');
  const [errors, setErrors] = useState<Partial<Record<NutrientKey, string>>>({});
  const dayLabel = date(dateKey, { month: 'short', day: 'numeric' });

  useEffect(() => {
    if (!open) return;
    setValues({
      calories: String(targets.calories),
      protein: String(targets.protein),
      carbs: String(targets.carbs),
      fat: String(targets.fat)
    });
    setErrors({});
    setScope('future');
  }, [open, targets]);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const next = {} as Targets;
    const errs: Partial<Record<NutrientKey, string>> = {};
    for (const k of NUTRIENT_KEYS) {
      const parsed = parseNumberInput(values[k]);
      if (parsed.kind !== 'value' || parsed.value <= 0) errs[k] = t('targets.error');else
      next[k] = parsed.value;
    }
    const first = NUTRIENT_KEYS.find((k) => errs[k]);
    if (first) {
      setErrors(errs);
      document.getElementById(`target-${first}`)?.focus();
      return;
    }
    onSave(next, scope);
  };

  const scopes: {value: TargetScope;label: string;hint: string;}[] = [
  { value: 'future', label: t('targets.scopeFuture', { date: dayLabel }), hint: t('targets.scopeFutureHint') },
  { value: 'day', label: t('targets.scopeDay', { date: dayLabel }), hint: t('targets.scopeDayHint') }];


  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('targets.title')}
      description={t('targets.desc')}
      footer={
      <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="targets-form">
            {t('targets.save')}
          </Button>
        </div>
      }>
      
      <form id="targets-form" noValidate onSubmit={save} className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          {NUTRIENT_KEYS.map((k, i) =>
          <TextField
            key={k}
            id={`target-${k}`}
            label={t(NUTRIENT_LABEL_KEY[k])}
            accent={NUTRIENT_COLOR[k].bg}
            inputMode="decimal"
            suffix={t(UNIT_KEY[k])}
            value={values[k]}
            onChange={(v) => {
              setValues((s) => ({ ...s, [k]: v }));
              setErrors((s) => ({ ...s, [k]: undefined }));
            }}
            error={errors[k]}
            {...i === 0 ? { 'data-autofocus': true } : {}} />

          )}
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-ink">{t('targets.scope')}</legend>
          <div className="mt-2 space-y-2">
            {scopes.map((s) =>
            <label
              key={s.value}
              className={`flex cursor-pointer gap-3 rounded-card border p-3.5 transition-colors duration-150 ${
              scope === s.value ? 'border-primary bg-primary-soft' : 'border-line hover:bg-elevated'}`
              }>
              
                <input
                type="radio"
                name="target-scope"
                value={s.value}
                checked={scope === s.value}
                onChange={() => setScope(s.value)}
                className="mt-0.5 h-4 w-4 accent-primary" />
              
                <span>
                  <span className="block text-sm font-medium text-ink">{s.label}</span>
                  <span className="block text-xs text-muted">{s.hint}</span>
                </span>
              </label>
            )}
          </div>
        </fieldset>
      </form>
    </Dialog>);

}