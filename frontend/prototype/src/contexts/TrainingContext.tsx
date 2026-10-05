import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSync } from './SyncContext';
import { exercises } from '../data/exercises';
import { createSeedTraining } from '../data/seedTraining';
import { createLocalAdapter, moveItem } from '../utils/localAdapter';
import { createId } from '../utils/nutrition';
import type { Exercise, FolderExercise, PlannedSet, SetRecord, TrainingState, WorkoutFolder } from '../types/training';

type Status = 'loading' | 'ready' | 'error';
type Dir = -1 | 1;

export interface Removed<T> {
  item: T;
  index: number;
  parentId?: string;
}

interface TrainingValue {
  status: Status;
  exercises: Exercise[];
  folders: WorkoutFolder[];
  records: SetRecord[];
  tutorialLinks: Record<string, string>;
  getExercise: (id: string) => Exercise | undefined;
  recordsFor: (exerciseId: string) => SetRecord[];
  createFolder: (name: string) => WorkoutFolder;
  renameFolder: (id: string, name: string) => void;
  duplicateFolder: (id: string, copySuffix: string) => void;
  deleteFolder: (id: string) => Removed<WorkoutFolder> | null;
  restoreFolder: (r: Removed<WorkoutFolder>) => void;
  moveFolder: (id: string, dir: Dir) => void;
  addExerciseToFolder: (folderId: string, exerciseId: string) => void;
  removeFolderItem: (folderId: string, itemId: string) => Removed<FolderExercise> | null;
  restoreFolderItem: (r: Removed<FolderExercise>) => void;
  moveFolderItem: (folderId: string, itemId: string, dir: Dir) => void;
  addSet: (folderId: string, itemId: string) => void;
  updateSet: (folderId: string, itemId: string, setId: string, patch: Partial<PlannedSet>) => void;
  removeSet: (folderId: string, itemId: string, setId: string) => void;
  moveSet: (folderId: string, itemId: string, setId: string, dir: Dir) => void;
  addRecord: (input: Omit<SetRecord, 'id'>) => void;
  updateRecord: (id: string, input: Omit<SetRecord, 'id'>) => void;
  deleteRecord: (id: string) => Removed<SetRecord> | null;
  restoreRecord: (r: Removed<SetRecord>) => void;
  setTutorialLink: (exerciseId: string, url: string | null) => void;
  reset: () => Promise<void>;
}

const TrainingContext = createContext<TrainingValue | null>(null);
const adapter = createLocalAdapter<TrainingState>('formlog.training.v1', () => createSeedTraining());

export function TrainingProvider({ children }: {children: React.ReactNode;}) {
  const { notifyChange, notifySaveFailed } = useSync();
  const [state, setState] = useState<TrainingState | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const ref = useRef<TrainingState | null>(null);

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
    (fn: (s: TrainingState) => TrainingState) => {
      if (!ref.current) return;
      const next = fn(ref.current);
      if (next === ref.current) return;
      ref.current = next;
      setState(next);
      adapter.save(next).then(notifyChange).catch(notifySaveFailed);
    },
    [notifyChange, notifySaveFailed]
  );

  const mapFolder = useCallback(
    (folderId: string, fn: (f: WorkoutFolder) => WorkoutFolder) =>
    commit((s) => ({
      ...s,
      folders: s.folders.map((f) => f.id === folderId ? { ...fn(f), updatedAt: new Date().toISOString() } : f)
    })),
    [commit]
  );

  const mapItem = useCallback(
    (folderId: string, itemId: string, fn: (i: FolderExercise) => FolderExercise) =>
    mapFolder(folderId, (f) => ({ ...f, items: f.items.map((i) => i.id === itemId ? fn(i) : i) })),
    [mapFolder]
  );

  const value = useMemo<TrainingValue>(() => {
    const folders = state?.folders ?? [];
    const records = state?.records ?? [];
    return {
      status,
      exercises,
      folders,
      records,
      tutorialLinks: state?.tutorialLinks ?? {},
      getExercise: (id) => exercises.find((e) => e.id === id),
      recordsFor: (exerciseId) =>
      records.filter((r) => r.exerciseId === exerciseId).sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0),
      createFolder: (name) => {
        const folder: WorkoutFolder = { id: createId(), name, items: [], updatedAt: new Date().toISOString() };
        commit((s) => ({ ...s, folders: [...s.folders, folder] }));
        return folder;
      },
      renameFolder: (id, name) => mapFolder(id, (f) => ({ ...f, name })),
      duplicateFolder: (id, copySuffix) =>
      commit((s) => {
        const index = s.folders.findIndex((f) => f.id === id);
        if (index < 0) return s;
        const src = s.folders[index];
        const copy: WorkoutFolder = {
          id: createId(),
          name: `${src.name} ${copySuffix}`,
          updatedAt: new Date().toISOString(),
          items: src.items.map((i) => ({ ...i, id: createId(), sets: i.sets.map((st) => ({ ...st, id: createId() })) }))
        };
        const next = [...s.folders];
        next.splice(index + 1, 0, copy);
        return { ...s, folders: next };
      }),
      deleteFolder: (id) => {
        const index = folders.findIndex((f) => f.id === id);
        if (index < 0) return null;
        const item = folders[index];
        commit((s) => ({ ...s, folders: s.folders.filter((f) => f.id !== id) }));
        return { item, index };
      },
      restoreFolder: ({ item, index }) =>
      commit((s) => {
        if (s.folders.some((f) => f.id === item.id)) return s;
        const next = [...s.folders];
        next.splice(Math.min(index, next.length), 0, item);
        return { ...s, folders: next };
      }),
      moveFolder: (id, dir) =>
      commit((s) => ({ ...s, folders: moveItem(s.folders, s.folders.findIndex((f) => f.id === id), dir) })),
      addExerciseToFolder: (folderId, exerciseId) =>
      mapFolder(folderId, (f) => ({
        ...f,
        items: [...f.items, { id: createId(), exerciseId, sets: [{ id: createId(), weight: null, reps: null }] }]
      })),
      removeFolderItem: (folderId, itemId) => {
        const folder = folders.find((f) => f.id === folderId);
        const index = folder ? folder.items.findIndex((i) => i.id === itemId) : -1;
        if (!folder || index < 0) return null;
        const item = folder.items[index];
        mapFolder(folderId, (f) => ({ ...f, items: f.items.filter((i) => i.id !== itemId) }));
        return { item, index, parentId: folderId };
      },
      restoreFolderItem: ({ item, index, parentId }) =>
      parentId &&
      mapFolder(parentId, (f) => {
        if (f.items.some((i) => i.id === item.id)) return f;
        const items = [...f.items];
        items.splice(Math.min(index, items.length), 0, item);
        return { ...f, items };
      }),
      moveFolderItem: (folderId, itemId, dir) =>
      mapFolder(folderId, (f) => ({ ...f, items: moveItem(f.items, f.items.findIndex((i) => i.id === itemId), dir) })),
      addSet: (folderId, itemId) =>
      mapItem(folderId, itemId, (i) => {
        const last = i.sets[i.sets.length - 1];
        return { ...i, sets: [...i.sets, { id: createId(), weight: last?.weight ?? null, reps: last?.reps ?? null }] };
      }),
      updateSet: (folderId, itemId, setId, patch) =>
      mapItem(folderId, itemId, (i) => ({ ...i, sets: i.sets.map((st) => st.id === setId ? { ...st, ...patch } : st) })),
      removeSet: (folderId, itemId, setId) =>
      mapItem(folderId, itemId, (i) => ({ ...i, sets: i.sets.filter((st) => st.id !== setId) })),
      moveSet: (folderId, itemId, setId, dir) =>
      mapItem(folderId, itemId, (i) => ({ ...i, sets: moveItem(i.sets, i.sets.findIndex((st) => st.id === setId), dir) })),
      addRecord: (input) => commit((s) => ({ ...s, records: [...s.records, { ...input, id: createId() }] })),
      updateRecord: (id, input) =>
      commit((s) => ({ ...s, records: s.records.map((r) => r.id === id ? { ...input, id } : r) })),
      deleteRecord: (id) => {
        const index = records.findIndex((r) => r.id === id);
        if (index < 0) return null;
        const item = records[index];
        commit((s) => ({ ...s, records: s.records.filter((r) => r.id !== id) }));
        return { item, index };
      },
      restoreRecord: ({ item, index }) =>
      commit((s) => {
        if (s.records.some((r) => r.id === item.id)) return s;
        const next = [...s.records];
        next.splice(Math.min(index, next.length), 0, item);
        return { ...s, records: next };
      }),
      setTutorialLink: (exerciseId, url) =>
      commit((s) => {
        const links = { ...s.tutorialLinks };
        if (url) links[exerciseId] = url;else
        delete links[exerciseId];
        return { ...s, tutorialLinks: links };
      }),
      reset: async () => {
        const s = await adapter.reset();
        ref.current = s;
        setState(s);
      }
    };
  }, [state, status, commit, mapFolder, mapItem]);

  return <TrainingContext.Provider value={value}>{children}</TrainingContext.Provider>;
}

export function useTraining(): TrainingValue {
  const ctx = useContext(TrainingContext);
  if (!ctx) throw new Error('useTraining must be used within TrainingProvider');
  return ctx;
}