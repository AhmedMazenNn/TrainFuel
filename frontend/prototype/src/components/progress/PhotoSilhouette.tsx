import React from 'react';
import type { PhotoLabel } from '../../types/progress';

const FRONT =
'M60 48 C44 48 34 54 32 64 L28 104 C28 109 34 109 35 104 L40 76 L42 112 L40 154 L54 154 L58 116 L62 116 L66 154 L80 154 L78 112 L80 76 L85 104 C86 109 92 109 92 104 L88 64 C86 54 76 48 60 48 Z';
const SIDE = 'M58 48 C50 48 46 55 47 63 L49 110 L51 154 L64 154 L66 112 L70 64 C70 54 66 48 58 48 Z';

/** Neutral demo placeholder — never a real body image. */
export function PhotoSilhouette({ label }: {label: PhotoLabel | null;}) {
  return (
    <svg viewBox="0 0 120 160" className="h-full w-full" aria-hidden preserveAspectRatio="xMidYMid meet">
      <rect width="120" height="160" className="fill-elevated" />
      {[40, 80, 120].map((y) =>
      <line key={y} x1="0" x2="120" y1={y} y2={y} className="stroke-line" strokeWidth="0.5" />
      )}
      {label === 'other' ?
      <g className="fill-muted/25">
          <circle cx="60" cy="72" r="22" />
          <rect x="38" y="100" width="44" height="40" rx="10" />
        </g> :

      <g className="fill-muted/25">
          <circle cx={label === 'side' ? 58 : 60} cy="32" r="13" />
          <path d={label === 'side' ? SIDE : FRONT} />
          {label === 'side' && <path d="M55 62 L52 104 C52 108 58 108 58 104 L62 66 Z" className="fill-muted/35" />}
        </g>
      }
    </svg>);

}