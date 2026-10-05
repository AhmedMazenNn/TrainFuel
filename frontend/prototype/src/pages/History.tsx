import React from 'react';
import { AlertCircleIcon } from 'lucide-react';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { FoodEntryDialog } from '../components/food/FoodEntryDialog';
import { DayDetail } from '../components/history/DayDetail';
import { MonthCalendar } from '../components/history/MonthCalendar';
import { WeeklySummary } from '../components/history/WeeklySummary';
import { useNutrition } from '../contexts/NutritionContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { useFoodEntryActions } from '../hooks/useFoodEntryActions';
import { shiftDateKey } from '../utils/dates';

export function History() {
  const { status, logs, selectedDate, setSelectedDate, openLog, retryLoad } = useNutrition();
  const { t } = usePreferences();
  const { openAdd, openEdit, handleDelete, dialogProps } = useFoodEntryActions();

  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 pb-28 pt-5 md:px-8 md:pb-14 md:pt-8">
      <PageHeader title={t('history.title')} subtitle={t('history.desc')} />

      {status === 'loading' &&
      <div className="mt-8 grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]" aria-busy="true">
          <span className="sr-only">{t('common.loading')}</span>
          <div className="h-96 rounded-panel bg-surface motion-safe:animate-pulse" />
          <div className="h-96 rounded-panel bg-surface motion-safe:animate-pulse" />
        </div>
      }

      {status === 'error' &&
      <Panel className="mt-8">
          <EmptyState
          icon={AlertCircleIcon}
          tone="danger"
          title={t('today.loadError')}
          body={t('today.loadErrorBody')}
          action={<Button onClick={retryLoad}>{t('common.retry')}</Button>} />
        
        </Panel>
      }

      {status === 'ready' &&
      <>
          <div className="mt-8 grid items-start gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
            <MonthCalendar selected={selectedDate} onSelect={setSelectedDate} logs={logs} />
            <DayDetail
            dateKey={selectedDate}
            log={logs[selectedDate]}
            onStartLog={() => openLog(selectedDate)}
            onAdd={openAdd}
            onEdit={openEdit}
            onDelete={handleDelete} />
          
          </div>
          <WeeklySummary
          selected={selectedDate}
          logs={logs}
          onSelectDay={setSelectedDate}
          onShiftWeek={(n) => setSelectedDate(shiftDateKey(selectedDate, n * 7))} />
        
        </>
      }
      <FoodEntryDialog {...dialogProps} />
    </div>);

}