export type PhotoLabel = 'front' | 'side' | 'back' | 'other';
export type PhotoStatus = 'local' | 'pending' | 'synced' | 'conflict';

export interface WeightEntry {
  id: string;
  date: string;
  weight: number;
  note: string;
}

export interface ProgressPhoto {
  id: string;
  /** Monday of the week this photo belongs to. */
  weekStart: string;
  label: PhotoLabel | null;
  captureDate: string;
  note: string;
  /** Data URL when stored locally with opt-in; null renders a neutral silhouette placeholder. */
  src: string | null;
  status: PhotoStatus;
  createdAt: string;
}

export interface ProgressState {
  version: 1;
  weights: WeightEntry[];
  photos: ProgressPhoto[];
}

export const PHOTOS_PER_WEEK = 4;