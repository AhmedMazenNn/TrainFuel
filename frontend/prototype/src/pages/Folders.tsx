import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { FolderPlusIcon, FolderOpenIcon } from 'lucide-react';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { FolderCard } from '../components/folders/FolderCard';
import { FolderNameDialog } from '../components/folders/FolderNameDialog';
import { usePreferences } from '../contexts/PreferencesContext';
import { useTraining } from '../contexts/TrainingContext';
import type { WorkoutFolder } from '../types/training';

export function Folders() {
  const { t, num } = usePreferences();
  const training = useTraining();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<{mode: 'create' | 'rename';folder?: WorkoutFolder;} | null>(null);

  const handleDelete = (folder: WorkoutFolder) => {
    const removed = training.deleteFolder(folder.id);
    if (removed) {
      toast(t('folders.deleted', { name: folder.name }), {
        action: { label: t('entry.undo'), onClick: () => training.restoreFolder(removed) }
      });
    }
  };

  const save = (name: string) => {
    if (dialog?.mode === 'rename' && dialog.folder) {
      training.renameFolder(dialog.folder.id, name);
      toast.success(t('folders.renamed'));
      setDialog(null);
    } else {
      const folder = training.createFolder(name);
      setDialog(null);
      navigate(`/folders/${folder.id}`);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 pb-28 pt-5 md:px-8 md:pb-14 md:pt-8">
      <PageHeader
        title={t('nav.folders')}
        subtitle={t('folders.subtitle', { count: num(training.folders.length, 0) })}
        actions={
        <Button size="lg" icon={FolderPlusIcon} onClick={() => setDialog({ mode: 'create' })}>
            {t('folders.create')}
          </Button>
        } />
      

      {training.status === 'loading' ?
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) =>
        <div key={i} className="h-60 rounded-panel bg-surface motion-safe:animate-pulse" />
        )}
        </div> :
      training.folders.length === 0 ?
      <EmptyState
        icon={FolderOpenIcon}
        title={t('folders.empty.title')}
        body={t('folders.empty.body')}
        action={
        <Button icon={FolderPlusIcon} onClick={() => setDialog({ mode: 'create' })}>
              {t('folders.create')}
            </Button>
        } /> :


      <ul className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {training.folders.map((f, i) =>
        <li key={f.id}>
              <FolderCard
            folder={f}
            index={i}
            total={training.folders.length}
            onRename={() => setDialog({ mode: 'rename', folder: f })}
            onDuplicate={() => {
              training.duplicateFolder(f.id, t('folders.copySuffix'));
              toast.success(t('folders.duplicated', { name: f.name }));
            }}
            onDelete={() => handleDelete(f)}
            onMove={(dir) => training.moveFolder(f.id, dir)} />
          
            </li>
        )}
        </ul>
      }
      <p className="mt-6 text-[13px] text-muted">{t('folders.noCompletion')}</p>

      <FolderNameDialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        mode={dialog?.mode ?? 'create'}
        initialName={dialog?.folder?.name ?? ''}
        onSave={save} />
      
    </div>);

}