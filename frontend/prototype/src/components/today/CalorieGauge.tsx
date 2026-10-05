import React from 'react';
import { motion } from 'framer-motion';
import { usePreferences } from '../../contexts/PreferencesContext';

interface CalorieGaugeProps {
  consumed: number;
  target: number;
}

const ARC = 'M 16 104 A 84 84 0 0 1 184 104';
const INNER = 'M 34 104 A 66 66 0 0 1 166 104';
const EASE = [0.23, 1, 0.32, 1] as const;

/** Semicircular calorie gauge. Purely visual — the panel states every number in text. */
export function CalorieGauge({ consumed, target }: CalorieGaugeProps) {
  const { dir, num } = usePreferences();
  const ratio = target > 0 ? consumed / target : 0;
  const fill = Math.min(1, ratio);
  const overflow = ratio > 1 ? Math.min(1, ratio - 1) : 0;
  const pct = Math.round(ratio * 100);

  return (
    <div className="relative w-full" aria-hidden>
      <svg viewBox="0 0 200 112" className="w-full overflow-visible">
        <g transform={dir === 'rtl' ? 'translate(200 0) scale(-1 1)' : undefined}>
          {[0.25, 0.5, 0.75].map((p) => {
            const a = Math.PI * (1 - p);
            return (
              <line
                key={p}
                x1={100 + Math.cos(a) * 96}
                y1={104 - Math.sin(a) * 96}
                x2={100 + Math.cos(a) * 101}
                y2={104 - Math.sin(a) * 101}
                className="stroke-line"
                strokeWidth={2}
                strokeLinecap="round" />);


          })}
          <path d={ARC} fill="none" className="stroke-elevated" strokeWidth={16} strokeLinecap="round" />
          <motion.path
            d={ARC}
            fill="none"
            className="stroke-primary"
            strokeWidth={16}
            strokeLinecap="round"
            initial={false}
            animate={{ pathLength: fill, opacity: fill > 0 ? 1 : 0 }}
            transition={{ duration: 0.22, ease: EASE }} />
          
          {overflow > 0 &&
          <motion.path
            d={INNER}
            fill="none"
            className="stroke-attention"
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray="2 5"
            initial={false}
            animate={{ pathLength: overflow }}
            transition={{ duration: 0.22, ease: EASE }} />

          }
        </g>
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <p className={`tnum font-display text-3xl font-extrabold leading-none sm:text-4xl ${ratio > 1 ? 'text-attention' : 'text-ink'}`}>
          {num(pct, 0)}%
        </p>
      </div>
    </div>);

}