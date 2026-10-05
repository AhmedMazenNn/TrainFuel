import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CheckIcon, FolderPlusIcon } from 'lucide-react';
import { Button } from '../Button';
import { Dialog } from '../Dialog';
import { TextField } from '../TextField';
import { usePreferences } from '../../contexts/PreferencesContext';
import { useTraining } from '../../contexts/TrainingContext';

interface AddToFolderDialogProps {
  open: boolean;
  onClose: () => void;
  exerciseId: string;
  exerciseName: string;
}

export function AddToFolderDialog({ open, onClose, exerciseId, exerciseName }: AddToFolderDialogProps) {
  const { t, num } = usePreferences();
  const { folders, addExerciseToFolder, createFolder } = useTraining();
  const [selected, setSelected] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (open) {
      setSelected(folders[0]?.id ?? null);
      setNewName('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = () => {
    let folderId = selected;
    let folderName = folders.find((f) => f.id === selected)?.name ?? '';
    if (newName.trim()) {
      const folder = createFolder(newName.trim());
      folderId = folder.id;
      folderName = folder.name;
    }
    if (!folderId) return;
    addExerciseToFolder(folderId, exerciseId);
    toast.success(t('folders.added', { exercise: exerciseName, folder: folderName }));
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('exercise.addToFolder')}
      description={exerciseName}
      footer={
      <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={save} disabled={!selected && !newName.trim()}>
            {t('exercise.addToFolder')}
          </Button>
        </div>
      }>
      
      <div role="radiogroup" aria-label={t('nav.folders')} className="space-y-2">
        {folders.map((f) => {
          const active = selected === f.id && !newName.trim();
          return (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                setSelected(f.id);
                setNewName('');
              }}
              className={`flex w-full items-center gap-3 rounded-card border p-3 text-start transition-colors duration-150 ${
              active ? 'border-primary bg-primary-soft' : 'border-line hover:bg-elevated'}`
              }>
              
              <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-elevated font-display text-sm font-extrabold text-primary">
                {f.name.charAt(0).toUpperCase()}
              </span>
              <span className="flex-1">
                <span className="block text-sm font-semibold text-ink">{f.name}</span>
                <span className="block text-xs text-muted">{t('folders.count', { count: num(f.items.length, 0) })}</span>
              </span>
              {active && <CheckIcon className="h-4 w-4 text-primary" aria-hidden />}
            </button>);

        })}
      </div>
      <div className="mt-5 border-t border-line pt-5">
        <p className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-ink">
          <FolderPlusIcon className="h-4 w-4 text-muted" aria-hidden />
          {t('folders.orCreate')}
        </p>
        <TextField
          id="new-folder-name"
          label={t('folders.nameLabel')}
          hideLabel
          placeholder={t('folders.namePlaceholder')}
          value={newName}
          onChange={setNewName} />
        
      </div>
    </Dialog>);

}