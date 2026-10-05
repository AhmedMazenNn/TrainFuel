import React, { useEffect, useState } from 'react';
import { Button } from '../Button';
import { Dialog } from '../Dialog';
import { TextField } from '../TextField';
import { usePreferences } from '../../contexts/PreferencesContext';
import { todayKey } from '../../utils/dates';
import { parseNumberInput } from '../../utils/format';
import type { WeightEntry } from '../../types/progress';

interface WeightEntryDialogProps {
  open: boolean;
  onClose: () => void;
  entry: WeightEntry | null;
  onSave: (input: Omit<WeightEntry, 'id'>) => void;
}

export function WeightEntryDialog({ open, onClose, entry, onSave }: WeightEntryDialogProps) {
  const { t } = usePreferences();
  const [values, setValues] = useState({ date: todayKey(), weight: '', note: '' });
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setValues(entry ? { date: entry.date, weight: String(entry.weight), note: entry.note } : { date: todayKey(), weight: '', note: '' });
    setError(undefined);
  }, [open, entry]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const w = parseNumberInput(values.weight);
    if (w.kind !== 'value' || w.value <= 0) {
      setError(t('progress.weightError'));
      return;
    }
    onSave({ date: values.date || todayKey(), weight: w.value, note: values.note.trim() });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={entry ? t('progress.editWeight') : t('progress.addWeight')}
      footer={
      <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="weight-form">
            {t('common.save')}
          </Button>
        </div>
      }>
      
      <form id="weight-form" noValidate onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <TextField
            id="weight-value"
            label={t('progress.weight')}
            inputMode="decimal"
            suffix={t('unit.kg')}
            value={values.weight}
            onChange={(v) => {
              setValues((s) => ({ ...s, weight: v }));
              setError(undefined);
            }}
            error={error}
            className="[&_input]:h-12 [&_input]:font-display [&_input]:text-xl [&_input]:font-bold"
            data-autofocus />
          
          <TextField id="weight-date" label={t('form.date')} type="date" value={values.date} onChange={(v) => setValues((s) => ({ ...s, date: v }))} />
        </div>
        <TextField
          id="weight-note"
          label={t('form.notes')}
          optionalLabel={t('common.optional')}
          value={values.note}
          onChange={(v) => setValues((s) => ({ ...s, note: v }))} />
        
      </form>
    </Dialog>);

}