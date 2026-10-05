import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSync } from './SyncContext';
import { localNutritionAdapter } from '../utils/nutritionAdapter';
import { createId } from '../utils/nutrition';
import { todayKey } from '../utils/dates';
import type { DayLog, FoodEntry, FoodEntryInput, NutritionState, Targets, TargetScope } from '../types/nutrition';

export interface DeletedEntry {
  entry: FoodEntry;
  index: number;
}

type LoadStatus = 'loading' | 'ready' | 'error';

interface NutritionValue {
  status: LoadStatus;
  logs: Record<string, DayLog>;
  defaultTargets: Targets;
  selectedDate: string;
  setSelectedDate: (key: string) => void;
  addEntry: (input: FoodEntryInput) => FoodEntry;
  updateEntry: (id: string, fromDate: string, input: FoodEntryInput) => void;
  deleteEntry: (date: string, id: string) => DeletedEntry | null;
  restoreEntry: (deleted: DeletedEntry) => void;
  openLog: (date: string) => 'created' | 'existing';
  startNewDay: () => 'created' | 'existing';
  updateTargets: (date: string, targets: Targets, scope: TargetScope) => void;
  resetDemoData: () => Promise<void>;
  retryLoad: () => void;
}

const NutritionContext = createContext<NutritionValue | null>(null);
const adapter = localNutritionAdapter;
const EMPTY_TARGETS: Targets = { calories: 0, protein: 0, carbs: 0, fat: 0 };

function ensureLog(s: NutritionState, date: string): NutritionState {
  if (s.logs[date]) return s;
  const log: DayLog = { date, targets: { ...s.defaultTargets }, entries: [], createdAt: new Date().toISOString() };
  return { ...s, logs: { ...s.logs, [date]: log } };
}

function updateLog(s: NutritionState, date: string, fn: (log: DayLog) => DayLog): NutritionState {
  const next = ensureLog(s, date);
  return { ...next, logs: { ...next.logs, [date]: fn(next.logs[date]) } };
}

export function NutritionProvider({ children }: {children: React.ReactNode;}) {
  const { notifyChange, notifySaveFailed } = useSync();
  const [state, setState] = useState<NutritionState | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const stateRef = useRef<NutritionState | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const s = await adapter.load();
      stateRef.current = s;
      setState(s);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const commit = useCallback(
    (updater: (s: NutritionState) => NutritionState) => {
      const current = stateRef.current;
      if (!current) return;
      const next = updater(current);
      if (next === current) return;
      stateRef.current = next;
      setState(next);
      adapter.
      save(next).
      then(() => notifyChange()).
      catch(() => notifySaveFailed());
    },
    [notifyChange, notifySaveFailed]
  );

  const addEntry = useCallback(
    (input: FoodEntryInput) => {
      const now = new Date().toISOString();
      const entry: FoodEntry = { ...input, id: createId(), createdAt: now, updatedAt: now };
      commit((s) => updateLog(s, input.date, (log) => ({ ...log, entries: [...log.entries, entry] })));
      return entry;
    },
    [commit]
  );

  const updateEntry = useCallback(
    (id: string, fromDate: string, input: FoodEntryInput) => {
      commit((s) => {
        const existing = s.logs[fromDate]?.entries.find((e) => e.id === id);
        if (!existing) return s;
        const updated: FoodEntry = { ...existing, ...input, updatedAt: new Date().toISOString() };
        if (fromDate === input.date) {
          return updateLog(s, fromDate, (log) => ({
            ...log,
            entries: log.entries.map((e) => e.id === id ? updated : e)
          }));
        }
        const removed = updateLog(s, fromDate, (log) => ({ ...log, entries: log.entries.filter((e) => e.id !== id) }));
        return updateLog(removed, input.date, (log) => ({ ...log, entries: [...log.entries, updated] }));
      });
    },
    [commit]
  );

  const deleteEntry = useCallback(
    (date: string, id: string): DeletedEntry | null => {
      const log = stateRef.current?.logs[date];
      const index = log ? log.entries.findIndex((e) => e.id === id) : -1;
      if (!log || index < 0) return null;
      const entry = log.entries[index];
      commit((s) => updateLog(s, date, (l) => ({ ...l, entries: l.entries.filter((e) => e.id !== id) })));
      return { entry, index };
    },
    [commit]
  );

  const restoreEntry = useCallback(
    ({ entry, index }: DeletedEntry) => {
      commit((s) =>
      updateLog(s, entry.date, (l) => {
        if (l.entries.some((e) => e.id === entry.id)) return l;
        const entries = [...l.entries];
        entries.splice(Math.min(index, entries.length), 0, entry);
        return { ...l, entries };
      })
      );
    },
    [commit]
  );

  const openLog = useCallback(
    (date: string) => {
      const exists = Boolean(stateRef.current?.logs[date]);
      if (!exists) commit((s) => ensureLog(s, date));
      setSelectedDate(date);
      return exists ? 'existing' : 'created';
    },
    [commit]
  );

  const startNewDay = useCallback(() => openLog(todayKey()), [openLog]);

  const updateTargets = useCallback(
    (date: string, targets: Targets, scope: TargetScope) => {
      commit((s) => {
        let next = updateLog(s, date, (l) => ({ ...l, targets: { ...targets } }));
        if (scope === 'future') {
          const logs = { ...next.logs };
          for (const key of Object.keys(logs)) {
            if (key > date) logs[key] = { ...logs[key], targets: { ...targets } };
          }
          next = { ...next, logs, defaultTargets: { ...targets } };
        }
        return next;
      });
    },
    [commit]
  );

  const resetDemoData = useCallback(async () => {
    const s = await adapter.reset();
    stateRef.current = s;
    setState(s);
    setSelectedDate(todayKey());
    notifyChange();
  }, [notifyChange]);

  const value = useMemo<NutritionValue>(
    () => ({
      status,
      logs: state?.logs ?? {},
      defaultTargets: state?.defaultTargets ?? EMPTY_TARGETS,
      selectedDate,
      setSelectedDate,
      addEntry,
      updateEntry,
      deleteEntry,
      restoreEntry,
      openLog,
      startNewDay,
      updateTargets,
      resetDemoData,
      retryLoad: () => void load()
    }),
    [status, state, selectedDate, addEntry, updateEntry, deleteEntry, restoreEntry, openLog, startNewDay, updateTargets, resetDemoData, load]
  );

  return <NutritionContext.Provider value={value}>{children}</NutritionContext.Provider>;
}

export function useNutrition(): NutritionValue {
  const ctx = useContext(NutritionContext);
  if (!ctx) throw new Error('useNutrition must be used within NutritionProvider');
  return ctx;
}