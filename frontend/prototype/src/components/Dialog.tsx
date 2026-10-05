import React, { useEffect, useId, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { XIcon } from 'lucide-react';
import { usePreferences } from '../contexts/PreferencesContext';
import { useMediaQuery } from '../hooks/useMediaQuery';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Drawer slides from the inline end on desktop; both become bottom sheets on mobile. */
  variant?: 'center' | 'drawer';
  size?: 'md' | 'lg';
}

const FOCUSABLE =
'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const EASE = [0.23, 1, 0.32, 1] as const;

export function Dialog({ open, onClose, title, description, children, footer, variant = 'center', size = 'md' }: DialogProps) {
  const { t, dir } = usePreferences();
  const desktop = useMediaQuery('(min-width: 768px)');
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => {
      const panel = panelRef.current;
      (panel?.querySelector<HTMLElement>('[data-autofocus]') ?? panel?.querySelector<HTMLElement>(FOCUSABLE))?.focus();
    }, 40);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      } else if (e.key === 'Tab' && panelRef.current) {
        const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previous?.focus();
    };
  }, [open]);

  const drawer = variant === 'drawer' && desktop;
  const offset = drawer ? { x: dir === 'rtl' ? -40 : 40, y: 0 } : desktop ? { x: 0, y: 12 } : { x: 0, y: 32 };
  const width = size === 'lg' ? 'md:max-w-2xl' : 'md:max-w-lg';

  return (
    <AnimatePresence>
      {open &&
      <div
        key="dialog"
        className={`fixed inset-0 z-50 flex ${drawer ? 'items-stretch justify-end' : 'items-end justify-center md:items-center md:p-6'}`}>
        
          <motion.div
          className="absolute inset-0 bg-black/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          onClick={onClose}
          aria-hidden />
        
          <motion.div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descId : undefined}
          initial={{ opacity: 0, ...offset }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, ...offset }}
          transition={{ duration: 0.22, ease: EASE }}
          className={`relative flex w-full flex-col border border-line bg-surface shadow-2xl ${
          drawer ? 'h-full max-w-[480px] rounded-s-panel border-e-0' : `max-h-[92vh] rounded-t-panel md:rounded-panel ${width}`}`
          }>
          
            {!drawer && <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line md:hidden" />}
            <header className="flex items-start gap-4 px-6 pb-4 pt-5">
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="font-display text-xl font-bold tracking-tight text-ink">
                  {title}
                </h2>
                {description &&
              <p id={descId} className="mt-1 text-sm text-muted">
                    {description}
                  </p>
              }
              </div>
              <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              className="-me-2 grid h-9 w-9 place-items-center rounded-control text-muted transition-colors duration-150 hover:bg-elevated hover:text-ink">
              
                <XIcon className="h-5 w-5" aria-hidden />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto px-6 pb-6">{children}</div>
            {footer && <footer className="border-t border-line bg-surface px-6 py-4">{footer}</footer>}
          </motion.div>
        </div>
      }
    </AnimatePresence>);

}