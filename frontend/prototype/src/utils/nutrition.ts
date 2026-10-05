import type { TranslationKey } from '../data/translations';
import type { DayLog, DayStatus, FoodEntry, NutrientKey, NutrientValues, Targets } from '../types/nutrition';

export const NUTRIENT_KEYS: NutrientKey[] = ['calories', 'protein', 'carbs', 'fat'];
export const MACRO_KEYS: NutrientKey[] = ['protein', 'carbs', 'fat'];

export const NUTRIENT_LABEL_KEY: Record<NutrientKey, TranslationKey> = {
  calories: 'nutrient.calories',
  protein: 'nutrient.protein',
  carbs: 'nutrient.carbs',
  fat: 'nutrient.fat'
};

export const NUTRIENT_SHORT_KEY: Record<NutrientKey, TranslationKey> = {
  calories: 'nutrientShort.calories',
  protein: 'nutrientShort.protein',
  carbs: 'nutrientShort.carbs',
  fat: 'nutrientShort.fat'
};

export const UNIT_KEY: Record<NutrientKey, TranslationKey> = {
  calories: 'unit.kcal',
  protein: 'unit.g',
  carbs: 'unit.g',
  fat: 'unit.g'
};

/** One color per nutrient, used consistently across counters, bars, rows, and fields. */
export const NUTRIENT_COLOR: Record<NutrientKey, {bg: string;text: string;}> = {
  calories: { bg: 'bg-primary', text: 'text-primary' },
  protein: { bg: 'bg-protein', text: 'text-protein' },
  carbs: { bg: 'bg-carbs', text: 'text-carbs' },
  fat: { bg: 'bg-fat', text: 'text-fat' }
};

export function missingNutrients(values: NutrientValues): NutrientKey[] {
  return NUTRIENT_KEYS.filter((k) => values[k] === null);
}

export interface DayTotals {
  totals: Targets;
  /** Number of draft entries missing each nutrient. */
  missing: Targets;
  draftCount: number;
}

export function computeTotals(entries: FoodEntry[]): DayTotals {
  const totals: Targets = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const missing: Targets = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  let draftCount = 0;
  for (const entry of entries) {
    if (entry.status === 'draft') draftCount += 1;
    for (const k of NUTRIENT_KEYS) {
      const v = entry.nutrients[k];
      if (v === null) missing[k] += 1;else
      totals[k] += v;
    }
  }
  for (const k of NUTRIENT_KEYS) totals[k] = Math.round(totals[k] * 10) / 10;
  return { totals, missing, draftCount };
}

export function dayStatus(log: DayLog | undefined): DayStatus {
  if (!log) return 'none';
  if (log.entries.length === 0) return 'empty';
  const { totals, draftCount } = computeTotals(log.entries);
  if (draftCount > 0) return 'partial';
  if (totals.calories > log.targets.calories) return 'over';
  return 'logged';
}

export function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}