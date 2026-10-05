import React from 'react';
import { motion } from 'framer-motion';

interface ProgressBarProps {
  value: number;
  max: number;
  /** Tailwind background class for the fill. */
  color?: string;
  size?: 'sm' | 'md';
}

const EASE = [0.23, 1, 0.32, 1] as const;

/** Decorative — adjacent text always states the same values. Overflow beyond target is striped. */
export function ProgressBar({ value, max, color = 'bg-primary', size = 'sm' }: ProgressBarProps) {
  const height = size === 'md' ? 'h-2' : 'h-1.5';
  if (max > 0 && value > max) {
    const base = max / value * 100;
    return (
      <div aria-hidden className={`relative flex w-full overflow-hidden rounded-full bg-elevated ${height}`}>
        <div className={`h-full ${color}`} style={{ width: `${base}%` }} />
        <div className="bar-stripes h-full flex-1 bg-attention" />
        <div className="absolute inset-y-0 w-0.5 bg-ink" style={{ insetInlineStart: `${base}%` }} />
      </div>);

  }
  const pct = max > 0 ? Math.min(100, value / max * 100) : 0;
  return (
    <div aria-hidden className={`w-full overflow-hidden rounded-full bg-elevated ${height}`}>
      <motion.div
        className={`h-full rounded-full ${color}`}
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.22, ease: EASE }} />
      
    </div>);

}