import React from 'react';
import { SyncStatusButton } from './shell/SyncStatusButton';

interface PageHeaderProps {
  title: string;
  eyebrow?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}

export function PageHeader({ title, eyebrow, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-sm text-muted">{eyebrow}</div>}
        <h1 className="font-display text-[34px] font-extrabold leading-none tracking-tight text-ink md:text-5xl">{title}</h1>
        {subtitle && <div className="mt-2.5 text-[15px] text-muted">{subtitle}</div>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="hidden md:block">
          <SyncStatusButton />
        </div>
        {actions}
      </div>
    </header>);

}