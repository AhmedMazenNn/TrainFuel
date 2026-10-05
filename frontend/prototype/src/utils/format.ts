import type { Language } from '../types/preferences';
import { fromDateKey } from './dates';

export function localeFor(lang: Language): string {
  return lang === 'ar' ? 'ar-EG' : 'en-US';
}

export function formatNumber(value: number, lang: Language, maxFractionDigits = 1): string {
  return new Intl.NumberFormat(localeFor(lang), { maximumFractionDigits: maxFractionDigits }).format(value);
}

export function formatDateKey(key: string, lang: Language, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(localeFor(lang), options).format(fromDateKey(key));
}

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';

/** Accepts Arabic-Indic digits and the Arabic decimal separator in numeric input. */
export function normalizeDigits(input: string): string {
  return input.
  replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC.indexOf(d))).
  replace(/[۰-۹]/g, (d) => String(PERSIAN.indexOf(d))).
  replace(/٫/g, '.').
  replace(/[,،٬\s]/g, '');
}

export type ParsedNumber = {kind: 'empty';} | {kind: 'invalid';} | {kind: 'value';value: number;};

export function parseNumberInput(raw: string): ParsedNumber {
  const s = normalizeDigits(raw.trim());
  if (!s) return { kind: 'empty' };
  if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return { kind: 'invalid' };
  const value = Number(s);
  if (!Number.isFinite(value) || value < 0) return { kind: 'invalid' };
  return { kind: 'value', value };
}