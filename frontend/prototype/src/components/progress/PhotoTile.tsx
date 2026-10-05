import React from 'react';
import { AlertTriangleIcon, CloudIcon, HardDriveIcon, MaximizeIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { PhotoSilhouette } from './PhotoSilhouette';
import { usePreferences } from '../../contexts/PreferencesContext';
import { PHOTO_LABEL_KEY } from '../../utils/photos';
import type { TranslationKey } from '../../data/translations';
import type { PhotoStatus, ProgressPhoto } from '../../types/progress';

interface PhotoTileProps {
  photo: ProgressPhoto;
  onZoom: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  compact?: boolean;
}

const STATUS: Record<PhotoStatus, {key: TranslationKey;cls: string;}> = {
  local: { key: 'photo.status.local', cls: 'text-muted' },
  pending: { key: 'photo.status.pending', cls: 'text-attention' },
  synced: { key: 'photo.status.synced', cls: 'text-primary' },
  conflict: { key: 'photo.status.conflict', cls: 'text-danger' }
};

export function PhotoTile({ photo, onZoom, onEdit, onDelete, compact }: PhotoTileProps) {
  const { t, date } = usePreferences();
  const status = STATUS[photo.status];
  const StatusIcon = photo.status === 'conflict' ? AlertTriangleIcon : photo.status === 'local' ? HardDriveIcon : CloudIcon;
  const label = photo.label ? t(PHOTO_LABEL_KEY[photo.label]) : t('photo.unlabeled');
  const btn = 'grid h-8 w-8 place-items-center rounded-[10px] text-muted transition-colors duration-150 hover:bg-elevated hover:text-ink';

  return (
    <figure className={`flex h-full flex-col overflow-hidden rounded-card border bg-surface ${photo.status === 'conflict' ? 'border-danger/60' : 'border-line'}`}>
      <button
        type="button"
        onClick={onZoom}
        aria-label={t('photo.zoomNamed', { label, date: date(photo.captureDate, { month: 'short', day: 'numeric' }) })}
        className="group relative aspect-[3/4] overflow-hidden bg-elevated">
        
        {photo.src ? <img src={photo.src} alt="" className="h-full w-full object-cover" /> : <PhotoSilhouette label={photo.label} />}
        <span className="absolute start-2 top-2 rounded-full bg-canvas/85 px-2 py-0.5 text-[11px] font-semibold text-ink">{label}</span>
        <span className="absolute end-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-canvas/85 text-ink opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
          <MaximizeIcon className="h-3.5 w-3.5" aria-hidden />
        </span>
        {photo.status === 'pending' &&
        <span className="absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded-full bg-canvas/70" aria-hidden>
            <span className="block h-full w-1/2 rounded-full bg-attention motion-safe:animate-pulse" />
          </span>
        }
      </button>
      {!compact &&
      <figcaption className="flex items-center gap-1 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="tnum truncate text-xs font-semibold text-ink">{date(photo.captureDate, { month: 'short', day: 'numeric' })}</p>
            <p className={`flex items-center gap-1 text-[11px] font-semibold ${status.cls}`}>
              <StatusIcon className="h-3 w-3" aria-hidden />
              {t(status.key)}
            </p>
          </div>
          {onEdit &&
        <button type="button" className={btn} onClick={onEdit} aria-label={t('photo.editNamed', { label })}>
              <PencilIcon className="h-3.5 w-3.5" aria-hidden />
            </button>
        }
          {onDelete &&
        <button type="button" className={`${btn} hover:!bg-danger-soft hover:!text-danger`} onClick={onDelete} aria-label={t('photo.deleteNamed', { label })}>
              <Trash2Icon className="h-3.5 w-3.5" aria-hidden />
            </button>
        }
        </figcaption>
      }
    </figure>);

}