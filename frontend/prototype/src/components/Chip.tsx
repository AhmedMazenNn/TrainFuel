import React from 'react';

interface ChipProps {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

export function Chip({ selected, onClick, children }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-semibold transition-colors duration-150 ${
      selected ? 'border-primary bg-primary text-primary-fg' : 'border-line bg-surface text-muted hover:border-muted/40 hover:text-ink'}`
      }>
      
      {children}
    </button>);

}