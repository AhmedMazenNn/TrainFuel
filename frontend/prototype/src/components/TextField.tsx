import React from 'react';

interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
  suffix?: string;
  badge?: React.ReactNode;
  optionalLabel?: string;
  multiline?: boolean;
  hideLabel?: boolean;
  /** Small colored dot next to the label (e.g. macro color). */
  accent?: string;
}

export const fieldClass = (error?: boolean) =>
`w-full rounded-control border bg-canvas px-3 text-[15px] text-ink placeholder:text-muted/60 transition-[border-color,background-color] duration-150 hover:border-muted/40 focus:border-primary focus:outline-none focus-visible:outline-none ${
error ? 'border-danger' : 'border-line'}`;


export function TextField({
  id,
  label,
  value,
  onChange,
  hint,
  error,
  suffix,
  badge,
  optionalLabel,
  multiline,
  hideLabel,
  accent,
  className = '',
  ...rest
}: TextFieldProps) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={className}>
      <div className={`mb-1.5 flex items-center justify-between gap-2 ${hideLabel ? 'sr-only' : ''}`}>
        <label htmlFor={id} className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
          {accent && <span aria-hidden className={`h-2 w-2 rounded-full ${accent}`} />}
          {label}
        </label>
        {badge ?? (optionalLabel && <span className="text-xs text-muted">{optionalLabel}</span>)}
      </div>
      <div className="relative">
        {multiline ?
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          rows={2}
          className={`${fieldClass(Boolean(error))} resize-y py-2.5`} /> :


        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={`${fieldClass(Boolean(error))} tnum h-10 ${suffix ? 'pe-12' : ''}`}
          {...rest} />

        }
        {suffix &&
        <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-[13px] text-muted" aria-hidden>
            {suffix}
          </span>
        }
      </div>
      {hint && !error &&
      <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      }
      {error &&
      <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      }
    </div>);

}