import {
  ActivityIcon,
  DumbbellIcon,
  FolderOpenIcon,
  HistoryIcon,
  LayoutGridIcon,
  MenuIcon,
  SettingsIcon,
  TrendingUpIcon } from
'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { TranslationKey } from './translations';

export interface NavItem {
  path: string;
  labelKey: TranslationKey;
  icon: LucideIcon;
}

export const sidebarItems: NavItem[] = [
{ path: '/', labelKey: 'nav.today', icon: LayoutGridIcon },
{ path: '/exercises', labelKey: 'nav.exercises', icon: DumbbellIcon },
{ path: '/folders', labelKey: 'nav.folders', icon: FolderOpenIcon },
{ path: '/history', labelKey: 'nav.history', icon: HistoryIcon },
{ path: '/progress', labelKey: 'nav.progress', icon: TrendingUpIcon },
{ path: '/settings', labelKey: 'nav.settings', icon: SettingsIcon }];


export const bottomItems: NavItem[] = [
{ path: '/', labelKey: 'nav.today', icon: LayoutGridIcon },
{ path: '/folders', labelKey: 'nav.workouts', icon: ActivityIcon },
{ path: '/progress', labelKey: 'nav.progress', icon: TrendingUpIcon },
{ path: '/more', labelKey: 'nav.more', icon: MenuIcon }];


export const moreItems: NavItem[] = [
{ path: '/exercises', labelKey: 'nav.exercises', icon: DumbbellIcon },
{ path: '/history', labelKey: 'nav.history', icon: HistoryIcon },
{ path: '/settings', labelKey: 'nav.settings', icon: SettingsIcon }];


export const morePaths = ['/more', '/history', '/exercises', '/settings'];