import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSync } from './SyncContext';
import { createSeedProgress } from '../data/seedProgress';
import { createLocalAdapter } from '../utils/localAdapter';
import { createId } from '../utils/nutrition';
import { PHOTOS_PER_WEEK } from '../types/progress';
import type { PhotoLabel, ProgressPhoto, ProgressState, WeightEntry } from '../types/progress';

type Status = 'loading' | 'ready' | 'error';
export type SlotResult = 'ok' | 'full';

export interface PhotoInput {
  weekStart: string;
  label: PhotoLabel | null;
  captureDate: string;
  note: string;
  src: string | null;
}

interface ProgressValue {
  status: Status;
  weights: WeightEntry[];
  photos: ProgressPhoto[];
  photosForWeek: (weekStart: string) => ProgressPhoto[];
  usedSlots: (weekStart: string) => number;
  addWeight: (input: Omit<WeightEntry, 'id'>) => void;
  updateWeight: (id: string, input: Omit<WeightEntry, 'id'>) => void;
  deleteWeight: (id: string) => WeightEntry | null;
  restoreWeight: (entry: WeightEntry) => void;
  addPhoto: (input: PhotoInput) => SlotResult;
  updatePhoto: (id: string, patch: Partial<Pick<ProgressPhoto, 'label' | 'note' | 'captureDate' | 'src'>>) => void;
  movePhoto: (id: string, weekStart: string) => SlotResult;
  deletePhoto: (id: string) => ProgressPhoto | null;
  restorePhoto: (photo: ProgressPhoto) => void;
  /** Demo: another device fills the week while your upload is pending. */
  simulateSlotConflict: (weekStart: string) => void;
  resolveConflictKeep: (id: string, replaceId: string) => void;
  reset: () => Promise<void>;
}

const ProgressContext = createContext<ProgressValue | null>(null);
const adapter = createLocalAdapter<ProgressState>('formlog.progress.v1', () => createSeedProgress());

const counts = (p: ProgressPhoto) => p.status !== 'conflict';
const byDate = (a: WeightEntry, b: WeightEntry) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0;

export function ProgressProvider({ children }: {children: React.ReactNode;}) {
  const { isOnline, notifyChange, notifySaveFailed } = useSync();
  const [state, setState] = useState<ProgressState | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const ref = useRef<ProgressState | null>(null);

  useEffect(() => {
    adapter.
    load().
    then((s) => {
      ref.current = s;
      setState(s);
      setStatus('ready');
    }).
    catch(() => setStatus('error'));
  }, []);

  const commit = useCallback(
    (fn: (s: ProgressState) => ProgressState) => {
      if (!ref.current) return;
      const next = fn(ref.current);
      if (next === ref.current) return;
      ref.current = next;
      setState(next);
      adapter.save(next).then(notifyChange).catch(notifySaveFailed);
    },
    [notifyChange, notifySaveFailed]
  );

  // Simulated upload: local/pending photos finish uploading once online.
  const hasPending = state?.photos.some((p) => p.status === 'pending' || p.status === 'local') ?? false;
  useEffect(() => {
    if (!hasPending) return;
    if (!isOnline) {
      commit((s) => ({ ...s, photos: s.photos.map((p) => p.status === 'pending' ? { ...p, status: 'local' } : p) }));
      return;
    }
    commit((s) => ({ ...s, photos: s.photos.map((p) => p.status === 'local' ? { ...p, status: 'pending' } : p) }));
    const timer = window.setTimeout(() => {
      commit((s) => ({ ...s, photos: s.photos.map((p) => p.status === 'pending' ? { ...p, status: 'synced' } : p) }));
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [hasPending, isOnline, commit]);

  const value = useMemo<ProgressValue>(() => {
    const photos = state?.photos ?? [];
    const photosForWeek = (weekStart: string) => photos.filter((p) => p.weekStart === weekStart);
    const usedSlots = (weekStart: string) => photosForWeek(weekStart).filter(counts).length;
    return {
      status,
      weights: [...(state?.weights ?? [])].sort(byDate),
      photos,
      photosForWeek,
      usedSlots,
      addWeight: (input) => commit((s) => ({ ...s, weights: [...s.weights, { ...input, id: createId() }] })),
      updateWeight: (id, input) => commit((s) => ({ ...s, weights: s.weights.map((w) => w.id === id ? { ...input, id } : w) })),
      deleteWeight: (id) => {
        const entry = state?.weights.find((w) => w.id === id) ?? null;
        if (entry) commit((s) => ({ ...s, weights: s.weights.filter((w) => w.id !== id) }));
        return entry;
      },
      restoreWeight: (entry) =>
      commit((s) => s.weights.some((w) => w.id === entry.id) ? s : { ...s, weights: [...s.weights, entry] }),
      addPhoto: (input) => {
        if (usedSlots(input.weekStart) >= PHOTOS_PER_WEEK) return 'full';
        const photo: ProgressPhoto = {
          ...input,
          id: createId(),
          status: isOnline ? 'pending' : 'local',
          createdAt: new Date().toISOString()
        };
        commit((s) => ({ ...s, photos: [...s.photos, photo] }));
        return 'ok';
      },
      updatePhoto: (id, patch) =>
      commit((s) => ({
        ...s,
        photos: s.photos.map((p) =>
        p.id === id ? { ...p, ...patch, status: patch.src !== undefined ? isOnline ? 'pending' : 'local' : p.status } : p
        )
      })),
      movePhoto: (id, weekStart) => {
        const photo = photos.find((p) => p.id === id);
        if (!photo) return 'ok';
        if (photo.weekStart !== weekStart && usedSlots(weekStart) >= PHOTOS_PER_WEEK) return 'full';
        commit((s) => ({
          ...s,
          photos: s.photos.map((p) =>
          p.id === id ? { ...p, weekStart, status: p.status === 'conflict' ? isOnline ? 'pending' : 'local' : p.status } : p
          )
        }));
        return 'ok';
      },
      deletePhoto: (id) => {
        const photo = photos.find((p) => p.id === id) ?? null;
        if (photo) commit((s) => ({ ...s, photos: s.photos.filter((p) => p.id !== id) }));
        return photo;
      },
      restorePhoto: (photo) =>
      commit((s) => {
        if (s.photos.some((p) => p.id === photo.id)) return s;
        const full = s.photos.filter((p) => p.weekStart === photo.weekStart && counts(p)).length >= PHOTOS_PER_WEEK;
        return { ...s, photos: [...s.photos, full && counts(photo) ? { ...photo, status: 'conflict' } : photo] };
      }),
      simulateSlotConflict: (weekStart) =>
      commit((s) => {
        const used = s.photos.filter((p) => p.weekStart === weekStart && counts(p)).length;
        const stamp = new Date().toISOString();
        const remote: ProgressPhoto[] = Array.from({ length: Math.max(0, PHOTOS_PER_WEEK - used) }, () => ({
          id: createId(),
          weekStart,
          label: 'other',
          captureDate: weekStart,
          note: '',
          src: null,
          status: 'synced',
          createdAt: stamp
        }));
        const mine: ProgressPhoto = {
          id: createId(),
          weekStart,
          label: 'front',
          captureDate: weekStart,
          note: '',
          src: null,
          status: 'conflict',
          createdAt: stamp
        };
        return { ...s, photos: [...s.photos, ...remote, mine] };
      }),
      resolveConflictKeep: (id, replaceId) =>
      commit((s) => ({
        ...s,
        photos: s.photos.
        filter((p) => p.id !== replaceId).
        map((p) => p.id === id ? { ...p, status: isOnline ? 'pending' : 'local' } : p)
      })),
      reset: async () => {
        const s = await adapter.reset();
        ref.current = s;
        setState(s);
      }
    };
  }, [state, status, commit, isOnline]);

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress must be used within ProgressProvider');
  return ctx;
}