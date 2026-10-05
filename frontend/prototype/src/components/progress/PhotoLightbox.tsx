import React, { useEffect, useState } from 'react';
import { ZoomInIcon, ZoomOutIcon } from 'lucide-react';
import { Button } from '../Button';
import { Dialog } from '../Dialog';
import { PhotoSilhouette } from './PhotoSilhouette';
import { usePreferences } from '../../contexts/PreferencesContext';
import { PHOTO_LABEL_KEY } from '../../utils/photos';
import type { ProgressPhoto } from '../../types/progress';

const LEVELS = [1, 1.5, 2, 3];

export function PhotoLightbox({ photo, onClose }: {photo: ProgressPhoto | null;onClose: () => void;}) {
  const { t, date, num } = usePreferences();
  const [level, setLevel] = useState(0);
  useEffect(() => setLevel(0), [photo?.id]);
  const zoom = LEVELS[level];
  const label = photo?.label ? t(PHOTO_LABEL_KEY[photo.label]) : t('photo.unlabeled');

  return (
    <Dialog
      open={photo !== null}
      onClose={onClose}
      size="lg"
      title={label}
      description={photo ? `${date(photo.captureDate, { dateStyle: 'medium' })}${photo.note ? ` · ${photo.note}` : ''}` : undefined}
      footer={
      <div className="flex items-center justify-center gap-2">
          <Button variant="secondary" size="icon" icon={ZoomOutIcon} onClick={() => setLevel((l) => Math.max(0, l - 1))} disabled={level === 0} aria-label={t('photo.zoomOut')} />
          <span className="tnum w-16 text-center text-sm font-semibold text-ink" aria-live="polite">
            {num(zoom)}×
          </span>
          <Button variant="secondary" size="icon" icon={ZoomInIcon} onClick={() => setLevel((l) => Math.min(LEVELS.length - 1, l + 1))} disabled={level === LEVELS.length - 1} aria-label={t('photo.zoomIn')} />
        </div>
      }>
      
      {photo &&
      <div className="max-h-[60vh] overflow-auto rounded-card bg-elevated" tabIndex={0} aria-label={t('photo.zoomArea')}>
          <div className="mx-auto aspect-[3/4] transition-[width] duration-200 ease-out" style={{ width: `${60 * zoom}%` }}>
            {photo.src ? <img src={photo.src} alt={label} className="h-full w-full object-cover" /> : <PhotoSilhouette label={photo.label} />}
          </div>
        </div>
      }
    </Dialog>);

}