import React from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { fieldClass } from './TextField';

interface SelectFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: {value: string;label: string;disabled?: boolean;}[];
  hint?: string;
  hideLabel?: boolean;
  className?: string;
}

export function SelectField({ id, label, value, onChange, options, hint, hideLabel, className = '' }: SelectFieldProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className={`mb-1.5 block text-[13px] font-medium text-ink ${hideLabel ? 'sr-only' : ''}`}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className={`${fieldClass()} h-10 appearance-none pe-9`}>
          
          {options.map((o) =>
          <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          )}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
      </div>
      {hint &&
      <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      }
    </div>);

}