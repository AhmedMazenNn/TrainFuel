import React from 'react';
import { AlertCircleIcon, ArrowUpIcon } from 'lucide-react';
import { Panel } from '../Panel';
import { ProgressBar } from '../ProgressBar';
import { usePreferences } from '../../contexts/PreferencesContext';
import { MACRO_KEYS, NUTRIENT_COLOR, NUTRIENT_LABEL_KEY } from '../../utils/nutrition';
import type { Targets } from '../../types/nutrition';

interface MacroPanelProps {
  totals: Targets;
  targets: Targets;
  missing: Targets;
}

export function MacroPanel({ totals, targets, missing }: MacroPanelProps) {
  const { t, num } = usePreferences();
  const unit = t('unit.g');

  return (
    <Panel aria-labelledby="macros-heading" padded={false}>
      <h2 id="macros-heading" className="sr-only">
        {t('today.macros')}
      </h2>
      <ul className="grid divide-y divide-line md:grid-cols-3 md:divide-x md:divide-y-0 rtl:md:divide-x-reverse">
        {MACRO_KEYS.map((k) => {
          const consumed = totals[k];
          const target = targets[k];
          const diff = Math.round((target - consumed) * 10) / 10;
          return (
            <li key={k} className="px-5 py-4 md:px-6 md:py-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-[13px] font-semibold text-muted">
                  <span aria-hidden className={`h-2 w-2 rounded-full ${NUTRIENT_COLOR[k].bg}`} />
                  {t(NUTRIENT_LABEL_KEY[k])}
                </h3>
                {missing[k] > 0 &&
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-attention" title={t('counter.partialHint', { count: num(missing[k], 0) })}>
                    <AlertCircleIcon className="h-3 w-3" aria-hidden />
                    {t('counter.partial')}
                    <span className="sr-only">{t('counter.partialHint', { count: num(missing[k], 0) })}</span>
                  </span>
                }
              </div>
              <p className="tnum mt-2 flex items-baseline gap-1.5">
                <span className="font-display text-[28px] font-extrabold leading-none text-ink">{num(consumed)}</span>
                <span className="text-sm font-semibold text-muted">
                  / {num(target)} {unit}
                </span>
              </p>
              <div className="mt-3">
                <ProgressBar value={consumed} max={target} color={NUTRIENT_COLOR[k].bg} />
              </div>
              <p className="mt-2 text-xs">
                {diff < 0 ?
                <span className="inline-flex items-center gap-1 font-semibold text-attention">
                    <ArrowUpIcon className="h-3 w-3" aria-hidden />
                    {t('counter.over', { value: num(-diff), unit })}
                  </span> :

                <span className="text-muted">{diff === 0 ? t('counter.atTarget') : t('counter.left', { value: num(diff), unit })}</span>
                }
              </p>
            </li>);

        })}
      </ul>
    </Panel>);

}