import React, { useEffect, useState } from 'react';
import { SearchIcon } from 'lucide-react';
import { Dialog } from '../Dialog';
import { fieldClass } from '../TextField';
import { usePreferences } from '../../contexts/PreferencesContext';
import { useTraining } from '../../contexts/TrainingContext';
import { EQUIPMENT_KEY, MUSCLE_KEY } from '../../utils/training';

interface AddExerciseDialogProps {
  open: boolean;
  onClose: () => void;
  onPick: (exerciseId: string) => void;
}

export function AddExerciseDialog({ open, onClose, onPick }: AddExerciseDialogProps) {
  const { t } = usePreferences();
  const { exercises } = useTraining();
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (open) setQuery('');
  }, [open]);
  const list = exercises.filter((e) => e.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <Dialog open={open} onClose={onClose} title={t('folders.addExercise')} variant="drawer">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <label htmlFor="add-exercise-search" className="sr-only">
          {t('exercise.search')}
        </label>
        <input
          id="add-exercise-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('exercise.search')}
          className={`${fieldClass()} h-11 ps-9`}
          data-autofocus />
        
      </div>
      <ul className="mt-4 space-y-1.5">
        {list.map((e) =>
        <li key={e.id}>
            <button
            type="button"
            onClick={() => onPick(e.id)}
            className="flex w-full items-center gap-3 rounded-card p-2 text-start transition-colors duration-150 hover:bg-elevated">
            
              <img src={e.image} alt="" className="h-12 w-12 rounded-[12px] object-cover" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{e.name}</span>
                <span className="block truncate text-xs text-muted">
                  {e.muscles.map((m) => t(MUSCLE_KEY[m])).join(' · ')} · {t(EQUIPMENT_KEY[e.equipment])}
                </span>
              </span>
            </button>
          </li>
        )}
        {list.length === 0 && <li className="py-6 text-center text-sm text-muted">{t('exercise.noResults')}</li>}
      </ul>
    </Dialog>);

}