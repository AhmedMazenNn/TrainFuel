import React from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { usePreferences } from '../../contexts/PreferencesContext';
import type { WeightEntry } from '../../types/progress';

export function WeightChart({ entries }: {entries: WeightEntry[];}) {
  const { t, num, date, dir } = usePreferences();
  const data = entries.map((e) => ({ date: e.date, weight: e.weight }));
  const values = entries.map((e) => e.weight);
  const min = Math.floor(Math.min(...values) - 1);
  const max = Math.ceil(Math.max(...values) + 1);

  return (
    <div className="h-64 w-full md:h-80" role="img" aria-label={t('progress.chartLabel')}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgb(var(--line))" vertical={false} />
          <XAxis
            dataKey="date"
            reversed={dir === 'rtl'}
            tickFormatter={(v: string) => date(v, { month: 'short', day: 'numeric' })}
            tick={{ fill: 'rgb(var(--muted))', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            minTickGap={24} />
          
          <YAxis
            domain={[min, max]}
            orientation={dir === 'rtl' ? 'right' : 'left'}
            tickFormatter={(v: number) => num(v, 0)}
            tick={{ fill: 'rgb(var(--muted))', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={36} />
          
          <Tooltip
            cursor={{ stroke: 'rgb(var(--muted))', strokeDasharray: '3 3' }}
            contentStyle={{
              background: 'rgb(var(--elevated))',
              border: '1px solid rgb(var(--line))',
              borderRadius: 12,
              color: 'rgb(var(--ink))'
            }}
            labelFormatter={(v: string) => date(v, { dateStyle: 'medium' })}
            formatter={(v) => [`${num(Number(v))} ${t('unit.kg')}`, t('progress.weight')]} />
          
          <Line
            type="monotone"
            dataKey="weight"
            stroke="rgb(var(--primary))"
            strokeWidth={2.5}
            dot={{ r: 3.5, fill: 'rgb(var(--surface))', stroke: 'rgb(var(--primary))', strokeWidth: 2 }}
            activeDot={{ r: 5.5, fill: 'rgb(var(--primary))' }}
            isAnimationActive={false} />
          
        </LineChart>
      </ResponsiveContainer>
    </div>);

}