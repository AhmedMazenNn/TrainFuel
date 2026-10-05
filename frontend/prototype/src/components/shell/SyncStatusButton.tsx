import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangleIcon, CloudIcon, CloudOffIcon, HardDriveIcon, RefreshCwIcon, BoxIcon } from "lucide-react";
import { Button } from "../Button";
import { Switch } from "../Switch";
import { usePreferences } from "../../contexts/PreferencesContext";
import { useSync } from "../../contexts/SyncContext";
import { TranslationKey } from "../../data/translations";
import { SyncState } from "../../types/preferences";
const META: Record<SyncState, {
  icon: BoxIcon;
  label: TranslationKey;
  desc: TranslationKey;
  dot: string;
}> = {
  local: {
    icon: HardDriveIcon,
    label: 'sync.local',
    desc: 'sync.desc.local',
    dot: 'bg-muted'
  },
  pending: {
    icon: RefreshCwIcon,
    label: 'sync.pending',
    desc: 'sync.desc.pending',
    dot: 'bg-attention'
  },
  synced: {
    icon: CloudIcon,
    label: 'sync.synced',
    desc: 'sync.desc.synced',
    dot: 'bg-primary'
  },
  attention: {
    icon: AlertTriangleIcon,
    label: 'sync.attention',
    desc: 'sync.desc.attention',
    dot: 'bg-danger'
  }
};
export function SyncStatusButton({
  compact = false


}: {compact?: boolean;}) {
  const {
    t
  } = usePreferences();
  const {
    syncState,
    isOnline,
    simulatedOffline,
    setSimulatedOffline,
    simulateConflict,
    resolveAttention
  } = useSync();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const meta = META[syncState];
  const Icon = isOnline ? meta.icon : CloudOffIcon;
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="dialog" className={`inline-flex h-10 items-center gap-2 rounded-full text-[13px] font-semibold text-ink transition-colors duration-150 ${compact ? 'w-9 justify-center hover:bg-elevated' : 'border border-line bg-surface px-3.5 hover:border-muted/40'}`}>
        <span className="relative">
          <Icon className={`h-4 w-4 ${syncState === 'pending' && isOnline ? 'motion-safe:animate-spin' : ''}`} aria-hidden />
          <span aria-hidden className={`absolute -end-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-canvas ${meta.dot}`} />
        </span>
        <span className={compact ? 'sr-only' : ''}>{t(meta.label)}</span>
      </button>

      <AnimatePresence>
        {open && <motion.div role="dialog" aria-label={t('sync.title')} initial={{
        opacity: 0,
        y: -4,
        scale: 0.98
      }} animate={{
        opacity: 1,
        y: 0,
        scale: 1
      }} exit={{
        opacity: 0,
        y: -4,
        scale: 0.98
      }} transition={{
        duration: 0.16,
        ease: [0.23, 1, 0.32, 1]
      }} className="absolute end-0 top-full z-40 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-card border border-line bg-elevated p-5 shadow-2xl">
            <div className="flex items-center gap-2">
              <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
              <p className="font-display font-bold text-ink">{t(meta.label)}</p>
            </div>
            <p className="mt-1.5 text-sm text-muted">{t(meta.desc)}</p>
            <p className="mt-3 text-[13px] text-ink">
              <span className="text-muted">{t('sync.connection')}: </span>
              {isOnline ? t('sync.online') : t('sync.offline')}
            </p>
            <div className="mt-4 space-y-3 border-t border-line pt-4">
              <p className="text-xs font-semibold text-attention">{t('sync.demoControls')}</p>
              <Switch id={`sync-offline-${compact ? 'm' : 'd'}`} checked={simulatedOffline} onChange={setSimulatedOffline} label={t('sync.simulateOffline')} description={t('sync.simulateOfflineHint')} />
              <Button variant="secondary" size="sm" onClick={syncState === 'attention' ? resolveAttention : simulateConflict} className="w-full">
                {syncState === 'attention' ? t('sync.markResolved') : t('sync.simulateConflict')}
              </Button>
              <p className="text-xs text-muted">{t('sync.demoNote')}</p>
            </div>
          </motion.div>}
      </AnimatePresence>
    </div>;
}