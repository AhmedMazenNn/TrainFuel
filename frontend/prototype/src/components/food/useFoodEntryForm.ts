import { useCallback, useEffect, useState } from 'react';
import { usePreferences } from '../../contexts/PreferencesContext';
import { parseNumberInput } from '../../utils/format';
import { NUTRIENT_KEYS } from '../../utils/nutrition';
import type { FoodEntry, FoodEntryInput, NutrientKey, NutrientValues } from '../../types/nutrition';

export interface FoodFormValues {
  name: string;
  weight: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  date: string;
  brand: string;
  notes: string;
}

type FieldKey = keyof FoodFormValues;
export type FoodFormErrors = Partial<Record<FieldKey, string>>;
type SubmitMode = 'complete' | 'draft';

const DRAFT_KEY = 'formlog.foodFormDraft';
const FIELD_ORDER: FieldKey[] = ['name', 'weight', 'date', 'calories', 'protein', 'carbs', 'fat'];

const blank = (date: string): FoodFormValues => ({
  name: '',
  weight: '',
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
  date,
  brand: '',
  notes: ''
});

const fromEntry = (e: FoodEntry): FoodFormValues => ({
  name: e.name,
  weight: e.weightGrams === null ? '' : String(e.weightGrams),
  calories: e.nutrients.calories === null ? '' : String(e.nutrients.calories),
  protein: e.nutrients.protein === null ? '' : String(e.nutrients.protein),
  carbs: e.nutrients.carbs === null ? '' : String(e.nutrients.carbs),
  fat: e.nutrients.fat === null ? '' : String(e.nutrients.fat),
  date: e.date,
  brand: e.brand,
  notes: e.notes
});

const hasContent = (v: FoodFormValues) =>
[v.name, v.weight, v.calories, v.protein, v.carbs, v.fat, v.brand, v.notes].some((s) => s.trim() !== '');

interface Options {
  open: boolean;
  entry: FoodEntry | null;
  defaultDate: string;
  onSubmit: (input: FoodEntryInput) => void;
}

export function useFoodEntryForm({ open, entry, defaultDate, onSubmit }: Options) {
  const { t } = usePreferences();
  const [values, setValues] = useState<FoodFormValues>(() => blank(defaultDate));
  const [errors, setErrors] = useState<FoodFormErrors>({});
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (entry) {
      setValues(fromEntry(entry));
      setRestored(false);
      return;
    }
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as FoodFormValues;
        setValues({ ...blank(defaultDate), ...saved, date: defaultDate });
        setRestored(true);
        return;
      }
    } catch {
      window.localStorage.removeItem(DRAFT_KEY);
    }
    setValues(blank(defaultDate));
    setRestored(false);
  }, [open, entry, defaultDate]);

  // Preserve unsaved new entries so closing the dialog never loses typing.
  useEffect(() => {
    if (!open || entry) return;
    if (hasContent(values)) window.localStorage.setItem(DRAFT_KEY, JSON.stringify(values));else
    window.localStorage.removeItem(DRAFT_KEY);
  }, [open, entry, values]);

  const setField = useCallback((key: FieldKey, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => e[key] ? { ...e, [key]: undefined } : e);
  }, []);

  const clearForm = useCallback(() => {
    window.localStorage.removeItem(DRAFT_KEY);
    setValues(blank(defaultDate));
    setErrors({});
    setRestored(false);
  }, [defaultDate]);

  const missing = NUTRIENT_KEYS.filter((k) => values[k].trim() === '');

  const submit = useCallback(
    (mode: SubmitMode) => {
      const next: FoodFormErrors = {};
      if (!values.name.trim()) next.name = t('form.errorName');
      if (!values.date) next.date = t('form.errorDate');
      const weight = parseNumberInput(values.weight);
      if (weight.kind === 'invalid') next.weight = t('form.errorNumber');

      const nutrients = {} as NutrientValues;
      for (const k of NUTRIENT_KEYS) {
        const parsed = parseNumberInput(values[k]);
        if (parsed.kind === 'invalid') next[k] = t('form.errorNumber');else
        if (parsed.kind === 'empty' && mode === 'complete') next[k] = t('form.errorRequired');
        nutrients[k] = parsed.kind === 'value' ? parsed.value : null;
      }

      const firstError = FIELD_ORDER.find((k) => next[k]);
      if (firstError) {
        setErrors(next);
        document.getElementById(`food-${firstError}`)?.focus();
        return;
      }

      const complete = NUTRIENT_KEYS.every((k: NutrientKey) => nutrients[k] !== null);
      onSubmit({
        date: values.date,
        name: values.name.trim(),
        weightGrams: weight.kind === 'value' ? weight.value : null,
        nutrients,
        brand: values.brand.trim(),
        notes: values.notes.trim(),
        status: complete ? 'complete' : 'draft'
      });
      if (!entry) window.localStorage.removeItem(DRAFT_KEY);
    },
    [values, entry, onSubmit, t]
  );

  return { values, errors, setField, submit, clearForm, restored, missing };
}