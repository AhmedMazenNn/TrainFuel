import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../Button';
import { RecordList } from '../exercises/RecordList';
import { PlannedSetRow, SET_GRID } from './PlannedSetRow';
import { usePreferences } from '../../contexts/PreferencesContext';
import { useTraining } from '../../contexts/TrainingContext';
import { MUSCLE_KEY } from '../../utils/training';
import type { FolderExercise } from '../../types/training';

interface FolderExerciseBlockProps {
  folderId: string;
  item: FolderExercise;
  index: number;
  total: number;
  onRecord: (exerciseId: string, prefill?: {weight: number | null;reps: number | null;}) => void;
}

export function FolderExerciseBlock({ folderId, item, index, total, onRecord }: FolderExerciseBlockProps) {
  const { t, num } = usePreferences();
  const training = useTraining();
  const exercise = training.getExercise(item.exerciseId);
  if (!exercise) return null;
  const records = training.recordsFor(exercise.id);

  const remove = () => {
    const removed = training.removeFolderItem(folderId, item.id);
    if (removed) {
      toast(t('folders.itemRemoved', { name: exercise.name }), {
        action: { label: t('entry.undo'), onClick: () => training.restoreFolderItem(removed) }
      });
    }
  };

  const moveBtn =
  'grid h-8 w-8 place-items-center rounded-[10px] text-muted transition-colors duration-150 hover:bg-elevated hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent';

  return (
    <article aria-labelledby={`item-${item.id}`} className="rounded-panel border border-line bg-surface">
      <header className="flex items-center gap-3 border-b border-line p-4 md:px-6">
        <span className="tnum grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line font-display text-sm font-extrabold text-primary">
          {num(index + 1, 0)}
        </span>
        <img src={exercise.image} alt="" className="hidden h-11 w-11 rounded-[12px] object-cover sm:block" />
        <div className="min-w-0 flex-1">
          <h2 id={`item-${item.id}`} className="truncate font-display text-lg font-bold text-ink">
            <Link to={`/exercises/${exercise.id}`} className="hover:underline">
              {exercise.name}
            </Link>
          </h2>
          <p className="truncate text-xs text-muted">{exercise.muscles.map((m) => t(MUSCLE_KEY[m])).join(' · ')}</p>
        </div>
        <div className="flex shrink-0">
          <button type="button" className={moveBtn} disabled={index === 0} onClick={() => training.moveFolderItem(folderId, item.id, -1)} aria-label={t('folders.moveUp', { name: exercise.name })}>
            <ArrowUpIcon className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" className={moveBtn} disabled={index === total - 1} onClick={() => training.moveFolderItem(folderId, item.id, 1)} aria-label={t('folders.moveDown', { name: exercise.name })}>
            <ArrowDownIcon className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" className={`${moveBtn} hover:!bg-danger-soft hover:!text-danger`} onClick={remove} aria-label={t('folders.removeItem', { name: exercise.name })}>
            <Trash2Icon className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </header>

      <div className="grid gap-6 p-4 md:px-6 md:py-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          <div className={`mb-2 grid gap-2 text-[11px] font-semibold text-muted ${SET_GRID}`} aria-hidden>
            <span className="text-center">#</span>
            <span>{t('sets.plannedWeight')}</span>
            <span>{t('sets.reps')}</span>
            <span className="w-[5.25rem]" />
          </div>
          {item.sets.length === 0 ?
          <p className="rounded-card border border-dashed border-line p-4 text-sm text-muted">{t('sets.noPlanned')}</p> :

          <ol className="space-y-2" aria-label={t('sets.planned')}>
              {item.sets.map((s, i) =>
            <PlannedSetRow
              key={s.id}
              set={s}
              index={i}
              total={item.sets.length}
              onChange={(patch) => training.updateSet(folderId, item.id, s.id, patch)}
              onMove={(dir) => training.moveSet(folderId, item.id, s.id, dir)}
              onRemove={() => training.removeSet(folderId, item.id, s.id)} />

            )}
            </ol>
          }
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" icon={PlusIcon} onClick={() => training.addSet(folderId, item.id)}>
              {t('sets.addSet')}
            </Button>
          </div>
        </div>

        <aside aria-label={t('sets.previous')} className="rounded-card bg-canvas/60 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[13px] font-semibold text-ink">{t('sets.previous')}</h3>
            <Button
              size="sm"
              variant="secondary"
              icon={PlusIcon}
              onClick={() => onRecord(exercise.id, item.sets[0] ? { weight: item.sets[0].weight, reps: item.sets[0].reps } : undefined)}>
              
              {t('sets.record')}
            </Button>
          </div>
          <div className="mt-3">
            {records.length === 0 ?
            <p className="text-[13px] text-muted">{t('exercise.noRecords')}</p> :

            <RecordList records={records} maxDates={2} />
            }
          </div>
        </aside>
      </div>
    </article>);

}