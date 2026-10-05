import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronDownIcon, ChevronUpIcon, CopyIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { usePreferences } from '../../contexts/PreferencesContext';
import { useTraining } from '../../contexts/TrainingContext';
import type { WorkoutFolder } from '../../types/training';

interface FolderCardProps {
  folder: WorkoutFolder;
  index: number;
  total: number;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
}

export function FolderCard({ folder, index, total, onRename, onDuplicate, onDelete, onMove }: FolderCardProps) {
  const { t, num } = usePreferences();
  const { getExercise } = useTraining();
  const items = folder.items.map((i) => ({ item: i, exercise: getExercise(i.exerciseId) })).filter((x) => x.exercise);
  const totalSets = folder.items.reduce((s, i) => s + i.sets.length, 0);
  const btn =
  'grid h-8 w-8 place-items-center rounded-[10px] text-muted transition-colors duration-150 hover:bg-elevated hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent';

  return (
    <article className="flex h-full flex-col rounded-panel border border-line bg-surface transition-colors duration-150 hover:border-muted/40">
      <Link to={`/folders/${folder.id}`} className="block flex-1 rounded-t-panel p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-display text-2xl font-extrabold tracking-tight text-ink">{folder.name}</h2>
            <p className="tnum mt-1 text-[13px] text-muted">
              {t('folders.count', { count: num(items.length, 0) })} · {t('folders.setCount', { count: num(totalSets, 0) })}
            </p>
          </div>
          <div className="flex -space-x-2 rtl:space-x-reverse" aria-hidden>
            {items.slice(0, 3).map(({ exercise }) =>
            <img
              key={exercise!.id}
              src={exercise!.image}
              alt=""
              className="h-10 w-10 rounded-full border-2 border-surface object-cover" />

            )}
          </div>
        </div>
        {items.length === 0 ?
        <p className="mt-5 rounded-card border border-dashed border-line p-4 text-sm text-muted">{t('folders.empty.short')}</p> :

        <ol className="mt-5 space-y-2">
            {items.slice(0, 3).map(({ item, exercise }, i) =>
          <li key={item.id} className="flex items-center gap-3 text-sm">
                <span className="tnum w-5 text-xs font-bold text-muted">{num(i + 1, 0)}</span>
                <span className="min-w-0 flex-1 truncate font-semibold text-ink">{exercise!.name}</span>
                <span className="tnum text-xs text-muted">{t('folders.setCount', { count: num(item.sets.length, 0) })}</span>
              </li>
          )}
            {items.length > 3 && <li className="ps-8 text-xs text-muted">{t('folders.more', { count: num(items.length - 3, 0) })}</li>}
          </ol>
        }
      </Link>
      <div className="flex items-center gap-0.5 border-t border-line px-3 py-2">
        <button type="button" className={btn} onClick={() => onMove(-1)} disabled={index === 0} aria-label={t('folders.moveUp', { name: folder.name })}>
          <ChevronUpIcon className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => onMove(1)}
          disabled={index === total - 1}
          aria-label={t('folders.moveDown', { name: folder.name })}>
          
          <ChevronDownIcon className="h-4 w-4" aria-hidden />
        </button>
        <span className="flex-1" />
        <button type="button" className={btn} onClick={onRename} aria-label={t('folders.renameNamed', { name: folder.name })}>
          <PencilIcon className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" className={btn} onClick={onDuplicate} aria-label={t('folders.duplicateNamed', { name: folder.name })}>
          <CopyIcon className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          className={`${btn} hover:!bg-danger-soft hover:!text-danger`}
          onClick={onDelete}
          aria-label={t('folders.deleteNamed', { name: folder.name })}>
          
          <Trash2Icon className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </article>);

}