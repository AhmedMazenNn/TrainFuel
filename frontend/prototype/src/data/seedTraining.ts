import { subDays } from 'date-fns';
import { toDateKey } from '../utils/dates';
import type { TrainingState } from '../types/training';

const sets = (prefix: string, values: [number, number][]) =>
values.map(([weight, reps], i) => ({ id: `${prefix}-s${i}`, weight, reps }));

export const seedFolders = [
{
  id: 'folder-push',
  name: 'Push',
  items: [
  { id: 'push-1', exerciseId: 'bench-press', values: [[60, 10], [65, 8], [65, 8]] as [number, number][] },
  { id: 'push-2', exerciseId: 'overhead-press', values: [[16, 12], [18, 10], [18, 8]] as [number, number][] }]

},
{
  id: 'folder-pull',
  name: 'Pull',
  items: [
  { id: 'pull-1', exerciseId: 'lat-pulldown', values: [[45, 12], [50, 10], [50, 8]] as [number, number][] },
  { id: 'pull-2', exerciseId: 'seated-cable-row', values: [[40, 12], [45, 10]] as [number, number][] },
  { id: 'pull-3', exerciseId: 'dumbbell-curl', values: [[20, 12], [22, 10], [22, 8]] as [number, number][] }]

},
{
  id: 'folder-legs',
  name: 'Legs',
  items: [
  { id: 'legs-1', exerciseId: 'goblet-squat', values: [[24, 12], [28, 10], [28, 10]] as [number, number][] },
  { id: 'legs-2', exerciseId: 'romanian-deadlift', values: [[70, 10], [80, 8]] as [number, number][] },
  { id: 'legs-3', exerciseId: 'walking-lunge', values: [[14, 12], [14, 12]] as [number, number][] }]

}];


export const seedRecords: {exerciseId: string;daysAgo: number;weight: number;reps: number;note?: string;referenceOnly?: boolean;}[] = [
{ exerciseId: 'dumbbell-curl', daysAgo: 2, weight: 20, reps: 12 },
{ exerciseId: 'dumbbell-curl', daysAgo: 2, weight: 22, reps: 9, note: 'Last rep slow' },
{ exerciseId: 'dumbbell-curl', daysAgo: 9, weight: 20, reps: 12 },
{ exerciseId: 'dumbbell-curl', daysAgo: 9, weight: 20, reps: 10 },
{ exerciseId: 'lat-pulldown', daysAgo: 2, weight: 50, reps: 10 },
{ exerciseId: 'lat-pulldown', daysAgo: 9, weight: 45, reps: 12 },
{ exerciseId: 'seated-cable-row', daysAgo: 2, weight: 45, reps: 10 },
{ exerciseId: 'bench-press', daysAgo: 3, weight: 65, reps: 8 },
{ exerciseId: 'bench-press', daysAgo: 10, weight: 62.5, reps: 8 },
{ exerciseId: 'overhead-press', daysAgo: 3, weight: 18, reps: 9 },
{ exerciseId: 'goblet-squat', daysAgo: 4, weight: 28, reps: 10 },
{ exerciseId: 'romanian-deadlift', daysAgo: 4, weight: 80, reps: 8 },
{ exerciseId: 'romanian-deadlift', daysAgo: 4, weight: 85, reps: 6, note: 'Try next week', referenceOnly: true }];


export function createSeedTraining(now: Date = new Date()): TrainingState {
  const stamp = now.toISOString();
  return {
    version: 1,
    tutorialLinks: {},
    folders: seedFolders.map((f) => ({
      id: f.id,
      name: f.name,
      updatedAt: stamp,
      items: f.items.map((item) => ({ id: item.id, exerciseId: item.exerciseId, sets: sets(item.id, item.values) }))
    })),
    records: seedRecords.map((r, i) => ({
      id: `seed-record-${i}`,
      exerciseId: r.exerciseId,
      date: toDateKey(subDays(now, r.daysAgo)),
      weight: r.weight,
      reps: r.reps,
      note: r.note ?? '',
      referenceOnly: r.referenceOnly ?? false
    }))
  };
}