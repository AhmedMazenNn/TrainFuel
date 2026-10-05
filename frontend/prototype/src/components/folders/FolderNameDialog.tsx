import React, { useEffect, useState } from 'react';
import { Button } from '../Button';
import { Dialog } from '../Dialog';
import { TextField } from '../TextField';
import { usePreferences } from '../../contexts/PreferencesContext';

interface FolderNameDialogProps {
  open: boolean;
  onClose: () => void;
  initialName?: string;
  mode: 'create' | 'rename';
  onSave: (name: string) => void;
}

export function FolderNameDialog({ open, onClose, initialName = '', mode, onSave }: FolderNameDialogProps) {
  const { t } = usePreferences();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (open) {
      setName(initialName);
      setError(undefined);
    }
  }, [open, initialName]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t('folders.nameError'));
      return;
    }
    onSave(name.trim());
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={mode === 'create' ? t('folders.create') : t('folders.rename')}
      footer={
      <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="folder-name-form">
            {mode === 'create' ? t('folders.create') : t('common.save')}
          </Button>
        </div>
      }>
      
      <form id="folder-name-form" onSubmit={submit} noValidate>
        <TextField
          id="folder-name"
          label={t('folders.nameLabel')}
          placeholder={t('folders.namePlaceholder')}
          value={name}
          onChange={(v) => {
            setName(v);
            setError(undefined);
          }}
          error={error}
          data-autofocus />
        
      </form>
    </Dialog>);

}