import { coreAr, coreEn } from './i18n/core';
import { progressAr, progressEn } from './i18n/progress';
import { trainingAr, trainingEn } from './i18n/training';
import type { Language } from '../types/preferences';

const en = { ...coreEn, ...trainingEn, ...progressEn };

export type TranslationKey = keyof typeof en;

const ar: Record<TranslationKey, string> = { ...coreAr, ...trainingAr, ...progressAr };

export const translations: Record<Language, Record<TranslationKey, string>> = { en, ar };