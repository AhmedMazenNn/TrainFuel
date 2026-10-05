import React, { useEffect, useRef, useState } from 'react';
import { ImageIcon, InfoIcon, UploadIcon } from 'lucide-react';
import { Button } from '../Button';
import { Dialog } from '../Dialog';
import { SelectField } from '../SelectField';
import { TextField } from '../TextField';
import { usePreferences } from '../../contexts/PreferencesContext';
import { useProgress } from '../../contexts/ProgressContext';
import { shiftDateKey, todayKey } from '../../utils/dates';
import { PHOTO_ACCEPT, PHOTO_LABELS, PHOTO_LABEL_KEY, readImageFile, recentWeekStarts } from '../../utils/photos';
import type { PhotoFileError } from '../../utils/photos';
import { PHOTOS_PER_WEEK } from '../../types/progress';
import type { PhotoLabel, ProgressPhoto } from '../../types/progress';

interface PhotoDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  weekStart: string;
  photo: ProgressPhoto | null;
  onSaved: (message: string) => void;
}

export function PhotoDetailsDialog({ open, onClose, weekStart, photo, onSaved }: PhotoDetailsDialogProps) {
  const { t, date, num, storePhotosLocally } = usePreferences();
  const progress = useProgress();
  const fileRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState<PhotoLabel | ''>('');
  const [captureDate, setCaptureDate] = useState(todayKey());
  const [note, setNote] = useState('');
  const [week, setWeek] = useState(weekStart);
  const [src, setSrc] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setLabel(photo?.label ?? '');
    const end = shiftDateKey(weekStart, 6);
    setCaptureDate(photo?.captureDate ?? (todayKey() > end ? weekStart : todayKey() < weekStart ? weekStart : todayKey()));
    setNote(photo?.note ?? '');
    setWeek(photo?.weekStart ?? weekStart);
    setSrc(photo?.src ?? null);
    setFileError(undefined);
    setError(undefined);
  }, [open, photo, weekStart]);

  const fileMessages: Record<PhotoFileError, string> = {
    type: t('photo.errorType'),
    size: t('photo.errorSize'),
    read: t('photo.errorRead')
  };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setSrc(await readImageFile(file));
      setFileError(undefined);
    } catch (e) {
      setFileError(fileMessages[e as PhotoFileError] ?? fileMessages.read);
    }
  };

  const weeks = recentWeekStarts(16);
  const save = () => {
    const details = { label: label || null, captureDate, note: note.trim(), src };
    if (photo) {
      if (week !== photo.weekStart && progress.movePhoto(photo.id, week) === 'full') {
        setError(t('photo.weekFull'));
        return;
      }
      progress.updatePhoto(photo.id, src !== photo.src ? details : { label: details.label, captureDate, note: details.note });
      onSaved(week !== photo.weekStart ? t('photo.moved') : t('entry.updated'));
    } else {
      if (progress.addPhoto({ ...details, weekStart: week }) === 'full') {
        setError(t('photo.weekFull'));
        return;
      }
      onSaved(t('photo.added'));
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      variant="drawer"
      title={photo ? t('photo.editTitle') : t('photo.addTitle')}
      description={t('photo.privateHint')}
      footer={
      <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={save}>{t('common.save')}</Button>
        </div>
      }>
      
      <div className="space-y-5">
        <div className="rounded-card border border-dashed border-line p-4">
          {storePhotosLocally ?
          <>
              <div className="flex items-center gap-3">
                <span className="grid h-16 w-12 place-items-center overflow-hidden rounded-[10px] bg-elevated">
                  {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5 text-muted" aria-hidden />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{src ? t('photo.selected') : t('photo.choose')}</p>
                  <p className="text-xs text-muted">{t('photo.fileHint')}</p>
                </div>
                <Button variant="secondary" size="sm" icon={UploadIcon} onClick={() => fileRef.current?.click()}>
                  {src ? t('photo.replace') : t('photo.browse')}
                </Button>
              </div>
              <input
              ref={fileRef}
              type="file"
              accept={PHOTO_ACCEPT}
              className="sr-only"
              aria-label={t('photo.choose')}
              onChange={(e) => {
                void pickFile(e.target.files?.[0]);
                e.target.value = '';
              }} />
            
              {fileError &&
            <p role="alert" className="mt-2 text-xs font-medium text-danger">
                  {fileError}
                </p>
            }
            </> :

          <p className="flex gap-2 text-[13px] text-muted">
              <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              {t('photo.optInHint')}
            </p>
          }
        </div>

        <div className="grid grid-cols-2 gap-3">
          <SelectField
            id="photo-label"
            label={t('photo.labelField')}
            value={label}
            onChange={(v) => setLabel(v as PhotoLabel | '')}
            options={[{ value: '', label: t('photo.unlabeled') }, ...PHOTO_LABELS.map((l) => ({ value: l, label: t(PHOTO_LABEL_KEY[l]) }))]} />
          
          <TextField id="photo-date" label={t('photo.captureDate')} type="date" value={captureDate} onChange={setCaptureDate} />
        </div>
        <SelectField
          id="photo-week"
          label={t('photo.week')}
          value={week}
          onChange={(v) => {
            setWeek(v);
            setError(undefined);
          }}
          options={weeks.map((w) => {
            const used = progress.usedSlots(w) - (photo && photo.weekStart === w && photo.status !== 'conflict' ? 1 : 0);
            return {
              value: w,
              label: `${date(w, { month: 'short', day: 'numeric' })} – ${date(shiftDateKey(w, 6), { month: 'short', day: 'numeric' })} · ${num(used, 0)}/${num(PHOTOS_PER_WEEK, 0)}`,
              disabled: used >= PHOTOS_PER_WEEK
            };
          })} />
        
        <TextField id="photo-note" label={t('form.notes')} optionalLabel={t('common.optional')} value={note} onChange={setNote} />
        {error &&
        <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        }
      </div>
    </Dialog>);

}