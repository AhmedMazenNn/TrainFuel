import React from 'react';
import { AlertCircleIcon, ArrowUpIcon, CheckIcon, SlidersHorizontalIcon } from 'lucide-react';
import { CalorieGauge } from './CalorieGauge';
import { Button } from '../Button';
import { Panel } from '../Panel';
import { usePreferences } from '../../contexts/PreferencesContext';

interface CaloriePanelProps {
  consumed: number;
  target: number;
  missingCount: number;
  onEditTargets: () => void;
}

export function CaloriePanel({ consumed, target, missingCount, onEditTargets }: CaloriePanelProps) {
  const { t, num } = usePreferences();
  const diff = Math.round((target - consumed) * 10) / 10;
  const unit = t('unit.kcal');

  return (
    <Panel aria-labelledby="calories-heading" className="relative overflow-hidden md:p-7">
      <div className="flex items-center justify-between gap-3">
        <h2 id="calories-heading" className="flex items-center gap-2 text-sm font-semibold text-muted">
          <span aria-hidden className="h-2 w-2 rounded-full bg-primary" />
          {t('nutrient.calories')}
          {missingCount > 0 &&
          <span className="inline-flex items-center gap-1 rounded-full bg-attention-soft px-2 py-0.5 text-xs font-semibold text-attention">
              <AlertCircleIcon className="h-3 w-3" aria-hidden />
              {t('counter.partial')}
              <span className="sr-only">{t('counter.partialHint', { count: num(missingCount, 0) })}</span>
            </span>
          }
        </h2>
        <Button variant="ghost" size="sm" icon={SlidersHorizontalIcon} onClick={onEditTargets}>
          <span className="hidden sm:inline">{t('today.editTargets')}</span>
          <span className="sr-only sm:hidden">{t('today.editTargets')}</span>
        </Button>
      </div>

      <div className="mt-4 flex items-center gap-4 sm:gap-8">
        <div className="min-w-0 flex-1">
          <p className="tnum flex flex-wrap items-baseline gap-x-2">
            <span className="font-display text-[56px] font-extrabold leading-[0.95] tracking-tight text-ink sm:text-7xl lg:text-[88px]">
              {num(consumed)}
            </span>
            <span className="font-display text-lg font-bold text-muted sm:text-2xl">
              / {num(target)} <span className="text-base font-semibold">{unit}</span>
            </span>
          </p>
          <p className="mt-4 text-[15px]">
            {diff < 0 ?
            <span className="inline-flex items-center gap-1.5 font-semibold text-attention">
                <ArrowUpIcon className="h-4 w-4" aria-hidden />
                {t('counter.over', { value: num(-diff), unit })}
              </span> :
            diff === 0 ?
            <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
                <CheckIcon className="h-4 w-4" aria-hidden />
                {t('counter.atTarget')}
              </span> :

            <span className="text-muted">
                <span className="tnum font-semibold text-ink">{num(diff)}</span> {t('counter.leftSuffix', { unit })}
              </span>
            }
          </p>
        </div>
        <div className="w-32 shrink-0 sm:w-56 lg:w-64">
          <CalorieGauge consumed={consumed} target={target} />
        </div>
      </div>
    </Panel>);

}