import React from 'react';

interface SwitchProps {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

export function Switch({ id, checked, onChange, label, description, disabled }: SwitchProps) {
  return (
    <div className={`flex items-start justify-between gap-4 ${disabled ? 'opacity-50' : ''}`}>
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        {description &&
        <p id={`${id}-desc`} className="mt-0.5 text-[13px] text-muted">
            {description}
          </p>
        }
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-desc` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-150 ${
        checked ? 'border-primary bg-primary' : 'border-line bg-elevated'}`
        }>
        
        <span
          aria-hidden
          className={`inline-block h-5 w-5 rounded-full shadow transition-transform duration-150 ease-out ${
          checked ? 'translate-x-[22px] bg-primary-fg rtl:-translate-x-[22px]' : 'translate-x-[3px] bg-muted rtl:-translate-x-[3px]'}`
          } />
        
      </button>
    </div>);

}