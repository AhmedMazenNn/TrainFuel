import { shiftDateKey, todayKey, weekStartKey } from './dates';
import type { TranslationKey } from '../data/translations';
import type { PhotoLabel } from '../types/progress';

export const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp';
export const MAX_PHOTO_BYTES = 1_500_000;
export const PHOTO_LABELS: PhotoLabel[] = ['front', 'side', 'back', 'other'];

export const PHOTO_LABEL_KEY: Record<PhotoLabel, TranslationKey> = {
  front: 'photo.label.front',
  side: 'photo.label.side',
  back: 'photo.label.back',
  other: 'photo.label.other'
};

export type PhotoFileError = 'type' | 'size' | 'read';

/** Reads an accepted image into a data URL for local prototype storage. */
export function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!PHOTO_ACCEPT.split(',').includes(file.type)) return reject('type' as PhotoFileError);
    if (file.size > MAX_PHOTO_BYTES) return reject('size' as PhotoFileError);
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject('read' as PhotoFileError);
    reader.readAsDataURL(file);
  });
}

/** Week starts (Mondays), newest first, including the current week. */
export function recentWeekStarts(count: number): string[] {
  const current = weekStartKey(todayKey());
  return Array.from({ length: count }, (_, i) => shiftDateKey(current, -7 * i));
}