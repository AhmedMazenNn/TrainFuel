import React from 'react';
import { Toaster } from 'sonner';
import { usePreferences } from '../../contexts/PreferencesContext';

export function AppToaster() {
  const { dir, resolvedTheme } = usePreferences();
  return (
    <Toaster
      position="bottom-center"
      dir={dir}
      theme={resolvedTheme}
      mobileOffset={{ bottom: 148 }}
      duration={5000}
      style={
      {
        '--normal-bg': 'rgb(var(--elevated))',
        '--normal-text': 'rgb(var(--ink))',
        '--normal-border': 'rgb(var(--line))',
        '--border-radius': '14px'
      } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: 'font-sans',
          actionButton: '!bg-primary !text-primary-fg !font-semibold !rounded-[8px]'
        }
      }} />);


}