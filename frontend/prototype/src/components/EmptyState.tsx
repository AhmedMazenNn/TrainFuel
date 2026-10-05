import React from "react";
import { BoxIcon } from "lucide-react";
interface EmptyStateProps {
  icon: BoxIcon;
  title: string;
  body: string;
  action?: React.ReactNode;
  tone?: 'default' | 'danger';
  compact?: boolean;
}
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  tone = 'default',
  compact
}: EmptyStateProps) {
  return <div className={`flex flex-col items-center px-6 text-center ${compact ? 'py-8' : 'py-14'}`}>
      <div className={`grid h-14 w-14 place-items-center rounded-card ${tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-elevated text-primary'}`}>
        <Icon className="h-6 w-6" strokeWidth={2} aria-hidden />
      </div>
      <h3 className="mt-4 font-display text-lg font-bold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>;
}