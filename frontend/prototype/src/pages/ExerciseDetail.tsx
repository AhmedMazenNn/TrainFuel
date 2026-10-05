import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeftIcon, DumbbellIcon, FolderPlusIcon, PlusIcon } from 'lucide-react';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { Panel } from '../components/Panel';
import { AddToFolderDialog } from '../components/exercises/AddToFolderDialog';
import { RecordList } from '../components/exercises/RecordList';
import { RecordSetDialog } from '../components/exercises/RecordSetDialog';
import { TutorialLinkEditor } from '../components/exercises/TutorialLinkEditor';
import { usePreferences } from '../contexts/PreferencesContext';
import { useTraining } from '../contexts/TrainingContext';
import { useRecordActions } from '../hooks/useRecordActions';
import { EQUIPMENT_KEY, MUSCLE_KEY } from '../utils/training';

export function ExerciseDetail() {
  const { id = '' } = useParams();
  const { t, num } = usePreferences();
  const { getExercise, recordsFor, folders } = useTraining();
  const { openNew, openEdit, handleDelete, dialogProps } = useRecordActions();
  const [folderOpen, setFolderOpen] = useState(false);
  const exercise = getExercise(id);

  if (!exercise) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <EmptyState
          icon={DumbbellIcon}
          title={t('exercise.notFound')}
          body={t('exercise.notFoundBody')}
          action={
          <Link to="/exercises" className="font-semibold text-primary hover:underline">
              {t('exercise.back')}
            </Link>
          } />
        
      </div>);

  }

  const records = recordsFor(exercise.id);
  const best = records.filter((r) => !r.referenceOnly).reduce<number | null>((m, r) => m === null || r.weight > m ? r.weight : m, null);
  const inFolders = folders.filter((f) => f.items.some((i) => i.exerciseId === exercise.id));
  const latest = records.find((r) => !r.referenceOnly);

  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 pb-28 pt-5 md:px-8 md:pb-14 md:pt-8">
      <Link to="/exercises" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeftIcon className="h-4 w-4 rtl:rotate-180" aria-hidden />
        {t('nav.exercises')}
      </Link>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-8">
        <div className="min-w-0 space-y-5">
          <figure className="overflow-hidden rounded-panel border border-line bg-elevated">
            <img src={exercise.image} alt={t('exercise.mediaAlt', { name: exercise.name })} className="aspect-[4/3] w-full object-cover" />
            <figcaption className="border-t border-line bg-surface px-5 py-3 text-xs text-muted">
              {exercise.mediaCredit} · {t('exercise.mediaNote')}
            </figcaption>
          </figure>
          <Panel aria-labelledby="instructions-heading">
            <h2 id="instructions-heading" className="font-display text-lg font-bold text-ink">
              {t('exercise.instructions')}
            </h2>
            <ol className="mt-4 space-y-4">
              {exercise.instructions.map((step, i) =>
              <li key={i} className="flex gap-4">
                  <span className="tnum grid h-7 w-7 shrink-0 place-items-center rounded-full bg-elevated font-display text-sm font-extrabold text-primary">
                    {num(i + 1, 0)}
                  </span>
                  <p className="pt-0.5 text-[15px] leading-relaxed text-ink" lang="en">
                    {step}
                  </p>
                </li>
              )}
            </ol>
          </Panel>
        </div>

        <div className="min-w-0 space-y-5">
          <div>
            <h1 className="font-display text-4xl font-extrabold leading-none tracking-tight text-ink md:text-5xl">{exercise.name}</h1>
            <div className="mt-4 flex flex-wrap gap-2">
              {exercise.muscles.map((m) =>
              <span key={m} className="rounded-full bg-elevated px-3 py-1 text-[13px] font-semibold text-ink">
                  {t(MUSCLE_KEY[m])}
                </span>
              )}
              <span className="rounded-full border border-line px-3 py-1 text-[13px] font-semibold text-muted">
                {t(EQUIPMENT_KEY[exercise.equipment])}
              </span>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button size="lg" icon={PlusIcon} onClick={() => openNew(exercise.id, latest ? { weight: latest.weight, reps: latest.reps } : undefined)}>
                {t('sets.recordTitle')}
              </Button>
              <Button size="lg" variant="secondary" icon={FolderPlusIcon} onClick={() => setFolderOpen(true)}>
                {t('exercise.addToFolder')}
              </Button>
            </div>
            {inFolders.length > 0 &&
            <p className="mt-3 text-[13px] text-muted">
                {t('exercise.inFolders')}{' '}
                {inFolders.map((f, i) =>
              <React.Fragment key={f.id}>
                    {i > 0 && ', '}
                    <Link to={`/folders/${f.id}`} className="font-semibold text-ink hover:underline">
                      {f.name}
                    </Link>
                  </React.Fragment>
              )}
              </p>
            }
          </div>

          <TutorialLinkEditor exerciseId={exercise.id} />

          <Panel aria-labelledby="records-heading">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="records-heading" className="font-display text-lg font-bold text-ink">
                  {t('sets.previous')}
                </h2>
                <p className="text-xs text-muted">{t('sets.previousHint')}</p>
              </div>
              {best !== null &&
              <div className="text-end">
                  <p className="text-xs text-muted">{t('sets.heaviest')}</p>
                  <p className="tnum font-display text-xl font-extrabold text-ink">
                    {num(best)} <span className="text-xs font-semibold text-muted">{t('unit.kg')}</span>
                  </p>
                </div>
              }
            </div>
            <div className="mt-4">
              {records.length === 0 ?
              <p className="rounded-card border border-dashed border-line p-5 text-center text-sm text-muted">{t('exercise.noRecords')}</p> :

              <RecordList records={records} onEdit={openEdit} onDelete={handleDelete} />
              }
            </div>
          </Panel>
        </div>
      </div>

      <RecordSetDialog {...dialogProps} />
      <AddToFolderDialog open={folderOpen} onClose={() => setFolderOpen(false)} exerciseId={exercise.id} exerciseName={exercise.name} />
    </div>);

}