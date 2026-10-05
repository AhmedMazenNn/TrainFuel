import type { TranslationKey } from '../data/translations';
import type { Equipment, MuscleGroup, SetRecord } from '../types/training';

export const MUSCLE_KEY: Record<MuscleGroup, TranslationKey> = {
  chest: 'muscle.chest',
  back: 'muscle.back',
  shoulders: 'muscle.shoulders',
  biceps: 'muscle.biceps',
  triceps: 'muscle.triceps',
  quads: 'muscle.quads',
  hamstrings: 'muscle.hamstrings',
  glutes: 'muscle.glutes',
  core: 'muscle.core'
};

export const EQUIPMENT_KEY: Record<Equipment, TranslationKey> = {
  dumbbell: 'equipment.dumbbell',
  barbell: 'equipment.barbell',
  cable: 'equipment.cable',
  machine: 'equipment.machine',
  bodyweight: 'equipment.bodyweight'
};

export interface RecordGroup {
  date: string;
  records: SetRecord[];
}

/** Records grouped by date, newest date first; order within a day preserved. */
export function groupRecordsByDate(records: SetRecord[]): RecordGroup[] {
  const map = new Map<string, SetRecord[]>();
  for (const r of records) map.set(r.date, [...(map.get(r.date) ?? []), r]);
  return [...map.entries()].sort(([a], [b]) => a < b ? 1 : -1).map(([date, recs]) => ({ date, records: recs }));
}

export function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}