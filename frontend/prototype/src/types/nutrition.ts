export type NutrientKey = 'calories' | 'protein' | 'carbs' | 'fat';

export type Targets = Record<NutrientKey, number>;

/** null = not entered yet (draft). 0 is a valid, explicit value. */
export type NutrientValues = Record<NutrientKey, number | null>;

export type EntryStatus = 'draft' | 'complete';

export interface FoodEntryInput {
  date: string;
  name: string;
  weightGrams: number | null;
  nutrients: NutrientValues;
  brand: string;
  notes: string;
  status: EntryStatus;
}

export interface FoodEntry extends FoodEntryInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface DayLog {
  date: string;
  targets: Targets;
  entries: FoodEntry[];
  createdAt: string;
}

export interface NutritionState {
  version: 1;
  defaultTargets: Targets;
  logs: Record<string, DayLog>;
}

export type TargetScope = 'day' | 'future';

export type DayStatus = 'none' | 'empty' | 'logged' | 'over' | 'partial';