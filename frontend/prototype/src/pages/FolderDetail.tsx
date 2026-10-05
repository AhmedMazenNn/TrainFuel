import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeftIcon, FolderOpenIcon, PencilIcon, PlusIcon } from 'lucide-react';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { RecordSetDialog } from '../components/exercises/RecordSetDialog';
import { AddExerciseDialog } from '../components/folders/AddExerciseDialog';
import { FolderExerciseBlock } from '../components/folders/FolderExerciseBlock';
import { FolderNameDialog } from '../components/folders/FolderNameDialog';
import { usePreferences } from '../contexts/PreferencesContext';
import { useTraining } from '../contexts/TrainingContext';
import { useRecordActions } from '../hooks/useRecordActions';

export function FolderDetail() {
  const { id = '' } = useParams();
  const { t, num } = usePreferences();
  const training = useTraining();
  const { openNew, dialogProps } = useRecordActions();
  const [renameOpen, setRenameOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const folder = training.folders.find((f) => f.id === id);

  if (training.status === 'loading') {
    return <div className="mx-auto mt-10 h-96 max-w-5xl rounded-panel bg-surface motion-safe:animate-pulse" aria-busy="true" />;
  }

  if (!folder) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <EmptyState
          icon={FolderOpenIcon}
          title={t('folders.notFound')}
          body={t('folders.notFoundBody')}
          action={
          <Link to="/folders" className="font-semibold text-primary hover:underline">
              {t('nav.folders')}
            </Link>
          } />
        
      </div>);

  }

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pb-28 pt-5 md:px-8 md:pb-14 md:pt-8">
      <Link to="/folders" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeftIcon className="h-4 w-4 rtl:rotate-180" aria-hidden />
        {t('nav.folders')}
      </Link>
      <div className="mt-4">
        <PageHeader
          title={folder.name}
          subtitle={t('folders.detailSubtitle', { count: num(folder.items.length, 0) })}
          actions={
          <>
              <Button variant="secondary" icon={PencilIcon} onClick={() => setRenameOpen(true)}>
                {t('folders.rename')}
              </Button>
              <Button icon={PlusIcon} onClick={() => setAddOpen(true)}>
                {t('folders.addExercise')}
              </Button>
            </>
          } />
        
      </div>

      <div className="mt-8 space-y-4">
        {folder.items.length === 0 ?
        <EmptyState
          icon={PlusIcon}
          title={t('folders.emptyDetail')}
          body={t('folders.emptyDetailBody')}
          action={
          <Button icon={PlusIcon} onClick={() => setAddOpen(true)}>
                {t('folders.addExercise')}
              </Button>
          } /> :


        folder.items.map((item, i) =>
        <FolderExerciseBlock key={item.id} folderId={folder.id} item={item} index={i} total={folder.items.length} onRecord={openNew} />
        )
        }
      </div>
      <p className="mt-6 text-[13px] text-muted">{t('folders.plannedNote')}</p>

      <RecordSetDialog {...dialogProps} />
      <FolderNameDialog
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        mode="rename"
        initialName={folder.name}
        onSave={(name) => {
          training.renameFolder(folder.id, name);
          setRenameOpen(false);
          toast.success(t('folders.renamed'));
        }} />
      
      <AddExerciseDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onPick={(exerciseId) => {
          training.addExerciseToFolder(folder.id, exerciseId);
          setAddOpen(false);
          toast.success(t('folders.added', { exercise: training.getExercise(exerciseId)?.name ?? '', folder: folder.name }));
        }} />
      
    </div>);

}