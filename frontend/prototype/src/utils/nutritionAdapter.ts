import { createSeedState } from '../data/seedNutrition';
import type { NutritionState } from '../types/nutrition';

/**
 * Storage boundary for nutrition data. The browser implementation below can be
 * swapped for a shared backend API client with the same interface.
 */
export interface NutritionAdapter {
  load(): Promise<NutritionState>;
  save(state: NutritionState): Promise<void>;
  reset(): Promise<NutritionState>;
}

const STORAGE_KEY = 'formlog.nutrition.v1';

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

function isNutritionState(value: unknown): value is NutritionState {
  return typeof value === 'object' && value !== null && (value as NutritionState).version === 1;
}

export const localNutritionAdapter: NutritionAdapter = {
  async load() {
    await wait(300);
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = createSeedState();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isNutritionState(parsed)) throw new Error('Unsupported data version');
    return parsed;
  },
  async save(state) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  },
  async reset() {
    const seed = createSeedState();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    window.localStorage.removeItem('formlog.foodFormDraft');
    return seed;
  }
};