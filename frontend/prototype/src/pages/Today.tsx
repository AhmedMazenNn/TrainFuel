import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertCircleIcon, CalendarPlusIcon, CalendarXIcon, PlusIcon } from 'lucide-react';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { WeekStrip } from '../components/WeekStrip';
import { FoodEntryDialog } from '../components/food/FoodEntryDialog';
import { FoodLog } from '../components/food/FoodLog';
import { TargetsDialog } from '../components/food/TargetsDialog';
import { CaloriePanel } from '../components/today/CaloriePanel';
import { MacroPanel } from '../components/today/MacroPanel';
import { ProgressShortcut } from '../components/today/ProgressShortcut';
import { TrainingShortcut } from '../components/today/TrainingShortcut';
import { useNutrition } from '../contexts/NutritionContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { useFoodEntryActions } from '../hooks/useFoodEntryActions';
import { todayKey } from '../utils/dates';
import { NUTRIENT_KEYS, NUTRIENT_LABEL_KEY, UNIT_KEY, computeTotals } from '../utils/nutrition';
import type { Targets, TargetScope } from '../types/nutrition';

function greetingKey(): 'today.greetingMorning' | 'today.greetingAfternoon' | 'today.greetingEvening' {
  const h = new Date().getHours();
  return h < 12 ? 'today.greetingMorning' : h < 18 ? 'today.greetingAfternoon' : 'today.greetingEvening';
}

export function Today() {
  const nutrition = useNutrition();
  const { status, logs, defaultTargets, selectedDate, setSelectedDate } = nutrition;
  const { t, date, num, displayName } = usePreferences();
  const { openAdd, openEdit, handleDelete, dialogProps } = useFoodEntryActions();
  const [targetsOpen, setTargetsOpen] = useState(false);

  const today = todayKey();
  const isToday = selectedDate === today;
  const log = logs[selectedDate];
  const targets = log?.targets ?? defaultTargets;
  const summary = useMemo(() => computeTotals(log?.entries ?? []), [log]);
  const sameYear = selectedDate.slice(0, 4) === today.slice(0, 4);
  const fullDate = date(selectedDate, { weekday: 'long', month: 'long', day: 'numeric', year: sameYear ? undefined : 'numeric' });

  const announcement = log ?
  NUTRIENT_KEYS.map((k) =>
  t('counter.announce', {
    label: t(NUTRIENT_LABEL_KEY[k]),
    consumed: num(summary.totals[k]),
    target: num(targets[k]),
    unit: t(UNIT_KEY[k])
  })
  ).join('. ') :
  '';

  const handleStartNewDay = () => {
    const result = nutrition.startNewDay();
    toast(result === 'created' ? t('today.started', { date: date(today, { month: 'short', day: 'numeric' }) }) : t('today.alreadyOpen'));
  };

  const handleSaveTargets = (next: Targets, scope: TargetScope) => {
    nutrition.updateTargets(selectedDate, next, scope);
    setTargetsOpen(false);
    toast.success(t('targets.saved'));
  };

  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 pb-40 pt-5 md:px-8 md:pb-14 md:pt-8">
      <PageHeader
        eyebrow={
        isToday ?
        <span>{t(greetingKey(), { name: displayName || t('header.demoUser') })}</span> :

        <span className="inline-flex rounded-full bg-attention-soft px-2.5 py-0.5 text-xs font-semibold text-attention">
              {selectedDate < today ? t('today.pastDay') : t('today.futureDay')}
            </span>

        }
        title={isToday ? t('today.isToday') : date(selectedDate, { weekday: 'short', month: 'short', day: 'numeric' })}
        subtitle={fullDate}
        actions={
        <>
            {!isToday &&
          <Button variant="secondary" onClick={() => setSelectedDate(today)}>
                {t('today.goToday')}
              </Button>
          }
            <Button variant="secondary" icon={CalendarPlusIcon} onClick={handleStartNewDay}>
              {t('today.startNewDay')}
            </Button>
            <Button size="lg" icon={PlusIcon} onClick={openAdd} disabled={status !== 'ready'} className="hidden md:inline-flex">
              {t('today.addFood')}
            </Button>
          </>
        } />
      

      <div className="mt-6 md:mt-8">
        <WeekStrip selected={selectedDate} onSelect={setSelectedDate} logs={logs} />
      </div>

      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] xl:gap-6">
        <div className="min-w-0 space-y-5">
          {status === 'loading' &&
          <div aria-busy="true" className="space-y-5">
              <span className="sr-only">{t('common.loading')}</span>
              <div className="h-64 rounded-panel bg-surface motion-safe:animate-pulse" />
              <div className="h-36 rounded-panel bg-surface motion-safe:animate-pulse" />
              <div className="h-72 rounded-panel bg-surface motion-safe:animate-pulse" />
            </div>
          }

          {status === 'error' &&
          <Panel>
              <EmptyState
              icon={AlertCircleIcon}
              tone="danger"
              title={t('today.loadError')}
              body={t('today.loadErrorBody')}
              action={<Button onClick={nutrition.retryLoad}>{t('common.retry')}</Button>} />
            
            </Panel>
          }

          {status === 'ready' && !log &&
          <Panel className="border-dashed">
              <EmptyState
              icon={CalendarXIcon}
              title={t('today.noLog.title')}
              body={isToday ? t('today.noLog.todayBody') : t('today.noLog.body')}
              action={
              isToday ?
              <Button icon={CalendarPlusIcon} onClick={handleStartNewDay}>
                      {t('today.startNewDay')}
                    </Button> :

              <>
                      <Button variant="secondary" icon={CalendarPlusIcon} onClick={() => nutrition.openLog(selectedDate)}>
                        {t('today.noLog.action')}
                      </Button>
                      <Button icon={PlusIcon} onClick={openAdd}>
                        {t('today.addFood')}
                      </Button>
                    </>

              } />
            
            </Panel>
          }

          {status === 'ready' && log &&
          <>
              <CaloriePanel
              consumed={summary.totals.calories}
              target={targets.calories}
              missingCount={summary.missing.calories}
              onEditTargets={() => setTargetsOpen(true)} />
            
              <MacroPanel totals={summary.totals} targets={targets} missing={summary.missing} />
              {summary.draftCount > 0 &&
            <div role="note" className="flex items-start gap-3 rounded-card border border-attention/30 bg-attention-soft px-4 py-3 text-sm">
                  <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-attention" aria-hidden />
                  <p className="text-ink">
                    <span className="font-semibold">{t('today.partialTitle')}.</span>{' '}
                    {t('today.partialBody', { count: num(summary.draftCount, 0) })}
                  </p>
                </div>
            }
              <FoodLog entries={log.entries} onAdd={openAdd} onEdit={openEdit} onDelete={handleDelete} />
            </>
          }
        </div>

        <aside aria-label={t('shortcut.label')} className="grid content-start gap-5 md:grid-cols-2 xl:grid-cols-1">
          <TrainingShortcut />
          <ProgressShortcut />
        </aside>
      </div>

      {status === 'ready' &&
      <div className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 md:hidden">
          <Button size="lg" icon={PlusIcon} onClick={openAdd} className="w-full shadow-2xl shadow-black/50">
            {t('today.addFood')}
          </Button>
        </div>
      }

      <FoodEntryDialog {...dialogProps} />
      <TargetsDialog
        open={targetsOpen}
        onClose={() => setTargetsOpen(false)}
        dateKey={selectedDate}
        targets={targets}
        onSave={handleSaveTargets} />
      
    </div>);

}