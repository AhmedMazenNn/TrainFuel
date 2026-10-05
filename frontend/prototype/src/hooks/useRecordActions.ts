import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { usePreferences } from '../contexts/PreferencesContext';
import { useTraining } from '../contexts/TrainingContext';
import type { SetRecord } from '../types/training';

interface EditorState {
  open: boolean;
  exerciseId: string;
  record: SetRecord | null;
  prefill?: {weight: number | null;reps: number | null;};
}

/** Shared record-set / edit / delete-with-undo flow for exercise and folder screens. */
export function useRecordActions() {
  const { t } = usePreferences();
  const training = useTraining();
  const [editor, setEditor] = useState<EditorState>({ open: false, exerciseId: '', record: null });

  const openNew = useCallback(
    (exerciseId: string, prefill?: EditorState['prefill']) => setEditor({ open: true, exerciseId, record: null, prefill }),
    []
  );
  const openEdit = useCallback((record: SetRecord) => setEditor({ open: true, exerciseId: record.exerciseId, record }), []);
  const close = useCallback(() => setEditor((e) => ({ ...e, open: false })), []);

  const onSave = useCallback(
    (input: Omit<SetRecord, 'id'>) => {
      if (editor.record) training.updateRecord(editor.record.id, input);else
      training.addRecord(input);
      toast.success(editor.record ? t('entry.updated') : t('sets.recorded'));
      setEditor((e) => ({ ...e, open: false }));
    },
    [editor.record, training, t]
  );

  const handleDelete = useCallback(
    (record: SetRecord) => {
      const removed = training.deleteRecord(record.id);
      if (!removed) return;
      toast(t('sets.recordDeleted'), { action: { label: t('entry.undo'), onClick: () => training.restoreRecord(removed) } });
    },
    [training, t]
  );

  return {
    openNew,
    openEdit,
    handleDelete,
    dialogProps: {
      open: editor.open,
      onClose: close,
      exerciseId: editor.exerciseId,
      exerciseName: training.getExercise(editor.exerciseId)?.name ?? '',
      record: editor.record,
      prefill: editor.prefill,
      onSave
    }
  };
}