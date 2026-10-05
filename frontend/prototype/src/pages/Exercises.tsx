import React, { useMemo, useState } from 'react';
import { SearchIcon, SearchXIcon } from 'lucide-react';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { ExerciseCard } from '../components/exercises/ExerciseCard';
import { fieldClass } from '../components/TextField';
import { usePreferences } from '../contexts/PreferencesContext';
import { useTraining } from '../contexts/TrainingContext';
import { equipmentTypes, muscleGroups } from '../data/exercises';
import { EQUIPMENT_KEY, MUSCLE_KEY } from '../utils/training';
import type { Equipment, MuscleGroup } from '../types/training';

export function Exercises() {
  const { t, num } = usePreferences();
  const { exercises, records, tutorialLinks, status } = useTraining();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter(
      (e) =>
      (!q || e.name.toLowerCase().includes(q)) && (
      !muscle || e.muscles.includes(muscle)) && (
      !equipment || e.equipment === equipment)
    );
  }, [exercises, query, muscle, equipment]);

  const lastRecord = (id: string) =>
  records.filter((r) => r.exerciseId === id && !r.referenceOnly).sort((a, b) => a.date < b.date ? 1 : -1)[0];
  const usedEquipment = equipmentTypes.filter((eq) => exercises.some((e) => e.equipment === eq));
  const clear = () => {
    setQuery('');
    setMuscle(null);
    setEquipment(null);
  };

  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 pb-28 pt-5 md:px-8 md:pb-14 md:pt-8">
      <PageHeader title={t('nav.exercises')} subtitle={t('exercise.subtitle', { count: num(exercises.length, 0) })} />

      <div className="mt-8 space-y-3">
        <div className="relative max-w-xl">
          <SearchIcon className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <label htmlFor="exercise-search" className="sr-only">
            {t('exercise.search')}
          </label>
          <input
            id="exercise-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('exercise.search')}
            className={`${fieldClass()} h-12 bg-surface ps-10`} />
          
        </div>
        <div role="group" aria-label={t('exercise.filterMuscle')} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          <Chip selected={!muscle} onClick={() => setMuscle(null)}>
            {t('exercise.allMuscles')}
          </Chip>
          {muscleGroups.map((m) =>
          <Chip key={m} selected={muscle === m} onClick={() => setMuscle(muscle === m ? null : m)}>
              {t(MUSCLE_KEY[m])}
            </Chip>
          )}
        </div>
        <div role="group" aria-label={t('exercise.filterEquipment')} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          {usedEquipment.map((eq) =>
          <Chip key={eq} selected={equipment === eq} onClick={() => setEquipment(equipment === eq ? null : eq)}>
              {t(EQUIPMENT_KEY[eq])}
            </Chip>
          )}
        </div>
      </div>

      <p className="tnum mt-6 text-[13px] text-muted" aria-live="polite">
        {t('exercise.results', { count: num(results.length, 0) })}
      </p>

      {status === 'loading' ?
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) =>
        <div key={i} className="h-72 rounded-panel bg-surface motion-safe:animate-pulse" />
        )}
        </div> :
      results.length === 0 ?
      <EmptyState
        icon={SearchXIcon}
        title={t('exercise.noResults')}
        body={t('exercise.noResultsBody')}
        action={
        <Button variant="secondary" onClick={clear}>
              {t('exercise.clearFilters')}
            </Button>
        } /> :


      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {results.map((e) =>
        <li key={e.id}>
              <ExerciseCard exercise={e} lastRecord={lastRecord(e.id)} hasPrivateLink={Boolean(tutorialLinks[e.id])} />
            </li>
        )}
        </ul>
      }
      <p className="mt-8 text-xs text-muted">{t('exercise.mediaNote')}</p>
    </div>);

}