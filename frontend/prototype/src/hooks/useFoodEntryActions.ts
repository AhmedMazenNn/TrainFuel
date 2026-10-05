import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useNutrition } from '../contexts/NutritionContext';
import { usePreferences } from '../contexts/PreferencesContext';
import type { FoodEntry, FoodEntryInput } from '../types/nutrition';

/** Shared add / edit / delete-with-undo behavior for any screen that shows food entries. */
export function useFoodEntryActions() {
  const nutrition = useNutrition();
  const { t, date } = usePreferences();
  const [editor, setEditor] = useState<{open: boolean;entry: FoodEntry | null;}>({ open: false, entry: null });
  const shortDate = useCallback((key: string) => date(key, { month: 'short', day: 'numeric' }), [date]);

  const openAdd = useCallback(() => setEditor({ open: true, entry: null }), []);
  const openEdit = useCallback((entry: FoodEntry) => setEditor({ open: true, entry }), []);
  const closeEditor = useCallback(() => setEditor((e) => ({ ...e, open: false })), []);

  const handleSubmit = useCallback(
    (input: FoodEntryInput, entry: FoodEntry | null) => {
      const view = { label: t('entry.view'), onClick: () => nutrition.setSelectedDate(input.date) };
      if (entry) {
        nutrition.updateEntry(entry.id, entry.date, input);
        if (input.date !== entry.date) toast.success(t('entry.movedTo', { date: shortDate(input.date) }), { action: view });else
        toast.success(input.status === 'draft' ? t('entry.savedDraft') : t('entry.updated'));
      } else {
        nutrition.addEntry(input);
        const msg = input.status === 'draft' ? t('entry.savedDraft') : t('entry.added', { name: input.name });
        if (input.date !== nutrition.selectedDate) toast.success(`${msg} · ${shortDate(input.date)}`, { action: view });else
        toast.success(msg);
      }
      setEditor((e) => ({ ...e, open: false }));
    },
    [nutrition, shortDate, t]
  );

  const handleDelete = useCallback(
    (entry: FoodEntry) => {
      const removed = nutrition.deleteEntry(entry.date, entry.id);
      if (!removed) return;
      toast(t('entry.deleted', { name: entry.name }), {
        action: {
          label: t('entry.undo'),
          onClick: () => {
            nutrition.restoreEntry(removed);
            toast.success(t('entry.restored'));
          }
        }
      });
    },
    [nutrition, t]
  );

  return {
    openAdd,
    openEdit,
    handleDelete,
    dialogProps: {
      open: editor.open,
      entry: editor.entry,
      onClose: closeEditor,
      onSubmit: handleSubmit,
      defaultDate: nutrition.selectedDate
    }
  };
}