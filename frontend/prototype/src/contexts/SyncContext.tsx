import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { SyncState } from '../types/preferences';

interface SyncValue {
  syncState: SyncState;
  isOnline: boolean;
  simulatedOffline: boolean;
  setSimulatedOffline: (v: boolean) => void;
  notifyChange: () => void;
  notifySaveFailed: () => void;
  simulateConflict: () => void;
  resolveAttention: () => void;
}

const SyncContext = createContext<SyncValue | null>(null);

/** Simulated sync. A real backend client would replace the timers below. */
export function SyncProvider({ children }: {children: React.ReactNode;}) {
  const [browserOnline, setBrowserOnline] = useState(() => navigator.onLine);
  const [simulatedOffline, setSimulatedOffline] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>('synced');
  const isOnline = browserOnline && !simulatedOffline;

  const onlineRef = useRef(isOnline);
  onlineRef.current = isOnline;
  const stateRef = useRef(syncState);
  stateRef.current = syncState;
  const timer = useRef<number>();

  useEffect(() => {
    const up = () => setBrowserOnline(true);
    const down = () => setBrowserOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
      window.clearTimeout(timer.current);
    };
  }, []);

  const beginSync = useCallback(() => {
    setSyncState('pending');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setSyncState((s) => s === 'pending' && onlineRef.current ? 'synced' : s);
    }, 900);
  }, []);

  useEffect(() => {
    if (isOnline && stateRef.current === 'local') beginSync();
    if (!isOnline && stateRef.current === 'pending') setSyncState('local');
  }, [isOnline, beginSync]);

  const notifyChange = useCallback(() => {
    if (stateRef.current === 'attention') return;
    if (!onlineRef.current) setSyncState('local');else
    beginSync();
  }, [beginSync]);

  const notifySaveFailed = useCallback(() => setSyncState('attention'), []);
  const simulateConflict = useCallback(() => setSyncState('attention'), []);
  const resolveAttention = useCallback(() => {
    if (onlineRef.current) beginSync();else
    setSyncState('local');
  }, [beginSync]);

  const value = useMemo(
    () => ({
      syncState,
      isOnline,
      simulatedOffline,
      setSimulatedOffline,
      notifyChange,
      notifySaveFailed,
      simulateConflict,
      resolveAttention
    }),
    [syncState, isOnline, simulatedOffline, notifyChange, notifySaveFailed, simulateConflict, resolveAttention]
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within SyncProvider');
  return ctx;
}