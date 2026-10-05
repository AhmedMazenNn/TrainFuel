import React, { useState } from 'react';
import { toast } from 'sonner';
import { LockIcon, PencilIcon, PlusIcon, ScaleIcon, Trash2Icon } from 'lucide-react';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { PhotoCompare } from '../components/progress/PhotoCompare';
import { PhotoWeekGallery } from '../components/progress/PhotoWeekGallery';
import { WeightChart } from '../components/progress/WeightChart';
import { WeightEntryDialog } from '../components/progress/WeightEntryDialog';
import { usePreferences } from '../contexts/PreferencesContext';
import { useProgress } from '../contexts/ProgressContext';
import type { WeightEntry } from '../types/progress';

export function Progress() {
  const { t, num, date } = usePreferences();
  const progress = useProgress();
  const { weights, status } = progress;
  const [editor, setEditor] = useState<{open: boolean;entry: WeightEntry | null;}>({ open: false, entry: null });

  const latest = weights[weights.length - 1];
  const first = weights[0];
  const change = latest && first ? Math.round((latest.weight - first.weight) * 10) / 10 : 0;
  const low = weights.length ? Math.min(...weights.map((w) => w.weight)) : 0;
  const high = weights.length ? Math.max(...weights.map((w) => w.weight)) : 0;

  const save = (input: Omit<WeightEntry, 'id'>) => {
    if (editor.entry) progress.updateWeight(editor.entry.id, input);else
    progress.addWeight(input);
    toast.success(editor.entry ? t('entry.updated') : t('progress.weightAdded'));
    setEditor((e) => ({ ...e, open: false }));
  };

  const remove = (entry: WeightEntry) => {
    const removed = progress.deleteWeight(entry.id);
    if (removed) toast(t('progress.weightDeleted'), { action: { label: t('entry.undo'), onClick: () => progress.restoreWeight(removed) } });
  };

  const stats = [
  { label: t('progress.latest'), value: latest ? num(latest.weight) : '—' },
  { label: t('progress.change'), value: latest ? `${change > 0 ? '+' : change < 0 ? '−' : ''}${num(Math.abs(change))}` : '—' },
  { label: t('progress.lowest'), value: weights.length ? num(low) : '—' },
  { label: t('progress.highest'), value: weights.length ? num(high) : '—' }];


  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 pb-28 pt-5 md:px-8 md:pb-14 md:pt-8">
      <PageHeader
        title={t('nav.progress')}
        subtitle={
        <span className="inline-flex items-center gap-1.5">
            <LockIcon className="h-3.5 w-3.5 text-primary" aria-hidden />
            {t('progress.privateLine')}
          </span>
        }
        actions={
        <Button size="lg" icon={PlusIcon} onClick={() => setEditor({ open: true, entry: null })}>
            {t('progress.addWeight')}
          </Button>
        } />
      

      {status === 'loading' ?
      <div className="mt-8 h-96 rounded-panel bg-surface motion-safe:animate-pulse" aria-busy="true" /> :

      <div className="mt-8 space-y-6">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
            <Panel aria-labelledby="weight-heading" className="min-w-0">
              <h2 id="weight-heading" className="font-display text-xl font-bold text-ink">
                {t('progress.weightHistory')}
              </h2>
              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
                {stats.map((s, i) =>
              <div key={s.label}>
                    <dt className="text-xs font-semibold text-muted">{s.label}</dt>
                    <dd className={`tnum font-display font-extrabold leading-tight text-ink ${i === 0 ? 'text-4xl' : 'text-2xl'}`}>
                      {s.value}
                      <span className="ms-1 text-sm font-semibold text-muted">{t('unit.kg')}</span>
                    </dd>
                  </div>
              )}
              </dl>
              <div className="mt-6">
                {weights.length >= 2 ?
              <WeightChart entries={weights} /> :

              <EmptyState compact icon={ScaleIcon} title={t('progress.noWeights')} body={t('progress.noWeightsBody')} />
              }
              </div>
              {first && latest && first !== latest &&
            <p className="mt-3 text-xs text-muted">
                  {t('progress.rangeNote', {
                start: date(first.date, { month: 'short', day: 'numeric' }),
                end: date(latest.date, { month: 'short', day: 'numeric' }),
                count: num(weights.length, 0)
              })}
                </p>
            }
            </Panel>

            <Panel aria-labelledby="entries-heading" className="min-w-0">
              <h2 id="entries-heading" className="font-display text-lg font-bold text-ink">
                {t('progress.entries')}
              </h2>
              <ul className="mt-3 max-h-[420px] divide-y divide-line overflow-y-auto">
                {[...weights].reverse().map((w) =>
              <li key={w.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="tnum text-sm font-semibold text-ink">
                        {num(w.weight)} {t('unit.kg')}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {date(w.date, { weekday: 'short', month: 'short', day: 'numeric' })}
                        {w.note && ` · ${w.note}`}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon-sm" icon={PencilIcon} onClick={() => setEditor({ open: true, entry: w })} aria-label={t('progress.editWeight')} />
                    <Button variant="ghost" size="icon-sm" icon={Trash2Icon} onClick={() => remove(w)} aria-label={t('progress.deleteWeight')} className="hover:!bg-danger-soft hover:!text-danger" />
                  </li>
              )}
              </ul>
            </Panel>
          </div>

          <PhotoWeekGallery />
          <PhotoCompare />
        </div>
      }

      <WeightEntryDialog open={editor.open} onClose={() => setEditor((e) => ({ ...e, open: false }))} entry={editor.entry} onSave={save} />
    </div>);

}