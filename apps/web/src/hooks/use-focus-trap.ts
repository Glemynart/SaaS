'use client';

import * as React from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Headless focus trap for dialog-contract components (SideSheet, ConfirmDialog).
 * While `active`, cycles Tab/Shift+Tab within the container, focuses the first
 * focusable element on open, and returns focus to the trigger on close.
 */
export function useFocusTrap(active: boolean) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!active) return;

    triggerRef.current = document.activeElement as HTMLElement | null;

    const container = containerRef.current;
    const focusables = container?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    focusables?.[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Tab' || !container) return;

      const nodes = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null,
      );
      if (nodes.length === 0) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      triggerRef.current?.focus();
    };
  }, [active]);

  return containerRef;
}
