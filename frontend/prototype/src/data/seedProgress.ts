import { subDays, subWeeks } from 'date-fns';
import { shiftDateKey, toDateKey, weekStartKey } from '../utils/dates';
import type { PhotoLabel, ProgressState } from '../types/progress';

export const seedWeights: {daysAgo: number;weight: number;note?: string;}[] = [
{ daysAgo: 66, weight: 82.6 },
{ daysAgo: 59, weight: 82.3 },
{ daysAgo: 52, weight: 82.4, note: 'After travel' },
{ daysAgo: 45, weight: 81.8 },
{ daysAgo: 38, weight: 81.5 },
{ daysAgo: 31, weight: 81.6 },
{ daysAgo: 24, weight: 81.0 },
{ daysAgo: 17, weight: 80.7 },
{ daysAgo: 10, weight: 80.9, note: 'Salty dinner the night before' },
{ daysAgo: 3, weight: 80.4 }];


export const seedPhotoWeeks: {weeksAgo: number;labels: PhotoLabel[];}[] = [
{ weeksAgo: 0, labels: ['front'] },
{ weeksAgo: 2, labels: ['front', 'side', 'back'] },
{ weeksAgo: 6, labels: ['front', 'side', 'back', 'other'] }];


export function createSeedProgress(now: Date = new Date()): ProgressState {
  const stamp = now.toISOString();
  return {
    version: 1,
    weights: seedWeights.map((w, i) => ({
      id: `seed-weight-${i}`,
      date: toDateKey(subDays(now, w.daysAgo)),
      weight: w.weight,
      note: w.note ?? ''
    })),
    photos: seedPhotoWeeks.flatMap((week) => {
      const weekStart = weekStartKey(toDateKey(subWeeks(now, week.weeksAgo)));
      const today = toDateKey(now);
      const tuesday = shiftDateKey(weekStart, 1);
      return week.labels.map((label, i) => ({
        id: `seed-photo-${week.weeksAgo}-${i}`,
        weekStart,
        label,
        captureDate: tuesday > today ? today : tuesday,
        note: '',
        src: null,
        status: 'synced' as const,
        createdAt: stamp
      }));
    })
  };
}