import React, { useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangleIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon } from 'lucide-react';
import { Button } from '../Button';
import { Panel } from '../Panel';
import { PhotoDetailsDialog } from './PhotoDetailsDialog';
import { PhotoLightbox } from './PhotoLightbox';
import { PhotoTile } from './PhotoTile';
import { usePreferences } from '../../contexts/PreferencesContext';
import { useProgress } from '../../contexts/ProgressContext';
import { shiftDateKey, todayKey, weekStartKey } from '../../utils/dates';
import { PHOTOS_PER_WEEK } from '../../types/progress';
import type { ProgressPhoto } from '../../types/progress';

export function PhotoWeekGallery() {
  const { t, date, num } = usePreferences();
  const progress = useProgress();
  const current = weekStartKey(todayKey());
  const [week, setWeek] = useState(current);
  const [editor, setEditor] = useState<{open: boolean;photo: ProgressPhoto | null;}>({ open: false, photo: null });
  const [zoomed, setZoomed] = useState<ProgressPhoto | null>(null);

  const photos = progress.photosForWeek(week);
  const placed = photos.filter((p) => p.status !== 'conflict');
  const conflicts = photos.filter((p) => p.status === 'conflict');
  const used = placed.length;
  const full = used >= PHOTOS_PER_WEEK;

  const remove = (photo: ProgressPhoto) => {
    const removed = progress.deletePhoto(photo.id);
    if (removed) toast(t('photo.deleted'), { action: { label: t('entry.undo'), onClick: () => progress.restorePhoto(removed) } });
  };

  const moveConflict = (photo: ProgressPhoto) => {
    let target = shiftDateKey(week, 7);
    for (let i = 0; i < 12 && progress.usedSlots(target) >= PHOTOS_PER_WEEK; i++) target = shiftDateKey(target, 7);
    if (target > current) {
      target = shiftDateKey(week, -7);
      for (let i = 0; i < 52 && progress.usedSlots(target) >= PHOTOS_PER_WEEK; i++) target = shiftDateKey(target, -7);
    }
    progress.movePhoto(photo.id, target);
    toast.success(t('photo.movedTo', { date: date(target, { month: 'short', day: 'numeric' }) }));
  };

  const navBtn = 'grid h-9 w-9 place-items-center rounded-control text-muted hover:bg-elevated hover:text-ink disabled:opacity-30';

  return (
    <Panel aria-labelledby="gallery-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="gallery-heading" className="font-display text-xl font-bold text-ink">
            {t('photo.weekly')}
          </h2>
          <div className="mt-1 flex items-center gap-1">
            <button type="button" className={navBtn} onClick={() => setWeek(shiftDateKey(week, -7))} aria-label={t('week.prev')}>
              <ChevronLeftIcon className="h-4 w-4 rtl:rotate-180" aria-hidden />
            </button>
            <p className="tnum min-w-[9.5rem] text-center text-sm font-semibold text-ink">
              {date(week, { month: 'short', day: 'numeric' })} – {date(shiftDateKey(week, 6), { month: 'short', day: 'numeric' })}
            </p>
            <button type="button" className={navBtn} onClick={() => setWeek(shiftDateKey(week, 7))} disabled={week >= current} aria-label={t('week.next')}>
              <ChevronRightIcon className="h-4 w-4 rtl:rotate-180" aria-hidden />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-end">
            <p className="tnum font-display text-3xl font-extrabold leading-none text-ink">
              {num(used, 0)}
              <span className="text-lg text-muted">/{num(PHOTOS_PER_WEEK, 0)}</span>
            </p>
            <p className="mt-1 text-xs text-muted">{t('photo.slotsUsed')}</p>
          </div>
          <div>
            <Button icon={PlusIcon} onClick={() => setEditor({ open: true, photo: null })} disabled={full} aria-describedby={full ? 'gallery-full' : undefined}>
              {t('photo.add')}
            </Button>
          </div>
        </div>
      </div>
      {full &&
      <p id="gallery-full" className="mt-3 text-[13px] text-muted">
          {t('photo.fullHint')}
        </p>
      }

      {conflicts.map((c) =>
      <div key={c.id} role="alert" className="mt-4 flex flex-col gap-3 rounded-card border border-danger/40 bg-danger-soft p-4 sm:flex-row sm:items-center">
          <AlertTriangleIcon className="h-5 w-5 shrink-0 text-danger" aria-hidden />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-ink">{t('photo.conflictTitle')}</p>
            <p className="text-muted">{t('photo.conflictBody')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => moveConflict(c)}>
              {t('photo.conflictMove')}
            </Button>
            {placed[0] &&
          <Button size="sm" variant="secondary" onClick={() => progress.resolveConflictKeep(c.id, placed[placed.length - 1].id)}>
                {t('photo.conflictReplace')}
              </Button>
          }
            <Button size="sm" variant="ghost" onClick={() => remove(c)}>
              {t('photo.conflictDiscard')}
            </Button>
          </div>
        </div>
      )}

      <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: PHOTOS_PER_WEEK }, (_, i) => {
          const photo = placed[i];
          return (
            <li key={photo?.id ?? `empty-${i}`}>
              {photo ?
              <PhotoTile photo={photo} onZoom={() => setZoomed(photo)} onEdit={() => setEditor({ open: true, photo })} onDelete={() => remove(photo)} /> :

              <button
                type="button"
                onClick={() => setEditor({ open: true, photo: null })}
                className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line text-muted transition-colors duration-150 hover:border-primary hover:text-primary">
                
                  <PlusIcon className="h-5 w-5" aria-hidden />
                  <span className="text-xs font-semibold">{t('photo.slot', { n: num(i + 1, 0) })}</span>
                </button>
              }
            </li>);

        })}
      </ul>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
        <p className="text-xs text-muted">{t('photo.demoNote')}</p>
        {!full &&
        <Button variant="ghost" size="sm" onClick={() => progress.simulateSlotConflict(week)}>
            {t('photo.simulateConflict')}
          </Button>
        }
      </div>

      <PhotoDetailsDialog
        open={editor.open}
        onClose={() => setEditor((e) => ({ ...e, open: false }))}
        weekStart={week}
        photo={editor.photo}
        onSaved={(msg) => {
          setEditor((e) => ({ ...e, open: false }));
          toast.success(msg);
        }} />
      
      <PhotoLightbox photo={zoomed} onClose={() => setZoomed(null)} />
    </Panel>);

}