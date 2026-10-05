import React, { useEffect, useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon, XIcon } from 'lucide-react';
import { usePreferences } from '../../contexts/PreferencesContext';
import { parseNumberInput } from '../../utils/format';
import type { PlannedSet } from '../../types/training';

interface PlannedSetRowProps {
  set: PlannedSet;
  index: number;
  total: number;
  onChange: (patch: Partial<PlannedSet>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}

export const SET_GRID = 'grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_auto]';

const inputCls =
'tnum h-10 w-full rounded-[10px] border border-line bg-canvas px-3 font-display text-[15px] font-bold text-ink transition-colors duration-150 hover:border-muted/40 focus:border-primary focus:outline-none focus-visible:outline-none aria-[invalid=true]:border-danger';

export function PlannedSetRow({ set, index, total, onChange, onMove, onRemove }: PlannedSetRowProps) {
  const { t, num } = usePreferences();
  const [weight, setWeight] = useState(set.weight === null ? '' : String(set.weight));
  const [reps, setReps] = useState(set.reps === null ? '' : String(set.reps));
  const [invalid, setInvalid] = useState<{weight?: boolean;reps?: boolean;}>({});

  useEffect(() => setWeight(set.weight === null ? '' : String(set.weight)), [set.weight]);
  useEffect(() => setReps(set.reps === null ? '' : String(set.reps)), [set.reps]);

  const commit = (field: 'weight' | 'reps', raw: string) => {
    const parsed = parseNumberInput(raw);
    if (parsed.kind === 'invalid' || field === 'reps' && parsed.kind === 'value' && !Number.isInteger(parsed.value)) {
      setInvalid((s) => ({ ...s, [field]: true }));
      return;
    }
    setInvalid((s) => ({ ...s, [field]: false }));
    const next = parsed.kind === 'value' ? parsed.value : null;
    if (next !== set[field]) onChange({ [field]: next });
  };

  const label = t('sets.setNumber', { n: num(index + 1, 0) });
  const iconBtn =
  'grid h-8 w-7 place-items-center rounded-[8px] text-muted transition-colors duration-150 hover:bg-elevated hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent';

  return (
    <li className={`grid items-center gap-2 ${SET_GRID}`}>
      <span className="tnum text-center font-display text-sm font-extrabold text-muted" aria-hidden>
        {num(index + 1, 0)}
      </span>
      <div className="relative">
        <input
          aria-label={`${label}, ${t('sets.weight')} (${t('unit.kg')})`}
          inputMode="decimal"
          value={weight}
          placeholder="—"
          onChange={(e) => setWeight(e.target.value)}
          onBlur={(e) => commit('weight', e.target.value)}
          aria-invalid={invalid.weight}
          className={`${inputCls} pe-9`} />
        
        <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs text-muted" aria-hidden>
          {t('unit.kg')}
        </span>
      </div>
      <div className="relative">
        <input
          aria-label={`${label}, ${t('sets.reps')}`}
          inputMode="numeric"
          value={reps}
          placeholder="—"
          onChange={(e) => setReps(e.target.value)}
          onBlur={(e) => commit('reps', e.target.value)}
          aria-invalid={invalid.reps}
          className={`${inputCls} pe-11`} />
        
        <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs text-muted" aria-hidden>
          {t('sets.repsShort')}
        </span>
      </div>
      <div className="flex">
        <button type="button" className={iconBtn} onClick={() => onMove(-1)} disabled={index === 0} aria-label={t('sets.moveUp', { set: label })}>
          <ChevronUpIcon className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" className={iconBtn} onClick={() => onMove(1)} disabled={index === total - 1} aria-label={t('sets.moveDown', { set: label })}>
          <ChevronDownIcon className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" className={`${iconBtn} hover:!text-danger`} onClick={onRemove} aria-label={t('sets.remove', { set: label })}>
          <XIcon className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </li>);

}