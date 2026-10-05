import React from 'react';
import { BookmarkIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { usePreferences } from '../../contexts/PreferencesContext';
import { groupRecordsByDate } from '../../utils/training';
import type { SetRecord } from '../../types/training';

interface RecordListProps {
  records: SetRecord[];
  maxDates?: number;
  onEdit?: (record: SetRecord) => void;
  onDelete?: (record: SetRecord) => void;
}

export function RecordList({ records, maxDates, onEdit, onDelete }: RecordListProps) {
  const { t, num, date } = usePreferences();
  const groups = groupRecordsByDate(records).slice(0, maxDates);

  return (
    <ol className="space-y-4">
      {groups.map((g) =>
      <li key={g.date}>
          <p className="text-xs font-semibold text-muted">{date(g.date, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
          <ul className="mt-1.5 space-y-1">
            {g.records.map((r) =>
          <li key={r.id} className="group flex items-center gap-3 rounded-[12px] bg-elevated px-3 py-2">
                <span className="tnum font-display text-[15px] font-extrabold text-ink">
                  {num(r.weight)}
                  <span className="text-xs font-semibold text-muted"> {t('unit.kg')}</span>
                  <span className="mx-1 text-muted">×</span>
                  {num(r.reps, 0)}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted">
                  {r.referenceOnly &&
              <span className="me-1.5 inline-flex items-center gap-1 font-semibold text-attention">
                      <BookmarkIcon className="h-3 w-3" aria-hidden />
                      {t('sets.reference')}
                    </span>
              }
                  {r.note}
                </span>
                {onEdit &&
            <button
              type="button"
              onClick={() => onEdit(r)}
              aria-label={t('sets.editRecord')}
              className="grid h-7 w-7 place-items-center rounded-[8px] text-muted hover:bg-surface hover:text-ink">
              
                    <PencilIcon className="h-3.5 w-3.5" aria-hidden />
                  </button>
            }
                {onDelete &&
            <button
              type="button"
              onClick={() => onDelete(r)}
              aria-label={t('sets.deleteRecord')}
              className="grid h-7 w-7 place-items-center rounded-[8px] text-muted hover:bg-danger-soft hover:text-danger">
              
                    <Trash2Icon className="h-3.5 w-3.5" aria-hidden />
                  </button>
            }
              </li>
          )}
          </ul>
        </li>
      )}
    </ol>);

}