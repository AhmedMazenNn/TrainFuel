import React, { useEffect, useMemo, useState } from 'react';
import { ColumnsIcon } from 'lucide-react';
import { Panel } from '../Panel';
import { SegmentedControl } from '../SegmentedControl';
import { SelectField } from '../SelectField';
import { PhotoLightbox } from './PhotoLightbox';
import { PhotoTile } from './PhotoTile';
import { usePreferences } from '../../contexts/PreferencesContext';
import { useProgress } from '../../contexts/ProgressContext';
import { shiftDateKey } from '../../utils/dates';
import { PHOTO_LABEL_KEY } from '../../utils/photos';
import type { ProgressPhoto } from '../../types/progress';

type Side = 'a' | 'b';

export function PhotoCompare() {
  const { t, date, num } = usePreferences();
  const { photos, weights, photosForWeek } = useProgress();
  const weeks = useMemo(
    () => [...new Set(photos.filter((p) => p.status !== 'conflict').map((p) => p.weekStart))].sort((a, b) => a < b ? 1 : -1),
    [photos]
  );
  const [weekA, setWeekA] = useState(weeks[weeks.length - 1] ?? '');
  const [weekB, setWeekB] = useState(weeks[0] ?? '');
  const [side, setSide] = useState<Side>('a');
  const [pairing, setPairing] = useState<Record<string, string>>({});
  const [zoomed, setZoomed] = useState<ProgressPhoto | null>(null);

  useEffect(() => {
    if (!weeks.includes(weekA)) setWeekA(weeks[weeks.length - 1] ?? '');
    if (!weeks.includes(weekB)) setWeekB(weeks[0] ?? '');
  }, [weeks, weekA, weekB]);
  useEffect(() => setPairing({}), [weekA, weekB]);

  const a = photosForWeek(weekA).filter((p) => p.status !== 'conflict');
  const b = photosForWeek(weekB).filter((p) => p.status !== 'conflict');
  const defaultPair = (p: ProgressPhoto, i: number) => p.label && b.find((x) => x.label === p.label) || b[i] || null;
  const pairFor = (p: ProgressPhoto, i: number) =>
  pairing[p.id] !== undefined ? b.find((x) => x.id === pairing[p.id]) ?? null : defaultPair(p, i);

  const weekLabel = (w: string) => `${date(w, { month: 'short', day: 'numeric' })} – ${date(shiftDateKey(w, 6), { month: 'short', day: 'numeric' })}`;
  const weightsIn = (w: string) => weights.filter((e) => e.date >= w && e.date <= shiftDateKey(w, 6));
  const weekOptions = weeks.map((w) => ({ value: w, label: weekLabel(w) }));
  const photoLabel = (p: ProgressPhoto) => p.label ? t(PHOTO_LABEL_KEY[p.label]) : t('photo.unlabeled');

  if (weeks.length < 2) {
    return (
      <Panel>
        <h2 className="font-display text-xl font-bold text-ink">{t('compare.title')}</h2>
        <p className="mt-2 text-sm text-muted">{t('compare.needTwo')}</p>
      </Panel>);

  }

  const weekHeader = (w: string, which: Side) =>
  <div className="rounded-card bg-elevated p-3">
      <p className="text-xs font-semibold text-muted">{which === 'a' ? t('compare.weekA') : t('compare.weekB')}</p>
      <p className="text-sm font-semibold text-ink">{weekLabel(w)}</p>
      <p className="tnum mt-1 text-xs text-muted">
        {weightsIn(w).length ?
      weightsIn(w).map((e) => `${num(e.weight)} ${t('unit.kg')} · ${date(e.date, { weekday: 'short' })}`).join('  ') :
      t('compare.noWeight')}
      </p>
    </div>;


  return (
    <Panel aria-labelledby="compare-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="compare-heading" className="flex items-center gap-2 font-display text-xl font-bold text-ink">
          <ColumnsIcon className="h-5 w-5 text-primary" aria-hidden />
          {t('compare.title')}
        </h2>
        <p className="text-xs text-muted">{t('compare.noAnalysis')}</p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <SelectField id="compare-a" label={t('compare.weekA')} value={weekA} onChange={setWeekA} options={weekOptions} />
        <SelectField id="compare-b" label={t('compare.weekB')} value={weekB} onChange={setWeekB} options={weekOptions} />
      </div>

      <div className="mt-4 md:hidden">
        <SegmentedControl<Side>
          label={t('compare.show')}
          value={side}
          onChange={setSide}
          className="w-full"
          options={[
          { value: 'a', label: t('compare.weekA') },
          { value: 'b', label: t('compare.weekB') }]
          } />
        
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className={side === 'a' ? '' : 'hidden md:block'}>{weekHeader(weekA, 'a')}</div>
        <div className={side === 'b' ? '' : 'hidden md:block'}>{weekHeader(weekB, 'b')}</div>
      </div>

      {a.length === 0 ?
      <p className="mt-4 text-sm text-muted">{t('compare.emptyA')}</p> :

      <ul className="mt-4 space-y-4">
          {a.map((p, i) => {
          const pair = pairFor(p, i);
          return (
            <li key={p.id} className="rounded-card border border-line p-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className={side === 'a' ? '' : 'hidden md:block'}>
                    <PhotoTile photo={p} onZoom={() => setZoomed(p)} compact />
                  </div>
                  <div className={side === 'b' ? '' : 'hidden md:block'}>
                    {pair ?
                  <PhotoTile photo={pair} onZoom={() => setZoomed(pair)} compact /> :

                  <div className="grid aspect-[3/4] place-items-center rounded-card border border-dashed border-line p-4 text-center text-xs text-muted">
                        {t('compare.noPair')}
                      </div>
                  }
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted">
                    <span className="font-semibold text-ink">{photoLabel(p)}</span> · {date(p.captureDate, { month: 'short', day: 'numeric' })}
                    {pair && ` → ${photoLabel(pair)} · ${date(pair.captureDate, { month: 'short', day: 'numeric' })}`}
                  </p>
                  <SelectField
                  id={`pair-${p.id}`}
                  label={t('compare.pairWith')}
                  hideLabel
                  className="w-48"
                  value={pair?.id ?? ''}
                  onChange={(v) => setPairing((s) => ({ ...s, [p.id]: v }))}
                  options={[
                  { value: '', label: t('compare.noPairOption') },
                  ...b.map((x, j) => ({ value: x.id, label: `${t('compare.pairWith')}: ${photoLabel(x)} ${num(j + 1, 0)}` }))]
                  } />
                
                </div>
              </li>);

        })}
        </ul>
      }
      <PhotoLightbox photo={zoomed} onClose={() => setZoomed(null)} />
    </Panel>);

}