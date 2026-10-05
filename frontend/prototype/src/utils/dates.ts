import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek } from
'date-fns';

export const toDateKey = (d: Date): string => format(d, 'yyyy-MM-dd');
export const fromDateKey = (key: string): Date => parseISO(key);
export const todayKey = (): string => toDateKey(new Date());

export const shiftDateKey = (key: string, days: number): string => toDateKey(addDays(fromDateKey(key), days));
export const shiftMonthKey = (key: string, months: number): string => toDateKey(addMonths(fromDateKey(key), months));

/** Monday of the week containing the given day (working default: Monday–Sunday). */
export const weekStartKey = (key: string): string => toDateKey(startOfWeek(fromDateKey(key), { weekStartsOn: 1 }));

export function weekKeys(key: string): string[] {
  const start = startOfWeek(fromDateKey(key), { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => toDateKey(addDays(start, i)));
}

export function monthGridKeys(key: string): string[] {
  const month = fromDateKey(key);
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end }).map(toDateKey);
}

export const isSameMonthKey = (a: string, b: string): boolean => a.slice(0, 7) === b.slice(0, 7);
export const monthStartKey = (key: string): string => `${key.slice(0, 7)}-01`;
export const dayOfMonth = (key: string): number => Number(key.slice(8, 10));
export const daysBetween = (a: string, b: string): number => differenceInCalendarDays(fromDateKey(b), fromDateKey(a));