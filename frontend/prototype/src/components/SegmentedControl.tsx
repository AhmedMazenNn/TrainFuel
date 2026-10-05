import React from 'react';

interface SegmentedControlProps<T extends string> {
  label: string;
  value: T;
  options: {value: T;label: string;}[];
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({ label, value, options, onChange, className = '' }: SegmentedControlProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={`inline-flex rounded-control border border-line bg-canvas p-1 ${className}`}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`h-8 flex-1 whitespace-nowrap rounded-[9px] px-3 text-[13px] font-semibold transition-colors duration-150 ${
            active ? 'bg-primary text-primary-fg' : 'text-muted hover:text-ink'}`
            }>
            
            {o.label}
          </button>);

      })}
    </div>);

}