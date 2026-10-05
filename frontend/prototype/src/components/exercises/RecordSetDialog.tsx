import React, { useEffect, useState } from 'react';
import { Button } from '../Button';
import { Dialog } from '../Dialog';
import { TextField } from '../TextField';
import { usePreferences } from '../../contexts/PreferencesContext';
import { todayKey } from '../../utils/dates';
import { parseNumberInput } from '../../utils/format';
import type { SetRecord } from '../../types/training';

interface RecordSetDialogProps {
  open: boolean;
  onClose: () => void;
  exerciseId: string;
  exerciseName: string;
  record?: SetRecord | null;
  prefill?: {weight: number | null;reps: number | null;};
  onSave: (input: Omit<SetRecord, 'id'>) => void;
}

export function RecordSetDialog({ open, onClose, exerciseId, exerciseName, record, prefill, onSave }: RecordSetDialogProps) {
  const { t } = usePreferences();
  const [values, setValues] = useState({ date: todayKey(), weight: '', reps: '', note: '', referenceOnly: false });
  const [errors, setErrors] = useState<{weight?: string;reps?: string;date?: string;}>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setValues(
      record ?
      { date: record.date, weight: String(record.weight), reps: String(record.reps), note: record.note, referenceOnly: record.referenceOnly } :
      {
        date: todayKey(),
        weight: prefill?.weight != null ? String(prefill.weight) : '',
        reps: prefill?.reps != null ? String(prefill.reps) : '',
        note: '',
        referenceOnly: false
      }
    );
  }, [open, record, prefill]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const w = parseNumberInput(values.weight);
    const r = parseNumberInput(values.reps);
    const errs: typeof errors = {};
    if (w.kind !== 'value') errs.weight = t('form.errorNumber');
    if (r.kind !== 'value' || r.value < 1 || !Number.isInteger(r.value)) errs.reps = t('sets.errorReps');
    if (!values.date) errs.date = t('form.errorDate');
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    onSave({
      exerciseId,
      date: values.date,
      weight: w.kind === 'value' ? w.value : 0,
      reps: r.kind === 'value' ? r.value : 0,
      note: values.note.trim(),
      referenceOnly: values.referenceOnly
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      variant="drawer"
      title={record ? t('sets.editRecord') : t('sets.recordTitle')}
      description={exerciseName}
      footer={
      <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="record-set-form">
            {t('sets.saveRecord')}
          </Button>
        </div>
      }>
      
      <form id="record-set-form" noValidate onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <TextField
            id="record-weight"
            label={t('sets.weight')}
            inputMode="decimal"
            suffix={t('unit.kg')}
            value={values.weight}
            onChange={(v) => setValues((s) => ({ ...s, weight: v }))}
            error={errors.weight}
            className="[&_input]:h-12 [&_input]:font-display [&_input]:text-xl [&_input]:font-bold"
            data-autofocus />
          
          <TextField
            id="record-reps"
            label={t('sets.reps')}
            inputMode="numeric"
            value={values.reps}
            onChange={(v) => setValues((s) => ({ ...s, reps: v }))}
            error={errors.reps}
            className="[&_input]:h-12 [&_input]:font-display [&_input]:text-xl [&_input]:font-bold" />
          
        </div>
        <TextField
          id="record-date"
          label={t('form.date')}
          type="date"
          value={values.date}
          onChange={(v) => setValues((s) => ({ ...s, date: v }))}
          error={errors.date} />
        
        <TextField
          id="record-note"
          label={t('form.notes')}
          optionalLabel={t('common.optional')}
          value={values.note}
          onChange={(v) => setValues((s) => ({ ...s, note: v }))} />
        
        <label className="flex cursor-pointer items-start gap-3 rounded-card border border-line p-3.5">
          <input
            type="checkbox"
            checked={values.referenceOnly}
            onChange={(e) => setValues((s) => ({ ...s, referenceOnly: e.target.checked }))}
            className="mt-0.5 h-4 w-4 accent-primary" />
          
          <span>
            <span className="block text-sm font-semibold text-ink">{t('sets.referenceOnly')}</span>
            <span className="block text-[13px] text-muted">{t('sets.referenceOnlyHint')}</span>
          </span>
        </label>
      </form>
    </Dialog>);

}